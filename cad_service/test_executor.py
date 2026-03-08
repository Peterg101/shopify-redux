"""Tests for executor.validate_code() — AST-based code validation."""
import pytest
from executor import validate_code


# ---------------------------------------------------------------------------
# Valid code — should pass
# ---------------------------------------------------------------------------

class TestValidCode:
    def test_standard_cadquery(self):
        code = '''
import cadquery as cq
import os

result = cq.Workplane("XY").box(10, 20, 5)
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"

    def test_with_math(self):
        code = '''
import cadquery as cq
import math
import os

radius = math.sqrt(2) * 10
result = cq.Workplane("XY").cylinder(20, radius)
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"

    def test_from_math_import(self):
        code = '''
import cadquery as cq
import os
from math import pi, sqrt

result = cq.Workplane("XY").cylinder(20, pi * sqrt(2))
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"

    def test_os_environ_access(self):
        """os.environ["OUTPUT_PATH"] must be allowed."""
        code = '''
import cadquery as cq
import os

output = os.environ["OUTPUT_PATH"]
result = cq.Workplane("XY").box(10, 10, 10)
cq.exporters.export(result, output)
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"


# ---------------------------------------------------------------------------
# Forbidden imports — should fail
# ---------------------------------------------------------------------------

class TestForbiddenImports:
    def test_import_subprocess(self):
        code = 'import subprocess\nsubprocess.run(["ls"])'
        valid, reason = validate_code(code)
        assert not valid
        assert "subprocess" in reason

    def test_import_socket(self):
        code = 'import socket\nsocket.socket()'
        valid, reason = validate_code(code)
        assert not valid
        assert "socket" in reason

    def test_import_requests(self):
        code = 'import requests\nrequests.get("http://evil.com")'
        valid, reason = validate_code(code)
        assert not valid
        assert "requests" in reason

    def test_import_http(self):
        code = 'import http.client'
        valid, reason = validate_code(code)
        assert not valid
        assert "http" in reason

    def test_from_subprocess_import(self):
        code = 'from subprocess import run'
        valid, reason = validate_code(code)
        assert not valid
        assert "subprocess" in reason

    def test_import_shutil(self):
        code = 'import shutil\nshutil.rmtree("/")'
        valid, reason = validate_code(code)
        assert not valid
        assert "shutil" in reason


# ---------------------------------------------------------------------------
# Forbidden names — should fail
# ---------------------------------------------------------------------------

class TestForbiddenNames:
    def test_dunder_import(self):
        code = '__import__("os").system("whoami")'
        valid, reason = validate_code(code)
        assert not valid
        assert "__import__" in reason

    def test_eval(self):
        code = 'eval("1+1")'
        valid, reason = validate_code(code)
        assert not valid
        assert "eval" in reason

    def test_exec(self):
        code = 'exec("import subprocess")'
        valid, reason = validate_code(code)
        assert not valid
        assert "exec" in reason

    def test_compile(self):
        code = 'compile("code", "<string>", "exec")'
        valid, reason = validate_code(code)
        assert not valid
        assert "compile" in reason

    def test_open(self):
        code = 'open("/etc/passwd").read()'
        valid, reason = validate_code(code)
        assert not valid
        assert "open" in reason

    def test_getattr(self):
        code = 'getattr(os, "system")("whoami")'
        valid, reason = validate_code(code)
        assert not valid
        assert "getattr" in reason

    def test_globals(self):
        code = 'globals()["__builtins__"]'
        valid, reason = validate_code(code)
        assert not valid
        assert "globals" in reason

    def test_breakpoint(self):
        code = 'breakpoint()'
        valid, reason = validate_code(code)
        assert not valid
        assert "breakpoint" in reason


# ---------------------------------------------------------------------------
# Forbidden os attributes — should fail
# ---------------------------------------------------------------------------

class TestForbiddenOsAttrs:
    def test_os_system(self):
        code = 'import os\nos.system("rm -rf /")'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.system" in reason

    def test_os_popen(self):
        code = 'import os\nos.popen("cat /etc/passwd")'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.popen" in reason

    def test_os_remove(self):
        code = 'import os\nos.remove("/important/file")'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.remove" in reason

    def test_os_listdir(self):
        code = 'import os\nos.listdir("/")'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.listdir" in reason

    def test_os_path(self):
        code = 'import os\nos.path.exists("/etc/passwd")'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.path" in reason

    def test_os_kill(self):
        code = 'import os\nos.kill(1, 9)'
        valid, reason = validate_code(code)
        assert not valid
        assert "os.kill" in reason

    def test_from_os_import_system(self):
        code = 'from os import system\nsystem("whoami")'
        valid, reason = validate_code(code)
        assert not valid
        assert "system" in reason

    def test_from_os_import_popen(self):
        code = 'from os import popen'
        valid, reason = validate_code(code)
        assert not valid
        assert "popen" in reason


# ---------------------------------------------------------------------------
# Syntax errors — should fail gracefully
# ---------------------------------------------------------------------------

class TestSyntaxErrors:
    def test_invalid_syntax(self):
        code = 'def foo(:\n  pass'
        valid, reason = validate_code(code)
        assert not valid
        assert "Syntax error" in reason

    def test_empty_string(self):
        """Empty code is syntactically valid (no-op)."""
        valid, reason = validate_code("")
        assert valid

    def test_incomplete_code(self):
        code = 'if True'
        valid, reason = validate_code(code)
        assert not valid
        assert "Syntax error" in reason


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_forbidden_name_in_string_is_ok(self):
        """String literals containing forbidden names should not trigger."""
        code = '''
import cadquery as cq
import os

# This string mentions eval but doesn't call it
name = "eval is a function"
result = cq.Workplane("XY").box(10, 10, 10)
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"

    def test_forbidden_name_in_comment_is_ok(self):
        """Comments mentioning forbidden names should not trigger."""
        code = '''
import cadquery as cq
import os

# Don't use exec or eval here
result = cq.Workplane("XY").box(10, 10, 10)
cq.exporters.export(result, os.environ["OUTPUT_PATH"])
'''
        valid, reason = validate_code(code)
        assert valid, f"Expected valid, got: {reason}"

    def test_relative_import(self):
        code = 'from . import something'
        valid, reason = validate_code(code)
        assert not valid
        assert "Relative import" in reason
