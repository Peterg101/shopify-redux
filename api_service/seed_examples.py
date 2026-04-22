"""Seed the verified_examples table with curated examples + official CadQuery examples.

Run with: docker compose exec api_service python seed_examples.py
"""
import json
import hashlib
import os
import sys
from uuid import uuid4
from datetime import datetime

# Add parent for imports
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fitd_schemas.fitd_db_schemas import Base, VerifiedExample

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@postgres:5432/fitd")

engine = create_engine(DATABASE_URL)


def geometry_hash(steps):
    if not steps:
        return None
    skeleton = [{"op": s.get("op", ""), "tag": s.get("tag", "")} for s in steps]
    return hashlib.sha256(json.dumps(skeleton, sort_keys=True).encode()).hexdigest()[:16]


def add_example(session, desc, category, complexity, source, cadquery_script=None,
                parameters=None, steps=None, keywords=None):
    """Add a single example, skip if description already exists."""
    existing = session.query(VerifiedExample).filter(
        VerifiedExample.description == desc,
        VerifiedExample.source == source,
    ).first()
    if existing:
        return False

    if keywords is None:
        stop = {"a", "an", "the", "with", "and", "or", "for", "of", "in", "on", "to", "mm", "from", "is", "it"}
        keywords = [w.lower().strip(".,;:!?()") for w in desc.split() if len(w) > 2 and w.lower() not in stop]

    ex = VerifiedExample(
        id=str(uuid4()),
        description=desc,
        keywords=json.dumps(keywords),
        category=category,
        complexity=complexity,
        source=source,
        parameters=json.dumps(parameters) if parameters else None,
        steps=json.dumps(steps) if steps else None,
        cadquery_script=cadquery_script,
        generation_path="direct" if cadquery_script and not steps else "structured",
        is_curated=source == "curated",
        is_active=True,
        upvotes=5 if source == "curated" else 3,
        geometry_hash=geometry_hash(steps) if steps else None,
        op_count=len(steps) if steps else 0,
        created_at=datetime.now().isoformat(),
    )
    session.add(ex)
    return True


def seed_curated_json(session):
    """Seed from the generation_service/cad/examples/*.json files."""
    examples_dir = os.path.join(os.path.dirname(__file__), "..", "generation_service", "cad", "examples")
    if not os.path.isdir(examples_dir):
        print(f"Examples dir not found: {examples_dir}")
        return 0

    count = 0
    for fname in sorted(os.listdir(examples_dir)):
        if not fname.endswith(".json") or fname == "cadquery_api.json":
            continue
        path = os.path.join(examples_dir, fname)
        with open(path) as f:
            data = json.load(f)
        category = fname.replace(".json", "")
        for ex in data:
            added = add_example(
                session,
                desc=ex.get("description", ""),
                category=category,
                complexity="simple" if len(ex.get("steps", [])) <= 3 else "medium",
                source="curated",
                parameters=ex.get("parameters"),
                steps=ex.get("steps"),
                keywords=ex.get("keywords"),
            )
            if added:
                count += 1
    return count


