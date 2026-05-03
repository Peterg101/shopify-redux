"""Download and prepare CadQuery training datasets.

Downloads from HuggingFace, filters for quality, formats as training JSONL.
Supports 4 dataset combinations for A/B testing training runs.

Usage:
    python download_data.py --preset A              # Text-to-CadQuery only (170K, ~8-12hrs)
    python download_data.py --preset B              # + prompt2CAD (~300K, ~16hrs)
    python download_data.py --preset C              # + CAD-Recode (~500K, ~20hrs)
    python download_data.py --preset D              # All combined (~1M+, ~30hrs)
    python download_data.py --datasets t2cq p2cad   # Custom combo
    python download_data.py --preset A --max-samples 50000  # Quick test run
"""
import argparse
import json
import os
import random
import logging
import hashlib

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)

# Dataset registry
DATASETS = {
    "t2cq": {
        "name": "Text-to-CadQuery",
        "hf_ids": ["ricemonster/text-to-cadquery", "ricemonster/cadquery-dataset"],
        "fields": {"prompt": ["prompt", "text", "description", "input"],
                   "code": ["cadquery_code", "code", "output", "completion"]},
    },
    "p2cad": {
        "name": "prompt2CAD",
        "hf_ids": ["gilfoyle19/prompt2CAD"],
        "fields": {"prompt": ["prompt", "text", "description", "instruction", "input"],
                   "code": ["code", "cadquery_code", "output", "completion"]},
    },
    "cadrecode": {
        "name": "CAD-Recode",
        "hf_ids": ["filapro/cad-recode-v1.5", "filapro/cad-recode"],
        "fields": {"prompt": ["text", "description", "caption", "prompt"],
                   "code": ["code", "cadquery_code", "python", "script", "output"]},
    },
}

PRESETS = {
    "V": ["vision"],  # Vision model — image → CadQuery (separate training script)
    "A": ["t2cq"],
    "B": ["t2cq", "p2cad"],
    "C": ["t2cq", "cadrecode"],
    "D": ["t2cq", "p2cad", "cadrecode"],
}


def download_dataset(key):
    """Download a single dataset from HuggingFace. Tries multiple IDs."""
    from datasets import load_dataset

    info = DATASETS[key]
    for hf_id in info["hf_ids"]:
        try:
            logger.info(f"Trying {hf_id}...")
            ds = load_dataset(hf_id, split="train")
            logger.info(f"  ✓ Loaded {len(ds)} examples from {hf_id}")
            return ds, info
        except Exception as e:
            logger.warning(f"  ✗ {hf_id}: {e}")

    logger.error(f"Could not load {info['name']} from any source")
    return None, info


def extract_fields(item, field_map):
    """Extract prompt and code from a dataset item, trying multiple field names."""
    prompt = None
    code = None

    for field in field_map["prompt"]:
        val = item.get(field)
        if val and isinstance(val, str) and len(val.strip()) > 3:
            prompt = val.strip()
            break

    for field in field_map["code"]:
        val = item.get(field)
        if val and isinstance(val, str) and len(val.strip()) > 10:
            code = val.strip()
            break

    return prompt, code


def is_valid_cadquery(code):
    """Basic quality filter for CadQuery code."""
    if not code or len(code) < 20:
        return False
    # Must reference CadQuery somehow
    cq_markers = ["cadquery", "cq.Workplane", "cq.Assembly", "import cq"]
    if not any(m in code for m in cq_markers):
        return False
    # Must assign to result or at least create geometry
    if "result" not in code and "show_object" not in code and "Workplane" not in code:
        return False
    return True


def clean_code(code):
    """Clean up code: remove show_object, ensure result assignment."""
    lines = code.split('\n')
    cleaned = []
    for line in lines:
        # Remove display/export calls
        stripped = line.strip()
        if stripped.startswith("show_object("):
            continue
        if stripped.startswith("show("):
            continue
        if "exporters.export" in stripped:
            continue
        if "cq.exporters" in stripped:
            continue
        cleaned.append(line)

    result = '\n'.join(cleaned).strip()

    # If code uses show_object(xxx), the variable before it is the result
    # Try to ensure `result` is assigned
    if "result" not in result and "show_object" in code:
        # Find the last variable assignment
        for line in reversed(lines):
            stripped = line.strip()
            if stripped.startswith("show_object("):
                var = stripped[len("show_object("):].rstrip(")")
                if var and var.isidentifier():
                    result += f"\nresult = {var}"
                break

    return result


