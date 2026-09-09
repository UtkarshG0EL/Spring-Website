/**
 * TorsionSpring.js — Three.js geometry for helical torsion springs.
 *
 * Structure: arm1 → close-wound helical body → arm2
 *
 * Both arms EXIT TANGENTIALLY from the helix so there are no sharp corners.
 *
 * Math:
 *   Helix at angle θ: P(θ) = (R·cos θ, y, R·sin θ)
 *   Forward tangent (hand=+1): dP/dθ ∝ (−sin θ, 0, cos θ)
 *
 * arm1Angle sets arm 1 direction as (cos a1, 0, sin a1).
 * To make arm 1 tangential, the helix must START at α₁ = a1 + hand·π/2
 * so the backward tangent at α₁ equals the arm 1 direction.
 *
 * arm 2 exits in the FORWARD tangent direction at the helix end — no extra
 * angle parameter needed, the torsion body naturally rotates arm 2.
 */

import * as THREE from 'three';

const SEG_PER_COIL = 64;
const ARM_PTS      = 10;   // points per arm (more = smoother CatmullRom blend)
const RADIAL_SEG   = 14;

// ---------------------------------------------------------------------------
export function buildTorsionSpring(params, material) {
  const {
    wireDiameter: d,
    coilDiameter: D,
    numCoils:     Na,
    arm1Length:   L1,
    arm1Angle:    a1deg,
    arm2Length:   L2,
    arm2Angle:    a2deg,
    handedness,
  } = params;

  const safeD  = Math.max(D, d * 1.1);
  const safeNa = Math.max(Na, 1);
  const hand   = handedness === 'left' ? -1 : 1;
  const R      = safeD / 2;
  const r      = d / 2;

  const a1 = (a1deg * Math.PI) / 180;
  const a2 = (a2deg * Math.PI) / 180;

  // ── Helix start/end angles ─────────────────────────────────────────────
  // Start angle chosen so backward tangent matches arm 1 direction
  const alpha1 = a1 + hand * Math.PI / 2;
  // End angle chosen so forward tangent matches arm 2 direction
  const alpha2 = a2 - hand * Math.PI / 2;

  // Find the required fractional turn to hit alpha2 from alpha1
  let diff = hand * (alpha2 - alpha1);
  let fraction = (diff % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

  // Use the integer part of the user's coil count (so slider adds full loops)
  let fullTurns = Math.floor(safeNa);
  // Prevent zero-length body
  if (fullTurns === 0 && fraction < 0.01) fullTurns = 1;

  const actualTurns = fullTurns + fraction / (2 * Math.PI);
  const bodyLen     = actualTurns * d;

  const y0 = -bodyLen / 2;
  const y1 =  bodyLen / 2;

  // ── Arm 1 direction & tip ──────────────────────────────────────────────
  const arm1Dir = new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1));
  const helixStart = new THREE.Vector3(R * Math.cos(alpha1), y0, R * Math.sin(alpha1));
  const arm1Tip = helixStart.clone().addScaledVector(arm1Dir, L1);

  // ── Arm 2 direction & tip ──────────────────────────────────────────────
  const endTheta = alpha1 + actualTurns * 2 * Math.PI * hand;
  const helixEnd = new THREE.Vector3(R * Math.cos(endTheta), y1, R * Math.sin(endTheta));
  const arm2Dir  = new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2));
  const arm2Tip  = helixEnd.clone().addScaledVector(arm2Dir, L2);

  // ── Build point list ───────────────────────────────────────────────────
  const pts = [];

  // Arm 1 (tip to helix start)
  for (let i = 0; i <= ARM_PTS; i++) {
    const t = i / ARM_PTS;
    pts.push(new THREE.Vector3().lerpVectors(arm1Tip, helixStart, t));
  }

  // Helix body
  const helixSeg = Math.max(Math.round(actualTurns * SEG_PER_COIL), 32);
  for (let i = 1; i <= helixSeg; i++) {
    const t     = i / helixSeg;
    const theta = alpha1 + t * actualTurns * 2 * Math.PI * hand;
    pts.push(new THREE.Vector3(
      R * Math.cos(theta),
      y0 + t * bodyLen,
      R * Math.sin(theta),
    ));
  }

  // Arm 2 (helix end to tip)
  for (let i = 1; i <= ARM_PTS; i++) {
    const t = i / ARM_PTS;
    pts.push(new THREE.Vector3().lerpVectors(helixEnd, arm2Tip, t));
  }

  // ── Curve & tube ──────────────────────────────────────────────────────
  const curve    = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const tubeSeg  = Math.max(pts.length * 3, 128);
  const geometry = new THREE.TubeGeometry(curve, tubeSeg, r, RADIAL_SEG, false);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material.clone()));

  // ── Flat Caps ─────────────────────────────────────────────────────────
  const capGeo = new THREE.CircleGeometry(r, 32);
  const capMat = material.clone();
  capMat.side = THREE.DoubleSide;

  const startCap = new THREE.Mesh(capGeo, capMat);
  startCap.position.copy(curve.getPoint(0));
  startCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(0).negate());

  const endCap = new THREE.Mesh(capGeo, capMat);
  endCap.position.copy(curve.getPoint(1));
  endCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(1));
  
  group.add(startCap, endCap);

  return group;
}






