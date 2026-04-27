"""Download and prepare the Text-to-CadQuery training dataset.

Downloads from HuggingFace, filters for quality, formats as training JSONL.
Output: ./data/train.jsonl, ./data/eval.jsonl

Usage:
    python download_data.py
    python download_data.py --max-samples 50000  # smaller subset for faster training
"""
import argparse
import json
import os
import random
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)


def download_dataset():
    """Download the Text-to-CadQuery dataset from HuggingFace."""
    from datasets import load_dataset

    logger.info("Downloading Text-to-CadQuery dataset from HuggingFace...")

    # Try the main dataset first
    try:
        ds = load_dataset("ricemonster/text-to-cadquery", split="train")
        logger.info(f"Loaded {len(ds)} examples from ricemonster/text-to-cadquery")
        return ds
    except Exception as e:
        logger.warning(f"Could not load ricemonster/text-to-cadquery: {e}")

    # Fallback: try alternative dataset names
    for name in ["ricemonster/cadquery-dataset", "gilfoyle19/prompt2CAD"]:
        try:
            ds = load_dataset(name, split="train")
            logger.info(f"Loaded {len(ds)} examples from {name}")
            return ds
        except Exception as e:
            logger.warning(f"Could not load {name}: {e}")

    raise RuntimeError("Could not download any CadQuery dataset. Check HuggingFace for available datasets.")


def filter_and_format(ds, max_samples=None):
    """Filter for quality and format as instruction-tuning pairs."""
    examples = []
    skipped = 0

    for item in ds:
        # Extract prompt and code — field names vary by dataset
        prompt = item.get("prompt") or item.get("text") or item.get("description") or item.get("input", "")
        code = item.get("cadquery_code") or item.get("code") or item.get("output") or item.get("completion", "")

        if not prompt or not code:
            skipped += 1
            continue

        # Basic quality filters
        if len(code) < 20:
            skipped += 1
            continue
        if "import cadquery" not in code and "import cq" not in code and "cq.Workplane" not in code:
            skipped += 1
            continue
        if len(prompt) < 5:
            skipped += 1
            continue

        # Format as instruction-tuning pair
        examples.append({
            "instruction": prompt.strip(),
            "output": code.strip(),
        })

    logger.info(f"Filtered: {len(examples)} valid, {skipped} skipped")

    # Shuffle
    random.seed(42)
    random.shuffle(examples)

    # Limit if requested
    if max_samples and len(examples) > max_samples:
        examples = examples[:max_samples]
        logger.info(f"Truncated to {max_samples} examples")

    return examples


def format_for_training(examples):
    """Format examples as chat-style training data for Qwen."""
    formatted = []
    for ex in examples:
        # Qwen chat format
        formatted.append({
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a CadQuery code generator. Given a description of a 3D part, "
                        "generate complete, executable CadQuery Python code that produces the part. "
                        "The code must assign the final shape to a variable called `result`. "
                        "Use named variables for all dimensions. Do not include export statements."
                    ),
                },
                {"role": "user", "content": ex["instruction"]},
                {"role": "assistant", "content": ex["output"]},
            ]
        })
    return formatted


def save_splits(formatted, output_dir="./data", eval_ratio=0.05):
    """Save train/eval splits as JSONL."""
    os.makedirs(output_dir, exist_ok=True)

    split_idx = int(len(formatted) * (1 - eval_ratio))
    train_data = formatted[:split_idx]
    eval_data = formatted[split_idx:]

    train_path = os.path.join(output_dir, "train.jsonl")
    eval_path = os.path.join(output_dir, "eval.jsonl")

    with open(train_path, "w") as f:
        for item in train_data:
            f.write(json.dumps(item) + "\n")

    with open(eval_path, "w") as f:
        for item in eval_data:
            f.write(json.dumps(item) + "\n")

    logger.info(f"Saved {len(train_data)} training examples to {train_path}")
    logger.info(f"Saved {len(eval_data)} evaluation examples to {eval_path}")

    # Also save raw instruction/output format for reference
    raw_path = os.path.join(output_dir, "raw_pairs.jsonl")
    with open(raw_path, "w") as f:
        for item in formatted:
            msgs = item["messages"]
            f.write(json.dumps({
                "prompt": msgs[1]["content"],
                "code": msgs[2]["content"],
            }) + "\n")
    logger.info(f"Saved raw pairs to {raw_path}")


def main():
    parser = argparse.ArgumentParser(description="Download and prepare CadQuery training data")
    parser.add_argument("--max-samples", type=int, default=None, help="Max training samples (default: all)")
    parser.add_argument("--output-dir", default="./data", help="Output directory")
    args = parser.parse_args()

    ds = download_dataset()
    examples = filter_and_format(ds, max_samples=args.max_samples)
    formatted = format_for_training(examples)
    save_splits(formatted, output_dir=args.output_dir)

    logger.info("Done! Ready for training.")
    logger.info(f"Next step: python train.py --data-dir {args.output_dir}")


if __name__ == "__main__":
    main()
