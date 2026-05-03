"""Evaluate trained models against standard test prompts.

Loads each GGUF model into Ollama, runs the same prompts, executes the
generated CadQuery code, and reports success/failure + geometry metrics.

Usage (on your Mac, after loading models into Ollama):
    # Load models first:
    ollama create fitd-run-a -f ./output/run_A_gguf/Modelfile
    ollama create fitd-run-b -f ./output/run_B_gguf/Modelfile
    ollama create fitd-run-c -f ./output/run_C_gguf/Modelfile
    ollama create fitd-run-d -f ./output/run_D_gguf/Modelfile

    # Run evaluation:
    python evaluate.py
    python evaluate.py --models fitd-run-a fitd-run-d   # test specific models
    python evaluate.py --include-claude                   # compare against Claude API
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(message)s')
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Test prompts — ordered by difficulty
# ──────────────────────────────────────────────

TEST_PROMPTS = [
    {
        "id": "T1",
        "difficulty": "trivial",
        "prompt": "A 50mm cube with a 20mm hole through the center",
        "expected": {"min_volume": 100, "max_volume": 200000, "has_hole": True},
    },
    {
        "id": "T2",
        "difficulty": "simple",
        "prompt": "A 100x60x5mm mounting plate with four M4 holes 8mm from each corner",
        "expected": {"min_volume": 20000, "bbox_x": (95, 105), "bbox_y": (55, 65)},
    },
    {
        "id": "T3",
        "difficulty": "simple",
        "prompt": "A cylinder 30mm diameter, 50mm tall, with a 10mm center bore",
        "expected": {"min_volume": 1000, "bbox_z": (45, 55)},
    },
    {
        "id": "T4",
        "difficulty": "medium",
        "prompt": "An L-bracket: horizontal leg 80x40x5mm, vertical leg 60mm tall from the back edge, two 6mm holes on each leg",
        "expected": {"min_volume": 10000},
    },
    {
        "id": "T5",
        "difficulty": "medium",
        "prompt": "A pen holder: hexagonal cross-section, 25mm radius, 80mm tall, 2.5mm walls, open top",
        "expected": {"min_volume": 5000},
    },
    {
        "id": "T6",
        "difficulty": "medium",
        "prompt": "A pipe elbow, 90 degree bend, 15mm outer diameter, 2mm wall thickness",
        "expected": {"min_volume": 500},
    },
    {
        "id": "T7",
        "difficulty": "hard",
        "prompt": "A Raspberry Pi 4 case: 90x65x30mm, 2mm walls, open top, four M2.5 mounting bosses 5mm from corners, USB-C cutout on the rear wall",
        "expected": {"min_volume": 10000},
    },
    {
        "id": "T8",
        "difficulty": "hard",
        "prompt": "A funnel: 50mm diameter at the top tapering to 15mm at the bottom, 60mm tall, 2mm wall thickness, open both ends",
        "expected": {"min_volume": 1000},
    },
    {
        "id": "T9",
        "difficulty": "hard",
        "prompt": "A pulley wheel with a V-groove around the circumference, 50mm outer diameter, 12mm wide, 8mm center bore",
        "expected": {"min_volume": 5000},
    },
    {
        "id": "T10",
        "difficulty": "expert",
        "prompt": "A cable grommet: 30mm outer diameter, 15mm tall, 12mm center hole, with a 3mm radial slot from the hole to the outer edge so a cable can snap in",
        "expected": {"min_volume": 500},
    },
    {
        "id": "T11",
        "difficulty": "expert",
        "prompt": "A wall-mounted coat hook: 60mm wide back plate with two 5mm screw holes near the top, and a curved arm extending 50mm from the plate",
        "expected": {"min_volume": 2000},
    },
    {
        "id": "T12",
        "difficulty": "expert",
        "prompt": "A spur gear with 20 teeth, module 2, 10mm face width, 8mm center bore",
        "expected": {"min_volume": 5000},
    },
]


def query_ollama(model_name, prompt, timeout=60):
    """Query an Ollama model and return the generated code."""
    system = (
        "You are a CadQuery code generator. Generate complete, executable CadQuery Python code. "
        "Assign the final shape to `result`. Use named variables for dimensions. "
        "No export statements. No show_object. Return ONLY the Python code."
    )

    try:
        result = subprocess.run(
            ["ollama", "run", model_name, f"[SYSTEM]{system}[/SYSTEM]\n{prompt}"],
            capture_output=True, text=True, timeout=timeout,
        )
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return None
    except FileNotFoundError:
        logger.error("Ollama not found. Make sure it's installed and in PATH.")
        return None


def query_claude(prompt, timeout=30):
    """Query Claude API for comparison (optional)."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

        system = (
            "You are a CadQuery code generator. Generate complete, executable CadQuery Python code. "
            "Assign the final shape to `result`. Use named variables for dimensions. "
            "No export statements. Return ONLY the Python code block."
        )

        response = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4096,
            temperature=0,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Claude query failed: {e}")
        return None


