import * as THREE from 'three';

const SEG_PER_COIL = 64;
const ARM_PTS      = 10;
const RADIAL_SEG   = 14;

export function buildDoubleTorsionSpring(params, material) {
  const {
    wireDiameter: d,
    coilDiameter: D,
    numCoils:     Na,
    arm1Length:   L1,
    arm1Angle:    a1deg,
    arm2Length:   L2,
    arm2Angle:    a2deg,
    bridgeLength,
    bridgeGap,
    handedness,
  } = params;

  const safeD  = Math.max(D, d * 1.1);
  const safeNa = Math.max(Na, 1);
  // User selection is treated as the Top Coil's handedness
  const hand   = handedness === 'left' ? -1 : 1; 
  const R      = safeD / 2;
  const r      = d / 2;

  // Bottom coil is opposite handedness to form a proper double torsion
  const hand1 = -hand;
  const hand2 = hand;

  const a1 = (a1deg * Math.PI) / 180;
  const a2 = (a2deg * Math.PI) / 180;

  // Both coils meet at the front center (alpha = pi/2) to form the bridge
  const alpha_center = Math.PI / 2;

  // --- Bottom Coil (hand1) ---
  const alpha1 = a1 + hand1 * Math.PI / 2;
  let diff1 = hand1 * (alpha_center - alpha1);
  let fraction1 = (diff1 % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  let fullTurns1 = Math.floor(safeNa);
  if (fullTurns1 === 0 && fraction1 < 0.01) fullTurns1 = 1;
  const actualTurns1 = fullTurns1 + fraction1 / (2 * Math.PI);

  // --- Top Coil (hand2) ---
  const alpha2 = a2 - hand2 * Math.PI / 2;
  let diff2 = hand2 * (alpha2 - alpha_center);
  let fraction2 = (diff2 % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  let fullTurns2 = Math.floor(safeNa);
  if (fullTurns2 === 0 && fraction2 < 0.01) fullTurns2 = 1;
  const actualTurns2 = fullTurns2 + fraction2 / (2 * Math.PI);

  // --- Y Coordinates ---
  const y1 = -bridgeGap / 2;
  const y2 = bridgeGap / 2;
  const y0 = y1 - actualTurns1 * d;
  const y3 = y2 + actualTurns2 * d;

  // --- Key Points & Directions ---
  const arm1Dir = new THREE.Vector3(Math.cos(a1), 0, Math.sin(a1));
  const helix1Start = new THREE.Vector3(R * Math.cos(alpha1), y0, R * Math.sin(alpha1));
  const arm1Tip = helix1Start.clone().addScaledVector(arm1Dir, L1);

  const arm2Dir = new THREE.Vector3(Math.cos(a2), 0, Math.sin(a2));
  const helix2End = new THREE.Vector3(R * Math.cos(alpha2), y3, R * Math.sin(alpha2));
  const arm2Tip = helix2End.clone().addScaledVector(arm2Dir, L2);

  const P1 = new THREE.Vector3(0, y1, R);
  const P2 = new THREE.Vector3(0, y2, R);

  // Tangent at pi/2 is purely on the X axis. 
  // Bridge projects radially outward to form a U-shape lever.
  const bridgeDir = new THREE.Vector3(-hand1, 0, 0); 
  const P_bridge_1 = P1.clone().addScaledVector(bridgeDir, bridgeLength);
  const P_bridge_2 = P2.clone().addScaledVector(bridgeDir, bridgeLength);
  const Cb = new THREE.Vector3(P_bridge_1.x, 0, R);
  const Rb = bridgeGap / 2;

  // --- Build Point List ---
  const pts = [];

  // Arm 1 (Bottom Tip to Helix Start)
  for (let i = 0; i <= ARM_PTS; i++) {
    const t = i / ARM_PTS;
    pts.push(new THREE.Vector3().lerpVectors(arm1Tip, helix1Start, t));
  }

  // Bottom Coil
  const helix1Seg = Math.max(Math.round(actualTurns1 * SEG_PER_COIL), 32);
  for (let i = 1; i <= helix1Seg; i++) {
    const t = i / helix1Seg;
    const theta = alpha1 + t * actualTurns1 * 2 * Math.PI * hand1;
    pts.push(new THREE.Vector3(
      R * Math.cos(theta),
      y0 + t * (y1 - y0),
      R * Math.sin(theta)
    ));
  }
  pts[pts.length - 1].copy(P1); // Ensure exact connection

  // Bridge (Straight Out)
  const bridgeSteps = Math.max(Math.round(bridgeLength), 2);
  for (let i = 1; i <= bridgeSteps; i++) {
    const t = i / bridgeSteps;
    pts.push(new THREE.Vector3().lerpVectors(P1, P_bridge_1, t));
  }

  // Bridge (U-Turn)
  const uSteps = 16;
  for (let i = 1; i <= uSteps; i++) {
    const t = i / uSteps;
    const theta = -Math.PI / 2 + t * Math.PI; // sweeps from -90 to 90
    pts.push(new THREE.Vector3(
      Cb.x + bridgeDir.x * Rb * Math.cos(theta),
      Rb * Math.sin(theta),
      R
    ));
  }

  // Bridge (Straight Back)
  for (let i = 1; i <= bridgeSteps; i++) {
    const t = i / bridgeSteps;
    pts.push(new THREE.Vector3().lerpVectors(P_bridge_2, P2, t));
  }

  // Top Coil
  const helix2Seg = Math.max(Math.round(actualTurns2 * SEG_PER_COIL), 32);
  for (let i = 1; i <= helix2Seg; i++) {
    const t = i / helix2Seg;
    const theta = alpha_center + t * actualTurns2 * 2 * Math.PI * hand2;
    pts.push(new THREE.Vector3(
      R * Math.cos(theta),
      y2 + t * (y3 - y2),
      R * Math.sin(theta)
    ));
  }
  pts[pts.length - 1].copy(helix2End);

  // Arm 2 (Helix End to Top Tip)
  for (let i = 1; i <= ARM_PTS; i++) {
    const t = i / ARM_PTS;
    pts.push(new THREE.Vector3().lerpVectors(helix2End, arm2Tip, t));
  }

  // --- Geometry & Caps ---
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const tubeSeg = Math.max(pts.length * 2, 128);
  const geometry = new THREE.TubeGeometry(curve, tubeSeg, r, RADIAL_SEG, false);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material.clone()));

  // Flat Circular Caps
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


