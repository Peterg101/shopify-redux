"""Anthropic tool-use schemas for the CAD design conversation.

Claude uses these tools to emit structured output, eliminating the need to
parse JSON blocks from prose. The tool selected by the model determines the
conversation phase the frontend sees.
"""

SUBMIT_SPEC_TOOL = {
    "name": "submit_cad_spec",
    "description": (
        "Call this when the user has provided enough information to generate "
        "the CAD model. Required: a clear description, overall dimensions, "
        "manufacturing process, and material. Do NOT call this until you have "
        "those four things — ask the user via ask_clarification instead."
    ),
    "input_schema": {
        "type": "object",
        "required": ["part_name", "description", "dimensions", "process", "material"],
        "properties": {
            "part_name": {
                "type": "string",
                "maxLength": 60,
                "description": "Short human-readable title for this part (e.g. 'M3 cable bracket').",
            },
            "description": {
                "type": "string",
                "description": "One-line summary of what the part is.",
            },
            "purpose": {
                "type": "string",
                "description": "What it's for and how it's used.",
            },
            "dimensions": {
                "type": "object",
                "required": ["length", "width", "height", "units"],
                "properties": {
                    "length": {"type": "number"},
                    "width": {"type": "number"},
                    "height": {"type": "number"},
                    "units": {"type": "string", "enum": ["mm", "inches"]},
                },
            },
            "wall_thickness": {
                "type": "number",
                "description": "Wall thickness in mm if the part is a shell/enclosure.",
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
                "description": "Discrete geometric features (holes, slots, fillets, etc.).",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "description": {"type": "string"},
                        "count": {"type": "integer"},
                        "diameter": {"type": "number"},
                        "position": {"type": "string"},
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
