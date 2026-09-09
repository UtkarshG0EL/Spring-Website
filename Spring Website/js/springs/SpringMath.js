/**
 * SpringMath.js — Engineering formulas for helical spring design.
 *
 * Units convention: mm (length), N (force), N/mm (spring rate),
 * N/mm² = MPa (stress), Hz (frequency), kg/mm³ (density).
 *
 * References:
 *   • Shigley's Mechanical Engineering Design, 10th ed.
 *   • Wahl, A.M. — Mechanical Springs, 2nd ed.
 */

// ---------------------------------------------------------------------------
// Materials database
// G  = Shear modulus   [N/mm²]
// E  = Young's modulus [N/mm²]
// rho = Density        [kg/mm³]
// ---------------------------------------------------------------------------
export const MATERIALS = {
  steel:          { label: 'Carbon Steel (A228)',      G: 79_300, E: 206_000, rho: 7.85e-6 },
  stainless:      { label: 'Stainless Steel (A313)',   G: 69_000, E: 193_000, rho: 7.92e-6 },
  chromeSilicon:  { label: 'Chrome Silicon (A401)',    G: 77_000, E: 203_000, rho: 7.85e-6 },
  phosphorBronze: { label: 'Phosphor Bronze (A159)',   G: 41_000, E: 103_000, rho: 8.86e-6 },
  titanium:       { label: 'Titanium (Grade 5)',       G: 41_000, E: 113_800, rho: 4.43e-6 },
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Spring Index  C = D_mean / d */
export function springIndex(D, d) {
  return d > 0 ? D / d : NaN;
}

/**
 * Wahl Correction Factor for shear stress (compression / extension springs).
 * K_w = (4C-1)/(4C-4) + 0.615/C
 */
export function wahlFactor(C) {
  if (C <= 1 || !isFinite(C)) return NaN;
  return (4 * C - 1) / (4 * C - 4) + 0.615 / C;
}

/**
 * Inner-fibre bending stress correction for torsion springs.
 * K_i = (4C²-C-1) / (4C(C-1))
 */
export function torsionStressFactor(C) {
  if (C <= 1 || !isFinite(C)) return NaN;
  return (4 * C * C - C - 1) / (4 * C * (C - 1));
}

// ---------------------------------------------------------------------------
// Compression / Extension spring formulas
// ---------------------------------------------------------------------------

/**
 * Helical spring rate (shear).
 * k = G·d⁴ / (8·D³·Na)  [N/mm]
 */
export function helicalSpringRate(G, d, D, Na) {
  if (Na <= 0 || D <= 0 || d <= 0) return 0;
  return (G * d ** 4) / (8 * D ** 3 * Na);
}

/**
 * Total coils for a compression spring given end type.
 * open → Nt = Na
 * closed / ground → Nt = Na + 2
 */
export function totalCoils(Na, endType) {
  return endType === 'open' ? Na : Na + 2;
}

/**
 * Solid length of a compression spring.
 * L_s = Nt · d  [mm]
 */
export function solidLength(Nt, d) {
  return Nt * d;
}

/**
 * Natural (resonance) frequency of a helical spring.
 * f_n = d / (π·D²·Na) · √(G / (2·ρ))  [Hz]
 */
export function resonanceFrequency(G, d, D, Na, rho) {
  if (Na <= 0 || D <= 0 || d <= 0 || rho <= 0) return 0;
  return (d / (Math.PI * D * D * Na)) * Math.sqrt(G / (2 * rho));
}

// ---------------------------------------------------------------------------
// Torsion spring formulas
// ---------------------------------------------------------------------------

/**
 * Torsion spring angular rate.
 * k_θ = E·d⁴ / (10.8·D·Na)  [N·mm/rad]
 */
export function torsionSpringRate(E, d, D, Na) {
  if (Na <= 0 || D <= 0 || d <= 0) return 0;
  return (E * d ** 4) / (10.8 * D * Na);
}

// ---------------------------------------------------------------------------
// Calculated property bundles (for the properties panel)
// ---------------------------------------------------------------------------

function fmt(v, dec = 2) {
  if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return '—';
  return v.toFixed(dec);
}

/**
 * Compute all displayable properties for a compression spring.
 * @param {object} p — { freeLength, wireDiameter, coilDiameter, numActiveCoils, endType, material }
 * @returns {object} — { props: Array<{name,value,unit,state}>, warnings: string[] }
 */
export function calcCompressionProps(p) {
  const { freeLength: L, wireDiameter: d, coilDiameter: D, numActiveCoils: Na, endType } = p;
  const mat = MATERIALS[p.material] || MATERIALS.steel;

  const C   = springIndex(D, d);
  const Kw  = wahlFactor(C);
  const k   = helicalSpringRate(mat.G, d, D, Na);
  const Nt  = totalCoils(Na, endType);
  const Ls  = solidLength(Nt, d);
  const fn  = resonanceFrequency(mat.G, d, D, Na, mat.rho);
  const maxDef = Math.max(0, L - Ls);

  const warnings = [];
  if (C < 4)      warnings.push('Spring index C < 4 — very difficult to manufacture');
  if (C > 12)     warnings.push('Spring index C > 12 — risk of lateral buckling');
  if (Ls >= L)    warnings.push('Solid length ≥ free length — spring cannot function');
  if (Na < 2)     warnings.push('Active coils < 2 — not a functional spring');
  if (d >= D)     warnings.push('Wire diameter ≥ coil diameter — invalid geometry');

  const indexState = (C < 4 || C > 12) ? 'warn' : 'ok';
  const defState   = maxDef <= 0 ? 'err' : 'ok';

  return {
    props: [
      { name: 'Spring Rate',      value: fmt(k),      unit: 'N/mm',   state: 'ok'        },
      { name: 'Spring Index',     value: fmt(C),       unit: 'C = D/d', state: indexState },
      { name: 'Wahl Factor',      value: fmt(Kw, 4),   unit: 'Kw',    state: 'ok'        },
      { name: 'Total Coils',      value: Nt.toFixed(1),unit: '',       state: 'ok'        },
      { name: 'Solid Length',     value: fmt(Ls),      unit: 'mm',    state: 'ok'        },
      { name: 'Max Deflection',   value: fmt(maxDef),  unit: 'mm',    state: defState    },
      { name: 'Resonance Freq.',  value: fmt(fn, 1),   unit: 'Hz',    state: 'ok'        },
      { name: 'Material',         value: mat.label,    unit: '',       state: 'ok'        },
    ],
    warnings,
  };
}

/**
 * Compute displayable properties for an extension spring.
 */
export function calcExtensionProps(p) {
  const { wireDiameter: d, coilDiameter: D, numActiveCoils: Na } = p;
  const mat = MATERIALS[p.material] || MATERIALS.steel;

  const C       = springIndex(D, d);
  const Kw      = wahlFactor(C);
  const k       = helicalSpringRate(mat.G, d, D, Na);
  const bodyLen = Na * d;           // close-wound body
  const fn      = resonanceFrequency(mat.G, d, D, Na, mat.rho);

  const warnings = [];
  if (C < 4)  warnings.push('Spring index C < 4 — very difficult to manufacture');
  if (C > 12) warnings.push('Spring index C > 12 — risk of lateral buckling');
  if (Na < 2) warnings.push('Active coils < 2 — not a functional spring');
  if (d >= D) warnings.push('Wire diameter ≥ coil diameter — invalid geometry');

  const indexState = (C < 4 || C > 12) ? 'warn' : 'ok';

  return {
    props: [
      { name: 'Spring Rate',     value: fmt(k),     unit: 'N/mm',    state: 'ok'        },
      { name: 'Spring Index',    value: fmt(C),      unit: 'C = D/d', state: indexState },
      { name: 'Wahl Factor',     value: fmt(Kw, 4),  unit: 'Kw',     state: 'ok'        },
      { name: 'Body Length',     value: fmt(bodyLen),unit: 'mm',      state: 'ok'        },
      { name: 'Resonance Freq.', value: fmt(fn, 1),  unit: 'Hz',      state: 'ok'        },
      { name: 'Material',        value: mat.label,   unit: '',         state: 'ok'        },
    ],
    warnings,
  };
}

/**
 * Compute displayable properties for a torsion spring.
 */
export function calcTorsionProps(p) {
  const { wireDiameter: d, coilDiameter: D, numCoils: Na, arm1Length: L1, arm2Length: L2 } = p;
  const mat = MATERIALS[p.material] || MATERIALS.steel;

  const C    = springIndex(D, d);
  const Ki   = torsionStressFactor(C);
  // Effective coils — arms contribute partial compliance
  const NaEff = Na + (L1 + L2) / (3 * Math.PI * D);
  const k    = torsionSpringRate(mat.E, d, D, NaEff);   // N·mm/rad
  const kDeg = k * (Math.PI / 180);                      // N·mm/°
  const bodyLen = Na * d;

  const warnings = [];
  if (C < 4)  warnings.push('Spring index C < 4 — very difficult to manufacture');
  if (C > 12) warnings.push('Spring index C > 12 — high stress concentration');
  if (Na < 2) warnings.push('Active coils < 2 — not a functional torsion spring');
  if (d >= D) warnings.push('Wire diameter ≥ coil diameter — invalid geometry');

  const indexState = (C < 4 || C > 12) ? 'warn' : 'ok';

  return {
    props: [
      { name: 'Angular Rate',    value: fmt(k, 1),     unit: 'N·mm/rad', state: 'ok'        },
      { name: 'Rate per Degree', value: fmt(kDeg, 3),  unit: 'N·mm/°',   state: 'ok'        },
      { name: 'Spring Index',    value: fmt(C),         unit: 'C = D/d',  state: indexState },
      { name: 'Stress Factor',   value: fmt(Ki, 4),     unit: 'Ki',       state: 'ok'        },
      { name: 'Eff. Active Coils', value: fmt(NaEff, 2), unit: '',         state: 'ok'        },
      { name: 'Body Length',     value: fmt(bodyLen),   unit: 'mm',       state: 'ok'        },
      { name: 'Material',        value: mat.label,      unit: '',          state: 'ok'        },
    ],
    warnings,
  };
}

/**
 * Compute all displayable properties for a double torsion spring.
 */
export function calcDoubleTorsionProps(p) {
  const { wireDiameter: d, coilDiameter: D, numCoils: Na, arm1Length: L1, arm2Length: L2, material } = p;
  const mat = MATERIALS[material] || MATERIALS.steel;

  const C   = springIndex(D, d);
  const Ki  = wahlFactor(C);
  
  // Arms flex as well. For double torsion we have two arms.
  const NaEff = Na + (L1 + L2) / (3 * Math.PI * D); // Simplified approx for double torsion
  
  // Single rate:
  const k_single    = torsionSpringRate(mat.E, d, D, NaEff);   // N·mm/rad
  const k_singleDeg = k_single * (Math.PI / 180);                      // N·mm/°
  
  // Double torsion rate is 2x the single rate (coils act in parallel on the central bridge)
  const k    = k_single * 2;
  const kDeg = k_singleDeg * 2;

  const bodyLen = Na * d * 2 + p.bridgeGap;

  const warnings = [];
  if (C < 4)  warnings.push('Spring index C < 4 — very difficult to manufacture');
  if (C > 14) warnings.push('Spring index C > 14 — risk of tangling');
  if (d >= D) warnings.push('Wire diameter ≥ coil diameter — invalid geometry');

  const indexState = (C < 4 || C > 14) ? 'warn' : 'ok';

  return {
    props: [
      { name: 'Angular Rate',    value: fmt(k, 1),     unit: 'N·mm/rad', state: 'ok'        },
      { name: 'Rate per Degree', value: fmt(kDeg, 3),  unit: 'N·mm/°',   state: 'ok'        },
      { name: 'Spring Index',    value: fmt(C),         unit: 'C = D/d',  state: indexState },
      { name: 'Stress Factor',   value: fmt(Ki, 4),     unit: 'Ki',       state: 'ok'        },
      { name: 'Coils per side',  value: Na.toFixed(1),  unit: '',         state: 'ok'        },
      { name: 'Total Body Len',  value: fmt(bodyLen),   unit: 'mm',       state: 'ok'        },
      { name: 'Material',        value: mat.label,      unit: '',          state: 'ok'        },
    ],
    warnings,
  };
}









