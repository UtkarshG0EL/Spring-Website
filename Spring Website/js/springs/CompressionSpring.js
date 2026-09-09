/**
 * CompressionSpring.js — Three.js geometry for helical compression springs.
 *
 * End types
 * ---------
 *  open   – uniform pitch throughout, wire tips float at whatever angle
 *  closed – 1 close-wound dead coil per end (pitch = wire diameter, coils touch)
 *           Abrupt transition to active pitch.  Matches real spring appearance.
 *  ground – identical geometry to closed (grinding is a manufacturing step,
 *           not a geometric one)
 *
 * Y-position formula
 * ------------------
 *  Bottom dead zone  (0 ≤ coil < 1):   y = coil × d
 *  Active zone       (1 ≤ coil ≤ Nt−1): y = d + (coil−1) × p
 *  Top dead zone     (Nt−1 < coil ≤ Nt): y = L − (Nt−coil) × d
 *
 *  where  p = (L − 2d) / Na   (active pitch)
 *         Nt = Na + 2          (total coils)
 */

import * as THREE from 'three';

const SEG_PER_COIL = 64;
const RADIAL_SEG   = 16;

// ---------------------------------------------------------------------------
class CompressionSpringCurve extends THREE.Curve {
  constructor(L, R, d, Na, endType, hand) {
    super();
    this.L    = L;
    this.R    = R;
    this.d    = d;
    this.hand = hand;

    this.dead = (endType === 'open') ? 0 : 1;
    this.Nt   = Na + this.dead * 2;
    this.turns = this.Nt;

    // Active pitch fills remaining height after dead coils
    this.p = (this.dead > 0)
      ? Math.max((L - 2 * d) / Na, d)   // can't be less than wire diameter
      : L / Na;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const { L, R, Nt, dead, d, p, hand } = this;

    const theta = t * Nt * 2 * Math.PI;
    const coil  = t * Nt;

    let y;

    if (dead > 0 && coil < dead) {
      // ── Bottom dead coil: close-wound ──────────────────────────────────
      y = coil * d;

    } else if (dead > 0 && coil > Nt - dead) {
      // ── Top dead coil: close-wound ────────────────────────────────────
      y = L - (Nt - coil) * d;

    } else {
      // ── Active zone ───────────────────────────────────────────────────
      y = dead * d + (coil - dead) * p;
    }

    return target.set(
      R * Math.cos(theta * hand),
      y - L / 2,
      R * Math.sin(theta),
    );
  }
}

// ---------------------------------------------------------------------------
export function buildCompressionSpring(params, material) {
  const {
    freeLength:     L,
    wireDiameter:   d,
    coilDiameter:   D,
    numActiveCoils: Na,
    endType,
    handedness,
  } = params;

  const safeD  = Math.max(D, d * 2.1);
  const safeNa = Math.max(Na, 1);
  const hand   = handedness === 'left' ? -1 : 1;
  const R      = safeD / 2;

  const curve   = new CompressionSpringCurve(L, R, d, safeNa, endType, hand);
  const tubeSeg = Math.max(Math.round(curve.turns * SEG_PER_COIL), 64);
  const geo     = new THREE.TubeGeometry(curve, tubeSeg, d / 2, RADIAL_SEG, false);

  // ── "Closed & Ground": clip wire flush at each end face ─────────────────
  // Two clipping planes slice the tube geometry exactly at y = ±L/2.
  // This reveals the flat wire cross-section at each end — the "ground" face —
  // with no extra disc geometry needed.
  const mat = material.clone();
  if (endType === 'ground') {
    mat.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(0,  1, 0),  L / 2),  // clips y < −L/2
      new THREE.Plane(new THREE.Vector3(0, -1, 0),  L / 2),  // clips y >  L/2
    ];
    mat.clipShadows = true;
  }

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));

  if (endType === 'ground') {
    // Add solid 2D flat rings to cover the hollow cross-section created by clipping
    const outerR = R + d / 2;
    const innerR = Math.max(R - d / 2, 0.001);
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 64);
    const ringMat = material.clone(); // use original material without clipping planes
    ringMat.side = THREE.DoubleSide;

    const topRing = new THREE.Mesh(ringGeo, ringMat);
    topRing.rotation.x = -Math.PI / 2;
    topRing.position.y = L / 2;

    const bottomRing = new THREE.Mesh(ringGeo, ringMat);
    bottomRing.rotation.x = Math.PI / 2;
    bottomRing.position.y = -L / 2;

    group.add(topRing, bottomRing);
  } else {
    // Add flat circular caps for Open and Closed (squared) to hide hollow tube ends
    const capGeo = new THREE.CircleGeometry(d / 2, 32);
    const capMat = material.clone();
    capMat.side = THREE.DoubleSide; // Ensure visibility from both sides

    const startCap = new THREE.Mesh(capGeo, capMat);
    startCap.position.copy(curve.getPoint(0));
    // Face cap normal (-Z before rotation) away from the curve start tangent
    startCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(0).negate());

    const endCap = new THREE.Mesh(capGeo, capMat);
    endCap.position.copy(curve.getPoint(1));
    // Face cap normal (+Z before rotation) away from the curve end tangent
    endCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(1));

    group.add(startCap, endCap);
  }

  return group;
}









