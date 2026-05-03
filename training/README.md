# Fine-Tuning a CadQuery Generation Model

## Datasets (all free, downloaded automatically)

| Key | Dataset | Size | HuggingFace |
|-----|---------|------|-------------|
| `t2cq` | Text-to-CadQuery | ~170K pairs | `ricemonster/text-to-cadquery` |
| `p2cad` | prompt2CAD | ~170K pairs | `gilfoyle19/prompt2CAD` |
| `cadrecode` | CAD-Recode | ~1M sequences | `filapro/cad-recode-v1.5` |

## Training Presets

| Preset | Datasets | ~Examples | Training Time (A100) | Cost (Vast.ai) |
|--------|----------|-----------|---------------------|----------------|
| **A** | t2cq | 170K | 8-12 hrs | ~$10 |
| **B** | t2cq + p2cad | 300K | 16 hrs | ~$13 |
| **C** | t2cq + cadrecode | 500K | 20 hrs | ~$16 |
| **D** | all combined | 1M+ | 30 hrs | ~$25 |

**Recommendation:** Start with **Preset A** overnight. Test the results. If good but not great, try **D** next.

## Quick Start (on your rented GPU)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Download + prepare data (pick a preset)
python download_data.py --preset A              # 170K examples, fast
# OR
python download_data.py --preset D              # 1M+ examples, max quality
# OR
python download_data.py --preset A --max-samples 50000  # Quick test

# 3. Train (~8-12 hours for preset A on A100 40GB)
python train.py --data-dir ./data/run_A

# 4. Convert for Ollama
python convert_to_ollama.py

# 5. Copy the GGUF file back to your machine (~4GB)
# Use scp, rsync, or the Vast.ai file browser
```

## Running Multiple Experiments

```bash
# Download all presets (do this once — datasets are cached)
python download_data.py --preset A
python download_data.py --preset B
python download_data.py --preset C
python download_data.py --preset D

# Train each (sequentially on same GPU — don't shut down between runs)
python train.py --data-dir ./data/run_A --output-dir ./output/run_A
python train.py --data-dir ./data/run_B --output-dir ./output/run_B
python train.py --data-dir ./data/run_C --output-dir ./output/run_C
python train.py --data-dir ./data/run_D --output-dir ./output/run_D

# Convert the best one
python convert_to_ollama.py --adapter-dir ./output/run_X
```

## Testing the Results

After training, test each model on these prompts (ordered by difficulty):

```
1. "A 50mm cube with a 20mm hole through the center"
2. "A 100x60x5mm mounting plate with four M4 holes 8mm from each corner"
3. "An L-bracket: horizontal leg 80x40x5mm, vertical leg 60mm tall"
4. "A Raspberry Pi 4 case with ventilation slots and USB cutout"
5. "A pulley wheel with a V-groove, 50mm diameter, 10mm bore"
6. "A funnel: 50mm top tapering to 15mm bottom, 60mm tall"
```

For each: execute the generated code in CadQuery, check if it produces valid geometry.

## Loading Into Your Docker Stack

```bash
# Back on your machine:
./training/integrate.sh /path/to/output/fitd-cadquery-7b-gguf/

# Update .env:
OLLAMA_MODEL=fitd-cadquery

# Rebuild:
docker compose up -d generation_service
```

## Cost Summary

- GPU rental (Vast.ai A100): ~$0.80-1.10/hr
- Preset A (one run): ~$10
- All 4 presets: ~$60
- Ongoing serving: $0 (Ollama on CPU)
