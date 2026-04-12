"""Tests for the JSON→CadQuery converter and constraint resolver.

These tests run WITHOUT Docker, CadQuery, Redis, or Anthropic.
They test the converter's Python output (string matching) and the
constraint resolver's arithmetic.

Run: cd generation_service && python -m pytest cad/tests/test_converter.py -v
"""
import pytest
import sys
import os

# Add parent to path so we can import cad modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from cad.converter import (
    convert_json_to_cadquery,
    resolve_position,
    resolve_hole_placement,
    _resolve_param,
    _resolve_axis,
    _ConstraintFaceTracker,
)


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------


class TestConverterValidation:
    def test_empty_steps_raises(self):
        with pytest.raises(ValueError, match="empty"):
            convert_json_to_cadquery([], {})

    def test_missing_tag_raises(self):
        steps = [{"op": "create_box", "length": 10, "width": 10, "height": 10, "depends_on": []}]
        with pytest.raises(ValueError, match="tag"):
            convert_json_to_cadquery(steps, {})

    def test_duplicate_tags_raises(self):
        steps = [
            {"op": "create_box", "tag": "body", "length": 10, "width": 10, "height": 10, "depends_on": []},
            {"op": "fillet", "tag": "body", "radius": 1, "edges": "|Z", "depends_on": ["body"]},
        ]
        with pytest.raises(ValueError, match="Duplicate"):
            convert_json_to_cadquery(steps, {})

    def test_unknown_op_raises(self):
        steps = [{"op": "magic_wand", "tag": "x", "depends_on": []}]
        with pytest.raises(ValueError, match="Unknown"):
            convert_json_to_cadquery(steps, {})

    def test_no_base_solid_raises(self):
        steps = [{"op": "fillet", "tag": "f", "radius": 1, "edges": "|Z", "depends_on": []}]
        with pytest.raises(ValueError, match="base solid"):
            convert_json_to_cadquery(steps, {})


# ---------------------------------------------------------------------------
# Parameter resolution tests
# ---------------------------------------------------------------------------


class TestParameterResolution:
    def test_literal_number(self):
        assert _resolve_param(42.0, {}) == 42.0

    def test_simple_reference(self):
        assert _resolve_param("$length", {"length": 100.0}) == 100.0

    def test_expression(self):
        result = _resolve_param("$length / 2 - $wall", {"length": 100.0, "wall": 2.0})
        assert result == 48.0

    def test_expression_with_multiplication(self):
        result = _resolve_param("$boss_dia / 2", {"boss_dia": 6.0})
        assert result == 3.0

    def test_undefined_param_raises(self):
        with pytest.raises(ValueError):
            _resolve_param("$nonexistent", {})

    def test_string_number(self):
        assert _resolve_param("42.5", {}) == 42.5

    def test_passthrough_non_string(self):
        assert _resolve_param([1, 2], {}) == [1, 2]


# ---------------------------------------------------------------------------
# Constraint resolver tests
# ---------------------------------------------------------------------------


class TestResolveAxis:
    def test_center(self):
        assert _resolve_axis("center", 100, 10) == 0.0

    def test_from_bottom(self):
        # Face is 40mm tall, feature is 5mm tall, offset 6mm from bottom
        # Result: -40/2 + 6 + 5/2 = -20 + 6 + 2.5 = -11.5
        result = _resolve_axis({"from": "bottom", "offset": 6}, 40, 5)
        assert result == pytest.approx(-11.5)

    def test_from_top(self):
        # Face is 40mm tall, feature is 5mm tall, offset 6mm from top
        # Result: 40/2 - 6 - 5/2 = 20 - 6 - 2.5 = 11.5
        result = _resolve_axis({"from": "top", "offset": 6}, 40, 5)
        assert result == pytest.approx(11.5)

    def test_from_left(self):
        # Face is 100mm wide, feature is 12mm wide, offset 10mm from left
        # Result: -100/2 + 10 + 12/2 = -50 + 10 + 6 = -34
        result = _resolve_axis({"from": "left", "offset": 10}, 100, 12)
        assert result == pytest.approx(-34.0)

    def test_from_right(self):
        # Face is 100mm wide, feature is 12mm wide, offset 10mm from right
        # Result: 100/2 - 10 - 12/2 = 50 - 10 - 6 = 34
        result = _resolve_axis({"from": "right", "offset": 10}, 100, 12)
        assert result == pytest.approx(34.0)

    def test_raw_number(self):
        assert _resolve_axis(15.5, 100, 10) == 15.5


