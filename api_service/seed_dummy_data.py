"""
Seed script: populate the database with manufacturing taxonomy, dummy users, orders,
claims, parts, and fulfiller profiles for development/demo.

Idempotent — uses ON CONFLICT DO NOTHING so it can be re-run safely without
duplicating or deleting existing data.

Usage:
  # Against Docker Postgres (from project root):
  docker compose exec api_service python seed_dummy_data.py

  # Locally (requires DATABASE_URL env var or defaults to Postgres):
  cd api_service && DATABASE_URL=postgresql://fitd:fitd_dev@localhost:5432/fitd python seed_dummy_data.py
"""
import os
import uuid
from datetime import datetime, timedelta

import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.orm import Session

# ── Connection ──────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fitd:fitd_dev@localhost:5432/fitd")
engine = sa.create_engine(DATABASE_URL)

now = datetime.utcnow()


def uid():
    return str(uuid.uuid4())


def ts(delta_days=0):
    return (now - timedelta(days=delta_days)).isoformat()


def dts(delta_days=0):
    return (now - timedelta(days=delta_days)).strftime("%Y-%m-%d %H:%M:%S")


# ── Known user IDs ──────────────────────────────────────────────────────
PETER = "103968401714276034667"
MARTA = "12233456778990008"


def upsert_user(conn, user_id, username, email, auth_provider="google", password_hash=None, email_verified=True):
    conn.execute(text("""
        INSERT INTO users (user_id, username, email, auth_provider, password_hash, email_verified)
        VALUES (:uid, :uname, :email, :auth, :pw, :ev)
        ON CONFLICT (user_id) DO NOTHING
    """), {"uid": user_id, "uname": username, "email": email, "auth": auth_provider, "pw": password_hash, "ev": email_verified})


def insert_task(conn, task_id, user_id, task_name, file_type="obj", complete=True, created_at=None):
    conn.execute(text("""
        INSERT INTO tasks (task_id, user_id, task_name, file_type, complete, created_at)
        VALUES (:tid, :uid, :name, :ft, :comp, :cat)
        ON CONFLICT (task_id) DO NOTHING
    """), {
        "tid": task_id, "uid": user_id, "name": task_name,
        "ft": file_type, "comp": complete, "cat": created_at or ts(30),
    })


def insert_order(conn, **kw):
    conn.execute(text("""
        INSERT INTO orders (
            order_id, task_id, user_id, stripe_checkout_session_id,
            name, material, technique, sizing, colour,
            "selectedFile", "selectedFileType", price, quantity,
            created_at, is_collaborative, status, qa_level,
            process_id, material_id, tolerance_mm, surface_finish
        ) VALUES (
            :order_id, :task_id, :user_id, :stripe_session,
            :name, :material, :technique, :sizing, :colour,
            :selectedFile, :selectedFileType, :price, :quantity,
            :created_at, :is_collaborative, :status, :qa_level,
            :process_id, :material_id, :tolerance_mm, :surface_finish
        ) ON CONFLICT (order_id) DO NOTHING
    """), {
        "order_id": kw["order_id"],
        "task_id": kw["task_id"],
        "user_id": kw["user_id"],
        "stripe_session": kw.get("stripe_session", f"cs_seed_{uid()[:8]}"),
        "name": kw["name"],
        "material": kw["material"],
        "technique": kw["technique"],
        "sizing": kw.get("sizing", 1.0),
        "colour": kw.get("colour", "white"),
        "selectedFile": kw.get("selectedFile", f"{kw['name'].lower()}.obj"),
        "selectedFileType": kw.get("selectedFileType", "obj"),
        "price": kw["price"],
        "quantity": kw["quantity"],
        "created_at": kw.get("created_at", ts(14)),
        "is_collaborative": kw.get("is_collaborative", True),
        "status": kw.get("status", "open"),
        "qa_level": kw.get("qa_level", "standard"),
        "process_id": kw.get("process_id"),
        "material_id": kw.get("material_id"),
        "tolerance_mm": kw.get("tolerance_mm"),
        "surface_finish": kw.get("surface_finish"),
    })


def insert_claim(conn, claim_id, order_id, claimant_user_id, quantity, status, created_days_ago, updated_days_ago):
    conn.execute(text("""
        INSERT INTO claims (id, order_id, claimant_user_id, quantity, status, created_at, updated_at)
        VALUES (:id, :oid, :cuid, :qty, :status, :cat, :uat)
        ON CONFLICT (id) DO NOTHING
    """), {
        "id": claim_id, "oid": order_id, "cuid": claimant_user_id,
        "qty": quantity, "status": status,
        "cat": dts(created_days_ago), "uat": dts(updated_days_ago),
    })


def insert_status_history(conn, claim_id, transitions, changed_by):
    for prev_status, new_status, days_ago in transitions:
        conn.execute(text("""
            INSERT INTO claim_status_history (id, claim_id, previous_status, new_status, changed_by, changed_at)
            VALUES (:id, :cid, :prev, :new, :by, :at)
        """), {
            "id": uid(), "cid": claim_id,
            "prev": prev_status, "new": new_status,
            "by": changed_by, "at": dts(days_ago),
        })


