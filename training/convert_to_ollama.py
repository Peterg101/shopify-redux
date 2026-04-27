"""Convert a QLoRA fine-tuned model to GGUF format for Ollama.

Merges the LoRA adapter with the base model, then quantises to Q4_K_M
(good balance of quality and speed for CPU inference).

Usage:
    python convert_to_ollama.py
    python convert_to_ollama.py --adapter-dir ./output/fitd-cadquery-7b --quantise Q5_K_M
"""
import argparse
import os
import logging
import shutil

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)


def merge_adapter(base_model, adapter_dir, merged_dir):
    """Merge LoRA adapter weights back into the base model."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    logger.info(f"Loading base model: {base_model}")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)

    logger.info(f"Loading LoRA adapter from: {adapter_dir}")
    model = PeftModel.from_pretrained(model, adapter_dir)

    logger.info("Merging weights...")
    model = model.merge_and_unload()

    logger.info(f"Saving merged model to: {merged_dir}")
    os.makedirs(merged_dir, exist_ok=True)
    model.save_pretrained(merged_dir, safe_serialization=True)
    tokenizer.save_pretrained(merged_dir)

    logger.info("Merge complete!")
    return merged_dir


def convert_to_gguf(merged_dir, output_dir, quantise="Q4_K_M"):
    """Convert merged model to GGUF format using llama.cpp."""
    logger.info(f"Converting to GGUF with {quantise} quantisation...")

    gguf_path = os.path.join(output_dir, f"fitd-cadquery-7b-{quantise.lower()}.gguf")
    os.makedirs(output_dir, exist_ok=True)

    # Try using llama-cpp-python's converter
    try:
        import subprocess

        # First convert to f16 GGUF
        f16_path = os.path.join(output_dir, "fitd-cadquery-7b-f16.gguf")

        # Use the convert script from llama.cpp (bundled with llama-cpp-python)
        convert_cmd = [
            "python", "-m", "llama_cpp.convert",
            "--outfile", f16_path,
            "--outtype", "f16",
            merged_dir,
        ]

        logger.info(f"Running: {' '.join(convert_cmd)}")
        result = subprocess.run(convert_cmd, capture_output=True, text=True)

        if result.returncode != 0:
            # Fallback: try llama.cpp's convert_hf_to_gguf.py directly
            logger.warning(f"llama_cpp.convert failed: {result.stderr[:200]}")
            logger.info("Trying alternative conversion via transformers + safetensors...")

            # Use huggingface_hub's GGUF conversion
            from huggingface_hub import HfApi
            api = HfApi()

            logger.info("Uploading merged model to convert... (this may take a while)")
            # For local conversion, we need llama.cpp installed
            raise RuntimeError("Please install llama.cpp and run: "
                             f"python convert_hf_to_gguf.py {merged_dir} --outfile {f16_path} --outtype f16")

        # Quantise
        if quantise != "f16":
            quantise_cmd = [
                "python", "-m", "llama_cpp.quantize",
                f16_path,
                gguf_path,
                quantise,
            ]
            logger.info(f"Quantising: {' '.join(quantise_cmd)}")
            result = subprocess.run(quantise_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                logger.error(f"Quantisation failed: {result.stderr[:200]}")
                logger.info(f"You can quantise manually: llama-quantize {f16_path} {gguf_path} {quantise}")
                gguf_path = f16_path
            else:
                # Clean up f16
                os.remove(f16_path)
        else:
            gguf_path = f16_path

    except Exception as e:
        logger.error(f"GGUF conversion failed: {e}")
        logger.info("\nManual conversion steps:")
        logger.info(f"1. Clone llama.cpp: git clone https://github.com/ggml-org/llama.cpp")
        logger.info(f"2. Build it: cd llama.cpp && make")
        logger.info(f"3. Convert: python convert_hf_to_gguf.py {merged_dir} --outfile {gguf_path} --outtype f16")
        logger.info(f"4. Quantise: ./llama-quantize {gguf_path} {gguf_path.replace('f16', quantise.lower())} {quantise}")
        return None

    logger.info(f"GGUF model saved to: {gguf_path}")
    return gguf_path


def create_modelfile(gguf_path, output_dir):
    """Create an Ollama Modelfile for the fine-tuned model."""
    modelfile_path = os.path.join(output_dir, "Modelfile")

    modelfile_content = f"""FROM {os.path.abspath(gguf_path)}

PARAMETER temperature 0
PARAMETER num_predict 4096
PARAMETER stop "<|endoftext|>"
PARAMETER stop "<|im_end|>"

SYSTEM \"\"\"You are a CadQuery code generator. Given a description of a 3D part, generate complete, executable CadQuery Python code that produces the part. The code must assign the final shape to a variable called `result`. Use named variables for all dimensions. Do not include export statements.\"\"\"
"""

    with open(modelfile_path, "w") as f:
        f.write(modelfile_content)

    logger.info(f"Modelfile saved to: {modelfile_path}")
    logger.info(f"\nTo load into Ollama:")
    logger.info(f"  ollama create fitd-cadquery -f {modelfile_path}")
    logger.info(f"  ollama run fitd-cadquery 'Create a 50mm cube with a 20mm hole'")

    return modelfile_path


def main():
    parser = argparse.ArgumentParser(description="Convert fine-tuned model to Ollama format")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B", help="Base model (for merging)")
    parser.add_argument("--adapter-dir", default="./output/fitd-cadquery-7b", help="LoRA adapter directory")
    parser.add_argument("--output-dir", default="./output/fitd-cadquery-7b-gguf", help="GGUF output directory")
    parser.add_argument("--quantise", default="Q4_K_M", help="Quantisation level (Q4_K_M, Q5_K_M, Q8_0, f16)")
    args = parser.parse_args()

    # Step 1: Merge LoRA adapter with base model
    merged_dir = os.path.join(args.output_dir, "merged")
    merge_adapter(args.base_model, args.adapter_dir, merged_dir)

    # Step 2: Convert to GGUF
    gguf_path = convert_to_gguf(merged_dir, args.output_dir, args.quantise)

    # Step 3: Create Ollama Modelfile
    if gguf_path:
        create_modelfile(gguf_path, args.output_dir)

    # Clean up merged model (large, no longer needed)
    logger.info(f"\nTo save disk space, delete the merged model: rm -rf {merged_dir}")


if __name__ == "__main__":
    main()
