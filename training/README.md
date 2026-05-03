# Fine-Tuning CadQuery Generation Models

## Two Models to Train

| Model | Input | Output | Base | Dataset | Training Time | Cost |
|-------|-------|--------|------|---------|--------------|------|
| **Text model** | "make a bracket..." | CadQuery code | Qwen 2.5 7B | 170K-1M text pairs | 8-30 hrs | $10-25 |
| **Vision model** | sketch/photo | CadQuery code | Qwen 2.5 VL 7B | 147K image pairs | 8-12 hrs | $10-12 |

## Routing in Production

```
User input
    ├── text only → text model (Ollama, free)
    ├── image/sketch → vision model (Ollama, free)
    └── complex/novel → Claude API (paid, fallback)
```

---

## Text Model Presets

| Preset | Datasets | ~Examples | Time (A100) | Cost |
|--------|----------|-----------|-------------|------|
| **A** | Text-to-CadQuery | 170K | 8-12 hrs | ~$10 |
| **B** | + prompt2CAD | 300K | 16 hrs | ~$13 |
| **C** | + CAD-Recode | 500K | 20 hrs | ~$16 |
| **D** | all combined | 1M+ | 30 hrs | ~$25 |

---

## Quick Start (on rented A100 GPU)

### 1. Setup
```bash
# SSH into your Vast.ai instance
git clone https://github.com/Peterg101/shopify-redux.git
cd shopify-redux/training
pip install -r requirements.txt
```

### 2. Train text model (overnight run)
```bash
python download_data.py --preset A
python train.py --data-dir ./data/run_A
# Wait 8-12 hours
python convert_to_ollama.py --adapter-dir ./output/fitd-cadquery-7b
```

### 3. Train vision model (second overnight run)
```bash
python train_vision.py
# Wait 8-12 hours
python convert_to_ollama.py --base-model Qwen/Qwen2.5-VL-7B-Instruct --adapter-dir ./output/fitd-cadquery-vision-7b
```

### 4. Download results (~4GB each)
```bash
# Copy GGUF files back to your Mac
scp -r ./output/fitd-cadquery-7b-gguf user@your-mac:~/
scp -r ./output/fitd-cadquery-vision-7b-gguf user@your-mac:~/
```

### 5. Load into Docker stack
```bash
# On your machine:
./training/integrate.sh ~/fitd-cadquery-7b-gguf/
# For vision model, same process with different model name
```

---

## Running All Experiments

If you want to A/B test text model presets:

```bash
# Download all data variants (cached after first download)
python download_data.py --preset A
python download_data.py --preset B
python download_data.py --preset D

# Train each sequentially (don't shut down the GPU between runs)
python train.py --data-dir ./data/run_A --output-dir ./output/run_A
python train.py --data-dir ./data/run_B --output-dir ./output/run_B
python train.py --data-dir ./data/run_D --output-dir ./output/run_D

# Train vision model too
python train_vision.py --output-dir ./output/run_vision

# Convert the best text model + the vision model
python convert_to_ollama.py --adapter-dir ./output/run_X
python convert_to_ollama.py --base-model Qwen/Qwen2.5-VL-7B-Instruct --adapter-dir ./output/run_vision
```

---

## Test Prompts

### Text model
```
1. "A 50mm cube with a 20mm hole through the center"
2. "A 100x60x5mm mounting plate with four M4 holes 8mm from each corner"
3. "An L-bracket: horizontal leg 80x40x5mm, vertical leg 60mm tall"
4. "A Raspberry Pi 4 case with ventilation slots and USB cutout"
5. "A pulley wheel with a V-groove, 50mm diameter, 10mm bore"
6. "A funnel: 50mm top tapering to 15mm bottom, 60mm tall"
```

### Vision model
- Hand-drawn sketch of a bracket → should generate bracket code
- Photo of a 3D printed enclosure → should generate similar enclosure
- Excalidraw diagram → should interpret topology and generate code

---

## Infrastructure

### Local dev (your Mac)
- Both models run in your existing Ollama container
- Text model: ~4GB GGUF, 3-5 sec inference on Apple Silicon
- Vision model: ~5GB GGUF, 5-8 sec inference on Apple Silicon
- Total: ~9GB in ollama_data volume

### Production
- Same Ollama on your VPS (CPU inference)
- 8GB+ RAM VPS handles both models
- Hetzner CAX21 (8GB ARM): €7.50/month — runs everything

### Routing (in generation_service)
```
if user_uploaded_image:
    model = "fitd-cadquery-vision"   # vision model
elif classifier == "BASIC":
    model = "fitd-cadquery"          # text model (free)
else:
    model = "claude-opus"            # Claude API (paid, complex parts)
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Text model training (preset A) | ~$10 |
| Vision model training | ~$12 |
| Total training | ~$22 |
| Ongoing serving | $0 (Ollama CPU) |
| Claude API fallback (complex parts) | ~$5-10/month at scale |
