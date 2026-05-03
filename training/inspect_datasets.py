"""Inspect dataset column names and sample data to fix field mappings."""
from datasets import load_dataset

datasets_to_check = [
    "CADCODER/GenCAD-Code",
    "kulibinai/cadevolve",
    "filapro/cad-recode-v1.5",
]

for name in datasets_to_check:
    print(f"\n{'='*60}")
    print(f"Dataset: {name}")
    print(f"{'='*60}")
    try:
        ds = load_dataset(name, split="train", streaming=True)
        sample = next(iter(ds))
        print(f"Columns: {list(sample.keys())}")
        print(f"\nSample values:")
        for key, val in sample.items():
            val_str = str(val)[:200] if val else "None"
            print(f"  {key}: {val_str}")
    except Exception as e:
        print(f"  ERROR: {e}")
