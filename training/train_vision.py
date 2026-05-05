"""Fine-tune Qwen 2.5 VL 7B on image → CadQuery generation using QLoRA.

This model can SEE sketches and photos and generate CadQuery code directly.
Runs on a single A100 40GB GPU. Takes ~8-12 hours on 147K examples.

Usage:
    python train_vision.py
    python train_vision.py --epochs 2 --batch-size 1
    python train_vision.py --base-model Qwen/Qwen2.5-VL-3B  # smaller, faster
"""
import argparse
import json
import os
import logging

import torch
from datasets import load_dataset, Dataset
from transformers import (
    AutoModelForVision2Seq,
    AutoProcessor,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)


def download_vision_dataset(max_samples=None):
    """Load image-CadQuery pairs from GenCAD-Code (same dataset as text model, already cached)."""
    logger.info("Loading CADCODER/GenCAD-Code (image + cadquery columns)...")

    ds = load_dataset("CADCODER/GenCAD-Code", split="train")
    logger.info(f"Loaded {len(ds)} examples")
    logger.info(f"Columns: {ds.column_names}")

    if max_samples and len(ds) > max_samples:
        ds = ds.shuffle(seed=42).select(range(max_samples))
        logger.info(f"Truncated to {max_samples} examples")

    return ds


def prepare_vision_data(ds):
    """Filter image-code pairs. Returns list of valid indices + cleaned codes.

    Stores indices into the dataset rather than copying PIL images into a list,
    to avoid loading 147K images into memory at once.
    """
    from tqdm import tqdm
    import re

    valid_indices = []
    valid_codes = []
    skipped = 0
    total = len(ds)

    logger.info(f"Filtering {total} examples...")

    # Process in batches using the dataset's column access (much faster than row-by-row)
    codes = ds["cadquery"]

    remove_pattern = re.compile(r"^\s*(show_object\(|show\(|cq\.exporters|exporters\.export).*$", re.MULTILINE)

    for i in tqdm(range(total), desc="Filtering"):
        code = codes[i] if codes[i] else ""

        if len(code) < 20:
            skipped += 1
            continue

        if "cadquery" not in code and "cq.Workplane" not in code and "cq." not in code:
            skipped += 1
            continue

        # Clean code
        code = remove_pattern.sub("", code).strip()
        if len(code) < 20:
            skipped += 1
            continue

        valid_indices.append(i)
        valid_codes.append(code)

    logger.info(f"Valid: {len(valid_indices)}, Skipped: {skipped}")
    return valid_indices, valid_codes


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Qwen VL on image → CadQuery")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-VL-7B-Instruct",
                        help="Base vision-language model")
    parser.add_argument("--output-dir", default="./output/fitd-cadquery-vision-7b",
                        help="Output directory")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=1,
                        help="Per-device batch size (1 for VL models — they're memory hungry)")
    parser.add_argument("--gradient-accumulation", type=int, default=16,
                        help="Gradient accumulation steps")
    parser.add_argument("--learning-rate", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--max-samples", type=int, default=None, help="Max training samples")
    parser.add_argument("--lora-r", type=int, default=64, help="LoRA rank")
    args = parser.parse_args()

    logger.info(f"Base model: {args.base_model}")
    logger.info(f"Output: {args.output_dir}")

    # Download and prepare data
    ds = download_vision_dataset(max_samples=args.max_samples)
    valid_indices, valid_codes = prepare_vision_data(ds)

    if not valid_indices:
        logger.error("No valid examples found!")
        return

    # Split
    split_idx = int(len(valid_indices) * 0.95)
    train_indices = valid_indices[:split_idx]
    train_codes = valid_codes[:split_idx]
    eval_indices = valid_indices[split_idx:]
    eval_codes = valid_codes[split_idx:]
    logger.info(f"Train: {len(train_indices)}, Eval: {len(eval_indices)}")

    # Quantisation config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # Load model
    logger.info(f"Loading {args.base_model} in 4-bit...")
    model = AutoModelForVision2Seq.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        dtype=torch.bfloat16,
    )
    model = prepare_model_for_kbit_training(model)

    # Load processor (handles both text and images)
    processor = AutoProcessor.from_pretrained(args.base_model, trust_remote_code=True)
    if processor.tokenizer.pad_token is None:
        processor.tokenizer.pad_token = processor.tokenizer.eos_token

    # LoRA config — target the vision + language projection layers
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=16,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    model = get_peft_model(model, lora_config)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

    # Prepare training data as formatted conversations
    system_prompt = (
        "You are a CadQuery code generator. Given an image of a 3D part (rendered view, "
        "sketch, or photo), generate complete, executable CadQuery Python code that "
        "produces the part. The code must assign the final shape to a variable called "
        "`result`. Use named variables for all dimensions. Do not include export statements."
    )

    def process_example(example):
        """Process a single example into model inputs."""
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": example["image"]},
                    {"type": "text", "text": "Generate CadQuery code for this part."},
                ],
            },
            {"role": "assistant", "content": example["code"]},
        ]

        # Use the processor's chat template
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
        inputs = processor(
            text=[text],
            images=[example["image"]],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048,
        )
        return inputs

    os.makedirs(args.output_dir, exist_ok=True)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=25,
        eval_strategy="steps",
        eval_steps=250,
        save_strategy="steps",
        save_steps=250,
        save_total_limit=3,
        bf16=True,
        gradient_checkpointing=True,
        report_to="none",
        max_grad_norm=0.3,
        remove_unused_columns=False,
    )

    # Custom dataset — loads images lazily from the HuggingFace dataset
    from torch.utils.data import Dataset as TorchDataset

    class VisionCadQueryDataset(TorchDataset):
        def __init__(self, hf_dataset, indices, codes, processor, system_prompt, max_length=2048):
            self.hf_dataset = hf_dataset
            self.indices = indices
            self.codes = codes
            self.processor = processor
            self.system_prompt = system_prompt
            self.max_length = max_length

        def __len__(self):
            return len(self.indices)

        def __getitem__(self, idx):
            # Load image lazily from the HuggingFace dataset
            ds_idx = self.indices[idx]
            image = self.hf_dataset[ds_idx]["image"]
            code = self.codes[idx]

            messages = [
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": image},
                        {"type": "text", "text": "Generate CadQuery code for this part."},
                    ],
                },
                {"role": "assistant", "content": code},
            ]
            text = self.processor.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=False
            )
            inputs = self.processor(
                text=[text],
                images=[image],
                return_tensors="pt",
                padding="max_length",
                truncation=True,
                max_length=self.max_length,
            )
            # Squeeze batch dimension
            inputs = {k: v.squeeze(0) for k, v in inputs.items()}
            inputs["labels"] = inputs["input_ids"].clone()
            return inputs

    train_dataset = VisionCadQueryDataset(ds, train_indices, train_codes, processor, system_prompt)
    eval_dataset = VisionCadQueryDataset(ds, eval_indices, eval_codes, processor, system_prompt)

    # Train using HuggingFace Trainer
    from transformers import Trainer

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
    )

    logger.info("Starting vision model training...")
    trainer.train()

    # Save
    logger.info(f"Saving LoRA adapter to {args.output_dir}")
    trainer.save_model(args.output_dir)
    processor.save_pretrained(args.output_dir)

    logger.info("Training complete!")
    logger.info(f"Next step: python convert_to_ollama.py --base-model {args.base_model} --adapter-dir {args.output_dir}")


if __name__ == "__main__":
    main()
