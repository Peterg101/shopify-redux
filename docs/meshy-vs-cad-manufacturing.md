# Meshy vs CAD: Manufacturing Flow Analysis

## Two Complementary Pipelines

The FITD platform supports two distinct 3D generation pathways that serve fundamentally different use cases:

| Aspect | Meshy (meshy_backend) | CAD (cad_service + step_service) |
|--------|----------------------|----------------------------------|
| **Use case** | Artistic/decorative objects | Functional/engineering parts |
| **Input** | Text or image prompt | Text prompt |
| **Engine** | Meshy.ai API (external) | LLM + CadQuery (local) |
| **Output format** | OBJ + MTL mesh | STEP solid + glB preview |
| **Geometry type** | Organic, sculptural | Parametric, precision |
| **Dimensions** | Arbitrary (unitless) | Absolute (mm, ISO 10303) |
| **Metadata** | Volume via Three.js (imprecise) | Bounding box, volume, surface area from STEP |
| **Storage** | db_service disk (`uploads/`) | MinIO S3 (`fitd-files` bucket) |
| **Manufacturing** | 3D printing only | Any technique |

## Current State

### What Works

- Both pipelines generate 3D models and register tasks in db_service
- Frontend correctly routes file fetching by `file_type` (Meshy → db_service, CAD → step_service)
- step_service extracts precise metadata from STEP files (bounding box, volume, surface area)
- Manufacturing infrastructure exists in the database (processes, materials, fulfiller capabilities)
- Fulfiller claim validation checks process + material capability

### What's Missing

The two pipelines **converge identically** at the order stage with no differentiation:

- Technique selection is hardcoded to 3D printing only (FDM/Resin)
- File type doesn't determine available manufacturing processes
- CAD metadata (bounding box, volume) is extracted but not propagated to basket/orders
- Pricing doesn't account for manufacturing process or dimensional requirements
- Fulfiller matching validates only process + material, not build volume or tolerance

## Database Infrastructure (Already Built)

The database schema already supports sophisticated manufacturing management:

```
ManufacturingProcess
├── family: "3d_printing" | "cnc" | "sheet_metal" | "casting" | "injection_molding"
├── name: "FDM", "SLA", "3-axis CNC", etc.
└── display_name: human-readable

ManufacturingMaterial
├── category: "thermoplastic", "metal", etc.
├── name: "PLA", "Aluminum 6061", etc.
└── process_family → ManufacturingProcess.family

FulfillerProfile
├── max_build_volume_x/y/z    # dimensional constraints
├── min_tolerance_mm           # precision capability
├── lead_time_days_min/max     # fulfillment timeline
├── certifications             # ["ISO 9001", etc.]
├── post_processing            # ["anodizing", "powder coating", etc.]
└── capabilities → FulfillerCapability[]
    ├── process_id → ManufacturingProcess
    ├── materials  # JSON array of material IDs
    └── notes      # process-specific guidance

Order (existing fields, underused)
├── process_id → ManufacturingProcess
├── material_id → ManufacturingMaterial
├── tolerance_mm
├── surface_finish
└── special_requirements
```

## Required Changes to Differentiate Flows

### 1. File-Type-Aware Process Selection (HIGH Priority)

**Problem:** ConfigurationPanel shows only FDM/Resin regardless of file type.

**Solution:** Gate available processes by file type:

```
Meshy file (OBJ/STL) → filter to family = "3d_printing" only
CAD file (STEP/glB)  → show ALL manufacturing families
```

The ConfigurationPanel already partially supports dynamic process loading from the server — it just needs the file-type filter added.

### 2. Metadata Propagation (HIGH Priority)

**Problem:** step_service extracts precise metadata but it stops there.

**Required flow:**
```
step_service extracts metadata (bounding_box, volume_mm3, surface_area_mm2)
    ↓
Frontend stores metadata in Redux on task completion
    ↓
BasketItem includes metadata when adding to cart
    ↓
Order preserves metadata from basket
    ↓
Fulfiller validation uses metadata at claim time
```

**Schema additions needed:**
- `BasketItem`: add `bounding_box_x/y/z`, `volume_mm3`, `surface_area_mm2`
- `Order`: add same fields (some may already exist)

### 3. Process-Aware Pricing (MEDIUM Priority)

