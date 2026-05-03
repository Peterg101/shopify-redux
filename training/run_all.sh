#!/bin/bash
# Run all 5 training experiments sequentially.
#
# Usage (on your rented GPU):
#   git clone https://github.com/Peterg101/shopify-redux.git
#   cd shopify-redux/training
#   pip install -r requirements.txt
#   chmod +x run_all.sh
#   ./run_all.sh 2>&1 | tee full_log.txt
#
# Then close your laptop and come back in ~4 days.
# Check progress anytime: cat training_log.txt

set -e

LOG="training_log.txt"
echo "=== TRAINING PIPELINE STARTED: $(date) ===" > "$LOG"

# ──────────────────────────────────────────────
# Step 1: Download all datasets (cached after first download)
# ──────────────────────────────────────────────
echo "=== DOWNLOADING DATASETS: $(date) ===" | tee -a "$LOG"

python download_data.py --preset A    # GenCAD-Code 147K
python download_data.py --preset B    # GenCAD-Code + CAD-Recode ~1.1M
python download_data.py --preset C    # CAD-Recode only ~1M

echo "=== DATASETS READY: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 1: GenCAD-Code only — 147K examples (~12 hours)
# ──────────────────────────────────────────────
echo "=== RUN A (GenCAD 147K): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_A --output-dir ./output/run_A
echo "=== RUN A (GenCAD 147K): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 2: GenCAD + CAD-Recode — ~1.1M examples (~30 hours)
# ──────────────────────────────────────────────
echo "=== RUN B (GenCAD+Recode 1.1M): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_B --output-dir ./output/run_B
echo "=== RUN B (GenCAD+Recode 1.1M): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 3: CAD-Recode only — ~1M examples (~28 hours)
# ──────────────────────────────────────────────
echo "=== RUN C (Recode 1M): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_C --output-dir ./output/run_C
echo "=== RUN C (Recode 1M): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 5: Vision model — 147K image pairs (~12 hours)
# ──────────────────────────────────────────────
echo "=== RUN V (Vision): Starting $(date) ===" | tee -a "$LOG"
python train_vision.py --output-dir ./output/run_vision
echo "=== RUN V (Vision): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Convert all to GGUF for Ollama
# ──────────────────────────────────────────────
echo "=== CONVERTING TO GGUF: $(date) ===" | tee -a "$LOG"

python convert_to_ollama.py --adapter-dir ./output/run_A --output-dir ./output/run_A_gguf
python convert_to_ollama.py --adapter-dir ./output/run_B --output-dir ./output/run_B_gguf
python convert_to_ollama.py --adapter-dir ./output/run_C --output-dir ./output/run_C_gguf
python convert_to_ollama.py --base-model Qwen/Qwen2.5-VL-7B-Instruct --adapter-dir ./output/run_vision --output-dir ./output/run_vision_gguf

echo "=== ALL CONVERSIONS DONE: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "================================================"
echo "ALL 4 RUNS COMPLETE"
echo "================================================"
echo ""
echo "Output directories:"
echo "  ./output/run_A_gguf/      — Text model (GenCAD-Code 147K)"
echo "  ./output/run_B_gguf/      — Text model (GenCAD + CAD-Recode ~1.1M)"
echo "  ./output/run_C_gguf/      — Text model (CAD-Recode only ~1M)"
echo "  ./output/run_vision_gguf/ — Vision model (147K images)"
echo ""
echo "Download these to your Mac and test with:"
echo "  ./training/integrate.sh ./output/run_X_gguf/"
echo ""
echo "Training log: $LOG"
echo "================================================"

cat "$LOG"
