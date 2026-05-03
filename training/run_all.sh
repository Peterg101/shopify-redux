#!/bin/bash
# Train text model + vision model on GenCAD-Code dataset.
#
# Usage (on your rented GPU):
#   git clone https://github.com/Peterg101/shopify-redux.git
#   cd shopify-redux/training
#   pip install -r requirements.txt
#   export HF_TOKEN=your_token_here
#   chmod +x run_all.sh
#   ./run_all.sh 2>&1 | tee full_log.txt

set -e

LOG="training_log.txt"
echo "=== TRAINING STARTED: $(date) ===" > "$LOG"

# ──────────────────────────────────────────────
# Step 1: Download + prepare text training data
# ──────────────────────────────────────────────
echo "=== DOWNLOADING DATA: $(date) ===" | tee -a "$LOG"
python download_data.py --preset A
echo "=== DATA READY: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 1: Text model — GenCAD-Code 108K (~8 hours)
# ──────────────────────────────────────────────
echo "=== TEXT MODEL: Starting $(date) ===" | tee -a "$LOG"
python train.py --data-dir ./data/run_A --output-dir ./output/run_text
echo "=== TEXT MODEL: Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Run 2: Vision model — GenCAD-Code 147K images (~12 hours)
# ──────────────────────────────────────────────
echo "=== VISION MODEL: Starting $(date) ===" | tee -a "$LOG"
python train_vision.py --output-dir ./output/run_vision
echo "=== VISION MODEL: Finished $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Convert both to GGUF for Ollama
# ──────────────────────────────────────────────
echo "=== CONVERTING TO GGUF: $(date) ===" | tee -a "$LOG"
python convert_to_ollama.py --adapter-dir ./output/run_text --output-dir ./output/text_gguf
python convert_to_ollama.py --base-model Qwen/Qwen2.5-VL-7B-Instruct --adapter-dir ./output/run_vision --output-dir ./output/vision_gguf
echo "=== CONVERSIONS DONE: $(date) ===" | tee -a "$LOG"

# ──────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────
echo ""
echo "================================================"
echo "BOTH MODELS COMPLETE"
echo "================================================"
echo ""
echo "Output:"
echo "  ./output/text_gguf/   — Text model (prompt → CadQuery)"
echo "  ./output/vision_gguf/ — Vision model (image → CadQuery)"
echo ""
echo "Download to your Mac, then:"
echo "  ./training/integrate.sh ./output/text_gguf/"
echo ""
echo "Training log: $LOG"
echo "================================================"

cat "$LOG"
