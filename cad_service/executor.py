"""Sandboxed CadQuery code executor."""
import os
import logging
import tempfile
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def execute_cadquery(code: str, timeout_seconds: int = 30) -> tuple[bool, str, str]:
    """Execute CadQuery code in a subprocess.

    Returns:
        (success, output_path_or_error, stderr)
        - On success: (True, "/path/to/output.step", "")
        - On failure: (False, "", "error message")
    """
    work_dir = tempfile.mkdtemp(prefix="cad_")
    script_path = os.path.join(work_dir, "generate.py")
    output_path = os.path.join(work_dir, "output.step")

    # Write the script
    with open(script_path, "w") as f:
        f.write(code)

    env = os.environ.copy()
    env["OUTPUT_PATH"] = output_path

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