def insert_disbursement(conn, disb_id, claim_id, user_id, amount_cents, status):
    conn.execute(text("""
        INSERT INTO disbursements (id, claim_id, user_id, amount_cents, status, created_at)
        VALUES (:id, :cid, :uid, :amt, :status, :cat)
        ON CONFLICT (id) DO NOTHING
    """), {
        "id": disb_id, "cid": claim_id, "uid": user_id,
        "amt": amount_cents, "status": status, "cat": dts(2),
    })


def insert_dispute(conn, dispute_id, claim_id, opened_by, reason, status, deadline_days_future):
    conn.execute(text("""
        INSERT INTO disputes (id, claim_id, opened_by, reason, status, fulfiller_deadline, created_at)
        VALUES (:id, :cid, :by, :reason, :status, :deadline, :cat)
        ON CONFLICT (id) DO NOTHING
    """), {
        "id": dispute_id, "cid": claim_id, "by": opened_by,
        "reason": reason, "status": status,
        "deadline": dts(-deadline_days_future), "cat": dts(2),
    })


def insert_part(conn, **p):
    conn.execute(text("""
        INSERT INTO parts (
            id, publisher_user_id, name, description, category, tags,
            task_id, file_type, bounding_box_x, bounding_box_y, bounding_box_z,
            volume_cm3, surface_area_cm2, recommended_process, recommended_material,
            status, is_public, download_count, created_at, updated_at
        ) VALUES (
            :id, :pub, :name, :desc, :cat, :tags,
            :tid, :ft, :bbx, :bby, :bbz,
            :vol, :sa, :rp, :rm,
            :status, :public, :dl, :created, :updated
        ) ON CONFLICT (id) DO NOTHING
    """), {
        "id": p["id"], "pub": p["publisher_user_id"],
        "name": p["name"], "desc": p.get("description"),
        "cat": p.get("category"), "tags": p.get("tags"),
        "tid": p["task_id"], "ft": p["file_type"],
        "bbx": p.get("bounding_box_x"), "bby": p.get("bounding_box_y"), "bbz": p.get("bounding_box_z"),
        "vol": p.get("volume_cm3"), "sa": p.get("surface_area_cm2"),
        "rp": p.get("recommended_process"), "rm": p.get("recommended_material"),
        "status": p.get("status", "published"), "public": p.get("is_public", True),
        "dl": p.get("download_count", 0),
        "created": p.get("created_at", ts(30)), "updated": p.get("updated_at", ts(1)),
    })


# ════════════════════════════════════════════════════════════════════════
# SEED DATA
# ════════════════════════════════════════════════════════════════════════

# Stable IDs so re-runs don't duplicate
PROC_IDS = {
    "FDM":              "proc-fdm-001",
    "SLA":              "proc-sla-001",
    "SLS":              "proc-sls-001",
    "3-axis CNC":       "proc-cnc3-001",
    "5-axis CNC":       "proc-cnc5-001",
    "Laser Cutting":    "proc-laser-001",
    "Sheet Bending":    "proc-bend-001",
    "Sand Casting":     "proc-sandcast-001",
    "Investment Cast":  "proc-investcast-001",
    "Injection Molding": "proc-injmold-001",
}

MAT_IDS = {
    "PLA Basic":           "mat-pla-001",
    "PETG":                "mat-petg-001",
    "ABS":                 "mat-abs-001",
    "Nylon (PA12)":        "mat-nylon-001",
    "TPU Flexible":        "mat-tpu-001",
    "Standard Resin":      "mat-resin-std-001",
    "Tough Resin":         "mat-resin-tough-001",
    "Nylon SLS":           "mat-nylon-sls-001",
    "Aluminum 6061":       "mat-al6061-001",
    "Aluminum 7075":       "mat-al7075-001",
    "Stainless Steel 316": "mat-ss316-001",
    "Brass C360":          "mat-brass-001",
    "Mild Steel":          "mat-mildsteel-001",
    "Stainless Sheet":     "mat-ss-sheet-001",
    "Aluminum Sheet":      "mat-al-sheet-001",
    "Aluminum Cast":       "mat-al-cast-001",
    "Bronze Cast":         "mat-bronze-cast-001",
    "ABS Injection":       "mat-abs-inj-001",
    "PP Injection":        "mat-pp-inj-001",
}