class TestResolvePosition:
    def test_raw_coordinates_passthrough(self):
        result = resolve_position([42, 22], 100, 60)
        assert result == [42.0, 22.0]

    def test_center_center(self):
        result = resolve_position({"h": "center", "v": "center"}, 100, 60)
        assert result == [0.0, 0.0]

    def test_usb_cutout_position(self):
        # "USB cutout centered, 6mm from bottom" on a 100x40mm rear face
        # with a 9x3.5mm cutout
        result = resolve_position(
            {"h": "center", "v": {"from": "bottom", "offset": 6}},
            100, 40, 9, 3.5
        )
        assert result[0] == pytest.approx(0.0)
        assert result[1] == pytest.approx(-12.25)  # -20 + 6 + 1.75


class TestResolveHolePlacement:
    def test_raw_positions_passthrough(self):
        result = resolve_hole_placement([[10, 20], [-10, -20]], 100, 60)
        assert result == [(10.0, 20.0), (-10.0, -20.0)]

    def test_corners_inset(self):
        # 100x60 face, 8mm inset from corners
        result = resolve_hole_placement({"type": "corners", "inset": 8}, 100, 60)
        assert len(result) == 4
        # Bottom-left: (-50+8, -30+8) = (-42, -22)
        assert result[0] == pytest.approx((-42.0, -22.0), abs=0.01)
        # Top-right: (50-8, 30-8) = (42, 22)
        assert result[2] == pytest.approx((42.0, 22.0), abs=0.01)

    def test_center_placement(self):
        result = resolve_hole_placement({"type": "center"}, 100, 60)
        assert result == [(0.0, 0.0)]

    def test_grid_placement(self):
        result = resolve_hole_placement(
            {"type": "grid", "rows": 2, "cols": 2, "spacing_h": 40, "spacing_v": 20},
            100, 60
        )
        assert len(result) == 4
        # Should be centered: (-20,-10), (20,-10), (-20,10), (20,10)
        assert result[0] == pytest.approx((-20.0, -10.0), abs=0.01)
        assert result[3] == pytest.approx((20.0, 10.0), abs=0.01)

    def test_along_edge(self):
        result = resolve_hole_placement(
            {"type": "along_edge", "edge": "top", "count": 3, "inset": 5, "margin": 10},
            100, 60
        )
        assert len(result) == 3
        # All at y = 30-5 = 25 (top edge, inset 5mm)
        for p in result:
            assert p[1] == pytest.approx(25.0, abs=0.01)
        # X positions evenly spaced across 80mm (100-2*10 margin)
        assert result[0][0] == pytest.approx(-40.0, abs=0.01)
        assert result[1][0] == pytest.approx(0.0, abs=0.01)
        assert result[2][0] == pytest.approx(40.0, abs=0.01)


# ---------------------------------------------------------------------------
# Face tracker tests
# ---------------------------------------------------------------------------


class TestConstraintFaceTracker:
    def test_box_face_dims(self):
        tracker = _ConstraintFaceTracker()
        tracker.after_base_box(100, 60, 40)
        assert tracker.get_face_dims(">Z") == (100, 60)
        assert tracker.get_face_dims("<Z") == (100, 60)
        assert tracker.get_face_dims(">Y") == (100, 40)
        assert tracker.get_face_dims("<Y") == (100, 40)
        assert tracker.get_face_dims(">X") == (60, 40)
        assert tracker.get_face_dims("<X") == (60, 40)

    def test_unknown_face_returns_none(self):
        tracker = _ConstraintFaceTracker()
        assert tracker.get_face_dims(">Z") is None

    def test_shell_records_thickness(self):
        tracker = _ConstraintFaceTracker()
        tracker.after_base_box(100, 60, 40)
        tracker.after_shell(2.0)
        assert tracker.wall_thickness == 2.0


# ---------------------------------------------------------------------------
# Code generation tests (string matching on output)
# ---------------------------------------------------------------------------


