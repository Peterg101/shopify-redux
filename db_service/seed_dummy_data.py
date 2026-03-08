"""
Seed script: populate the database with dummy data covering all community flow scenarios.
Run from db_service/: python seed_dummy_data.py
"""
import sqlite3
import uuid
import shutil
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = "changing_the_schemas.db"
UPLOADS = Path("uploads")

PETER = "103968401714276034667"
MARTA = "12233456778990008"

# Source obj files (Peter's existing tasks with real 3D models)
SRC_FILES = {
    "paddington": "019a0ca2-b6f8-790e-888c-c700a2d30bcf",
    "bird":       "019a0ca5-815e-777d-bf4e-0f8176f6aa4c",
    "phoebe":     "019a30fe-9ed5-71d4-9f5a-a82de5f7e3fe",
    "printer":    "019a9754-69b7-732a-a4d9-4e86c60f29f1",
    "cooper":     "019a9bf1-fe8f-7cff-9cf0-15b43f335a0d",
    "monitor":    "019a104d-66fa-76ed-9157-1ca815bd1fa8",
    "alan":       "019a0ca1-09aa-7dd7-9b3f-80146985916e",
    "fiona2":     "019a7cd5-fa1c-7472-a805-e54fb23236d5",
    "strategy":   "019a105c-e5dc-7360-84e4-87469b8d46a7",
    "kuldeep":    "019a104c-3f04-769e-acc9-494567c5bba6",
}

now = datetime.utcnow()


def uid():
    return str(uuid.uuid4())


def ts(delta_days=0):
    return (now - timedelta(days=delta_days)).isoformat()


def dts(delta_days=0):
    return (now - timedelta(days=delta_days)).strftime("%Y-%m-%d %H:%M:%S")


def copy_obj(src_task_id, dst_task_id):
    src = UPLOADS / f"{src_task_id}.obj"
    dst = UPLOADS / f"{dst_task_id}.obj"
    if src.exists() and not dst.exists():
        shutil.copy2(src, dst)


