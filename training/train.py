"""Fine-tune Qwen 2.5 7B on CadQuery generation using QLoRA.

Runs on a single A100 40GB GPU. Takes ~8-12 hours on 170K examples.

Usage:
    python train.py
    python train.py --epochs 2 --batch-size 4
    python train.py --base-model Qwen/Qwen2.5-3B  # smaller, faster (~4hrs)
"""
import argparse
import json
import os
import logging

import torch
from datasets import Dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)


def load_data(data_dir="./data"):
    """Load training data from JSONL files."""
    train_path = os.path.join(data_dir, "train.jsonl")
    eval_path = os.path.join(data_dir, "eval.jsonl")

    def load_jsonl(path):
        items = []
        with open(path) as f:
            for line in f:
                items.append(json.loads(line.strip()))
        return items

    train_data = load_jsonl(train_path)
    eval_data = load_jsonl(eval_path)

    logger.info(f"Loaded {len(train_data)} train, {len(eval_data)} eval examples")
    return Dataset.from_list(train_data), Dataset.from_list(eval_data)


def format_chat(example):
    """Format a single example as a chat string for the tokenizer."""
    messages = example["messages"]
    # Build chat string manually (works with any model)
    parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            parts.append(f"<|system|>\n{content}")
        elif role == "user":
            parts.append(f"<|user|>\n{content}")
        elif role == "assistant":
            parts.append(f"<|assistant|>\n{content}")
    return "\n".join(parts)


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Qwen on CadQuery")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B", help="Base model from HuggingFace")
    parser.add_argument("--data-dir", default="./data", help="Training data directory")
    parser.add_argument("--output-dir", default="./output/fitd-cadquery-7b", help="Output directory")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=2, help="Per-device batch size")
    parser.add_argument("--gradient-accumulation", type=int, default=8, help="Gradient accumulation steps")
    parser.add_argument("--learning-rate", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--max-seq-length", type=int, default=2048, help="Max sequence length")
    parser.add_argument("--lora-r", type=int, default=64, help="LoRA rank")
    parser.add_argument("--lora-alpha", type=int, default=16, help="LoRA alpha")
    args = parser.parse_args()

    logger.info(f"Base model: {args.base_model}")
    logger.info(f"Output: {args.output_dir}")
    logger.info(f"Epochs: {args.epochs}, Batch: {args.batch_size}, LR: {args.learning_rate}")

    # Load data
    train_dataset, eval_dataset = load_data(args.data_dir)

    # Quantisation config (4-bit for memory efficiency)
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
    )
    model = prepare_model_for_kbit_training(model)

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # LoRA config
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    model = get_peft_model(model, lora_config)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"Trainable parameters: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

    # Format data for training
    def formatting_func(example):
        return format_chat(example)

    # Training config — try SFTConfig first (trl >= 0.12), fall back to TrainingArguments
    training_kwargs = dict(
        output_dir=args.output_dir,
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=50,
        eval_strategy="steps",
        eval_steps=500,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=3,
        bf16=True,
        gradient_checkpointing=True,
        report_to="none",
        max_grad_norm=0.3,
    )

    try:
        from trl import SFTConfig
        training_args = SFTConfig(
            max_length=args.max_seq_length,
            packing=True,
            **training_kwargs,
        )
        logger.info("Using SFTConfig (trl >= 0.12)")
    except ImportError:
        training_args = TrainingArguments(**training_kwargs)
        logger.info("Using TrainingArguments (older trl)")

    # Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        peft_config=lora_config,
        args=training_args,
        formatting_func=formatting_func,
        processing_class=tokenizer,
    )

    # Train
    logger.info("Starting training...")
    trainer.train()

    # Save LoRA adapter
    logger.info(f"Saving LoRA adapter to {args.output_dir}")
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    logger.info("Training complete!")
    logger.info(f"LoRA adapter saved to: {args.output_dir}")
    logger.info(f"Next step: python convert_to_ollama.py --adapter-dir {args.output_dir}")


if __name__ == "__main__":
    main()
