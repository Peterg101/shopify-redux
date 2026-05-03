"""Download and prepare CadQuery training datasets.

Downloads from HuggingFace, filters for quality, formats as training JSONL.
Uses pandas for efficient vectorised processing instead of row-by-row loops.

Usage:
    python download_data.py --preset A              # GenCAD-Code (~147K)
    python download_data.py --preset B              # + CAD-Recode (~1.1M)
    python download_data.py --preset C              # CAD-Recode only (~1M)
    python download_data.py --preset A --max-samples 50000  # Quick test
"""
import argparse
import hashlib
import json
import os
import random
import logging
import re

import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Dataset registry — verified HuggingFace IDs
# ──────────────────────────────────────────────

DATASETS = {
    "t2cq": {
        "name": "GenCAD-Code",
        "hf_ids": ["CADCODER/GenCAD-Code"],
        "code_col": "cadquery",
        "prompt_col": None,  # prompts are generic — we generate from code
    },
    "cadrecode": {
        "name": "CAD-Recode",
        "hf_ids": ["filapro/cad-recode-v1.5", "filapro/cad-recode"],
        "code_col": None,  # need to discover
        "prompt_col": None,
    },
}

PRESETS = {
    "A": ["t2cq"],
    "B": ["t2cq", "cadrecode"],
    "C": ["cadrecode"],
}

SYSTEM_PROMPT = (
    "You are a CadQuery code generator. Given a description of a 3D part, "
    "generate complete, executable CadQuery Python code that produces the part. "
    "The code must assign the final shape to a variable called `result`. "
    "Use named variables for all dimensions. Do not include export statements."
)

# ──────────────────────────────────────────────
# Download
# ──────────────────────────────────────────────

def download_dataset(key):
    """Download a dataset from HuggingFace, return as pandas DataFrame."""
    from datasets import load_dataset

    info = DATASETS[key]
    for hf_id in info["hf_ids"]:
        try:
            logger.info(f"  Trying {hf_id}...")
            ds = load_dataset(hf_id, split="train")
            logger.info(f"  ✓ Loaded {len(ds)} rows from {hf_id}")
            logger.info(f"  Columns: {ds.column_names}")

            # Convert to pandas — drop image columns (huge, not needed for text training)
            drop_cols = [c for c in ds.column_names if c in ("image", "img", "screenshot", "npy")]
            df = ds.to_pandas()
            if drop_cols:
                df = df.drop(columns=[c for c in drop_cols if c in df.columns])
                logger.info(f"  Dropped image columns: {drop_cols}")

            return df, info
        except Exception as e:
            logger.warning(f"  ✗ {hf_id}: {e}")

    logger.error(f"Could not load {info['name']}")
    return None, info


# ──────────────────────────────────────────────
# Processing (vectorised with pandas)
# ──────────────────────────────────────────────

def find_code_column(df, info):
    """Find which column contains CadQuery code."""
    if info.get("code_col") and info["code_col"] in df.columns:
        return info["code_col"]

    # Search for a column containing CadQuery code
    candidates = ["cadquery", "code", "cadquery_code", "script", "python", "output", "completion"]
    for col in candidates:
        if col in df.columns:
            sample = df[col].dropna().head(10)
            if sample.str.contains("cadquery|cq\\.Workplane", case=False, regex=True).any():
                logger.info(f"  Found code column: {col}")
                return col

    logger.warning(f"  Could not find code column. Available: {list(df.columns)}")
    return None


def generate_prompt_from_code(code_series):
    """Vectorised: generate synthetic prompts from CadQuery code."""
    parts = []
    checks = [
        (".box(", "box"),
        (".cylinder(", "cylinder"),
        (".sphere(", "sphere"),
        (".hole(", "with holes"),
        (".shell(", "shelled"),
        (".fillet(", "with fillets"),
        (".loft(", "lofted"),
        (".sweep(", "swept"),
        (".revolve(", "revolved"),
        (".cut(", "with cuts"),
        (".union(", "with unions"),
    ]

    prompts = []
    for code in code_series:
        if not isinstance(code, str):
            prompts.append("Generate a CadQuery 3D model")
            continue
        found = [label for pattern, label in checks if pattern in code]
        if found:
            prompts.append(f"Generate a CadQuery model: {', '.join(found)}")
        else:
            prompts.append("Generate a CadQuery 3D model")
    return prompts


def clean_code_series(code_series):
    """Vectorised: clean CadQuery code — remove show_object, exports."""
    remove_patterns = r"^\s*(show_object\(|show\(|cq\.exporters|exporters\.export).*$"
    cleaned = code_series.str.replace(remove_patterns, "", regex=True, flags=re.MULTILINE)
    cleaned = cleaned.str.strip()
    return cleaned