def main():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # ── Generate task IDs for Marta's new orders ──
    marta_tasks = {}
    for name in ["paddington", "bird", "phoebe", "printer", "cooper", "monitor"]:
        tid = uid()
        marta_tasks[name] = tid
        copy_obj(SRC_FILES[name], tid)
        c.execute(
            "INSERT INTO tasks (task_id, user_id, task_name, complete, created_at) VALUES (?,?,?,?,?)",
            (tid, MARTA, f"marta-{name}", 1, ts(30)),
        )

    # ── Peter's unused tasks → new orders ──
    # These already have obj files, just need orders
    peter_new_tasks = {
        "alan":     SRC_FILES["alan"],
        "fiona2":   SRC_FILES["fiona2"],
        "strategy": SRC_FILES["strategy"],
        "kuldeep":  SRC_FILES["kuldeep"],
    }

    # ====================================================================
    # MARTA'S COMMUNITY ORDERS (visible to Peter in /fulfill marketplace)
    # ====================================================================

    # 1) Paddington Bear — qty 5, unclaimed, community → Peter can claim
    ord_paddington = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_paddington, marta_tasks["paddington"], MARTA, "cs_seed_1",
         "Paddington Bear", "PLA Basic", "FDM", 1.2, "brown",
         "paddington.obj", "obj", 24.99, 5, ts(14), 1, "open", "standard"),
    )

    # 2) Friendly Bird — qty 8, Peter claimed 3 (pending), community
    ord_bird = uid()
    claim_bird = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_bird, marta_tasks["bird"], MARTA, "cs_seed_2",
         "Friendly Bird", "PETG", "FDM", 0.8, "blue",
         "bird.obj", "obj", 12.50, 8, ts(12), 1, "open", "standard"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_bird, ord_bird, PETER, 3, "pending", dts(2), dts(2)),
    )

    # 3) Baby Phoebe — qty 2, Peter claimed all 2 (in_progress), community
    ord_phoebe = uid()
    claim_phoebe = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_phoebe, marta_tasks["phoebe"], MARTA, "cs_seed_3",
         "Baby Phoebe", "Resin Standard", "Resin", 1.0, "pink",
         "phoebe.obj", "obj", 45.00, 2, ts(10), 1, "open", "high"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_phoebe, ord_phoebe, PETER, 2, "in_progress", dts(8), dts(5)),
    )
    c.execute(
        "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
        (uid(), claim_phoebe, "pending", "in_progress", PETER, dts(5)),
    )

    # 4) 3D Printer Miniature — qty 4, Peter claimed all 4 (printing), community, high QA
    ord_printer = uid()
    claim_printer = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_printer, marta_tasks["printer"], MARTA, "cs_seed_4",
         "3D Printer Miniature", "Even Ressinier Resin", "Resin", 1.5, "silver",
         "printer.obj", "obj", 89.00, 4, ts(20), 1, "open", "high"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_printer, ord_printer, PETER, 4, "printing", dts(15), dts(3)),
    )
    for prev, nxt, days in [("pending", "in_progress", 12), ("in_progress", "printing", 3)]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_printer, prev, nxt, PETER, dts(days)),
        )

    # 5) Mini Cooper S — qty 3, Peter claimed all 3 (delivered), community → buyer review
    ord_cooper = uid()
    claim_cooper = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_cooper, marta_tasks["cooper"], MARTA, "cs_seed_5",
         "Mini Cooper S", "PLA Basic", "FDM", 2.0, "red",
         "cooper.obj", "obj", 35.00, 3, ts(25), 1, "open", "standard"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_cooper, ord_cooper, PETER, 3, "delivered", dts(20), dts(1)),
    )
    for prev, nxt, days in [
        ("pending", "in_progress", 18),
        ("in_progress", "printing", 14),
        ("printing", "qa_check", 10),
        ("qa_check", "shipped", 5),
        ("shipped", "delivered", 1),
    ]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_cooper, prev, nxt, PETER, dts(days)),
        )

    # 6) Computer Monitor — qty 6, Peter claimed 4 (shipped), community → 2 still available
    ord_monitor = uid()
    claim_monitor = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_monitor, marta_tasks["monitor"], MARTA, "cs_seed_6",
         "Computer Monitor", "PETG", "FDM", 1.8, "black",
         "monitor.obj", "obj", 18.75, 6, ts(18), 1, "open", "standard"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_monitor, ord_monitor, PETER, 4, "shipped", dts(14), dts(2)),
    )
    for prev, nxt, days in [
        ("pending", "in_progress", 12),
        ("in_progress", "printing", 8),
        ("printing", "qa_check", 6),
        ("qa_check", "shipped", 2),
    ]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_monitor, prev, nxt, PETER, dts(days)),
        )

    # ====================================================================
    # PETER'S COMMUNITY ORDERS (visible to Marta, shows toggle for Peter)
    # ====================================================================

    # 7) Alan Meeson — qty 3, community, Marta claimed 2 (qa_check)
    ord_alan = uid()
    claim_alan = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_alan, peter_new_tasks["alan"], PETER, "cs_seed_7",
         "Alan Meeson Figurine", "PLA Basic", "FDM", 1.0, "beige",
         "alan.obj", "obj", 29.99, 3, ts(22), 1, "open", "high"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_alan, ord_alan, MARTA, 2, "qa_check", dts(18), dts(3)),
    )
    for prev, nxt, days in [
        ("pending", "in_progress", 16),
        ("in_progress", "printing", 10),
        ("printing", "qa_check", 3),
    ]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_alan, prev, nxt, MARTA, dts(days)),
        )

    # 8) Princess Fiona — qty 1, community, Marta claimed 1 (accepted) + disbursement
    ord_fiona2 = uid()
    claim_fiona2 = uid()
    disb_fiona2 = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_fiona2, peter_new_tasks["fiona2"], PETER, "cs_seed_8",
         "Princess Fiona", "Resin Standard", "Resin", 1.3, "green",
         "fiona2.obj", "obj", 55.00, 1, ts(35), 1, "open", "standard"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_fiona2, ord_fiona2, MARTA, 1, "accepted", dts(30), dts(5)),
    )
    for prev, nxt, days in [
        ("pending", "in_progress", 28),
        ("in_progress", "printing", 22),
        ("printing", "qa_check", 18),
        ("qa_check", "shipped", 14),
        ("shipped", "delivered", 8),
        ("delivered", "accepted", 5),
    ]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_fiona2, prev, nxt, MARTA if nxt != "accepted" else PETER, dts(days)),
        )
    c.execute(
        "INSERT INTO disbursements (id, claim_id, user_id, amount_cents, status, created_at) VALUES (?,?,?,?,?,?)",
        (disb_fiona2, claim_fiona2, MARTA, 5500, "pending", dts(5)),
    )

    # 9) Manufacturing Strategy — qty 10, community, unclaimed → available for Marta
    ord_strategy = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_strategy, peter_new_tasks["strategy"], PETER, "cs_seed_9",
         "Manufacturing Strategy Model", "PETG", "FDM", 0.5, "white",
         "strategy.obj", "obj", 8.50, 10, ts(7), 1, "open", "standard"),
    )

    # 10) Kuldeep Figurine — qty 2, community, Marta claimed 2 (delivered, then disputed - open)
    ord_kuldeep = uid()
    claim_kuldeep = uid()
    disb_kuldeep = uid()
    dispute_kuldeep = uid()
    c.execute(
        """INSERT INTO orders (order_id, task_id, user_id, stripe_checkout_session_id, name, material,
           technique, sizing, colour, "selectedFile", "selectedFileType", price, quantity,
           created_at, is_collaborative, status, qa_level)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (ord_kuldeep, peter_new_tasks["kuldeep"], PETER, "cs_seed_10",
         "Kuldeep Figurine", "PLA Basic", "FDM", 1.1, "navy",
         "kuldeep.obj", "obj", 32.00, 2, ts(30), 1, "open", "standard"),
    )
    c.execute(
        "INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (claim_kuldeep, ord_kuldeep, MARTA, 2, "disputed", dts(25), dts(2)),
    )
    for prev, nxt, days in [
        ("pending", "in_progress", 23),
        ("in_progress", "printing", 18),
        ("printing", "qa_check", 14),
        ("qa_check", "shipped", 10),
        ("shipped", "delivered", 5),
        ("delivered", "disputed", 2),
    ]:
        c.execute(
            "INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at) VALUES (?,?,?,?,?,?)",
            (uid(), claim_kuldeep, prev, nxt, MARTA if nxt != "disputed" else PETER, dts(days)),
        )
    c.execute(
        "INSERT INTO disbursements (id, claim_id, user_id, amount_cents, status, created_at) VALUES (?,?,?,?,?,?)",
        (disb_kuldeep, claim_kuldeep, MARTA, 6400, "held", dts(2)),
    )
    c.execute(
        """INSERT INTO disputes (id, claim_id, opened_by, reason, status, fulfiller_deadline, created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (dispute_kuldeep, claim_kuldeep, PETER,
         "The figurine's face details are completely wrong - looks nothing like the reference.",
         "open", dts(-5), dts(2)),  # deadline 5 days in the future
    )

    # ====================================================================
    # TOGGLE EXISTING ORDERS TO COLLABORATIVE
    # ====================================================================

    # Make Peter's "shrek" order collaborative (already has disputed claim from Marta)
    c.execute("UPDATE orders SET is_collaborative = 1 WHERE name = 'shrek'")

    # Make Marta's "a really scary bird" order collaborative
    c.execute("UPDATE orders SET is_collaborative = 1 WHERE name = 'a really scary bird'")

    # ====================================================================
    # PARTS CATALOG — seed published parts from existing tasks
    # ====================================================================

    # Clear any existing parts first (idempotent re-runs)
    c.execute("DELETE FROM parts")

    parts = [
        # ── Peter's parts (linked to his existing tasks) ──
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Shrek Figurine",
            "description": "Highly detailed Shrek figurine with layered textures. Great for display or painting.",
            "category": "figurine",
            "tags": '["character", "movie", "ogre", "display"]',
            "task_id": SRC_FILES.get("paddington", "01945071-9eda-77c0-a811-6f239f0642cb"),
            "file_type": "obj",
            "bounding_box_x": 45.0, "bounding_box_y": 40.0, "bounding_box_z": 85.0,
            "volume_cm3": 120.5, "surface_area_cm2": 380.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "published", "is_public": 1, "download_count": 12,
            "created_at": ts(60), "updated_at": ts(5),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Donkey (Shrek)",
            "description": "Animated donkey companion. Optimised for FDM with minimal supports needed.",
            "category": "figurine",
            "tags": '["character", "movie", "animal"]',
            "task_id": "01945074-1f42-77c0-a0e6-e2652fe71d56",
            "file_type": "obj",
            "bounding_box_x": 60.0, "bounding_box_y": 25.0, "bounding_box_z": 55.0,
            "volume_cm3": 65.3, "surface_area_cm2": 290.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "published", "is_public": 1, "download_count": 8,
            "created_at": ts(55), "updated_at": ts(10),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Princess Fiona",
            "description": "Princess Fiona in warrior pose. Fine details best printed with resin.",
            "category": "figurine",
            "tags": '["character", "movie", "fantasy", "princess"]',
            "task_id": "019a7cd5-fa1c-7472-a805-e54fb23236d5",
            "file_type": "obj",
            "bounding_box_x": 35.0, "bounding_box_y": 35.0, "bounding_box_z": 90.0,
            "volume_cm3": 88.7, "surface_area_cm2": 420.0,
            "recommended_process": "SLA", "recommended_material": "Tough Resin",
            "status": "published", "is_public": 1, "download_count": 15,
            "created_at": ts(50), "updated_at": ts(3),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Mini Cooper S Scale Model",
            "description": "1:24 scale Mini Cooper S with opening bonnet. Snap-fit assembly, no glue required.",
            "category": "automotive",
            "tags": '["car", "scale-model", "snap-fit", "mini"]',
            "task_id": "019a9bf1-fe8f-7cff-9cf0-15b43f335a0d",
            "file_type": "obj",
            "bounding_box_x": 170.0, "bounding_box_y": 75.0, "bounding_box_z": 65.0,
            "volume_cm3": 210.0, "surface_area_cm2": 850.0,
            "recommended_process": "FDM", "recommended_material": "PETG",
            "status": "published", "is_public": 1, "download_count": 22,
            "created_at": ts(45), "updated_at": ts(7),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Desktop Monitor Stand",
            "description": "Adjustable monitor riser with cable management channels. Functional print.",
            "category": "hardware",
            "tags": '["desk", "organiser", "functional", "cable-management"]',
            "task_id": "019a104d-66fa-76ed-9157-1ca815bd1fa8",
            "file_type": "obj",
            "bounding_box_x": 250.0, "bounding_box_y": 200.0, "bounding_box_z": 80.0,
            "volume_cm3": 350.0, "surface_area_cm2": 1200.0,
            "recommended_process": "FDM", "recommended_material": "PETG",
            "status": "published", "is_public": 1, "download_count": 31,
            "created_at": ts(40), "updated_at": ts(2),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Baby Phoebe Ornament",
            "description": "Delicate baby figurine for nursery decoration. Resin recommended for fine detail.",
            "category": "figurine",
            "tags": '["baby", "ornament", "gift", "nursery"]',
            "task_id": "019a30fe-9ed5-71d4-9f5a-a82de5f7e3fe",
            "file_type": "obj",
            "bounding_box_x": 30.0, "bounding_box_y": 30.0, "bounding_box_z": 50.0,
            "volume_cm3": 25.0, "surface_area_cm2": 110.0,
            "recommended_process": "SLA", "recommended_material": "Standard Resin",
            "status": "published", "is_public": 1, "download_count": 5,
            "created_at": ts(38), "updated_at": ts(15),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "3D Printer Miniature",
            "description": "Detailed desktop 3D printer replica. Moving gantry and spool holder.",
            "category": "mechanical",
            "tags": '["printer", "replica", "mechanical", "moving-parts"]',
            "task_id": "019a9754-69b7-732a-a4d9-4e86c60f29f1",
            "file_type": "obj",
            "bounding_box_x": 80.0, "bounding_box_y": 70.0, "bounding_box_z": 90.0,
            "volume_cm3": 155.0, "surface_area_cm2": 620.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "published", "is_public": 1, "download_count": 18,
            "created_at": ts(35), "updated_at": ts(4),
        },
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Paddington Bear",
            "description": "Classic Paddington Bear with hat and suitcase. Multi-part for colour printing.",
            "category": "figurine",
            "tags": '["character", "bear", "classic", "multi-part"]',
            "task_id": "019a0ca2-b6f8-790e-888c-c700a2d30bcf",
            "file_type": "obj",
            "bounding_box_x": 40.0, "bounding_box_y": 35.0, "bounding_box_z": 75.0,
            "volume_cm3": 72.0, "surface_area_cm2": 310.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "published", "is_public": 1, "download_count": 27,
            "created_at": ts(32), "updated_at": ts(1),
        },

        # ── Marta's parts ──
        {
            "id": uid(), "publisher_user_id": MARTA,
            "name": "Planetary Gear Set",
            "description": "Fully functional planetary gearbox. 5:1 ratio. Prints assembled with 0.2mm clearance.",
            "category": "mechanical",
            "tags": '["gear", "gearbox", "planetary", "functional", "print-in-place"]',
            "task_id": marta_tasks["bird"],
            "file_type": "stl",
            "bounding_box_x": 60.0, "bounding_box_y": 60.0, "bounding_box_z": 40.0,
            "volume_cm3": 95.0, "surface_area_cm2": 450.0,
            "recommended_process": "FDM", "recommended_material": "PETG",
            "status": "published", "is_public": 1, "download_count": 45,
            "created_at": ts(28), "updated_at": ts(6),
        },
        {
            "id": uid(), "publisher_user_id": MARTA,
            "name": "M6 Hex Bolt & Nut Set",
            "description": "ISO-standard M6x20 hex bolt with matching nut. Functional threading.",
            "category": "hardware",
            "tags": '["bolt", "nut", "fastener", "M6", "threading", "ISO"]',
            "task_id": marta_tasks["printer"],
            "file_type": "step",
            "bounding_box_x": 10.0, "bounding_box_y": 10.0, "bounding_box_z": 25.0,
            "volume_cm3": 1.2, "surface_area_cm2": 8.5,
            "recommended_process": "SLA", "recommended_material": "Tough Resin",
            "status": "published", "is_public": 1, "download_count": 63,
            "created_at": ts(25), "updated_at": ts(1),
        },
        {
            "id": uid(), "publisher_user_id": MARTA,
            "name": "Cable Clip Assortment",
            "description": "Set of 6 cable management clips for various diameters (3mm to 12mm). Adhesive back.",
            "category": "hardware",
            "tags": '["cable", "clip", "organiser", "desk", "adhesive"]',
            "task_id": marta_tasks["phoebe"],
            "file_type": "stl",
            "bounding_box_x": 20.0, "bounding_box_y": 15.0, "bounding_box_z": 12.0,
            "volume_cm3": 3.5, "surface_area_cm2": 22.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "published", "is_public": 1, "download_count": 89,
            "created_at": ts(20), "updated_at": ts(8),
        },
        {
            "id": uid(), "publisher_user_id": MARTA,
            "name": "Phone Stand (Adjustable)",
            "description": "Articulating phone stand with ball joint. Fits phones up to 80mm wide.",
            "category": "hardware",
            "tags": '["phone", "stand", "adjustable", "ball-joint"]',
            "task_id": marta_tasks["cooper"],
            "file_type": "stl",
            "bounding_box_x": 70.0, "bounding_box_y": 70.0, "bounding_box_z": 120.0,
            "volume_cm3": 42.0, "surface_area_cm2": 195.0,
            "recommended_process": "FDM", "recommended_material": "PETG",
            "status": "published", "is_public": 1, "download_count": 34,
            "created_at": ts(15), "updated_at": ts(3),
        },

        # ── Draft part (Peter, not visible in catalog) ──
        {
            "id": uid(), "publisher_user_id": PETER,
            "name": "Scary Bird (WIP)",
            "description": "Work in progress — scary bird model. Not yet ready for ordering.",
            "category": "figurine",
            "tags": '["bird", "wip"]',
            "task_id": "019a0b48-84af-7522-8867-e5782e1ada80",
            "file_type": "obj",
            "bounding_box_x": 50.0, "bounding_box_y": 45.0, "bounding_box_z": 60.0,
            "volume_cm3": 55.0, "surface_area_cm2": 240.0,
            "recommended_process": "FDM", "recommended_material": "PLA",
            "status": "draft", "is_public": 0, "download_count": 0,
            "created_at": ts(5), "updated_at": ts(1),
        },
    ]

    cols = [
        "id", "publisher_user_id", "name", "description", "category", "tags",
        "task_id", "file_type", "bounding_box_x", "bounding_box_y", "bounding_box_z",
        "volume_cm3", "surface_area_cm2", "recommended_process", "recommended_material",
        "status", "is_public", "download_count", "created_at", "updated_at",
    ]
    placeholders = ",".join(["?"] * len(cols))
    col_names = ",".join(cols)

    for p in parts:
        values = [p.get(col) for col in cols]
        c.execute(f"INSERT INTO parts ({col_names}) VALUES ({placeholders})", values)

    conn.commit()
    conn.close()

    print("Seed complete!")
    print()
    print("=== MARTA'S COMMUNITY ORDERS (Peter sees in marketplace) ===")
    print(f"  Paddington Bear     | qty 5  | unclaimed        | available to claim")
    print(f"  Friendly Bird       | qty 8  | 3 claimed (pending) | 5 still available")
    print(f"  Baby Phoebe         | qty 2  | 2 claimed (in_progress) | fully claimed (hidden)")
    print(f"  3D Printer Mini     | qty 4  | 4 claimed (printing)    | fully claimed (hidden)")
    print(f"  Mini Cooper S       | qty 3  | 3 claimed (delivered)   | buyer review ready")
    print(f"  Computer Monitor    | qty 6  | 4 claimed (shipped)     | 2 still available")
    print(f"  a really scary bird | qty 12 | 6 claimed (disputed)    | 6 still available (existing)")
    print()
    print("=== PETER'S COMMUNITY ORDERS (shows toggle behavior) ===")
    print(f"  Alan Meeson         | qty 3  | 2 claimed by Marta (qa_check)")
    print(f"  Princess Fiona      | qty 1  | 1 claimed by Marta (accepted, disbursement pending)")
    print(f"  Manufacturing Model | qty 10 | unclaimed")
    print(f"  Kuldeep Figurine    | qty 2  | 2 claimed by Marta (disputed, open)")
    print(f"  shrek               | qty 1  | 1 claimed by Marta (disputed, existing)")
    print()
    print("=== PARTS CATALOG ===")
    print(f"  {len(parts)} parts seeded ({len([p for p in parts if p['status'] == 'published'])} published, {len([p for p in parts if p['status'] == 'draft'])} draft)")
    print(f"  Peter's: Shrek, Donkey, Fiona, Mini Cooper, Monitor Stand, Baby Phoebe, 3D Printer, Paddington, Scary Bird (draft)")
    print(f"  Marta's: Planetary Gear, M6 Bolt Set, Cable Clips, Phone Stand")
    print(f"  Categories: figurine, automotive, mechanical, hardware")
    print(f"  File types: obj, stl, step")
    print()
    print("=== CLAIM LIFECYCLE COVERAGE ===")
    print("  pending, in_progress, printing, qa_check, shipped, delivered, accepted, disputed, resolved_partial")


if __name__ == "__main__":
    main()
