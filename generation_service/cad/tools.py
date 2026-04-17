"""Anthropic tool-use schemas for the CAD design conversation.

Claude uses these tools to emit structured output, eliminating the need to
parse JSON blocks from prose. The tool selected by the model determines the
conversation phase the frontend sees.
"""

SUBMIT_SPEC_TOOL = {
    "name": "submit_cad_spec",
    "description": (
        "Call this when the user has provided enough information to generate "
        "the CAD model. Required: a clear description, base shape, overall "
        "dimensions, manufacturing process, and material. Do NOT call this "
        "until you have those — ask the user via ask_clarification instead."
    ),
    "input_schema": {
        "type": "object",
        "required": ["part_name", "description", "base_shape", "dimensions", "process", "material"],
        "properties": {
            "part_name": {
                "type": "string",
                "maxLength": 60,
                "description": "Short human-readable title (e.g. 'M3 cable bracket').",
            },
            "description": {
                "type": "string",
                "description": "Full description including spatial details the generator needs.",
            },
            "purpose": {
                "type": "string",
                "description": "What it's for and how it's used.",
            },
            "base_shape": {
                "type": "string",
                "enum": ["box", "cylinder", "sphere", "cone", "loft"],
                "description": (
                    "The fundamental shape: box (rectangular), cylinder (round), "
                    "sphere, cone (tapered cylinder — specify top and bottom diameters), "
                    "or loft (varying cross-sections at different heights)."
                ),
            },
            "dimensions": {
                "type": "object",
                "required": ["units"],
                "properties": {
                    "length": {"type": "number", "description": "X dimension (for box)"},
                    "width": {"type": "number", "description": "Y dimension (for box)"},
                    "height": {"type": "number", "description": "Z dimension / total height"},
                    "radius": {"type": "number", "description": "Radius (for cylinder/sphere)"},
                    "diameter": {"type": "number", "description": "Diameter (alternative to radius)"},
                    "top_diameter": {"type": "number", "description": "Diameter at the top (for cones/tapers)"},
                    "bottom_diameter": {"type": "number", "description": "Diameter at the bottom (for cones/tapers)"},
                    "units": {"type": "string", "enum": ["mm", "inches"]},
                },
            },
            "cross_sections": {
                "type": "array",
                "description": (
                    "For loft shapes: define cross-sections at different heights. "
                    "Each section has a shape, size, and height offset."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "shape": {"type": "string", "enum": ["circle", "rectangle", "polygon"]},
                        "width": {"type": "number"},
                        "height_offset": {"type": "number", "description": "Z offset from base"},
                        "diameter": {"type": "number"},
                    },
                },
            },
            "wall_thickness": {
                "type": "number",
                "description": "Wall thickness in mm if the part is hollow/shelled.",
            },
            "hollow": {
                "type": "boolean",
                "description": "Whether the part should be hollow (shelled).",
            },
            "open_faces": {
                "type": "array",
                "description": "Which faces are open (e.g. ['top'] for an open-top container).",
                "items": {"type": "string", "enum": ["top", "bottom", "front", "back", "left", "right"]},
            },
            "process": {
                "type": "string",
                "enum": ["fdm", "sla", "sls", "cnc", "injection"],
            },
            "material": {
                "type": "string",
                "description": "Material category (e.g. 'plastic', 'metal', 'rubber').",
            },
            "features": {
                "type": "array",
                "description": "Discrete geometric features (holes, slots, fillets, cutouts, bosses, etc.).",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "count": {"type": "integer"},
                        "diameter": {"type": "number"},
                        "width": {"type": "number"},
                        "height": {"type": "number"},
                        "depth": {"type": "number"},
                        "position": {
                            "type": "string",
                            "description": "Where on the part (e.g. '8mm from each corner', 'centered on rear wall 6mm from bottom').",
                        },
                        "face": {
                            "type": "string",
                            "description": "Which face (top, bottom, front, back, left, right).",
                        },
                    },
                },
            },
            "tolerances": {"type": "string"},
            "notes": {"type": "string"},
        },
    },
}


ASK_CLARIFICATION_TOOL = {
    "name": "ask_clarification",
    "description": (
        "Call this when you need to ask the user a clarifying question before "
        "you can produce the CAD spec. Ask ONE focused question per call. "
        "Use this for both freeform (open-ended) and guided (specific dimensions) "
        "questions — the assistant decides which based on context."
    ),
    "input_schema": {
        "type": "object",
        "required": ["question"],
        "properties": {
            "question": {
                "type": "string",
                "description": "The question to show the user.",
            },
            "reason": {
                "type": "string",
                "description": "Brief note on why you need this information.",
            },
            "phase": {
                "type": "string",
                "enum": ["freeform", "guided"],
                "description": (
                    "freeform = exploring purpose/intent. "
                    "guided = nailing down specific engineering details."
                ),
            },
        },
    },
}


CAD_TOOLS = [SUBMIT_SPEC_TOOL, ASK_CLARIFICATION_TOOL]
