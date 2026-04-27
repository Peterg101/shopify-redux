#!/bin/bash
# Load the fine-tuned model into your Docker Ollama instance.
#
# Usage:
#   1. Copy the GGUF file + Modelfile to your machine
#   2. Run this script from the project root:
#      ./training/integrate.sh /path/to/fitd-cadquery-7b-gguf/
#
# After loading, set CAD_PROVIDER=ollama and OLLAMA_MODEL=fitd-cadquery
# in your .env file to route generation to the fine-tuned model.

set -e

GGUF_DIR="${1:?Usage: ./integrate.sh /path/to/gguf-dir}"

if [ ! -f "$GGUF_DIR/Modelfile" ]; then
    echo "Error: Modelfile not found in $GGUF_DIR"
    exit 1
fi

echo "=== Copying GGUF model to Ollama container ==="

# Find the GGUF file
GGUF_FILE=$(find "$GGUF_DIR" -name "*.gguf" | head -1)
if [ -z "$GGUF_FILE" ]; then
    echo "Error: No .gguf file found in $GGUF_DIR"
    exit 1
fi
echo "Found: $GGUF_FILE"

# Copy into the Ollama container
docker compose cp "$GGUF_FILE" ollama:/tmp/model.gguf
docker compose cp "$GGUF_DIR/Modelfile" ollama:/tmp/Modelfile

# Update Modelfile to point to the container path
docker compose exec ollama sh -c "sed -i 's|^FROM .*|FROM /tmp/model.gguf|' /tmp/Modelfile"

echo "=== Creating model in Ollama ==="
docker compose exec ollama ollama create fitd-cadquery -f /tmp/Modelfile

echo "=== Verifying ==="
docker compose exec ollama ollama list

echo ""
echo "=== Done! ==="
echo ""
echo "To use the fine-tuned model, update your .env:"
echo "  CAD_PROVIDER=ollama"
echo "  OLLAMA_MODEL=fitd-cadquery"
echo ""
echo "Or for hybrid routing (fine-tuned for simple, Claude for complex):"
echo "  CAD_PROVIDER=anthropic        # keep Anthropic as default"
echo "  OLLAMA_MODEL=fitd-cadquery    # Ollama model name"
echo "  # Then modify pipeline.py to route BASIC → Ollama, DETAILED → Claude"
echo ""
echo "Test: docker compose exec ollama ollama run fitd-cadquery 'Create a 50mm cube with a 20mm hole'"