def extract_code(response):
    """Extract Python code from model response."""
    if not response:
        return None

    # Try to find code in ``` blocks
    match = re.search(r'```(?:python)?\s*\n(.*?)```', response, re.DOTALL)
    if match:
        return match.group(1).strip()

    # If the whole response looks like code
    if "import cadquery" in response or "cq.Workplane" in response:
        # Strip any non-code preamble
        lines = response.split('\n')
        code_lines = []
        in_code = False
        for line in lines:
            if 'import' in line or 'cq.' in line or 'result' in line or in_code:
                in_code = True
                code_lines.append(line)
        if code_lines:
            return '\n'.join(code_lines).strip()

    return response


def validate_code_syntax(code):
    """Check if code is syntactically valid Python."""
    if not code:
        return False, "No code generated"
    try:
        import ast
        ast.parse(code)
        return True, ""
    except SyntaxError as e:
        return False, f"SyntaxError: {e}"


def execute_cadquery(code, timeout=30):
    """Execute CadQuery code and return success + metadata.

    Uses Docker sandbox if available, otherwise tries local execution.
    """
    if not code:
        return False, "No code to execute", {}

    # Add validation suffix
    validation = '''
import json, sys
try:
    _solid = result.val()
    _bb = _solid.BoundingBox()
    _vol = _solid.Volume()
    _meta = {
        "valid": _solid.isValid(),
        "volume_mm3": round(_vol, 2),
        "bbox_x": round(_bb.xlen, 2),
        "bbox_y": round(_bb.ylen, 2),
        "bbox_z": round(_bb.zlen, 2),
    }
    print("METADATA:" + json.dumps(_meta))
except Exception as e:
    print(f"VALIDATION_ERROR:{e}", file=sys.stderr)
    sys.exit(1)
'''

    full_code = code + "\n\n" + validation

    # Try Docker execution first
    try:
        result = subprocess.run(
            [
                "docker", "run", "--rm",
                "--network=none", "--memory=512m",
                "-i", "fitd-cad-sandbox:latest",
                "python", "-c", full_code,
            ],
            capture_output=True, text=True, timeout=timeout,
        )

        if result.returncode == 0:
            # Parse metadata from stdout
            for line in result.stdout.split('\n'):
                if line.startswith("METADATA:"):
                    meta = json.loads(line[9:])
                    return True, "", meta
            return True, "", {}
        else:
            error = result.stderr.strip()[:200]
            return False, error, {}

    except subprocess.TimeoutExpired:
        return False, "Timeout", {}
    except FileNotFoundError:
        # Docker not available — try local CadQuery
        try:
            import cadquery as cq
            exec_globals = {"cq": cq, "__builtins__": __builtins__}
            exec(full_code, exec_globals)
            # If we get here, check stdout capture
            return True, "", exec_globals.get("_meta", {})
        except Exception as e:
            return False, str(e)[:200], {}


def check_expectations(meta, expected):
    """Check if generated geometry meets expected criteria."""
    issues = []

    if not meta:
        return ["No metadata — couldn't validate"]

    vol = meta.get("volume_mm3", 0)
    if expected.get("min_volume") and vol < expected["min_volume"]:
        issues.append(f"Volume too small: {vol} < {expected['min_volume']}")

    if expected.get("max_volume") and vol > expected["max_volume"]:
        issues.append(f"Volume too large: {vol} > {expected['max_volume']}")

    for dim in ["bbox_x", "bbox_y", "bbox_z"]:
        if dim in expected:
            actual = meta.get(dim, 0)
            lo, hi = expected[dim]
            if actual < lo or actual > hi:
                issues.append(f"{dim}: {actual} not in range [{lo}, {hi}]")

    if not meta.get("valid", False):
        issues.append("BRep invalid")

    return issues


def evaluate_model(model_name, prompts, is_claude=False):
    """Run all test prompts against a model and collect results."""
    results = []

    for test in prompts:
        logger.info(f"  [{test['id']}] {test['difficulty']}: {test['prompt'][:60]}...")

        start = time.time()
        if is_claude:
            response = query_claude(test["prompt"])
        else:
            response = query_ollama(model_name, test["prompt"])
        gen_time = time.time() - start

        code = extract_code(response)
        syntax_ok, syntax_err = validate_code_syntax(code)

        exec_ok = False
        exec_err = ""
        meta = {}
        expectations = []

        if syntax_ok:
            exec_ok, exec_err, meta = execute_cadquery(code)
            if exec_ok:
                expectations = check_expectations(meta, test.get("expected", {}))

        result = {
            "id": test["id"],
            "difficulty": test["difficulty"],
            "prompt": test["prompt"],
            "generated": bool(response),
            "syntax_valid": syntax_ok,
            "syntax_error": syntax_err,
            "execution_success": exec_ok,
            "execution_error": exec_err,
            "metadata": meta,
            "expectation_issues": expectations,
            "generation_time_s": round(gen_time, 2),
            "code_length": len(code) if code else 0,
            "pass": exec_ok and len(expectations) == 0,
        }

        status = "✓ PASS" if result["pass"] else ("⚠ PARTIAL" if exec_ok else "✗ FAIL")
        logger.info(f"    {status} ({gen_time:.1f}s)")
        if not syntax_ok:
            logger.info(f"    Syntax: {syntax_err[:80]}")
        elif not exec_ok:
            logger.info(f"    Exec: {exec_err[:80]}")
        elif expectations:
            logger.info(f"    Issues: {', '.join(expectations)}")

        results.append(result)

    return results


