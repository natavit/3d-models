# Multi-Angle Reference & Turnaround Guide

High-craft 3D modeling depends on orthographic, shadow-even, distortion-free references. Dramatic wide-angle renders hide proportions in perspective foreshortening and deep shadows.

Always save references inside `<project>/refs/` and inspect them with `read_file` before writing `blueprint.md`.

---

## Mode 1: `generate` (Nano Banana Two-Step Anchor → Turnaround)

Calling an image model 4 separate times (*"front view"*, *"side view"*, *"back view"*, *"top view"*) produces 4 **inconsistent** designs whose silhouettes do not align. Always lock a single **Hero 3/4 Anchor** first, then generate **one single 2×2 Orthographic Sheet** anchored to that exact image.

### Step 1 — Hero 3/4 Studio Anchor (`refs/hero-3q.png`)

Invoke the `image-generator` subagent with a prompt following this template:

> Studio product photography of **[SUBJECT + SPECIFIC DESIGN DETAILS + MATERIALS]**, **[VISUAL STYLE]**, three-quarter front-right view at 25-degree elevation, shot on an 85mm telephoto lens with minimal perspective distortion, resting flat on a seamless neutral light-grey background (`#E5E5E5`), soft even three-point studio lighting that clearly separates surface planes, bevels, seams, and material finishes, crisp silhouette, symmetric neutral pose, zero background props, zero text or watermarks, square 1:1 composition.

*Gate:* If the user's initial prompt left aesthetic choices open, show `refs/hero-3q.png` first and confirm before Step 2.

### Step 2 — 2×2 Orthographic Turnaround Sheet (`refs/turnaround-ortho.png`)

Invoke `image-generator` passing `refs/hero-3q.png` as the input/reference image to edit/transform:

> Using the exact object design, proportions, part count, colors, and surface details from `refs/hero-3q.png`, generate a clean technical 3D modeler's orthographic turnaround sheet on a flat uniform `#E5E5E5` background. Arrange a crisp 2×2 grid of four strictly orthographic views with ZERO perspective lens distortion and identical world scale across panels:
> - Top-Left: Front orthographic view
> - Top-Right: Right-side profile orthographic view
> - Bottom-Left: Back orthographic view
> - Bottom-Right: Top-down orthographic plan view (front of object pointing downward)
> Keep horizontal height landmarks aligned between the Front, Right-side, and Back panels. Neutral symmetric state, even shadowless diffuse studio illumination so every contour, seam, cutout, and recess is legible. Minimal small corner labels (`FRONT`, `RIGHT`, `BACK`, `TOP`) only; no clutter.

*(Why match this exact `FRONT | RIGHT` / `BACK | TOP` layout? Because `scripts/render-quad.mjs` renders the exact same 2×2 panel arrangement in `pass-N-ortho.png`, making side-by-side proportion checks instant.)*

---

## Mode 2: `hybrid` (Search Ground-Truth → Nano Banana Clean Sheet)

Recommended for real-world categories (vehicles, cameras, espresso machines, watches, furniture, instruments, robotics):

1. **Search real facts first (`search_web`):**
   - Look up real overall dimensions in millimeters/meters (`width × height × depth`, wheelbase, seat height, lens diameter, etc.).
   - Gather reference descriptions or download clean reference images to `refs/raw-*` to understand authentic mechanical joints, fasteners, vents, and ergonomics.
2. **Synthesize clean studio references (`image-generator`):**
   - Generate `refs/hero-3q.png` incorporating the exact real-world proportions and functional details discovered during research.
   - Generate `refs/turnaround-ortho.png` from `refs/hero-3q.png` using the Step 2 prompt above.

This eliminates cluttered backgrounds, wide-angle smartphone distortion, and missing back/top angles common in web photos while keeping real mechanical authenticity.

---

## Mode 3: `search` (Direct Real-World Blueprints / Photos)

Best when modeling a specific real product or vehicle that already has published technical drawings or clean multi-angle studio photos:

1. Search for `"<subject> orthographic blueprint front side top back"` and `"<subject> dimensions mm"`.
2. Download the cleanest orthographic blueprint and 2–3 high-resolution studio photos into `<project>/refs/` (`curl -L -sS ...`).
3. Inspect each downloaded file with `read_file` to verify it actually loaded a valid, high-resolution image (never assume a URL worked without viewing the saved file).
4. Record exact millimeter/meter dimensions at the top of `blueprint.md`.

---

## Measuring Proportions from `refs/turnaround-ortho.png`

Before writing `blueprint.md`, extract dimensionless ratios from the orthographic panels so parts never drift:

1. Pick `H` (total height from floor `y = 0` to highest point) in meters.
2. Measure `W / H` from the `FRONT` panel and `D / H` from the `RIGHT` panel.
3. Record vertical elevation landmarks as fractions of `H` (e.g., `basePlinthTop = 0.08 H`, `countertop = 0.42 H`, `hoodCrest = 0.86 H`).
4. Record horizontal landmarks along `X` (from `FRONT`/`TOP`) and `Z` (from `RIGHT`/`TOP`).
5. Cross-check `TOP` panel aspect ratio (`W : D`) against `FRONT` width and `RIGHT` depth—if Nano Banana drifted slightly between panels, treat `FRONT` (for `X, Y`) and `RIGHT` (for `Z, Y`) as authoritative and reconcile `TOP` to match `[W, D]`.
