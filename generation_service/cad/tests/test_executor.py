"""Tests for pure functions in cad/executor.py.

No Docker needed. Tests code validation and LLM code stripping.
Skips if docker module isn't installed (local dev without Docker SDK).
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

try:
    from cad.executor import validate_code, _strip_llm_code
except ImportError:
    pytest.skip("docker module not installed", allow_module_level=True)


class TestValidateCode:
    def test_clean_cadquery_script(self):
        code = "import cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)"
        issues = validate_code(code)
        assert not any(i["level"] == "error" for i in issues)

    def test_forbidden_import_subprocess(self):
        code = "import subprocess\nresult = subprocess.run(['ls'])"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) > 0
        assert any("subprocess" in str(i) for i in errors)

    def test_forbidden_import_os_system(self):
        code = "import os\nos.system('rm -rf /')"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) > 0

    def test_forbidden_builtin_eval(self):
        code = "result = eval('1+1')"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) > 0

    def test_forbidden_builtin_exec(self):
        code = "exec('import os')"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) > 0

    def test_allowed_imports(self):
        code = "import cadquery as cq\nimport math\nresult = cq.Workplane('XY').box(10, 10, 10)"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) == 0

    def test_syntax_error(self):
        code = "def foo(:\n    pass"
        issues = validate_code(code)
        errors = [i for i in issues if i["level"] == "error"]
        assert len(errors) > 0


class TestStripLlmCode:
    def test_removes_export_line(self):
        code = "result = cq.Workplane('XY').box(10, 10, 10)\ncq.exporters.export(result, 'out.step')"
        stripped = _strip_llm_code(code)
        assert "export" not in stripped
        assert "result = " in stripped

    def test_removes_print(self):
        code = "result = cq.Workplane('XY').box(10, 10, 10)\nprint(result)"
        stripped = _strip_llm_code(code)
        assert "print" not in stripped

    def test_preserves_normal_code(self):
        code = "import cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)"
        stripped = _strip_llm_code(code)
        assert stripped.strip() == code.strip()

    def test_removes_show_object(self):
        code = "result = cq.Workplane('XY').box(10, 10, 10)\nshow_object(result)"
        stripped = _strip_llm_code(code)
        assert "show_object" not in stripped
