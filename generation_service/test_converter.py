"""Proof-of-concept: test the JSON→CadQuery converter with hardcoded examples.

Run: python test_converter.py
"""
import sys
import json
sys.path.insert(0, ".")

from cad.converter import convert_json_to_cadquery


def test_enclosure():
    """Complex test: shelled enclosure with bosses, cutouts, vents, fillets."""
    parameters = {
        "length": 100.0, "width": 60.0, "height": 40.0,
        "wall": 2.0,
        "boss_dia": 6.0, "boss_height": 10.0,
        "screw_dia": 3.2,
        "usb_width": 12.0, "usb_height": 5.0,
        "vent_width": 20.0, "vent_height": 1.5,
        "fillet_r": 2.0,
    }

    # Boss positions (pre-calculated: length/2 - wall - inset, width/2 - wall - inset)
    # 100/2 - 2 - 8 = 40, 60/2 - 2 - 8 = 20
    boss_positions = [(-40, 20), (40, 20), (-40, -20), (40, -20)]

    steps = [
        {"op": "create_box", "tag": "body",
         "length": "$length", "width": "$width", "height": "$height",
         "depends_on": []},

        {"op": "shell", "tag": "shell",
         "thickness": "$wall", "open_faces": [">Z"],
         "depends_on": ["body"]},
    ]

    # Add 4 bosses as unions
    for i, (bx, by) in enumerate(boss_positions):
        name = ["fl", "fr", "rl", "rr"][i]
        steps.append({
            "op": "union", "tag": f"boss_{name}",
            "body": {
                "type": "cylinder",
                "radius": "$boss_dia / 2",
                "height": "$boss_height",
                "translate": [bx, by, 2.0],  # wall thickness offset
            },
            "depends_on": ["shell"],
        })

    # Screw holes through bosses
    steps.append({
        "op": "holes", "tag": "screw_holes", "face": ">Z",
        "diameter": "$screw_dia", "pattern": "explicit",
        "positions": [list(p) for p in boss_positions],
        "depth": "$boss_height",
        "depends_on": ["boss_fl", "boss_fr", "boss_rl", "boss_rr"],
    })

    # USB cutout on rear wall
    steps.append({
        "op": "cut_blind", "tag": "usb_port", "face": "<Y",
        "profile": {"type": "rect", "width": "$usb_width", "height": "$usb_height", "position": [0.0, -10.0]},
        "depth": "$wall",
        "depends_on": ["shell"],
    })

    # Ventilation slots on left wall
    for i in range(5):
        offset = (i - 2) * 4.0  # -8, -4, 0, 4, 8
        steps.append({
            "op": "cut_blind", "tag": f"vent_{i+1}", "face": "<X",
            "profile": {"type": "rect", "width": "$vent_width", "height": "$vent_height", "position": [0.0, offset]},
            "depth": "$wall",
            "depends_on": ["shell"],
        })

    # Fillets on vertical edges
    steps.append({
        "op": "fillet", "tag": "body_fillets",
        "radius": "$fillet_r", "edges": "|Z",
        "depends_on": ["body"],
    })

    return steps, parameters


if __name__ == "__main__":
    steps, parameters = test_enclosure()

    print("=" * 60)
    print(f"TEST: Shelled enclosure ({len(steps)} operations)")
    print("=" * 60)

    code = convert_json_to_cadquery(steps, parameters)
    print(f"\nGenerated {len(code)} chars of CadQuery code")
    print("\n" + code)