def deduplicate(examples):
    """Remove duplicate examples by code hash."""
    seen = set()
    unique = []
    for ex in examples:
        code_hash = hashlib.md5(ex["output"].encode()).hexdigest()
        if code_hash not in seen:
            seen.add(code_hash)
            unique.append(ex)
    removed = len(examples) - len(unique)
    if removed > 0:
        logger.info(f"  Removed {removed} duplicates")
    return unique


def process_dataset(ds, info):
    """Extract, filter, and clean examples from a downloaded dataset."""
    examples = []
    skipped = 0

    for item in ds:
        prompt, code = extract_fields(item, info["fields"])

        if not prompt or not code:
            skipped += 1
            continue

        if not is_valid_cadquery(code):
            skipped += 1
            continue

        code = clean_code(code)
        if len(code) < 20:
            skipped += 1
            continue

        examples.append({
            "instruction": prompt,
            "output": code,
            "source": info["name"],
        })

    logger.info(f"  {info['name']}: {len(examples)} valid, {skipped} skipped")
    return examples


def format_for_training(examples):
    """Format as Qwen chat-style training data."""
    formatted = []
    for ex in examples:
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


def save_splits(formatted, output_dir, eval_ratio=0.05):
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

    # Stats file for reference
    stats = {
        "total": len(formatted),
        "train": len(train_data),
        "eval": len(eval_data),
        "sources": {},
    }
    for item in formatted:
        src = item["messages"][1]["content"][:50]  # rough source tracking
        # Actually track by looking at the data before formatting
    stats_path = os.path.join(output_dir, "stats.json")
    with open(stats_path, "w") as f:
        json.dump({"total": len(formatted), "train": len(train_data), "eval": len(eval_data)}, f, indent=2)

    return train_path, eval_path


def main():
    parser = argparse.ArgumentParser(description="Download and prepare CadQuery training data")
    parser.add_argument("--preset", choices=["A", "B", "C", "D"],
                        help="Dataset preset: A=t2cq(170K), B=+p2cad(300K), C=+cadrecode(500K), D=all(1M+)")
    parser.add_argument("--datasets", nargs="+", choices=list(DATASETS.keys()),
                        help="Custom dataset combo (e.g., --datasets t2cq p2cad)")
    parser.add_argument("--max-samples", type=int, default=None,
                        help="Max total training samples")
    parser.add_argument("--output-dir", default="./data",
                        help="Output directory")
    args = parser.parse_args()

    # Determine which datasets to use
    if args.preset:
        dataset_keys = PRESETS[args.preset]
        logger.info(f"Preset {args.preset}: {', '.join(dataset_keys)}")
    elif args.datasets:
        dataset_keys = args.datasets
    else:
        dataset_keys = ["t2cq"]
        logger.info("No preset specified, defaulting to t2cq only (preset A)")

    # Download and process each dataset
    all_examples = []
    for key in dataset_keys:
        logger.info(f"\n{'='*60}")
        logger.info(f"Downloading {DATASETS[key]['name']}...")
        logger.info(f"{'='*60}")

        ds, info = download_dataset(key)
        if ds is None:
            logger.warning(f"Skipping {info['name']} — download failed")
            continue

        examples = process_dataset(ds, info)
        all_examples.extend(examples)

    if not all_examples:
        logger.error("No examples collected! Check dataset availability.")
        return

    # Deduplicate across datasets
    logger.info(f"\nTotal before dedup: {len(all_examples)}")
    all_examples = deduplicate(all_examples)
    logger.info(f"Total after dedup: {len(all_examples)}")

    # Shuffle
    random.seed(42)
    random.shuffle(all_examples)

    # Limit if requested
    if args.max_samples and len(all_examples) > args.max_samples:
        all_examples = all_examples[:args.max_samples]
        logger.info(f"Truncated to {args.max_samples} examples")

    # Source breakdown
    sources = {}
    for ex in all_examples:
        src = ex.get("source", "unknown")
        sources[src] = sources.get(src, 0) + 1
    logger.info(f"\nSource breakdown:")
    for src, count in sorted(sources.items()):
        logger.info(f"  {src}: {count}")

    # Format and save
    formatted = format_for_training(all_examples)

    # Use preset name in output dir if specified
    output_dir = args.output_dir
    if args.preset:
        output_dir = os.path.join(args.output_dir, f"run_{args.preset}")

    save_splits(formatted, output_dir=output_dir)

    logger.info(f"\n{'='*60}")
    logger.info(f"Done! {len(formatted)} examples ready for training.")
    logger.info(f"Output: {output_dir}")
    logger.info(f"\nNext step:")
    logger.info(f"  python train.py --data-dir {output_dir}")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