class TestCodeGeneration:
    def _simple_box(self, **extra_params):
        params = {"length": 100.0, "width": 60.0, "height": 5.0, **extra_params}
        steps = [
            {"op": "create_box", "tag": "plate", "length": "$length",
             "width": "$width", "height": "$height", "depends_on": []},
        ]
        return convert_json_to_cadquery(steps, params)

    def test_create_box_output(self):
        code = self._simple_box()
        assert "cq.Workplane" in code
        assert ".box(length, width, height)" in code
        assert '.tag("plate")' in code
        assert "result = " in code

    def test_parameter_declarations(self):
        code = self._simple_box()
        assert "length = 100.0" in code
        assert "width = 60.0" in code
        assert "height = 5.0" in code

    def test_feature_tracking_init(self):
        code = self._simple_box()
        assert "_features = []" in code
        assert "_step = 0" in code

    def test_no_export_or_print(self):
        code = self._simple_box()
        assert "export" not in code.lower()
        assert "print(" not in code

    def test_fillet_has_try_except(self):
        params = {"length": 100.0, "width": 60.0, "height": 5.0, "r": 2.0}
        steps = [
            {"op": "create_box", "tag": "plate", "length": "$length",
             "width": "$width", "height": "$height", "depends_on": []},
            {"op": "fillet", "tag": "fillets", "radius": "$r",
             "edges": "|Z", "depends_on": ["plate"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        assert "try:" in code
        assert "except" in code
        assert ".fillet(" in code

    def test_shell_output(self):
        params = {"length": 100.0, "width": 60.0, "height": 40.0, "wall": 2.0}
        steps = [
            {"op": "create_box", "tag": "body", "length": "$length",
             "width": "$width", "height": "$height", "depends_on": []},
            {"op": "shell", "tag": "shell", "thickness": "$wall",
             "open_faces": [">Z"], "depends_on": ["body"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        assert ".shell(-" in code
        assert '.tag("shell")' in code

    def test_operation_ordering(self):
        """Shell should come before cuts, fillets last."""
        params = {"l": 100.0, "w": 60.0, "h": 40.0, "t": 2.0, "r": 1.0, "d": 5.0}
        steps = [
            {"op": "fillet", "tag": "fillets", "radius": "$r", "edges": "|Z", "depends_on": ["body"]},
            {"op": "cut_blind", "tag": "slot", "face": ">Z", "profile": {"type": "rect", "width": 20, "height": 5, "position": [0, 0]}, "depth": "$d", "depends_on": ["shell"]},
            {"op": "create_box", "tag": "body", "length": "$l", "width": "$w", "height": "$h", "depends_on": []},
            {"op": "shell", "tag": "shell", "thickness": "$t", "open_faces": [">Z"], "depends_on": ["body"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        # Check ordering in generated code
        box_pos = code.index(".box(")
        shell_pos = code.index(".shell(")
        cut_pos = code.index(".cutBlind(")
        fillet_pos = code.index(".fillet(")
        assert box_pos < shell_pos < cut_pos < fillet_pos

    def test_clean_before_fillets(self):
        params = {"l": 100.0, "w": 60.0, "h": 5.0, "hd": 4.5, "r": 2.0}
        steps = [
            {"op": "create_box", "tag": "plate", "length": "$l", "width": "$w", "height": "$h", "depends_on": []},
            {"op": "holes", "tag": "holes", "face": ">Z", "diameter": "$hd",
             "pattern": "explicit", "positions": [[10, 10]], "depends_on": ["plate"]},
            {"op": "fillet", "tag": "fillets", "radius": "$r", "edges": "|Z", "depends_on": ["holes"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        clean_pos = code.index("result = result.clean()")
        fillet_pos = code.index(".fillet(")
        assert clean_pos < fillet_pos

    def test_holes_explicit_positions(self):
        params = {"l": 100.0, "w": 60.0, "h": 5.0, "hd": 4.5}
        steps = [
            {"op": "create_box", "tag": "plate", "length": "$l", "width": "$w", "height": "$h", "depends_on": []},
            {"op": "holes", "tag": "holes", "face": ">Z", "diameter": "$hd",
             "pattern": "explicit", "positions": [[42, 22], [-42, -22]],
             "depends_on": ["plate"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        assert ".pushPoints(" in code
        assert "(42" in code or "42.0" in code
        assert ".hole(" in code

    def test_holes_corners_constraint(self):
        """Corner placement constraint should resolve to 4 positions."""
        params = {"l": 100.0, "w": 60.0, "h": 5.0, "hd": 4.5}
        steps = [
            {"op": "create_box", "tag": "plate", "length": "$l", "width": "$w", "height": "$h", "depends_on": []},
            {"op": "holes", "tag": "holes", "face": ">Z", "diameter": "$hd",
             "placement": {"type": "corners", "inset": 8},
             "depends_on": ["plate"]},
        ]
        code = convert_json_to_cadquery(steps, params)
        assert ".pushPoints(" in code
        # Should have 4 points with values near 42 and 22
        assert "42" in code
        assert "22" in code