def process_dataset(df, info):
    """Process a DataFrame into training-ready examples using pandas."""
    code_col = find_code_column(df, info)
    if not code_col:
        logger.error(f"  No code column found in {info['name']}")
        return pd.DataFrame()

    logger.info(f"  Processing {len(df)} rows from {info['name']}...")

    # Work with just the code column
    result = pd.DataFrame()
    result["code"] = df[code_col].astype(str)

    # Filter: must have content
    result = result[result["code"].str.len() > 20].copy()
    logger.info(f"  After length filter: {len(result)}")

    # Filter: must contain CadQuery markers
    cq_mask = result["code"].str.contains(
        r"cadquery|cq\.Workplane|cq\.Assembly|import cq", case=False, regex=True
    )
    result = result[cq_mask].copy()
    logger.info(f"  After CadQuery filter: {len(result)}")

    # Clean code
    result["code"] = clean_code_series(result["code"])
    result = result[result["code"].str.len() > 20].copy()
    logger.info(f"  After cleaning: {len(result)}")

    # Generate prompts
    result["prompt"] = generate_prompt_from_code(result["code"])

    # Deduplicate by code hash
    result["hash"] = result["code"].apply(lambda x: hashlib.md5(x.encode()).hexdigest())
    before_dedup = len(result)
    result = result.drop_duplicates(subset="hash")
    logger.info(f"  After dedup: {len(result)} (removed {before_dedup - len(result)})")

    result["source"] = info["name"]

    return result[["prompt", "code", "source"]]


# ──────────────────────────────────────────────
# Format + save
# ──────────────────────────────────────────────

def format_and_save(df, output_dir, eval_ratio=0.05):
    """Format as Qwen chat JSONL and save train/eval splits."""
    os.makedirs(output_dir, exist_ok=True)

    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    # Split
    split_idx = int(len(df) * (1 - eval_ratio))
    train_df = df.iloc[:split_idx]
    eval_df = df.iloc[split_idx:]

    # Write JSONL
    for split_name, split_df in [("train", train_df), ("eval", eval_df)]:
        path = os.path.join(output_dir, f"{split_name}.jsonl")
        with open(path, "w") as f:
            for _, row in split_df.iterrows():
                entry = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": row["prompt"]},
                        {"role": "assistant", "content": row["code"]},
                    ]
                }
                f.write(json.dumps(entry) + "\n")
        logger.info(f"  Saved {len(split_df)} examples to {path}")

    # Stats
    stats = {"total": len(df), "train": len(train_df), "eval": len(eval_df)}
    sources = df["source"].value_counts().to_dict()
    stats["sources"] = sources
    stats_path = os.path.join(output_dir, "stats.json")
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)
    logger.info(f"  Stats: {stats}")

    return stats


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Download and prepare CadQuery training data")
    parser.add_argument("--preset", choices=list(PRESETS.keys()),
                        help="Dataset preset: A=GenCAD(147K), B=+CAD-Recode(1.1M), C=CAD-Recode only")
    parser.add_argument("--datasets", nargs="+", choices=list(DATASETS.keys()),
                        help="Custom dataset combo")
    parser.add_argument("--max-samples", type=int, default=None, help="Max total examples")
    parser.add_argument("--output-dir", default="./data", help="Output directory")
    args = parser.parse_args()

    dataset_keys = PRESETS.get(args.preset, ["t2cq"]) if args.preset else (args.datasets or ["t2cq"])
    logger.info(f"Datasets: {dataset_keys}")

    # Download and process each
    all_dfs = []
    for key in dataset_keys:
        logger.info(f"\n{'='*60}")
        logger.info(f"Dataset: {DATASETS[key]['name']}")
        logger.info(f"{'='*60}")

        df, info = download_dataset(key)
        if df is None:
            continue

        processed = process_dataset(df, info)
        if len(processed) > 0:
            all_dfs.append(processed)

    if not all_dfs:
        logger.error("No valid examples collected!")
        return

    # Combine
    combined = pd.concat(all_dfs, ignore_index=True)
    logger.info(f"\nCombined: {len(combined)} examples")

    # Cross-dataset dedup
    combined["hash"] = combined["code"].apply(lambda x: hashlib.md5(x.encode()).hexdigest())
    before = len(combined)
    combined = combined.drop_duplicates(subset="hash").drop(columns="hash")
    logger.info(f"After cross-dedup: {len(combined)} (removed {before - len(combined)})")

    # Limit
    if args.max_samples and len(combined) > args.max_samples:
        combined = combined.sample(n=args.max_samples, random_state=42)
        logger.info(f"Truncated to {args.max_samples}")

    # Source breakdown
    logger.info(f"\nSources:")
    for src, count in combined["source"].value_counts().items():
        logger.info(f"  {src}: {count}")

    # Save
    output_dir = args.output_dir
    if args.preset:
        output_dir = os.path.join(args.output_dir, f"run_{args.preset}")

    stats = format_and_save(combined, output_dir)

    logger.info(f"\n{'='*60}")
    logger.info(f"Done! {stats['total']} examples ready.")
    logger.info(f"Output: {output_dir}")
    logger.info(f"Next: python train.py --data-dir {output_dir}")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