def seed_manufacturing_taxonomy(conn):
    """Seed manufacturing processes and materials."""
    print("  Seeding manufacturing processes...")

    processes = [
        # 3D Printing
        (PROC_IDS["FDM"],           "3d_printing", "FDM",              "Fused Deposition Modeling"),
        (PROC_IDS["SLA"],           "3d_printing", "SLA",              "Stereolithography (Resin)"),
        (PROC_IDS["SLS"],           "3d_printing", "SLS",              "Selective Laser Sintering"),
        # CNC
        (PROC_IDS["3-axis CNC"],    "cnc",         "3-axis CNC",       "3-Axis CNC Milling"),
        (PROC_IDS["5-axis CNC"],    "cnc",         "5-axis CNC",       "5-Axis CNC Milling"),
        # Sheet Metal
        (PROC_IDS["Laser Cutting"], "sheet_metal", "Laser Cutting",    "Laser Cutting"),
        (PROC_IDS["Sheet Bending"], "sheet_metal", "Sheet Bending",    "Sheet Metal Bending"),
        # Casting
        (PROC_IDS["Sand Casting"],      "casting", "Sand Casting",     "Sand Casting"),
        (PROC_IDS["Investment Cast"],   "casting", "Investment Cast",  "Investment (Lost Wax) Casting"),
        # Injection Molding
        (PROC_IDS["Injection Molding"], "injection_molding", "Injection Molding", "Plastic Injection Molding"),
    ]

    for pid, family, name, display in processes:
        conn.execute(text("""
            INSERT INTO manufacturing_processes (id, family, name, display_name)
            VALUES (:id, :family, :name, :display)
            ON CONFLICT (id) DO NOTHING
        """), {"id": pid, "family": family, "name": name, "display": display})

    print("  Seeding manufacturing materials...")

    materials = [
        # 3D printing — thermoplastics
        (MAT_IDS["PLA Basic"],           "thermoplastic", "PLA Basic",           "3d_printing"),
        (MAT_IDS["PETG"],                "thermoplastic", "PETG",                "3d_printing"),
        (MAT_IDS["ABS"],                 "thermoplastic", "ABS",                 "3d_printing"),
        (MAT_IDS["Nylon (PA12)"],        "thermoplastic", "Nylon (PA12)",        "3d_printing"),
        (MAT_IDS["TPU Flexible"],        "thermoplastic", "TPU Flexible",        "3d_printing"),
        # 3D printing — resins
        (MAT_IDS["Standard Resin"],      "resin",         "Standard Resin",      "3d_printing"),
        (MAT_IDS["Tough Resin"],         "resin",         "Tough Resin",         "3d_printing"),
        # 3D printing — SLS
        (MAT_IDS["Nylon SLS"],           "thermoplastic", "Nylon SLS",           "3d_printing"),
        # CNC metals
        (MAT_IDS["Aluminum 6061"],       "metal",         "Aluminum 6061",       "cnc"),
        (MAT_IDS["Aluminum 7075"],       "metal",         "Aluminum 7075",       "cnc"),
        (MAT_IDS["Stainless Steel 316"], "metal",         "Stainless Steel 316", "cnc"),
        (MAT_IDS["Brass C360"],          "metal",         "Brass C360",          "cnc"),
        (MAT_IDS["Mild Steel"],          "metal",         "Mild Steel",          "cnc"),
        # Sheet metal
        (MAT_IDS["Stainless Sheet"],     "metal",         "Stainless Sheet",     "sheet_metal"),
        (MAT_IDS["Aluminum Sheet"],      "metal",         "Aluminum Sheet",      "sheet_metal"),
        # Casting
        (MAT_IDS["Aluminum Cast"],       "metal",         "Aluminum Cast",       "casting"),
        (MAT_IDS["Bronze Cast"],         "metal",         "Bronze Cast",         "casting"),
        # Injection molding
        (MAT_IDS["ABS Injection"],       "thermoplastic", "ABS Injection",       "injection_molding"),
        (MAT_IDS["PP Injection"],        "thermoplastic", "PP Injection",        "injection_molding"),
    ]

    for mid, category, name, process_family in materials:
        conn.execute(text("""
            INSERT INTO manufacturing_materials (id, category, name, process_family)
            VALUES (:id, :cat, :name, :pf)
            ON CONFLICT (id) DO NOTHING
        """), {"id": mid, "cat": category, "name": name, "pf": process_family})


TEST_BUYER = "test-buyer-001"
TEST_FULFILLER = "test-fulfiller-001"

# Pre-hashed passwords (bcrypt, 12 rounds):
# "TestBuyer123!" → hash below
# "TestFulfiller123!" → hash below
import bcrypt as _bcrypt
_BUYER_PW = _bcrypt.hashpw(b"TestBuyer123!", _bcrypt.gensalt()).decode()
_FULFILLER_PW = _bcrypt.hashpw(b"TestFulfiller123!", _bcrypt.gensalt()).decode()


