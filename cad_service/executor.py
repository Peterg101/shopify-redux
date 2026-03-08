"""Sandboxed CadQuery code executor with static code validation."""
import ast
import os
import logging
import tempfile
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Static code validation — AST-based allowlist
# ---------------------------------------------------------------------------

ALLOWED_MODULES = {"cadquery", "cq", "math", "os"}

FORBIDDEN_NAMES = {
    "__import__", "eval", "exec", "compile",
    "getattr", "setattr", "delattr",
    "globals", "locals", "vars",
    "breakpoint", "open",
}

FORBIDDEN_OS_ATTRS = {
    "system", "popen",
    "execv", "execve", "execvp", "execvpe",
    "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe",
    "remove", "unlink", "rmdir", "makedirs", "mkdir",
    "listdir", "walk", "scandir",
    "kill", "fork", "pipe",
    "path",
}


def validate_code(code: str) -> tuple[bool, str]:
    """Validate LLM-generated CadQuery code against an allowlist.

    Uses Python's ast module to parse and walk the code tree.
    Returns (True, "") on success or (False, "reason") on failure.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error: {e}"

    for node in ast.walk(tree):
        # --- Check imports ---
        if isinstance(node, ast.Import):
            for alias in node.names:
                top_module = alias.name.split(".")[0]
                if top_module not in ALLOWED_MODULES:
                    return False, f"Forbidden import: {alias.name}"

        elif isinstance(node, ast.ImportFrom):
            if node.module is None:
                return False, "Relative imports are not allowed"
            top_module = node.module.split(".")[0]
            if top_module not in ALLOWED_MODULES:
                return False, f"Forbidden import: from {node.module}"
            # Block dangerous os sub-imports (e.g. from os import system)
            if top_module == "os":
                for alias in node.names:
                    if alias.name in FORBIDDEN_OS_ATTRS:
                        return False, f"Forbidden os import: from os import {alias.name}"

        # --- Check forbidden builtin names ---
        elif isinstance(node, ast.Name):
            if node.id in FORBIDDEN_NAMES:
                return False, f"Forbidden name: {node.id}"

        # --- Check dangerous os.* attribute access ---
        elif isinstance(node, ast.Attribute):
            if (
                isinstance(node.value, ast.Name)
                and node.value.id == "os"
                and node.attr in FORBIDDEN_OS_ATTRS
            ):
                return False, f"Forbidden os attribute: os.{node.attr}"

    return True, ""


def execute_cadquery(code: str, timeout_seconds: int = 30) -> tuple[bool, str, str]:
    """Execute CadQuery code in a subprocess.

    Returns:
        (success, output_path_or_error, stderr)
        - On success: (True, "/path/to/output.step", "")
        - On failure: (False, "", "error message")
    """
    # Validate code before execution
    valid, reason = validate_code(code)
    if not valid:
        logger.warning(f"Code validation failed: {reason}")
        return False, "", f"Code validation failed: {reason}"

    work_dir = tempfile.mkdtemp(prefix="cad_")
    script_path = os.path.join(work_dir, "generate.py")
    output_path = os.path.join(work_dir, "output.step")

    # Write the script
    with open(script_path, "w") as f:
        f.write(code)

    # Minimal environment — no secrets leak even if validation is bypassed
    env = {
        "OUTPUT_PATH": output_path,
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": "/tmp",
        "TMPDIR": work_dir,
    }

    try:
        result = subprocess.run(
            ["python", script_path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            cwd=work_dir,
            env=env,
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip() or "Unknown error"
            # Truncate long errors to last 2000 chars for Claude
            if len(error_msg) > 2000:
                error_msg = "..." + error_msg[-2000:]
            logger.warning(f"CadQuery execution failed: {error_msg[:200]}")
            return False, "", error_msg

        # Check output file exists
        if not Path(output_path).exists():
            return False, "", "Code ran successfully but no STEP file was produced at OUTPUT_PATH"

        file_size = Path(output_path).stat().st_size
        if file_size == 0:
            return False, "", "STEP file was created but is empty (0 bytes)"

        logger.info(f"CadQuery execution succeeded, STEP file: {file_size} bytes")
        return True, output_path, ""

    except subprocess.TimeoutExpired:
        return False, "", f"Execution timed out after {timeout_seconds} seconds"
    except Exception as e:
        return False, "", f"Execution error: {str(e)}"