**Current:** Volume-based with material cost multiplier only.

**Required for CAD:**
```
base_cost = actual_volume_mm3 * scale^3 * material_cost_per_mm3 * process_markup
          + tolerance_premium (tighter = more expensive)
          + surface_finish_premium (e.g., anodizing, polishing)
```

**For Meshy:** Keep existing Three.js volume estimation + simple pricing. The imprecise geometry doesn't warrant more sophisticated pricing.

### 4. Enhanced Fulfiller Matching (MEDIUM Priority)

**Current:** Validates process + material only.

**Additional checks for CAD orders:**
- Build volume: part dimensions (scaled) must fit fulfiller's max volume
- Tolerance: order's `tolerance_mm` must be achievable by fulfiller's `min_tolerance_mm`
- Lead time: optional matching against fulfiller's range

**For Meshy:** Process + material validation is sufficient (no dimensional constraints).

## Example: CAD Order Flow (Future State)

```
1. User generates a bracket via cad_service
   → step_service extracts: 100×50×75 mm, 2500 mm³, 4000 mm²

2. ConfigurationPanel detects file_type = "glb" (CAD)
   → Shows ALL manufacturing processes:
     - 3D Printing: FDM, SLA, SLS
     - CNC: 3-axis, 5-axis
     - Sheet Metal: laser cut, bend
     - Casting: investment, sand
     - Injection Molding

3. User selects "3-axis CNC" + "Aluminum 6061"
   → Tolerance: 0.5 mm, Surface finish: "anodized"
   → Sizing: 1.5x → scaled to 150×75×112.5 mm

4. Pricing: volume * CNC markup * aluminum cost * tolerance premium
   = 8437.5 mm³ * 2.5 * $0.02/mm³ * 1.2 = ~$507

5. Fulfiller claims order:
   ✓ Has "3-axis CNC" capability
   ✓ Has "Aluminum 6061" material
   ✓ Build volume 500×300×300 mm ≥ 150×75×112.5 mm
   ✓ min_tolerance 0.1 mm ≤ required 0.5 mm
   → Claim succeeds
```

## Example: Meshy Order Flow (Current, Mostly Working)

```
1. User generates a figurine via meshy_backend
   → OBJ file, no metadata, arbitrary units

2. ConfigurationPanel detects file_type = "obj" (Meshy)
   → Shows 3D printing only: FDM, SLA/Resin
   → No tolerance or surface finish options

3. User selects "FDM" + "PLA Basic"
   → Sizing: 1.0x
   → Volume estimated by Three.js

4. Pricing: estimated_volume * material_cost * markup

5. Fulfiller claims order:
   ✓ Has "FDM" capability
   ✓ Has "PLA" material
   → Claim succeeds (no dimensional checks needed)
```

## Priority Roadmap

| Priority | Change | Impact |
|----------|--------|--------|
| **HIGH** | File-type-aware process filtering in ConfigurationPanel | Unlocks CNC/molding/etc. for CAD models |
| **HIGH** | Add `file_type` to BasketItem model | Enables downstream routing |
| **HIGH** | Propagate step_service metadata to basket/orders | Enables dimensional validation |
| **MEDIUM** | Process-specific pricing factors | Accurate cost for CNC vs FDM vs injection |
| **MEDIUM** | Build volume + tolerance validation in claim flow | Prevents mismatched fulfiller claims |
| **MEDIUM** | Tolerance/surface finish UI for CAD orders | Captures engineering requirements |
| **LOW** | Fulfiller lead time matching | Better fulfiller-order fit |
| **LOW** | Post-processing catalog in order specs | Request specific finishes |
| **LOW** | Fulfiller marketplace / quoting | Pre-order fulfiller discovery |

## Key Architectural Principle

**Meshy and CAD are complementary, not redundant.** They serve different customer segments:

- **Meshy buyers** want decorative objects, figurines, artistic pieces → 3D printing is the only viable manufacturing method for organic geometry
- **CAD buyers** want functional parts, enclosures, brackets → multiple manufacturing techniques apply depending on material, precision, and volume requirements

The platform's value proposition grows significantly when CAD models can be manufactured via CNC, injection molding, and other techniques — not just 3D printing. The database infrastructure for this already exists; it just needs to be connected to the frontend flow.