def seed_users(conn):
    """Ensure Peter, Marta, and test email users exist."""
    print("  Seeding users...")
    upsert_user(conn, PETER, "Peter Goon", "petergoon@gmail.com")
    upsert_user(conn, MARTA, "Marta Demo", "marta@demo.fitd.dev")

    # Test email users (pre-verified, known passwords for dev login)
    upsert_user(conn, TEST_BUYER, "Test Buyer", "buyer@test.fitd.dev",
                auth_provider="email", password_hash=_BUYER_PW, email_verified=True)
    upsert_user(conn, TEST_FULFILLER, "Test Fulfiller", "fulfiller@test.fitd.dev",
                auth_provider="email", password_hash=_FULFILLER_PW, email_verified=True)
    print("    Test accounts: buyer@test.fitd.dev / TestBuyer123!")
    print("    Test accounts: fulfiller@test.fitd.dev / TestFulfiller123!")


def seed_tasks(conn):
    """Seed tasks for both users (Marta's new tasks + references to Peter's existing ones)."""
    print("  Seeding tasks...")

    # Marta's tasks (for her community orders)
    marta_tasks = {
        "paddington": "seed-marta-paddington",
        "bird":       "seed-marta-bird",
        "phoebe":     "seed-marta-phoebe",
        "printer":    "seed-marta-printer",
        "cooper":     "seed-marta-cooper",
        "monitor":    "seed-marta-monitor",
    }
    for label, tid in marta_tasks.items():
        insert_task(conn, tid, MARTA, f"marta-{label}", "obj", True, ts(30))

    # Peter's tasks for his community orders (obj models)
    peter_order_tasks = {
        "alan":     "seed-peter-alan",
        "fiona":    "seed-peter-fiona",
        "strategy": "seed-peter-strategy",
        "kuldeep":  "seed-peter-kuldeep",
    }
    for label, tid in peter_order_tasks.items():
        insert_task(conn, tid, PETER, f"peter-{label}", "obj", True, ts(40))

    # Peter's CAD tasks (for CAD-specific manufacturing orders)
    peter_cad_tasks = {
        "bracket":  "seed-peter-cad-bracket",
        "enclosure": "seed-peter-cad-enclosure",
    }
    for label, tid in peter_cad_tasks.items():
        insert_task(conn, tid, PETER, f"peter-cad-{label}", "glb", True, ts(10))

    return marta_tasks, peter_order_tasks, peter_cad_tasks


