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
    AutoModelForCausalLM,
    AutoProcessor,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)


def download_vision_dataset(max_samples=None):
    """Download image-CadQuery pairs from HuggingFace."""
    logger.info("Downloading ThomasTheMaker/cadquery dataset (image → code pairs)...")

    for hf_id in ["ThomasTheMaker/cadquery", "ThomasTheMaker/cadquery-image-pairs"]:
        try:
            ds = load_dataset(hf_id, split="train")
            logger.info(f"Loaded {len(ds)} examples from {hf_id}")
            if max_samples and len(ds) > max_samples:
                ds = ds.shuffle(seed=42).select(range(max_samples))
                logger.info(f"Truncated to {max_samples} examples")
            return ds
        except Exception as e:
            logger.warning(f"Could not load {hf_id}: {e}")

    # Fallback: try sylaera's smaller dataset
    try:
        ds = load_dataset("sylaera/cadquery-image-pairs", split="train")
        logger.info(f"Loaded {len(ds)} examples from sylaera/cadquery-image-pairs")
        return ds
    except Exception as e:
        logger.warning(f"Fallback also failed: {e}")

    raise RuntimeError("Could not download any image-CadQuery dataset")


def prepare_vision_data(ds):
    """Filter and format image-code pairs for vision-language training."""
    valid = []
    skipped = 0

    for item in ds:
        # Extract image and code — field names may vary
        image = item.get("image") or item.get("img") or item.get("screenshot")
        code = (item.get("cadquery_code") or item.get("code") or
                item.get("output") or item.get("completion") or "")

        if image is None or not code or len(code) < 20:
            skipped += 1
            continue

        # Basic CadQuery validation
        if "cadquery" not in code and "cq.Workplane" not in code and "cq." not in code:
            skipped += 1
            continue

        # Clean code
        lines = []
        for line in code.split('\n'):
            stripped = line.strip()
            if stripped.startswith("show_object(") or stripped.startswith("show("):
                continue
            if "exporters.export" in stripped:
                continue
            lines.append(line)
        code = '\n'.join(lines).strip()

        valid.append({"image": image, "code": code})

    logger.info(f"Valid: {len(valid)}, Skipped: {skipped}")
    return valid


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
    examples = prepare_vision_data(ds)

    if not examples:
        logger.error("No valid examples found!")
        return

    # Split
    split_idx = int(len(examples) * 0.95)
    train_examples = examples[:split_idx]
    eval_examples = examples[split_idx:]
    logger.info(f"Train: {len(train_examples)}, Eval: {len(eval_examples)}")

    # Quantisation config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # Load model
    logger.info(f"Loading {args.base_model} in 4-bit...")
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
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

    # Save processed data for the trainer
    os.makedirs(args.output_dir, exist_ok=True)

    # For VL models, we use a custom training loop since SFTTrainer
    # doesn't natively handle image inputs well. Save the data and
    # use a simple training script.
    logger.info("Processing and saving training data...")
    train_jsonl = os.path.join(args.output_dir, "train_vision.jsonl")
    eval_jsonl = os.path.join(args.output_dir, "eval_vision.jsonl")

    with open(train_jsonl, "w") as f:
        for ex in train_examples:
            # Save image as base64 for portability
            import base64
            from io import BytesIO
            buf = BytesIO()
            ex["image"].save(buf, format="PNG")
            img_b64 = base64.b64encode(buf.getvalue()).decode()
            f.write(json.dumps({"image_b64": img_b64, "code": ex["code"]}) + "\n")

    with open(eval_jsonl, "w") as f:
        for ex in eval_examples:
            buf = BytesIO()
            ex["image"].save(buf, format="PNG")
            img_b64 = base64.b64encode(buf.getvalue()).decode()
            f.write(json.dumps({"image_b64": img_b64, "code": ex["code"]}) + "\n")

    logger.info(f"Saved {len(train_examples)} train, {len(eval_examples)} eval to {args.output_dir}")

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

    # Custom data collator for vision inputs
    from torch.utils.data import Dataset as TorchDataset

    class VisionCadQueryDataset(TorchDataset):
        def __init__(self, examples, processor, system_prompt, max_length=2048):
            self.examples = examples
            self.processor = processor
            self.system_prompt = system_prompt
            self.max_length = max_length

        def __len__(self):
            return len(self.examples)

        def __getitem__(self, idx):
            ex = self.examples[idx]
            messages = [
                {"role": "system", "content": self.system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": ex["image"]},
                        {"type": "text", "text": "Generate CadQuery code for this part."},
                    ],
                },
                {"role": "assistant", "content": ex["code"]},
            ]
            text = self.processor.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=False
            )
            inputs = self.processor(
                text=[text],
                images=[ex["image"]],
                return_tensors="pt",
                padding="max_length",
                truncation=True,
                max_length=self.max_length,
            )
            # Squeeze batch dimension
            inputs = {k: v.squeeze(0) for k, v in inputs.items()}
            inputs["labels"] = inputs["input_ids"].clone()
            return inputs

    train_dataset = VisionCadQueryDataset(train_examples, processor, system_prompt)
    eval_dataset = VisionCadQueryDataset(eval_examples, processor, system_prompt)

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
