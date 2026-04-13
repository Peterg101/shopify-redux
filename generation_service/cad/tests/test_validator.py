"""Tests for cad/validator.py.

No external dependencies needed. Tests parameter change detection,
tag removal detection, bounding box checks, and volume checks.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from cad.validator import check_parameters, check_tags, check_bbox, check_volume


class TestCheckParameters:
    def test_no_changes(self):
        old = "length = 100\nwidth = 60\nresult = cq.box(length, width, 5)"
        new = "length = 100\nwidth = 60\nresult = cq.box(length, width, 5)"
        result = check_parameters(old, new, "make it taller")
        assert result is None

    def test_mentioned_change_allowed(self):
        old = "height = 20\nresult = cq.box(10, 10, height)"
        new = "height = 30\nresult = cq.box(10, 10, height)"
        result = check_parameters(old, new, "increase the height to 30")
        assert result is None

    def test_unmentioned_change_rejected(self):
        old = "length = 100\nwidth = 60\nresult = cq.box(length, width, 5)"
        new = "length = 100\nwidth = 80\nresult = cq.box(length, width, 5)"
        result = check_parameters(old, new, "make it taller")
        # Note: check_parameters uses naive substring matching.
        # "width" is not in "make it taller" → should be flagged
        assert result is not None


class TestCheckTags:
    def test_all_tags_present(self):
        old = 'result = box.tag("body")\nresult = result.tag("holes")'
        new = 'result = box.tag("body")\nresult = result.tag("holes")\nresult = result.tag("new")'
        result = check_tags(old, new)
        assert result is None

    def test_tag_removed(self):
        old = 'result = box.tag("body")\nresult = result.tag("holes")\nresult = result.tag("fillet")'
        new = 'result = box.tag("body")\nresult = result.tag("fillet")'
        result = check_tags(old, new)
        assert result is not None
        assert "holes" in result


class TestCheckBbox:
    def test_within_tolerance(self):
        old_meta = {"bbox": {"xlen": 100, "ylen": 60, "zlen": 20}}
        new_meta = {"bbox": {"xlen": 100.3, "ylen": 60.1, "zlen": 20}}
        result = check_bbox(old_meta, new_meta, "add a small hole")
        assert result is None

    def test_large_change_flagged(self):
        old_meta = {"bbox": {"xlen": 100, "ylen": 60, "zlen": 20}}
        new_meta = {"bbox": {"xlen": 200, "ylen": 60, "zlen": 20}}
        result = check_bbox(old_meta, new_meta, "add a small hole")
        assert result is not None

    def test_missing_bbox_in_old(self):
        result = check_bbox({}, {"bbox": {"xlen": 100}}, "test")
        assert result is None

    def test_missing_bbox_in_new(self):
        result = check_bbox({"bbox": {"xlen": 100}}, {}, "test")
        assert result is None


class TestCheckVolume:
    def test_small_change_passes(self):
        old_meta = {"volume_mm3": 10000}
        new_meta = {"volume_mm3": 9500}
        result = check_volume(old_meta, new_meta, "add a hole")
        assert result is None

    def test_large_change_flagged(self):
        old_meta = {"volume_mm3": 10000}
        new_meta = {"volume_mm3": 2000}
        result = check_volume(old_meta, new_meta, "add a small notch")
        assert result is not None

    def test_zero_old_volume(self):
        result = check_volume({"volume_mm3": 0}, {"volume_mm3": 10000}, "test")
        assert result is None

    def test_missing_volume_in_old(self):
        result = check_volume({}, {"volume_mm3": 10000}, "test")
        assert result is None