def seed_orders_and_claims(conn, marta_tasks, peter_order_tasks, peter_cad_tasks):
    """Seed orders covering all claim lifecycle states, plus CAD-specific orders."""
    print("  Seeding orders and claims...")

    # ── MARTA'S COMMUNITY ORDERS (visible to Peter in /fulfill marketplace) ──

    # 1) Paddington Bear — qty 5, unclaimed, 3D printing
    insert_order(conn,
        order_id="seed-ord-paddington", task_id=marta_tasks["paddington"], user_id=MARTA,
        name="Paddington Bear", material="PLA Basic", technique="FDM",
        sizing=1.2, colour="brown", price=24.99, quantity=5,
        created_at=ts(14), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PLA Basic"],
    )

    # 2) Friendly Bird — qty 8, Peter claimed 3 (pending)
    insert_order(conn,
        order_id="seed-ord-bird", task_id=marta_tasks["bird"], user_id=MARTA,
        name="Friendly Bird", material="PETG", technique="FDM",
        sizing=0.8, colour="blue", price=12.50, quantity=8,
        created_at=ts(12), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PETG"],
    )
    claim_bird = "seed-claim-bird"
    insert_claim(conn, claim_bird, "seed-ord-bird", PETER, 3, "pending", 2, 2)

    # 3) Baby Phoebe — qty 2, Peter claimed all (in_progress)
    insert_order(conn,
        order_id="seed-ord-phoebe", task_id=marta_tasks["phoebe"], user_id=MARTA,
        name="Baby Phoebe", material="Standard Resin", technique="SLA",
        sizing=1.0, colour="pink", price=45.00, quantity=2,
        created_at=ts(10), qa_level="high",
        process_id=PROC_IDS["SLA"], material_id=MAT_IDS["Standard Resin"],
    )
    claim_phoebe = "seed-claim-phoebe"
    insert_claim(conn, claim_phoebe, "seed-ord-phoebe", PETER, 2, "in_progress", 8, 5)
    insert_status_history(conn, claim_phoebe, [("pending", "in_progress", 5)], PETER)

    # 4) 3D Printer Mini — qty 4, Peter claimed all (printing)
    insert_order(conn,
        order_id="seed-ord-printer", task_id=marta_tasks["printer"], user_id=MARTA,
        name="3D Printer Miniature", material="Tough Resin", technique="SLA",
        sizing=1.5, colour="silver", price=89.00, quantity=4,
        created_at=ts(20), qa_level="high",
        process_id=PROC_IDS["SLA"], material_id=MAT_IDS["Tough Resin"],
    )
    claim_printer = "seed-claim-printer"
    insert_claim(conn, claim_printer, "seed-ord-printer", PETER, 4, "printing", 15, 3)
    insert_status_history(conn, claim_printer, [
        ("pending", "in_progress", 12), ("in_progress", "printing", 3),
    ], PETER)

    # 5) Mini Cooper S — qty 3, Peter claimed all (delivered, ready for buyer review)
    insert_order(conn,
        order_id="seed-ord-cooper", task_id=marta_tasks["cooper"], user_id=MARTA,
        name="Mini Cooper S", material="PLA Basic", technique="FDM",
        sizing=2.0, colour="red", price=35.00, quantity=3,
        created_at=ts(25), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PLA Basic"],
    )
    claim_cooper = "seed-claim-cooper"
    insert_claim(conn, claim_cooper, "seed-ord-cooper", PETER, 3, "delivered", 20, 1)
    insert_status_history(conn, claim_cooper, [
        ("pending", "in_progress", 18), ("in_progress", "printing", 14),
        ("printing", "qa_check", 10), ("qa_check", "shipped", 5),
        ("shipped", "delivered", 1),
    ], PETER)

    # 6) Computer Monitor — qty 6, Peter claimed 4 (shipped), 2 still available
    insert_order(conn,
        order_id="seed-ord-monitor", task_id=marta_tasks["monitor"], user_id=MARTA,
        name="Computer Monitor", material="PETG", technique="FDM",
        sizing=1.8, colour="black", price=18.75, quantity=6,
        created_at=ts(18), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PETG"],
    )
    claim_monitor = "seed-claim-monitor"
    insert_claim(conn, claim_monitor, "seed-ord-monitor", PETER, 4, "shipped", 14, 2)
    insert_status_history(conn, claim_monitor, [
        ("pending", "in_progress", 12), ("in_progress", "printing", 8),
        ("printing", "qa_check", 6), ("qa_check", "shipped", 2),
    ], PETER)

    # ── PETER'S COMMUNITY ORDERS ──

    # 7) Alan Meeson — qty 3, Marta claimed 2 (qa_check)
    insert_order(conn,
        order_id="seed-ord-alan", task_id=peter_order_tasks["alan"], user_id=PETER,
        name="Alan Meeson Figurine", material="PLA Basic", technique="FDM",
        sizing=1.0, colour="beige", price=29.99, quantity=3,
        created_at=ts(22), qa_level="high",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PLA Basic"],
    )
    claim_alan = "seed-claim-alan"
    insert_claim(conn, claim_alan, "seed-ord-alan", MARTA, 2, "qa_check", 18, 3)
    insert_status_history(conn, claim_alan, [
        ("pending", "in_progress", 16), ("in_progress", "printing", 10),
        ("printing", "qa_check", 3),
    ], MARTA)

    # 8) Princess Fiona — qty 1, Marta claimed 1 (accepted) + disbursement
    insert_order(conn,
        order_id="seed-ord-fiona", task_id=peter_order_tasks["fiona"], user_id=PETER,
        name="Princess Fiona", material="Standard Resin", technique="SLA",
        sizing=1.3, colour="green", price=55.00, quantity=1,
        created_at=ts(35), qa_level="standard",
        process_id=PROC_IDS["SLA"], material_id=MAT_IDS["Standard Resin"],
    )
    claim_fiona = "seed-claim-fiona"
    insert_claim(conn, claim_fiona, "seed-ord-fiona", MARTA, 1, "accepted", 30, 5)
    insert_status_history(conn, claim_fiona, [
        ("pending", "in_progress", 28), ("in_progress", "printing", 22),
        ("printing", "qa_check", 18), ("qa_check", "shipped", 14),
        ("shipped", "delivered", 8), ("delivered", "accepted", 5),
    ], MARTA)
    insert_disbursement(conn, "seed-disb-fiona", claim_fiona, MARTA, 5500, "pending")

    # 9) Manufacturing Strategy — qty 10, unclaimed
    insert_order(conn,
        order_id="seed-ord-strategy", task_id=peter_order_tasks["strategy"], user_id=PETER,
        name="Manufacturing Strategy Model", material="PETG", technique="FDM",
        sizing=0.5, colour="white", price=8.50, quantity=10,
        created_at=ts(7), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PETG"],
    )

    # 10) Kuldeep Figurine — qty 2, Marta claimed 2 (disputed)
    insert_order(conn,
        order_id="seed-ord-kuldeep", task_id=peter_order_tasks["kuldeep"], user_id=PETER,
        name="Kuldeep Figurine", material="PLA Basic", technique="FDM",
        sizing=1.1, colour="navy", price=32.00, quantity=2,
        created_at=ts(30), qa_level="standard",
        process_id=PROC_IDS["FDM"], material_id=MAT_IDS["PLA Basic"],
    )
    claim_kuldeep = "seed-claim-kuldeep"
    insert_claim(conn, claim_kuldeep, "seed-ord-kuldeep", MARTA, 2, "disputed", 25, 2)
    insert_status_history(conn, claim_kuldeep, [
        ("pending", "in_progress", 23), ("in_progress", "printing", 18),
        ("printing", "qa_check", 14), ("qa_check", "shipped", 10),
        ("shipped", "delivered", 5), ("delivered", "disputed", 2),
    ], MARTA)
    insert_disbursement(conn, "seed-disb-kuldeep", claim_kuldeep, MARTA, 6400, "held")
    insert_dispute(conn, "seed-dispute-kuldeep", claim_kuldeep, PETER,
        "The figurine's face details are completely wrong - looks nothing like the reference.",
        "open", 5)

    # ── CAD-SPECIFIC ORDERS (demonstrate CNC/sheet metal flows) ──

    # 11) CNC Bracket — CAD model, CNC process, Aluminum, tight tolerance
    insert_order(conn,
        order_id="seed-ord-bracket", task_id=peter_cad_tasks["bracket"], user_id=PETER,
        name="Motor Mounting Bracket", material="Aluminum 6061", technique="3-axis CNC",
        sizing=1.0, colour="natural", selectedFileType="glb",
        price=185.00, quantity=4,
        created_at=ts(5), qa_level="high",
        process_id=PROC_IDS["3-axis CNC"], material_id=MAT_IDS["Aluminum 6061"],
        tolerance_mm=0.1, surface_finish="Bead Blasted",
    )

    # 12) Sheet Metal Enclosure — CAD model, sheet metal process
    insert_order(conn,
        order_id="seed-ord-enclosure", task_id=peter_cad_tasks["enclosure"], user_id=PETER,
        name="Electronics Enclosure", material="Aluminum Sheet", technique="Laser Cutting",
        sizing=1.0, colour="natural", selectedFileType="glb",
        price=95.00, quantity=2,
        created_at=ts(3), qa_level="standard",
        process_id=PROC_IDS["Laser Cutting"], material_id=MAT_IDS["Aluminum Sheet"],
        tolerance_mm=0.5, surface_finish="As Machined",
    )