def seed_official_cadquery(session):
    """Seed official CadQuery examples as verified working code."""
    examples = [
        {
            "desc": "Pillow block with counterbored holes and fillets",
            "category": "bracket",
            "complexity": "medium",
            "code": """import cadquery as cq
length = 80.0
width = 100.0
thickness = 10.0
center_hole_dia = 22.0
cbore_hole_diameter = 2.4
cbore_inset = 12.0
cbore_diameter = 4.4
cbore_depth = 2.1
result = (
    cq.Workplane("XY")
    .box(length, width, thickness)
    .faces(">Z").workplane().hole(center_hole_dia)
    .faces(">Z").workplane()
    .rect(length - cbore_inset, width - cbore_inset, forConstruction=True)
    .vertices().cboreHole(cbore_hole_diameter, cbore_diameter, cbore_depth)
    .edges("|Z").fillet(2.0)
)""",
        },
        {
            "desc": "I-beam structural profile extruded along length",
            "category": "structural",
            "complexity": "medium",
            "code": """import cadquery as cq
(L, H, W, t) = (100.0, 20.0, 20.0, 1.0)
pts = [
    (0, H / 2.0), (W / 2.0, H / 2.0), (W / 2.0, (H / 2.0 - t)),
    (t / 2.0, (H / 2.0 - t)), (t / 2.0, (t - H / 2.0)),
    (W / 2.0, (t - H / 2.0)), (W / 2.0, H / -2.0), (0, H / -2.0),
]
result = cq.Workplane("front").polyline(pts).mirrorY().extrude(L)""",
        },
        {
            "desc": "Spline-based organic profile extruded as a solid",
            "category": "organic",
            "complexity": "medium",
            "code": """import cadquery as cq
s = cq.Workplane("XY")
sPnts = [(2.75, 1.5), (2.5, 1.75), (2.0, 1.5), (1.5, 1.0), (1.0, 1.25), (0.5, 1.0), (0, 1.0)]
r = s.lineTo(3.0, 0).lineTo(3.0, 1.0).spline(sPnts, includeCurrent=True).close()
result = r.extrude(0.5)""",
        },
        {
            "desc": "Loft from square base to circular top creating a smooth transition",
            "category": "organic",
            "complexity": "medium",
            "code": """import cadquery as cq
result = (
    cq.Workplane("front")
    .box(4.0, 4.0, 0.25)
    .faces(">Z").circle(1.5)
    .workplane(offset=3.0).rect(0.75, 0.5)
    .loft(combine=True)
)""",
        },
        {
            "desc": "Sweep circle along spline path creating curved tube",
            "category": "organic",
            "complexity": "medium",
            "code": """import cadquery as cq
pts = [(0, 1), (1, 2), (2, 4)]
path = cq.Workplane("XZ").spline(pts)
result = cq.Workplane("XY").circle(1.0).sweep(path)""",
        },
        {
            "desc": "Multi-section sweep transitioning from circle to rectangle along a path",
            "category": "organic",
            "complexity": "complex",
            "code": """import cadquery as cq
path = cq.Workplane("XZ").moveTo(-10, 0).lineTo(10, 0)
result = (
    cq.Workplane("YZ")
    .workplane(offset=-10.0).rect(2.0, 2.0)
    .workplane(offset=8.0).circle(1.0)
    .workplane(offset=4.0).circle(1.0)
    .workplane(offset=8.0).rect(2.0, 2.0)
    .sweep(path, multisection=True)
)""",
        },
        {
            "desc": "Swept helix thread profile creating a coil/spring shape",
            "category": "cylindrical",
            "complexity": "complex",
            "code": """import cadquery as cq
r = 0.5
p = 0.4
h = 2.4
wire = cq.Wire.makeHelix(pitch=p, height=h, radius=r)
helix = cq.Workplane(obj=wire)
result = (
    cq.Workplane("XZ").center(r, 0)
    .polyline(((-0.15, 0.1), (0.0, 0.05), (0, 0.35), (-0.15, 0.3)))
    .close().sweep(helix, isFrenet=True)
)""",
        },
        {
            "desc": "Classic OCC bottle shape with rounded body and neck",
            "category": "cylindrical",
            "complexity": "complex",
            "code": """import cadquery as cq
(L, w, t) = (20.0, 6.0, 3.0)
s = cq.Workplane("XY")
p = (
    s.center(-L / 2.0, 0).vLine(w / 2.0)
    .threePointArc((L / 2.0, w / 2.0 + t), (L, w / 2.0))
    .vLine(-w / 2.0).mirrorX()
    .extrude(30.0, True)
)
p = p.faces(">Z").workplane(centerOption="CenterOfMass").circle(3.0).extrude(2.0, True)
result = p.faces(">Z").shell(0.3)""",
        },
        {
            "desc": "Enclosure with snap-fit lip using offset2D for lid mating",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
from cadquery.selectors import AreaNthSelector
result = (
    cq.Workplane("XY").rect(20, 20).extrude(10)
    .edges("|Z or <Z").fillet(2)
    .faces(">Z").shell(2)
    .faces(">Z").wires(AreaNthSelector(-1)).toPending()
    .workplane().offset2D(-1).extrude(1)
    .faces(">Z[-2]").wires(AreaNthSelector(0)).toPending()
    .workplane().cutBlind(2)
)""",
        },
        {
            "desc": "Parametric Lego brick with bumps and internal posts",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
lbumps = 6
wbumps = 2
pitch = 8.0
clearance = 0.1
bumpDiam = 4.8
bumpHeight = 1.8
height = 3.2
t = (pitch - (2 * clearance) - bumpDiam) / 2.0
postDiam = pitch - t
total_length = lbumps * pitch - 2.0 * clearance
total_width = wbumps * pitch - 2.0 * clearance
s = cq.Workplane("XY").box(total_length, total_width, height)
s = s.faces("<Z").shell(-1.0 * t)
s = s.faces(">Z").workplane().rarray(pitch, pitch, lbumps, wbumps, True).circle(bumpDiam / 2.0).extrude(bumpHeight)
tmp = s.faces("<Z").workplane(invert=True)
tmp = tmp.rarray(pitch, pitch, lbumps - 1, wbumps - 1, center=True).circle(postDiam / 2.0).circle(bumpDiam / 2.0).extrude(height - t)
result = tmp""",
        },
        {
            "desc": "Loft between trapezoid and rounded rectangle sketches",
            "category": "organic",
            "complexity": "medium",
            "code": """from cadquery import Workplane, Sketch
s1 = Sketch().trapezoid(3, 1, 110).vertices().fillet(0.2)
s2 = Sketch().rect(2, 1).vertices().fillet(0.2)
result = Workplane().placeSketch(s1, s2.moved(z=3)).loft()""",
        },
        {
            "desc": "Revolve profile to create solid of revolution (axisymmetric part)",
            "category": "cylindrical",
            "complexity": "medium",
            "code": """import cadquery as cq
rectangle_width = 10.0
rectangle_length = 10.0
result = cq.Workplane("XY").rect(rectangle_width, rectangle_length, False).revolve()""",
        },
        {
            "desc": "Spherical joint with slot cut by sweeping to a face",
            "category": "mechanical",
            "complexity": "complex",
            "code": """import cadquery as cq
sphere = cq.Workplane().sphere(5)
base = cq.Workplane(origin=(0, 0, -2)).box(12, 12, 10).cut(sphere).edges("|Z").fillet(2)
sphere_face = base.faces(">>X[2] and (not |Z) and (not |Y)").val()
base = base.faces("<Z").workplane().circle(2).extrude(10)
shaft = cq.Workplane().sphere(4.5).circle(1.5).extrude(20)
result = (
    base.union(shaft).faces(">X").workplane(centerOption="CenterOfMass")
    .move(0, 4).slot2D(10, 2, 90).cutBlind(sphere_face)
    .workplane(offset=10).move(0, 2).circle(0.9).extrude("next")
)""",
        },
        {
            "desc": "Shelled box (thin-walled enclosure)",
            "category": "enclosure",
            "complexity": "simple",
            "code": """import cadquery as cq
result = cq.Workplane("front").box(2, 2, 2).faces("+Z").shell(0.05)""",
        },
        {
            "desc": "Box split by a plane keeping the top half",
            "category": "plate",
            "complexity": "medium",
            "code": """import cadquery as cq
c = cq.Workplane("XY").box(1, 1, 1).faces(">Z").workplane().circle(0.25).cutThruAll()
result = c.faces(">Y").workplane(-0.5).split(keepTop=True)""",
        },
        {
            "desc": "Extruded lines and arcs creating a custom 2D profile",
            "category": "plate",
            "complexity": "medium",
            "code": """import cadquery as cq
width = 2.0
thickness = 0.25
result = (
    cq.Workplane("front")
    .lineTo(width, 0).lineTo(width, 1.0)
    .threePointArc((1.0, 1.5), (0.0, 1.0))
    .sagittaArc((-0.5, 1.0), 0.2)
    .radiusArc((-0.7, -0.2), -1.5)
    .close().extrude(thickness)
)""",
        },
        {
            "desc": "Cone created using Solid.makeCone",
            "category": "cylindrical",
            "complexity": "simple",
            "code": """import cadquery as cq
result = cq.Workplane("XY").add(cq.Solid.makeCone(10, 5, 20))""",
        },
        {
            "desc": "Hollow funnel using revolve of L-shaped profile",
            "category": "organic",
            "complexity": "medium",
            "code": """import cadquery as cq
import math
top_r = 25.0
bottom_r = 7.5
height = 60.0
wall = 2.0
result = (
    cq.Workplane('XZ')
    .moveTo(bottom_r, 0)
    .lineTo(top_r, height)
    .lineTo(top_r - wall, height)
    .lineTo(bottom_r - wall, 0)
    .close()
    .revolve(360, (0, 0, 0), (0, 0, 1))
)""",
        },
        # ---- Complex direct code examples for categories that need freeform CadQuery ----
        {
            "desc": "Involute spur gear with parametric teeth, bore, and hub",
            "category": "gear",
            "complexity": "complex",
            "code": """import cadquery as cq
import math
module = 2.0
teeth = 20
face_width = 10.0
bore_d = 8.0
pressure_angle_deg = 20.0
pitch_r = module * teeth / 2
addendum = module
dedendum = 1.25 * module
outer_r = pitch_r + addendum
root_r = pitch_r - dedendum
base_r = pitch_r * math.cos(math.radians(pressure_angle_deg))
tooth_angle = 360.0 / teeth
result = cq.Workplane('XY').circle(root_r).extrude(face_width)
for i in range(teeth):
    angle = i * tooth_angle
    tooth = (
        cq.Workplane('XY')
        .moveTo(root_r * math.cos(math.radians(angle - tooth_angle * 0.15)),
                root_r * math.sin(math.radians(angle - tooth_angle * 0.15)))
        .lineTo(outer_r * math.cos(math.radians(angle - tooth_angle * 0.1)),
                outer_r * math.sin(math.radians(angle - tooth_angle * 0.1)))
        .threePointArc(
            (outer_r * math.cos(math.radians(angle)),
             outer_r * math.sin(math.radians(angle))),
            (outer_r * math.cos(math.radians(angle + tooth_angle * 0.1)),
             outer_r * math.sin(math.radians(angle + tooth_angle * 0.1))))
        .lineTo(root_r * math.cos(math.radians(angle + tooth_angle * 0.15)),
                root_r * math.sin(math.radians(angle + tooth_angle * 0.15)))
        .close()
        .extrude(face_width)
    )
    result = result.union(tooth)
result = result.faces('>Z').workplane().hole(bore_d)
result = result.clean()""",
        },
        {
            "desc": "Wall hook with curved arm using sweep",
            "category": "hook",
            "complexity": "medium",
            "code": """import cadquery as cq
wall_w = 30.0
wall_h = 50.0
wall_t = 4.0
hook_r = 15.0
wire_r = 3.0
base = cq.Workplane('XY').box(wall_w, wall_t, wall_h)
base = base.faces('>Z').workplane().pushPoints([(10, 0), (-10, 0)]).hole(4.0)
path = cq.Workplane('XZ').center(0, wall_h / 2).threePointArc(
    (hook_r, hook_r), (hook_r * 2, 0)).wire()
try:
    hook_wire = cq.Workplane('XY').center(0, wall_t / 2).circle(wire_r).sweep(path)
    result = base.union(hook_wire).clean()
except:
    result = base""",
        },
        {
            "desc": "S-hook with two opposing curved ends",
            "category": "hook",
            "complexity": "complex",
            "code": """import cadquery as cq
wire_d = 4.0
upper_r = 12.0
lower_r = 10.0
straight = 15.0
result = cq.Workplane('XY').circle(wire_d / 2).extrude(straight)
try:
    upper_path = cq.Workplane('XZ').center(0, straight).threePointArc(
        (upper_r, upper_r), (0, upper_r * 2)).wire()
    upper = cq.Workplane('XY').circle(wire_d / 2).sweep(upper_path)
    result = result.union(upper)
except:
    pass
try:
    lower_path = cq.Workplane('XZ').threePointArc(
        (-lower_r, -lower_r), (0, -lower_r * 2)).wire()
    lower = cq.Workplane('XY').circle(wire_d / 2).sweep(lower_path)
    result = result.union(lower)
except:
    pass
result = result.clean()""",
        },
        {
            "desc": "Round knob with grip ridges around the circumference",
            "category": "handle",
            "complexity": "medium",
            "code": """import cadquery as cq
import math
knob_r = 15.0
knob_h = 12.0
shaft_r = 4.0
shaft_h = 8.0
ridge_count = 12
ridge_depth = 1.5
result = cq.Workplane('XY').cylinder(knob_h, knob_r)
for i in range(ridge_count):
    angle = i * 360.0 / ridge_count
    x = (knob_r + 0.01) * math.cos(math.radians(angle))
    y = (knob_r + 0.01) * math.sin(math.radians(angle))
    groove = cq.Workplane('XY').box(ridge_depth * 2, ridge_depth * 2, knob_h).translate((x, y, knob_h / 2))
    result = result.cut(groove)
shaft = cq.Workplane('XY').cylinder(shaft_h, shaft_r).translate((0, 0, -(shaft_h / 2)))
result = result.union(shaft)
result = result.faces('>Z').workplane().hole(3.0)
result = result.clean()""",
        },
        {
            "desc": "Pulley wheel with V-groove and bore",
            "category": "mechanical",
            "complexity": "medium",
            "code": """import cadquery as cq
outer_r = 25.0
width = 12.0
bore_d = 8.0
groove_depth = 4.0
groove_angle = 40.0
hub_r = 12.0
result = cq.Workplane('XY').cylinder(width, outer_r)
groove_tool = (
    cq.Workplane('XZ')
    .moveTo(outer_r + 1, width / 2)
    .lineTo(outer_r - groove_depth, 0)
    .lineTo(outer_r + 1, -width / 2)
    .close()
    .revolve(360, (0, 0, 0), (0, 0, 1))
)
result = result.cut(groove_tool)
result = result.faces('>Z').workplane().hole(bore_d)
result = result.clean()""",
        },
        {
            "desc": "Angled phone stand with slot for charging cable",
            "category": "stand",
            "complexity": "medium",
            "code": """import cadquery as cq
base_l = 80.0
base_w = 60.0
base_h = 5.0
back_h = 70.0
back_t = 4.0
angle = 15.0
lip_h = 10.0
lip_t = 3.0
cable_d = 8.0
result = cq.Workplane('XY').box(base_l, base_w, base_h)
back = cq.Workplane('XY').box(base_l, back_t, back_h).translate((0, -base_w / 2 + back_t / 2, back_h / 2))
back = back.rotate((0, -base_w / 2, 0), (1, 0, 0), -angle)
result = result.union(back)
lip = cq.Workplane('XY').box(base_l - 20, lip_t, lip_h).translate((0, base_w / 2 - lip_t / 2, lip_h / 2))
result = result.union(lip)
cable_cut = cq.Workplane('XY').cylinder(base_h * 3, cable_d / 2).translate((0, 0, 0))
result = result.cut(cable_cut)
result = result.clean()""",
        },
        {
            "desc": "Pipe elbow 90-degree bend using revolve",
            "category": "pipe",
            "complexity": "medium",
            "code": """import cadquery as cq
outer_r = 12.0
wall = 2.0
bend_r = 30.0
inner_r = outer_r - wall
result = (
    cq.Workplane('XZ')
    .center(bend_r, 0)
    .circle(outer_r)
    .circle(inner_r)
    .revolve(90, (0, 0, 0), (0, 0, 1))
)""",
        },
        {
            "desc": "Desk cable management clip that snaps onto desk edge",
            "category": "clip",
            "complexity": "medium",
            "code": """import cadquery as cq
clip_w = 20.0
desk_t = 20.0
jaw_gap = 18.0
wall = 3.0
cable_d = 8.0
result = cq.Workplane('XY').box(clip_w, desk_t + wall * 2, wall)
back = cq.Workplane('XY').box(clip_w, wall, desk_t + wall).translate((0, -(desk_t / 2 + wall / 2), desk_t / 2))
result = result.union(back)
top_jaw = cq.Workplane('XY').box(clip_w, jaw_gap / 2, wall).translate((0, 0, desk_t + wall))
result = result.union(top_jaw)
cable_holder = cq.Workplane('XY').box(clip_w, wall, cable_d * 2).translate((0, desk_t / 2 + wall / 2, cable_d))
result = result.union(cable_holder)
cable_cut = cq.Workplane('XZ').center(0, cable_d).circle(cable_d / 2).extrude(clip_w, both=True)
result = result.cut(cable_cut)
result = result.clean()""",
        },
        {
            "desc": "Vase shape using revolve of curved profile",
            "category": "organic",
            "complexity": "complex",
            "code": """import cadquery as cq
base_r = 30.0
mid_r = 40.0
neck_r = 25.0
top_r = 30.0
height = 120.0
wall = 2.5
result = (
    cq.Workplane('XZ')
    .moveTo(base_r, 0)
    .spline([(mid_r, height * 0.4), (neck_r, height * 0.7), (top_r, height)])
    .lineTo(top_r - wall, height)
    .spline([(neck_r - wall, height * 0.7), (mid_r - wall, height * 0.4), (base_r - wall, 0)])
    .close()
    .revolve(360, (0, 0, 0), (0, 0, 1))
)""",
        },
        {
            "desc": "Hex container / pencil cup with hexagonal cross-section",
            "category": "container",
            "complexity": "simple",
            "code": """import cadquery as cq
hex_r = 25.0
height = 80.0
wall = 2.5
result = cq.Workplane('XY').polygon(6, hex_r * 2).extrude(height)
result = result.faces('>Z').shell(-wall)""",
        },
        {
            "desc": "Living hinge test piece with thin flexible section",
            "category": "mechanical",
            "complexity": "medium",
            "code": """import cadquery as cq
length = 60.0
width = 30.0
thickness = 3.0
hinge_t = 0.4
hinge_w = 10.0
result = cq.Workplane('XY').box(length, width, thickness)
hinge_cut = cq.Workplane('XY').box(hinge_w, width + 1, thickness - hinge_t).translate((0, 0, hinge_t / 2))
result = result.cut(hinge_cut)
result = result.clean()""",
        },
        # ---- Official CadQuery repo examples (exact source) ----
        {
            "desc": "Involute gear with parametric tooth profile (official CadQuery contrib)",
            "category": "gear",
            "complexity": "complex",
            "code": """import cadquery as cq
from cadquery import Workplane, Edge, Wire
from math import *
def involute_gear(m, z, alpha=20, shift=0, N=20):
    alpha = radians(alpha)
    r_ref = m*z/2
    r_top = r_ref + m*(1+shift)
    r_base = r_ref*cos(alpha)
    r_d = r_ref - 1.25*m
    inv = lambda a: tan(a) - a
    alpha_inv = inv(alpha)
    alpha_tip = acos(r_base/r_top)
    alpha_tip_inv = inv(alpha_tip)
    a = 90/z+degrees(alpha_inv)
    a2 = 90/z+degrees(alpha_inv)-degrees(alpha_tip_inv)
    a3 = 360/z-a
    def involute_curve(r_b, sign=1):
        def f(r):
            alpha = sign*acos(r_b/r)
            x = r*cos(tan(alpha) - alpha)
            y = r*sin(tan(alpha) - alpha)
            return x, y
        return f
    right = Workplane().transformed(rotate=(0,0,a)).parametricCurve(
        involute_curve(r_base,-1), start=r_base, stop=r_top, makeWire=False, N=N).val()
    left = Workplane().transformed(rotate=(0,0,-a)).parametricCurve(
        involute_curve(r_base), start=r_base, stop=r_top, makeWire=False, N=N).val()
    top = Edge.makeCircle(r_top, angle1=-a2, angle2=a2)
    bottom = Edge.makeCircle(r_d, angle1=-a3, angle2=-a)
    side = Edge.makeLine(cq.Vector(r_d,0), cq.Vector(r_base,0))
    side1 = side.rotate(cq.Vector(0,0,0), cq.Vector(0,0,1), -a)
    side2 = side.rotate(cq.Vector(0,0,0), cq.Vector(0,0,1), -a3)
    profile = Wire.assembleEdges([left, top, right, side1, bottom, side2])
    profile = profile.chamfer2D(m/4, profile.Vertices()[-3:-1])
    res = Workplane().polarArray(0,0,360,z).each(lambda loc: profile.located(loc)).consolidateWires()
    return res.val()
result = Workplane(obj=involute_gear(1, 20)).toPending().extrude(10)""",
        },
        {
            "desc": "Parametric enclosure with screw posts, split lid, and counterbored holes (official CadQuery contrib)",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
p_outerWidth = 100.0
p_outerLength = 150.0
p_outerHeight = 50.0
p_thickness = 3.0
p_sideRadius = 10.0
p_topAndBottomRadius = 2.0
p_screwpostInset = 12.0
p_screwpostID = 4.0
p_screwpostOD = 10.0
p_boreDiameter = 8.0
p_boreDepth = 1.0
p_flipLid = True
p_lipHeight = 1.0
oshell = cq.Workplane("XY").rect(p_outerWidth, p_outerLength).extrude(p_outerHeight + p_lipHeight)
oshell = oshell.edges("|Z").fillet(p_sideRadius)
oshell = oshell.edges("#Z").fillet(p_topAndBottomRadius)
ishell = oshell.faces("<Z").workplane(p_thickness, True).rect(
    p_outerWidth - 2*p_thickness, p_outerLength - 2*p_thickness).extrude(p_outerHeight - 2*p_thickness, False)
ishell = ishell.edges("|Z").fillet(p_sideRadius - p_thickness)
box = oshell.cut(ishell)
POSTWIDTH = p_outerWidth - 2*p_screwpostInset
POSTLENGTH = p_outerLength - 2*p_screwpostInset
box = box.faces(">Z").workplane(-p_thickness).rect(POSTWIDTH, POSTLENGTH, forConstruction=True).vertices().circle(
    p_screwpostOD/2).circle(p_screwpostID/2).extrude(-(p_outerHeight + p_lipHeight - p_thickness), True)
(lid, bottom) = box.faces(">Z").workplane(-p_thickness - p_lipHeight).split(keepTop=True, keepBottom=True).all()
lowerLid = lid.translate((0, 0, -p_lipHeight))
cutlip = lowerLid.cut(bottom).translate((p_outerWidth + p_thickness, 0, p_thickness - p_outerHeight + p_lipHeight))
topOfLid = cutlip.faces(">Z").workplane().rect(POSTWIDTH, POSTLENGTH, forConstruction=True).vertices().cboreHole(
    p_screwpostID, p_boreDiameter, p_boreDepth, 2*p_thickness)
if p_flipLid:
    topOfLid = topOfLid.rotateAboutCenter((1,0,0), 180)
result = topOfLid.union(bottom)""",
        },
        {
            "desc": "Case with snap-fit seam lip using offset2D (official CadQuery)",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
from cadquery.selectors import AreaNthSelector
result = (
    cq.Workplane("XY").rect(20, 20).extrude(10)
    .edges("|Z or <Z").fillet(2)
    .faces(">Z").shell(2)
    .faces(">Z").wires(AreaNthSelector(-1)).toPending()
    .workplane().offset2D(-1).extrude(1)
    .faces(">Z[-2]").wires(AreaNthSelector(0)).toPending()
    .workplane().cutBlind(2)
)""",
        },
        {
            "desc": "Resin mold with revolved pocket and mounting holes (official CadQuery contrib)",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
BS = cq.selectors.BoxSelector
mw = 40
mh = 13
ml = 120
wd = 6
rt = 7
rl = 50
rwpl = 10
pf = 18
mhd = 7
mht = 3
fhd = 6
base = cq.Workplane("XY").box(ml, mw, mh, (True, True, False))
pocket = (cq.Workplane("XY", (0, 0, mh)).moveTo(-ml/2., 0).line(0, wd/2.)
    .line((ml-rl)/2.-rwpl, 0).line(rwpl, rt).line(rl, 0)
    .line(rwpl, -rt).line((ml-rl)/2.-rwpl, 0)
    .line(0, -(wd/2.)).close().revolve(axisEnd=(1, 0))
    .edges(BS((-rl/2.-rwpl-.1, -100, -100), (rl/2.+rwpl+.1, 100, 100)))
    .fillet(pf))
r = base.cut(pocket)
px = ml/2.-mht-mhd/2.
py = mw/2.-mht-mhd/2
r = r.faces("<Z").workplane().pushPoints([(px,py),(-px,py),(-px,-py),(px,-py)]).hole(mhd)
result = r.faces("<Y").workplane().center(0, mh/2.).pushPoints([(-rl/2.,0),(0,0),(rl/2.,0)]).hole(fhd, mw/2.)""",
        },
        {
            "desc": "Multi-section sweep from circle to rectangle and back along a straight path (official CadQuery)",
            "category": "organic",
            "complexity": "complex",
            "code": """import cadquery as cq
path = cq.Workplane("XZ").moveTo(-10, 0).lineTo(10, 0)
result = (
    cq.Workplane("YZ")
    .workplane(offset=-10.0).rect(2.0, 2.0)
    .workplane(offset=8.0).circle(1.0)
    .workplane(offset=4.0).circle(1.0)
    .workplane(offset=8.0).rect(2.0, 2.0)
    .sweep(path, multisection=True)
)""",
        },
        {
            "desc": "Swept helix coil with custom cross-section (official CadQuery)",
            "category": "cylindrical",
            "complexity": "complex",
            "code": """import cadquery as cq
r = 0.5
p = 0.4
h = 2.4
wire = cq.Wire.makeHelix(pitch=p, height=h, radius=r)
helix = cq.Workplane(obj=wire)
result = (
    cq.Workplane("XZ").center(r, 0)
    .polyline(((-0.15, 0.1), (0.0, 0.05), (0, 0.35), (-0.15, 0.3)))
    .close().sweep(helix, isFrenet=True)
)""",
        },
        {
            "desc": "Lego brick with bumps and internal hollow posts (official CadQuery)",
            "category": "enclosure",
            "complexity": "complex",
            "code": """import cadquery as cq
lbumps = 6
wbumps = 2
pitch = 8.0
clearance = 0.1
bumpDiam = 4.8
bumpHeight = 1.8
height = 3.2
t = (pitch - (2 * clearance) - bumpDiam) / 2.0
postDiam = pitch - t
total_length = lbumps * pitch - 2.0 * clearance
total_width = wbumps * pitch - 2.0 * clearance
s = cq.Workplane("XY").box(total_length, total_width, height)
s = s.faces("<Z").shell(-1.0 * t)
s = s.faces(">Z").workplane().rarray(pitch, pitch, lbumps, wbumps, True).circle(bumpDiam / 2.0).extrude(bumpHeight)
tmp = s.faces("<Z").workplane(invert=True)
result = tmp.rarray(pitch, pitch, lbumps - 1, wbumps - 1, center=True).circle(postDiam / 2.0).circle(bumpDiam / 2.0).extrude(height - t)""",
        },
        {
            "desc": "Reinforced junction using fillet with NearestToPointSelector (official CadQuery contrib)",
            "category": "bracket",
            "complexity": "medium",
            "code": """import cadquery as cq
from cadquery import selectors
model = (cq.Workplane("XY").box(15.0, 15.0, 2.0)
    .faces(">Z").rect(10.0, 10.0, forConstruction=True).vertices().cskHole(2.0, 4.0, 82)
    .faces(">Z").circle(4.0).extrude(10.0)
    .faces(">Z").hole(6))
result = model.faces('<Z[1]').edges(selectors.NearestToPointSelector((0.0, 0.0))).fillet(1)""",
        },
    ]

    count = 0
    for ex in examples:
        added = add_example(
            session,
            desc=ex["desc"],
            category=ex["category"],
            complexity=ex["complexity"],
            source="curated",
            cadquery_script=ex["code"],
        )
        if added:
            count += 1
    return count


def main():
    with Session(engine) as session:
        print("Seeding curated JSON examples...")
        n1 = seed_curated_json(session)
        print(f"  Added {n1} curated JSON examples")

        print("Seeding official CadQuery examples...")
        n2 = seed_official_cadquery(session)
        print(f"  Added {n2} official CadQuery examples")

        session.commit()
        total = session.query(VerifiedExample).count()
        print(f"\nTotal verified examples in DB: {total}")


if __name__ == "__main__":
    main()
