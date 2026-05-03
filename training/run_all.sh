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

python download_data.py --preset A
python download_data.py --preset B
python download_data.py --preset C
python download_data.py --preset D

echo "=== DATASETS READY: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 1: Text model — 170K examples (~12 hours)
# ──────────────────────────────────────────────
echo "=== RUN A (170K): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_A --output-dir ./output/run_A
echo "=== RUN A (170K): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 2: Text model — 300K examples (~16 hours)
# ──────────────────────────────────────────────
echo "=== RUN B (300K): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_B --output-dir ./output/run_B
echo "=== RUN B (300K): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 3: Text model — 500K examples (~20 hours)
# ──────────────────────────────────────────────
echo "=== RUN C (500K): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_C --output-dir ./output/run_C
echo "=== RUN C (500K): Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 4: Text model — 1M+ examples (~30 hours)
# ──────────────────────────────────────────────
echo "=== RUN D (1M+): Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_D --output-dir ./output/run_D
echo "=== RUN D (1M+): Finished $(date) ===" | tee -a "$LOG"

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
python convert_to_ollama.py --adapter-dir ./output/run_D --output-dir ./output/run_D_gguf
python convert_to_ollama.py --base-model Qwen/Qwen2.5-VL-7B-Instruct --adapter-dir ./output/run_vision --output-dir ./output/run_vision_gguf

echo "=== ALL CONVERSIONS DONE: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "================================================"
echo "ALL 5 RUNS COMPLETE"
echo "================================================"
echo ""
echo "Output directories:"
echo "  ./output/run_A_gguf/    — Text model (170K)"
echo "  ./output/run_B_gguf/    — Text model (300K)"
echo "  ./output/run_C_gguf/    — Text model (500K)"
echo "  ./output/run_D_gguf/    — Text model (1M+)"
echo "  ./output/run_vision_gguf/ — Vision model (147K images)"
echo ""
echo "Download these to your Mac and test with:"
echo "  ./training/integrate.sh ./output/run_X_gguf/"
echo ""
echo "Training log: $LOG"
echo "================================================"

cat "$LOG"