def seed_fulfiller_profiles(conn):
    """Seed fulfiller profiles with manufacturing capabilities."""
    print("  Seeding fulfiller profiles...")

    # Marta has a fulfiller profile with FDM + SLA capabilities
    conn.execute(text("""
        INSERT INTO fulfiller_profiles (
            id, user_id, business_name, description,
            max_build_volume_x, max_build_volume_y, max_build_volume_z,
            min_tolerance_mm, lead_time_days_min, lead_time_days_max,
            certifications, post_processing, is_active,
            created_at, updated_at
        ) VALUES (
            :id, :uid, :bname, :desc,
            :bvx, :bvy, :bvz,
            :tol, :ltmin, :ltmax,
            :certs, :pp, :active,
            :cat, :uat
        ) ON CONFLICT (id) DO NOTHING
    """), {
        "id": "seed-profile-marta", "uid": MARTA,
        "bname": "Marta's Print Shop",
        "desc": "FDM and resin printing, fast turnaround for figurines and prototypes.",
        "bvx": 250.0, "bvy": 210.0, "bvz": 200.0,
        "tol": 0.2, "ltmin": 3, "ltmax": 7,
        "certs": '["ISO 9001"]', "pp": '["sanding", "painting", "vapor smoothing"]',
        "active": True,
        "cat": dts(30), "uat": dts(1),
    })

    # Capabilities: FDM + SLA
    for cap_id, proc_id, materials_json in [
        ("seed-cap-marta-fdm", PROC_IDS["FDM"],
         f'["{MAT_IDS["PLA Basic"]}", "{MAT_IDS["PETG"]}", "{MAT_IDS["ABS"]}"]'),
        ("seed-cap-marta-sla", PROC_IDS["SLA"],
         f'["{MAT_IDS["Standard Resin"]}", "{MAT_IDS["Tough Resin"]}"]'),
    ]:
        conn.execute(text("""
            INSERT INTO fulfiller_capabilities (id, profile_id, process_id, materials, notes)
            VALUES (:id, :pid, :proc, :mats, :notes)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": cap_id, "pid": "seed-profile-marta",
            "proc": proc_id, "mats": materials_json,
            "notes": None,
        })


def seed_parts_catalog(conn, marta_tasks, peter_order_tasks, peter_cad_tasks):
    """Seed the parts catalog with published parts."""
    print("  Seeding parts catalog...")

    parts = [
        # Peter's published parts
        {"id": "seed-part-fiona", "publisher_user_id": PETER,
         "name": "Princess Fiona", "description": "Princess Fiona in warrior pose. Fine details best printed with resin.",
         "category": "figurine", "tags": '["character", "movie", "fantasy"]',
         "task_id": peter_order_tasks["fiona"], "file_type": "obj",
         "bounding_box_x": 35.0, "bounding_box_y": 35.0, "bounding_box_z": 90.0,
         "volume_cm3": 88.7, "surface_area_cm2": 420.0,
         "recommended_process": "SLA", "recommended_material": "Tough Resin",
         "status": "published", "is_public": True, "download_count": 15,
         "created_at": ts(50), "updated_at": ts(3)},

        {"id": "seed-part-alan", "publisher_user_id": PETER,
         "name": "Alan Meeson Figurine", "description": "Highly detailed figurine. FDM-optimised.",
         "category": "figurine", "tags": '["character", "portrait"]',
         "task_id": peter_order_tasks["alan"], "file_type": "obj",
         "bounding_box_x": 45.0, "bounding_box_y": 40.0, "bounding_box_z": 85.0,
         "volume_cm3": 120.5, "surface_area_cm2": 380.0,
         "recommended_process": "FDM", "recommended_material": "PLA",
         "status": "published", "is_public": True, "download_count": 12,
         "created_at": ts(60), "updated_at": ts(5)},

        {"id": "seed-part-strategy", "publisher_user_id": PETER,
         "name": "Manufacturing Strategy Model", "description": "Abstract desktop display piece.",
         "category": "art", "tags": '["abstract", "display"]',
         "task_id": peter_order_tasks["strategy"], "file_type": "obj",
         "bounding_box_x": 80.0, "bounding_box_y": 80.0, "bounding_box_z": 60.0,
         "volume_cm3": 155.0, "surface_area_cm2": 620.0,
         "recommended_process": "FDM", "recommended_material": "PETG",
         "status": "published", "is_public": True, "download_count": 8,
         "created_at": ts(35), "updated_at": ts(4)},

        # Peter's CAD parts
        {"id": "seed-part-bracket", "publisher_user_id": PETER,
         "name": "Motor Mounting Bracket", "description": "CNC-ready mounting bracket for NEMA 23 motors. Aluminum recommended.",
         "category": "hardware", "tags": '["cnc", "bracket", "motor", "functional"]',
         "task_id": peter_cad_tasks["bracket"], "file_type": "step",
         "bounding_box_x": 80.0, "bounding_box_y": 60.0, "bounding_box_z": 25.0,
         "volume_cm3": 18.5, "surface_area_cm2": 145.0,
         "recommended_process": "3-axis CNC", "recommended_material": "Aluminum 6061",
         "status": "published", "is_public": True, "download_count": 6,
         "created_at": ts(5), "updated_at": ts(1)},

        {"id": "seed-part-enclosure", "publisher_user_id": PETER,
         "name": "Electronics Enclosure", "description": "Sheet metal enclosure for Raspberry Pi + HAT. Laser cut + bend.",
         "category": "hardware", "tags": '["sheet-metal", "enclosure", "electronics", "raspberry-pi"]',
         "task_id": peter_cad_tasks["enclosure"], "file_type": "step",
         "bounding_box_x": 100.0, "bounding_box_y": 70.0, "bounding_box_z": 35.0,
         "volume_cm3": 8.2, "surface_area_cm2": 310.0,
         "recommended_process": "Laser Cutting", "recommended_material": "Aluminum Sheet",
         "status": "published", "is_public": True, "download_count": 3,
         "created_at": ts(3), "updated_at": ts(1)},

        # Marta's published parts
        {"id": "seed-part-geartrain", "publisher_user_id": MARTA,
         "name": "Planetary Gear Set", "description": "Fully functional planetary gearbox. 5:1 ratio. Print-in-place.",
         "category": "mechanical", "tags": '["gear", "gearbox", "functional", "print-in-place"]',
         "task_id": marta_tasks["bird"], "file_type": "stl",
         "bounding_box_x": 60.0, "bounding_box_y": 60.0, "bounding_box_z": 40.0,
         "volume_cm3": 95.0, "surface_area_cm2": 450.0,
         "recommended_process": "FDM", "recommended_material": "PETG",
         "status": "published", "is_public": True, "download_count": 45,
         "created_at": ts(28), "updated_at": ts(6)},

        {"id": "seed-part-bolt", "publisher_user_id": MARTA,
         "name": "M6 Hex Bolt & Nut Set", "description": "ISO-standard M6x20 hex bolt with matching nut.",
         "category": "hardware", "tags": '["bolt", "nut", "fastener", "M6", "ISO"]',
         "task_id": marta_tasks["printer"], "file_type": "step",
         "bounding_box_x": 10.0, "bounding_box_y": 10.0, "bounding_box_z": 25.0,
         "volume_cm3": 1.2, "surface_area_cm2": 8.5,
         "recommended_process": "SLA", "recommended_material": "Tough Resin",
         "status": "published", "is_public": True, "download_count": 63,
         "created_at": ts(25), "updated_at": ts(1)},

        {"id": "seed-part-cableclip", "publisher_user_id": MARTA,
         "name": "Cable Clip Assortment", "description": "Set of 6 cable management clips for various diameters.",
         "category": "hardware", "tags": '["cable", "clip", "organiser", "desk"]',
         "task_id": marta_tasks["phoebe"], "file_type": "stl",
         "bounding_box_x": 20.0, "bounding_box_y": 15.0, "bounding_box_z": 12.0,
         "volume_cm3": 3.5, "surface_area_cm2": 22.0,
         "recommended_process": "FDM", "recommended_material": "PLA",
         "status": "published", "is_public": True, "download_count": 89,
         "created_at": ts(20), "updated_at": ts(8)},
    ]

    for p in parts:
        insert_part(conn, **p)


# ════════════════════════════════════════════════════════════════════════
# FILE SYMLINKS
# ════════════════════════════════════════════════════════════════════════

def seed_placeholder_files(marta_tasks, peter_order_tasks):
    """Create symlinks in uploads/ so seed OBJ tasks resolve to real 3D model files.

    Picks from existing .obj files already present in uploads/ (generated by Meshy).
    CAD tasks (glb) are skipped — they use a different fetch path.
    """
    uploads_dir = "uploads"
    if not os.path.isdir(uploads_dir):
        print("  SKIP: uploads/ directory not found")
        return

    # Gather large-ish OBJ files to use as link targets
    real_objs = sorted(
        f for f in os.listdir(uploads_dir)
        if f.endswith(".obj")
        and not f.startswith("seed-")
        and os.path.getsize(os.path.join(uploads_dir, f)) > 500_000
    )
    if not real_objs:
        print("  SKIP: no existing OBJ files to link from")
        return

    all_obj_tasks = list(marta_tasks.values()) + list(peter_order_tasks.values())
    linked = 0
    for i, task_id in enumerate(all_obj_tasks):
        target = os.path.join(uploads_dir, f"{task_id}.obj")
        if os.path.exists(target):
            continue
        source = real_objs[i % len(real_objs)]
        os.symlink(source, target)
        linked += 1
        print(f"    {task_id}.obj -> {source}")

    print(f"  Created {linked} symlinks ({len(all_obj_tasks) - linked} already existed)")


# ════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════

def main():
    print(f"Connecting to: {DATABASE_URL.split('@')[0].split('://')[0]}://***@{DATABASE_URL.split('@')[-1]}")

    with engine.begin() as conn:
        seed_manufacturing_taxonomy(conn)
        seed_users(conn)
        marta_tasks, peter_order_tasks, peter_cad_tasks = seed_tasks(conn)
        seed_orders_and_claims(conn, marta_tasks, peter_order_tasks, peter_cad_tasks)
        seed_fulfiller_profiles(conn)
        seed_parts_catalog(conn, marta_tasks, peter_order_tasks, peter_cad_tasks)

    print("  Seeding placeholder OBJ files...")
    seed_placeholder_files(marta_tasks, peter_order_tasks)

    print()
    print("Seed complete!")
    print()
    print("=== MANUFACTURING TAXONOMY ===")
    print(f"  {len(PROC_IDS)} processes: FDM, SLA, SLS, 3-axis CNC, 5-axis CNC, Laser Cutting, Sheet Bending, Sand/Investment Casting, Injection Molding")
    print(f"  {len(MAT_IDS)} materials across 5 families")
    print()
    print("=== MARTA'S COMMUNITY ORDERS (Peter sees in marketplace) ===")
    print("  Paddington Bear     | qty 5  | unclaimed           | available to claim")
    print("  Friendly Bird       | qty 8  | 3 claimed (pending) | 5 still available")
    print("  Baby Phoebe         | qty 2  | 2 claimed (in_progress)")
    print("  3D Printer Mini     | qty 4  | 4 claimed (printing)")
    print("  Mini Cooper S       | qty 3  | 3 claimed (delivered)   | buyer review ready")
    print("  Computer Monitor    | qty 6  | 4 claimed (shipped)     | 2 still available")
    print()
    print("=== PETER'S COMMUNITY ORDERS ===")
    print("  Alan Meeson         | qty 3  | 2 claimed by Marta (qa_check)")
    print("  Princess Fiona      | qty 1  | 1 claimed by Marta (accepted, disbursement pending)")
    print("  Manufacturing Model | qty 10 | unclaimed")
    print("  Kuldeep Figurine    | qty 2  | 2 claimed by Marta (disputed, open)")
    print()
    print("=== CAD-SPECIFIC ORDERS (new manufacturing flows) ===")
    print("  Motor Bracket       | qty 4  | 3-axis CNC | Al 6061 | +/-0.1mm | Bead Blasted")
    print("  Electronics Encl.   | qty 2  | Laser Cut  | Al Sheet | +/-0.5mm | As Machined")
    print()
    print("=== FULFILLER PROFILES ===")
    print("  Marta's Print Shop  | FDM (PLA/PETG/ABS) + SLA (Std/Tough Resin) | min tol 0.2mm")
    print()
    print("=== PARTS CATALOG ===")
    print("  8 published parts (3 Peter OBJ, 2 Peter CAD/STEP, 3 Marta)")
    print()
    print("=== CLAIM LIFECYCLE COVERAGE ===")
    print("  pending, in_progress, printing, qa_check, shipped, delivered, accepted, disputed")


if __name__ == "__main__":
    main()
