# ⚙ Spring Design Preview

An interactive 3D spring design tool powered by **Three.js**. Visualize and parameterize three spring types in real time by dragging sliders.

![Spring types: Compression, Extension, Torsion]

---

## Features

| Feature | Details |
|---|---|
| **3 spring types** | Compression, Extension, Torsion |
| **Live 3D preview** | Updates instantly as you drag sliders |
| **Orbit controls** | Drag to orbit · Scroll to zoom · Right-drag to pan |
| **Engineering calc** | Spring rate, Wahl factor, solid length, resonance frequency |
| **5 materials** | Carbon Steel, Stainless, Chrome Silicon, Phosphor Bronze, Titanium |
| **End types** | Open / Closed / Closed & Ground (compression) |
| **Helix direction** | Left-hand or Right-hand |
| **Torsion arms** | Configurable arm length & angle |
| **Validation warnings** | Flags impractical spring indices, invalid solid length, etc. |

---

## Quick Start

### Option 1 — Python (no install needed)
```bash
# In this folder:
python -m http.server 8080
# Then open: http://localhost:8080
```

### Option 2 — Node.js
```bash
npx serve .
```

### Option 3 — VS Code Live Server
Install the **Live Server** extension, right-click `index.html` → *Open with Live Server*.

> **Why not just double-click index.html?**
> Modern browsers block ES module imports between local files on the `file://` protocol (CORS policy). A local HTTP server solves this. The CDN imports for Three.js work fine from anywhere.

---

## Project Structure

```
Spring Website/
├── index.html                    — HTML shell, Three.js importmap
├── style.css                     — Dark engineering UI theme
├── js/
│   ├── main.js                   — App entry: wires everything together
│   ├── scene/
│   │   └── SceneManager.js       — Three.js renderer, camera, lights
│   ├── springs/
│   │   ├── CompressionSpring.js  — Parametric compression helix geometry
│   │   ├── ExtensionSpring.js    — Close-wound helix + machine-loop hooks
│   │   ├── TorsionSpring.js      — Helix body + configurable arms
│   │   └── SpringMath.js         — Engineering formulas & material database
│   └── ui/
│       ├── ControlPanel.js       — Dynamic sliders / dropdowns sidebar
│       └── PropertiesPanel.js    — Calculated properties display
└── assets/
    └── cad/                      — Place your STEP/IGES files here (reference)
```

---

## Spring Parameters

### Compression Spring
| Parameter | Range | Description |
|---|---|---|
| Free Length | 20–300 mm | Unloaded spring length |
| Wire Diameter | 0.5–15 mm | Wire cross-section diameter |
| Coil Diameter (OD) | 5–150 mm | Outer coil diameter |
| Active Coils | 2–40 | Number of coils contributing to deflection |
| End Type | open / closed / ground | Controls inactive end coils |
| Helix Direction | Left / Right hand | Winding direction |

### Extension Spring
| Parameter | Range | Description |
|---|---|---|
| Wire Diameter | 0.5–10 mm | |
| Coil Diameter (OD) | 5–100 mm | |
| Active Coils | 2–60 | Close-wound body coils |

### Torsion Spring
| Parameter | Range | Description |
|---|---|---|
| Wire Diameter | 0.5–10 mm | |
| Coil Diameter (OD) | 5–100 mm | |
| Number of Coils | 2–20 | |
| Arm 1 / 2 Length | 5–120 mm | |
| Arm 1 / 2 Angle | 0–360° | Angle of arm from +X axis |

---

## Engineering Formulas Used

| Property | Formula |
|---|---|
| Spring Rate (comp/ext) | $k = \frac{G d^4}{8 D^3 N_a}$ |
| Spring Rate (torsion) | $k_\theta = \frac{E d^4}{10.8 D N_a}$ |
| Spring Index | $C = D / d$ |
| Wahl Factor (shear) | $K_w = \frac{4C-1}{4C-4} + \frac{0.615}{C}$ |
| Solid Length | $L_s = N_t \cdot d$ |
| Resonance Frequency | $f_n = \frac{d}{\pi D^2 N_a} \sqrt{\frac{G}{2\rho}}$ |

> All units: mm, N, N/mm, Hz

---

## CAD Files

Place your STEP or IGES files in `assets/cad/`. Browsers cannot render STEP/IGES natively. To use them as reference overlays:
1. Convert to GLB using [CAD Exchanger](https://cadexchanger.com/), FreeCAD, or Fusion 360 (export GLB)
2. Load via `THREE.GLTFLoader` — raise a GitHub issue or ask to have this feature added

---

## Tech Stack
- [Three.js r168](https://threejs.org/) — 3D rendering via WebGL
- Vanilla HTML/CSS/JS — zero build tools, zero frameworks
- ES Modules with importmap — works in all modern browsers
