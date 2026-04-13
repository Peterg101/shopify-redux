"""Tests for pure functions in cad/conversation.py.

No Redis, no Anthropic API needed. Tests response parsing, design intent
formatting, image handling, and spec-to-prompt conversion.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from cad.conversation import (
    _parse_response,
    _build_design_intent_block,
    _clean_image_b64,
    _make_image_block,
    spec_to_prompt,
)


class TestParseResponse:
    def test_with_json_block(self):
        text = 'Great, here are my questions.\n\n```json\n{"phase": "freeform", "spec": null}\n```'
        display, phase, spec = _parse_response(text)
        assert display == "Great, here are my questions."
        assert phase == "freeform"
        assert spec is None

    def test_confirmation_with_spec(self):
        text = 'Here is the spec:\n\n```json\n{"phase": "confirmation", "spec": {"description": "A plate", "dimensions": {"length": 100}}}\n```'
        display, phase, spec = _parse_response(text)
        assert phase == "confirmation"
        assert spec["description"] == "A plate"
        assert spec["dimensions"]["length"] == 100

    def test_no_json_block(self):
        text = "I need to know more about the dimensions."
        display, phase, spec = _parse_response(text)
        assert display == text
        assert phase == "freeform"
        assert spec is None

    def test_confirmed_phase(self):
        text = 'Generating.\n\n```json\n{"phase": "confirmed", "spec": {"description": "Done"}}\n```'
        display, phase, spec = _parse_response(text)
        assert phase == "confirmed"
        assert spec["description"] == "Done"

    def test_malformed_json_returns_freeform(self):
        text = 'Here:\n\n```json\n{not valid json}\n```'
        display, phase, spec = _parse_response(text)
        assert phase == "freeform"
        assert spec is None


class TestBuildDesignIntent:
    def test_full_intent(self):
        intent = {
            "process": "fdm",
            "material_hint": "plastic",
            "approximate_size": {"width": 100, "depth": 60, "height": 40},
            "target_units": "mm",
            "features": ["hollow", "fillets"],
        }
        result = _build_design_intent_block(intent)
        assert "FDM" in result
        assert "plastic" in result
        assert "100" in result
        assert "hollow" in result

    def test_empty_intent(self):
        assert _build_design_intent_block(None) == ""
        assert _build_design_intent_block({}) == ""

    def test_process_only(self):
        result = _build_design_intent_block({"process": "cnc"})
        assert "CNC" in result

    def test_non_mm_units(self):
        result = _build_design_intent_block({"target_units": "inches"})
        assert "inches" in result

    def test_mm_units_not_shown(self):
        result = _build_design_intent_block({"target_units": "mm"})
        assert "Units" not in result


class TestImageHandling:
    def test_png_detection(self):
        media_type, data = _clean_image_b64("iVBORw0KGgoAAAA")
        assert media_type == "image/png"
        assert data == "iVBORw0KGgoAAAA"

    def test_jpeg_detection(self):
        media_type, data = _clean_image_b64("/9j/4AAQSkZJRg")
        assert media_type == "image/jpeg"

    def test_data_uri_stripping(self):
        media_type, data = _clean_image_b64("data:image/jpeg;base64,/9j/4AAQ")
        assert media_type == "image/jpeg"
        assert data == "/9j/4AAQ"

    def test_make_image_block(self):
        block = _make_image_block("iVBORw0KGgoAAAA")
        assert block["type"] == "image"
        assert block["source"]["type"] == "base64"
        assert block["source"]["media_type"] == "image/png"


class TestSpecToPrompt:
    def test_full_spec(self):
        spec = {
            "description": "A mounting plate",
            "purpose": "Mount a sensor",
            "dimensions": {"length": 100, "width": 60, "height": 5, "units": "mm"},
            "wall_thickness": 2,
            "features": [
                {"description": "M4 holes", "diameter": 4.5, "count": 4, "position": "corners"}
            ],
            "tolerances": "+/- 0.3mm",
            "notes": "FDM printable",
        }
        result = spec_to_prompt(spec)
        assert "mounting plate" in result
        assert "100 x 60 x 5" in result
        assert "M4 holes" in result
        assert "4.5" in result
        assert "0.3mm" in result

    def test_minimal_spec(self):
        result = spec_to_prompt({"description": "A box"})
        assert "box" in result

    def test_with_design_intent(self):
        result = spec_to_prompt(
            {"description": "A bracket"},
            {"process": "cnc", "material_hint": "metal"}
        )
        assert "CNC" in result
        assert "metal" in result

    def test_empty_spec(self):
        result = spec_to_prompt({})
        assert isinstance(result, str)
