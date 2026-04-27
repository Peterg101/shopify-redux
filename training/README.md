# Fine-Tuning a CadQuery Generation Model

## Quick Start

```bash
# 1. On your rented GPU (Vast.ai / RunPod):
pip install -r requirements.txt

# 2. Download + prepare the training data:
python download_data.py

# 3. Train (~8-12 hours on A100 40GB):
python train.py

# 4. Convert for Ollama:
python convert_to_ollama.py

# 5. Copy the output back to your machine:
scp -r ./output/fitd-cadquery-7b-gguf user@your-machine:~/
```

## What Each Script Does

- `download_data.py` — Downloads the Text-to-CadQuery dataset from HuggingFace, filters for quality, formats as training JSONL
- `train.py` — QLoRA fine-tune Qwen 2.5 7B on the prepared data
- `convert_to_ollama.py` — Merges LoRA weights + quantises to GGUF for Ollama
- `integrate.sh` — Loads the model into your Docker Ollama instance

## Cost

- GPU rental: ~$10-15 for 12 hours on A100 40GB (Vast.ai)
- Ongoing serving: $0 (runs on Ollama, CPU inference, already in your Docker stack)