def print_summary(all_results):
    """Print a comparison table of all models."""
    print("\n" + "=" * 80)
    print("EVALUATION SUMMARY")
    print("=" * 80)

    # Header
    models = list(all_results.keys())
    header = f"{'Test':<6} {'Difficulty':<10}"
    for m in models:
        header += f" {m:<16}"
    print(header)
    print("-" * len(header))

    # Per-test results
    test_ids = [t["id"] for t in TEST_PROMPTS]
    for tid in test_ids:
        difficulty = next(t["difficulty"] for t in TEST_PROMPTS if t["id"] == tid)
        row = f"{tid:<6} {difficulty:<10}"
        for m in models:
            result = next((r for r in all_results[m] if r["id"] == tid), None)
            if result is None:
                row += f" {'?':<16}"
            elif result["pass"]:
                row += f" {'✓ PASS':<16}"
            elif result["execution_success"]:
                row += f" {'⚠ PARTIAL':<16}"
            elif result["syntax_valid"]:
                row += f" {'✗ EXEC FAIL':<16}"
            else:
                row += f" {'✗ SYNTAX':<16}"
        print(row)

    # Totals
    print("-" * len(header))
    totals_row = f"{'TOTAL':<6} {'pass/12':<10}"
    for m in models:
        passed = sum(1 for r in all_results[m] if r["pass"])
        partial = sum(1 for r in all_results[m] if r["execution_success"] and not r["pass"])
        totals_row += f" {passed}✓ {partial}⚠ {'':>6}"
    print(totals_row)

    # Timing
    time_row = f"{'TIME':<6} {'avg (s)':<10}"
    for m in models:
        avg_time = sum(r["generation_time_s"] for r in all_results[m]) / len(all_results[m])
        time_row += f" {avg_time:>5.1f}s{'':>10}"
    print(time_row)

    print("=" * 80)

    # By difficulty breakdown
    print("\nBY DIFFICULTY:")
    for diff in ["trivial", "simple", "medium", "hard", "expert"]:
        diff_tests = [t["id"] for t in TEST_PROMPTS if t["difficulty"] == diff]
        if not diff_tests:
            continue
        row = f"  {diff:<10}"
        for m in models:
            passed = sum(1 for r in all_results[m] if r["id"] in diff_tests and r["pass"])
            total = len(diff_tests)
            row += f" {passed}/{total}{'':>12}"
        print(row)


def main():
    parser = argparse.ArgumentParser(description="Evaluate trained CadQuery models")
    parser.add_argument("--models", nargs="+",
                        default=["fitd-run-a", "fitd-run-b", "fitd-run-c", "fitd-run-d"],
                        help="Ollama model names to evaluate")
    parser.add_argument("--include-claude", action="store_true",
                        help="Also test Claude API for comparison")
    parser.add_argument("--output", default="./evaluation_results.json",
                        help="Save detailed results to JSON")
    parser.add_argument("--tests", nargs="+",
                        help="Run specific test IDs only (e.g., --tests T1 T4 T7)")
    args = parser.parse_args()

    prompts = TEST_PROMPTS
    if args.tests:
        prompts = [t for t in TEST_PROMPTS if t["id"] in args.tests]

    all_results = {}

    for model in args.models:
        logger.info(f"\n{'='*60}")
        logger.info(f"Evaluating: {model}")
        logger.info(f"{'='*60}")
        all_results[model] = evaluate_model(model, prompts)

    if args.include_claude:
        logger.info(f"\n{'='*60}")
        logger.info(f"Evaluating: Claude (API)")
        logger.info(f"{'='*60}")
        all_results["claude"] = evaluate_model("claude", prompts, is_claude=True)

    # Print summary
    print_summary(all_results)

    # Save detailed results
    output = {
        "timestamp": datetime.now().isoformat(),
        "models": args.models + (["claude"] if args.include_claude else []),
        "test_count": len(prompts),
        "results": all_results,
    }
    with open(args.output, "w") as f:
        json.dump(output, f, indent=2, default=str)
    logger.info(f"\nDetailed results saved to: {args.output}")


if __name__ == "__main__":
    main()
