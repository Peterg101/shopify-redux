"""Tests for pure functions in cad/llm.py.

No LLM calls, no API keys needed. Tests error classification, code extraction,
parameter parsing, and JSON extraction.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from cad.llm import classify_error, extract_code, extract_parameters, _extract_json


class TestClassifyError:
    def test_brep_api_error(self):
        result = classify_error("BRep_API: command not done at some point")
        assert "fillet" in result.lower() or "chamfer" in result.lower()
        assert "radius" in result.lower()

    def test_null_object_error(self):
        result = classify_error("Standard_NullObject raised in selector")
        assert "selector" in result.lower()

    def test_wire_not_closed(self):
        result = classify_error("Wire is not closed")
        assert "closed" in result.lower()

    def test_shapes_empty(self):
        result = classify_error("Shapes is empty after selection")
        assert "selector" in result.lower()

    def test_no_result_defined(self):
        result = classify_error("name 'result' is not defined")
        assert "result" in result.lower()

    def test_unknown_error_returns_raw(self):
        result = classify_error("Some completely unknown error message")
        assert "Some completely unknown error message" in result

    def test_multiple_matches(self):
        # Error containing multiple known patterns should include hints for both
        result = classify_error("BRep_API: command not done and Standard_NullObject too")
        assert "fillet" in result.lower() or "radius" in result.lower()


class TestExtractCode:
    def test_code_in_python_fences(self):
        text = "Here's the code:\n```python\nimport cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)\n```"
        result = extract_code(text)
        assert "import cadquery" in result
        assert "result = " in result

    def test_code_in_generic_fences(self):
        text = "```\nimport cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)\n```"
        result = extract_code(text)
        assert "import cadquery" in result

    def test_bare_code_starting_with_import(self):
        text = "import cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)"
        result = extract_code(text)
        assert "import cadquery" in result

    def test_bare_code_starting_with_comment(self):
        text = "# CadQuery script\nimport cadquery as cq\nresult = cq.Workplane('XY').box(10, 10, 10)"
        result = extract_code(text)
        assert "import cadquery" in result

    def test_non_code_becomes_clarification(self):
        text = "I need more information about the dimensions."
        result = extract_code(text)
        assert result.startswith("CLARIFICATION:")


class TestExtractParameters:
    def test_simple_assignments(self):
        script = "length = 100.0\nwidth = 60.0\nresult = cq.Workplane('XY').box(length, width, 5)"
        params = extract_parameters(script)
        names = [p["name"] for p in params]
        assert "length" in names
        assert "width" in names

    def test_int_and_float(self):
        script = "count = 4\nradius = 2.5\nresult = None"
        params = extract_parameters(script)
        types = {p["name"]: p["type"] for p in params}
        assert types["count"] == "int"
        assert types["radius"] == "float"

    def test_ignores_string_assignments(self):
        script = 'name = "test"\nlength = 100.0\nresult = None'
        params = extract_parameters(script)
        names = [p["name"] for p in params]
        assert "name" not in names
        assert "length" in names

    def test_empty_script(self):
        assert extract_parameters("") == []

    def test_syntax_error_returns_empty(self):
        assert extract_parameters("this is not valid python {{{") == []


class TestExtractJson:
    def test_json_in_fences(self):
        text = 'Here:\n```json\n{"parameters": {}, "steps": []}\n```'
        result = _extract_json(text)
        assert "parameters" in result
        assert "steps" in result

    def test_bare_json(self):
        text = '{"parameters": {"length": 100}, "steps": []}'
        result = _extract_json(text)
        assert result["parameters"]["length"] == 100

    def test_json_with_surrounding_text(self):
        text = 'Here is the result:\n{"parameters": {}, "steps": [{"op": "create_box"}]}\nDone.'
        result = _extract_json(text)
        assert len(result["steps"]) == 1

    def test_no_json_returns_error(self):
        text = "This is just plain text with no JSON at all."
        result = _extract_json(text)
        assert "error" in result

    def test_braces_in_strings(self):
        text = '{"parameters": {}, "steps": [{"op": "create_box", "tag": "body_{test}"}]}'
        result = _extract_json(text)
        assert result["steps"][0]["tag"] == "body_{test}"
