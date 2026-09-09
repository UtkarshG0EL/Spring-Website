/**
 * ExtensionSpring.js — Three.js geometry for helical extension springs.
 *
 * Body: close-wound helix (pitch = wire diameter).
 * Ends: machine-loop hooks modelled as semicircular arcs.
 */

import * as THREE from 'three';

const SEG_PER_COIL  = 60;
const RADIAL_SEG    = 16;
const HOOK_SEG      = 32;   // segments per hook arc

// ---------------------------------------------------------------------------
// Close-wound helix curve
// ---------------------------------------------------------------------------
class ExtensionBodyCurve extends THREE.Curve {
  constructor({ D, d, Na, hand }) {
    super();
    this.R    = D / 2;
    this.d    = d;
    this.Na   = Na;
    this.hand = hand;
    this.bodyLength = Na * d;   // coils touching → pitch = d
    this.turns = Na;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const { R, d, Na, hand, bodyLength } = this;
    const theta = t * Na * 2 * Math.PI;
    return target.set(
      R * Math.cos(theta * hand),
      t * bodyLength - bodyLength / 2,
      R * Math.sin(theta),
    );
  }
}

// ---------------------------------------------------------------------------
// Machine-loop hook geometry
// ---------------------------------------------------------------------------

/**
 * Build control points for a machine-loop hook.
 *
 * The hook:
 * 1. Exits the last coil radially inward (straight segment → centre axis).
 * 2. Bends upward (or downward) in a 270° arc.
 * 3. Ends with the opening facing sideways.
 *
 * @param {number} springR     coil radius
 * @param {number} endY        Y position where the body coil ends
 * @param {number} endAngle    cumulative helix angle at the end (radians)
 * @param {number} hookR       hook loop radius
 * @param {number} sign        +1 top hook, -1 bottom hook
 */
function makeHookPoints(springR, endY, endAngle, hookR, sign, hand) {
  const pts = [];

  // Radial normal from center to the coil end
  const Norm = new THREE.Vector3(Math.cos(endAngle), 0, Math.sin(endAngle));
  // True forward tangent of the helix at this angle
  const Dir  = new THREE.Vector3(-Math.sin(endAngle) * hand, 0, Math.cos(endAngle) * hand);

  // We trace the top hook forward (along Dir), and bottom hook backward (-Dir)
  // because we always generate points from the helix OUT to the hook tip.
  const StartDir = Dir.clone().multiplyScalar(sign);
  const Up = new THREE.Vector3(0, sign, 0);

  // Center of the vertical hook loop
  const C = new THREE.Vector3(0, endY + sign * hookR, 0);

  // Sweep phi from -90° (bottom of loop) to 180° (far side tip)
  const startPhi = -Math.PI / 2;
  const endPhi   = Math.PI;
  const steps = 40;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const phi = startPhi + t * (endPhi - startPhi);

    // Smoothstep blend the radial offset so the wire swoops gracefully
    // from the coil radius into the central plane over the first 90 degrees.
    let blend = 0;
    if (phi < 0) {
      const u = (phi - startPhi) / (Math.PI / 2); // 0 to 1
      blend = 1.0 - (3 * u * u - 2 * u * u * u);
    }

    const p = C.clone()
      .addScaledVector(StartDir, hookR * Math.cos(phi))
      .addScaledVector(Up,       hookR * Math.sin(phi))
      .addScaledVector(Norm,     springR * blend);

    pts.push(p);
  }

  return pts;
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/**
 * Build an extension spring mesh group.
 * @param {object} params — { wireDiameter, coilDiameter, numActiveCoils, handedness }
 * @param {THREE.Material} material
 * @returns {THREE.Group}
 */
export function buildExtensionSpring(params, material) {
  const {
    wireDiameter:   d,
    coilDiameter:   D,
    numActiveCoils: Na,
    handedness,
  } = params;

  const safeD  = Math.max(D, d * 1.1);
  const safeNa = Math.max(Na, 2);
  const hand   = handedness === 'left' ? -1 : 1;
  const r      = d / 2;
  const R      = safeD / 2;

  const group = new THREE.Group();

  // --- Body ---
  const bodyCurve  = new ExtensionBodyCurve({ D: safeD, d, Na: safeNa, hand });
  const bodyLength = bodyCurve.bodyLength;
  const tubeSeg    = Math.round(bodyCurve.turns * SEG_PER_COIL);
  const bodyGeo    = new THREE.TubeGeometry(bodyCurve, tubeSeg, r, RADIAL_SEG, false);
  group.add(new THREE.Mesh(bodyGeo, material.clone()));

  const hookR = R * 0.85;

  // Bottom end angle = 0 (helix starts at angle 0)
  const botEndAngle = 0;
  const topEndAngle = safeNa * 2 * Math.PI * hand;

  // --- Bottom hook ---
  const botPts  = makeHookPoints(R, -bodyLength / 2, botEndAngle, hookR, -1, hand);
  const botCurve = new THREE.CatmullRomCurve3(botPts, false, 'catmullrom', 0.1);
  const botGeo   = new THREE.TubeGeometry(botCurve, HOOK_SEG * 2, r * 0.9, RADIAL_SEG, false);
  group.add(new THREE.Mesh(botGeo, material.clone()));

  // --- Top hook ---
  const topPts  = makeHookPoints(R,  bodyLength / 2, topEndAngle, hookR,  1, hand);
  const topCurve = new THREE.CatmullRomCurve3(topPts, false, 'catmullrom', 0.1);
  const topGeo   = new THREE.TubeGeometry(topCurve, HOOK_SEG * 2, r * 0.9, RADIAL_SEG, false);
  group.add(new THREE.Mesh(topGeo, material.clone()));

  // --- Flat Caps ---
  // The hooks use slightly smaller wire radius r * 0.9 in the TubeGeometry above
  const capGeo = new THREE.CircleGeometry(r * 0.9, 32);
  const capMat = material.clone();
  capMat.side = THREE.DoubleSide;

  const botCap = new THREE.Mesh(capGeo, capMat);
  botCap.position.copy(botCurve.getPoint(1));
  botCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), botCurve.getTangent(1));

  const topCap = new THREE.Mesh(capGeo, capMat);
  topCap.position.copy(topCurve.getPoint(1));
  topCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), topCurve.getTangent(1));

  group.add(botCap, topCap);

  return group;
}









