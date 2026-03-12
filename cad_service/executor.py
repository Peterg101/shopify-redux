"""Sandboxed CadQuery code executor with static code validation + Docker isolation.

Each CadQuery execution runs inside a throwaway Docker container with:
- --network=none (no network access)
- --memory=512m (OOM-kill memory bombs)
- --read-only filesystem (no persistent writes)
- tmpfs /tmp (64MB scratch space)
- Non-root 'sandbox' user
- Minimal image (CadQuery + stdlib only — no secrets, no network libs)

AST validation runs first as defense-in-depth.
"""
import ast
import os
import stat
import logging
import tempfile
from pathlib import Path

import docker
from docker.errors import ImageNotFound, APIError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CAD_SANDBOX_IMAGE = os.environ.get("CAD_SANDBOX_IMAGE", "fitd-cad-sandbox:latest")
CAD_WORK_DIR = os.environ.get("CAD_WORK_DIR", "/tmp/cad_work")
CAD_TIMEOUT = int(os.environ.get("CAD_TIMEOUT", "60"))

# ---------------------------------------------------------------------------
# Docker client (module-level, lazy init)
# ---------------------------------------------------------------------------

_docker_client: docker.DockerClient | None = None


def _get_docker_client() -> docker.DockerClient:
    """Get or create the Docker client singleton."""
    global _docker_client
    if _docker_client is None:
        _docker_client = docker.from_env()
        logger.info("Docker client initialized")
        _cleanup_stale_containers()
    return _docker_client


def _cleanup_stale_containers():
    """Remove any leftover cad-sandbox containers from previous runs."""
    try:
        client = _docker_client
        if client is None:
            return
        stale = client.containers.list(
            all=True,
            filters={"label": "fitd.sandbox=cad"},
        )
        for c in stale:
            logger.warning(f"Removing stale sandbox container: {c.short_id}")
            c.remove(force=True)
    except Exception as e:
        logger.warning(f"Stale container cleanup failed: {e}")


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


# ---------------------------------------------------------------------------
# Docker-sandboxed execution
# ---------------------------------------------------------------------------

def execute_cadquery(code: str, timeout_seconds: int = 30) -> tuple[bool, str, str]:
    """Execute CadQuery code in a throwaway Docker container.

    Returns:
        (success, output_path_or_error, stderr)
        - On success: (True, "/path/to/output.step", "")
        - On failure: (False, "", "error message")
    """
    # AST validation first (defense-in-depth)
    valid, reason = validate_code(code)
    if not valid:
        logger.warning(f"Code validation failed: {reason}")
        return False, "", f"Code validation failed: {reason}"

    # Ensure work dir exists
    os.makedirs(CAD_WORK_DIR, exist_ok=True)

    # Create temp dir inside shared work dir (visible to both host and container)
    work_dir = tempfile.mkdtemp(prefix="cad_", dir=CAD_WORK_DIR)
    # chmod 777 so non-root sandbox user in the container can write output
    os.chmod(work_dir, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)

    script_path = os.path.join(work_dir, "generate.py")
    output_path = os.path.join(work_dir, "output.step")

    # Write the script
    with open(script_path, "w") as f:
        f.write(code)
    os.chmod(script_path, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)

    container = None
    try:
        client = _get_docker_client()

        # Use the actual timeout or the configured max, whichever is smaller
        effective_timeout = min(timeout_seconds, CAD_TIMEOUT)

        container = client.containers.run(
            image=CAD_SANDBOX_IMAGE,
            command=["python", "/work/generate.py"],
            volumes={work_dir: {"bind": "/work", "mode": "rw"}},
            environment={
                "OUTPUT_PATH": "/work/output.step",
                "HOME": "/tmp",
                "TMPDIR": "/tmp",
            },
            network_mode="none",
            mem_limit="512m",
            read_only=True,
            tmpfs={"/tmp": "size=64m"},
            user="sandbox",
            labels={"fitd.sandbox": "cad"},
            detach=True,
            stderr=True,
        )

        # Wait for completion with timeout
        result = container.wait(timeout=effective_timeout)
        exit_code = result.get("StatusCode", -1)
        logs = container.logs(stdout=True, stderr=True).decode("utf-8", errors="replace")

        if exit_code != 0:
            error_msg = logs.strip() or "Unknown error"
            if len(error_msg) > 2000:
                error_msg = "..." + error_msg[-2000:]
            logger.warning(f"CadQuery sandbox execution failed (exit {exit_code}): {error_msg[:200]}")
            return False, "", error_msg

        # Check output file exists
        if not Path(output_path).exists():
            return False, "", "Code ran successfully but no STEP file was produced at OUTPUT_PATH"

        file_size = Path(output_path).stat().st_size
        if file_size == 0:
            return False, "", "STEP file was created but is empty (0 bytes)"

        logger.info(f"CadQuery sandbox execution succeeded, STEP file: {file_size} bytes")
        return True, output_path, ""

    except ConnectionError as e:
        return False, "", f"Docker connection failed: {e}"
    except ImageNotFound:
        return False, "", f"Sandbox image '{CAD_SANDBOX_IMAGE}' not found. Run: docker compose build cad_sandbox"
    except APIError as e:
        return False, "", f"Docker API error: {e}"
    except Exception as e:
        error_type = type(e).__name__
        # container.wait() raises ConnectionError on timeout in some docker-py versions,
        # but may also raise requests.exceptions.ReadTimeout
        if "timeout" in str(e).lower() or "timed out" in str(e).lower():
            return False, "", f"Execution timed out after {timeout_seconds} seconds"
        return False, "", f"Execution error ({error_type}): {e}"
    finally:
        # Always clean up the container
        if container is not None:
            try:
                container.remove(force=True)
            except Exception:
                pass
