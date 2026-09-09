/**
 * main.js — Application entry point.
 */

import * as THREE from 'three';

import { SceneManager }     from './scene/SceneManager.js?v=17';
import { ControlPanel }     from './ui/ControlPanel.js?v=17';
import { PropertiesPanel }  from './ui/PropertiesPanel.js?v=17';

import { buildCompressionSpring } from './springs/CompressionSpring.js?v=17';
import { buildExtensionSpring }   from './springs/ExtensionSpring.js?v=17';
import { buildTorsionSpring }     from './springs/TorsionSpring.js?v=17';
import { buildDoubleTorsionSpring } from './springs/DoubleTorsionSpring.js?v=17';

import {
  calcCompressionProps,
  calcExtensionProps,
  calcTorsionProps,
  calcDoubleTorsionProps,
} from './springs/SpringMath.js?v=17';

// ---------------------------------------------------------------------------
// GLB file map — which file to load for each spring type + variant
// ---------------------------------------------------------------------------
const CAD_FILES = {
  compression: 'Part2OPP-2943Final.glb',
  // Extension has two variants — default is Part3; user can switch via dropdown
  extension: 'Part3Assembly.glb',
  torsion: null,   // no CAD file provided; show message instead
  doubleTorsion: null,
};

// ---------------------------------------------------------------------------
// Visual appearance per engineering material
// Each entry defines the Three.js PBR parameters that best represent
// that material's real-world look under metallic studio lighting.
// ---------------------------------------------------------------------------
const MATERIAL_VISUALS = {
  //                       color      metal rough  reflect clearcoat  cc-rough
  steel:          { color: 0x8a9ba8, metal: 0.95, rough: 0.25, ref: 0.9, cc: 0.05, ccr: 0.4 },
  stainless:      { color: 0xd0d8dc, metal: 0.98, rough: 0.10, ref: 1.0, cc: 0.15, ccr: 0.1 },
  chromeSilicon:  { color: 0xa09880, metal: 0.95, rough: 0.22, ref: 0.9, cc: 0.05, ccr: 0.3 },
  phosphorBronze: { color: 0xc8a040, metal: 0.90, rough: 0.30, ref: 0.8, cc: 0.00, ccr: 0.5 },
  titanium:       { color: 0x6a7e8c, metal: 0.85, rough: 0.35, ref: 0.8, cc: 0.00, ccr: 0.5 },
};

/**
 * Create a Three.js material whose colour and surface finish match the
 * chosen engineering material (steel, stainless, bronze, etc.).
 *
 * @param {string} materialKey — key from SpringMath.MATERIALS / ControlPanel defaults
 * @returns {THREE.MeshPhysicalMaterial}
 */
function makeSpringMaterial(materialKey) {
  const v = MATERIAL_VISUALS[materialKey] ?? MATERIAL_VISUALS.steel;
  return new THREE.MeshPhysicalMaterial({
    color:            v.color,
    metalness:        v.metal,
    roughness:        v.rough,
    reflectivity:     v.ref,
    clearcoat:        v.cc,
    clearcoatRoughness: v.ccr,
  });
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------
let _currentType = null;
let _currentView = 'parametric';   // 'parametric' | 'cad'
let _extGlbFile  = 'Part3Assembly.glb';

// ---------------------------------------------------------------------------
// Build + show the parametric spring
// ---------------------------------------------------------------------------
function showParametric(scene, propsPanel, type, params) {
  const typeChanged = type !== _currentType;
  _currentType = type;

  const mat = makeSpringMaterial(params.material);
  let group, calcResult;

  if (type === 'compression') {
    group      = buildCompressionSpring(params, mat);
    calcResult = calcCompressionProps(params);
    if (typeChanged) scene.frameTo(params.freeLength, params.coilDiameter + params.wireDiameter);

  } else if (type === 'extension') {
    group      = buildExtensionSpring(params, mat);
    calcResult = calcExtensionProps(params);
    if (typeChanged) {
      const bodyLen = params.numActiveCoils * params.wireDiameter;
      scene.frameTo(bodyLen + params.coilDiameter * 2, params.coilDiameter + params.wireDiameter);
    }

  } else if (type === 'torsion') {
    group      = buildTorsionSpring(params, mat);
    calcResult = calcTorsionProps(params);
    if (typeChanged) {
      const bodyLen = params.numCoils * params.wireDiameter;
      scene.frameTo(bodyLen + Math.max(params.arm1Length, params.arm2Length) * 1.5,
                    params.coilDiameter + params.wireDiameter);
    }
  } else if (type === 'doubleTorsion') {
    group      = buildDoubleTorsionSpring(params, mat);
    calcResult = calcDoubleTorsionProps(params);
    if (typeChanged) {
      const bodyLen = params.numCoils * params.wireDiameter * 2 + params.bridgeGap;
      scene.frameTo(bodyLen + Math.max(params.arm1Length, params.arm2Length, params.bridgeLength) * 1.5,
                    params.coilDiameter + params.wireDiameter);
    }
  }

  if (group)      scene.setSpring(group);
  if (calcResult) propsPanel.update(calcResult);
}

// ---------------------------------------------------------------------------
// Load + show the CAD model
// ---------------------------------------------------------------------------
async function showCad(scene, type, params) {
  const loadingEl = document.getElementById('cad-loading');

  // Torsion has no GLB
  if (type === 'torsion') {
    scene.setMode('cad');
    scene.clearCadModel();
    document.getElementById('props-content').innerHTML =
      '<div class="warning-card" style="margin-top:8px">No CAD reference file available for the Torsion spring.<br>Switch back to ⬡ Parametric view to use the live 3D preview.</div>';
    return;
  }

  const url = type === 'extension' ? _extGlbFile : CAD_FILES[type];
  if (!url) return;

  // Build the material that matches the currently selected engineering material
  const mat = makeSpringMaterial(params?.material ?? 'steel');

  loadingEl.style.display = 'flex';
  scene.setMode('cad');

  try {
    await scene.loadCadModel(url, mat);
  } catch (err) {
    console.error('GLB load failed:', err);
    document.getElementById('props-content').innerHTML =
      `<div class="warning-card">Failed to load CAD file: ${url}<br>${err.message ?? err}</div>`;
  } finally {
    loadingEl.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Central update — called when any slider / tab / toggle changes
// ---------------------------------------------------------------------------
function update(scene, propsPanel, type, params) {
  if (_currentView === 'parametric') {
    showParametric(scene, propsPanel, type, params);
  } else {
    showCad(scene, type, params);
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------
function init() {
  const canvas     = document.getElementById('spring-canvas');
  const scene      = new SceneManager(canvas);

  const propsPanel = new PropertiesPanel(document.getElementById('props-content'));
  const panel      = new ControlPanel(
    document.getElementById('control-panel'),
    (type, params) => update(scene, propsPanel, type, params),
  );

  // ---- Tab buttons -------------------------------------------------------
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const type = tab.dataset.type;

      // Show/hide the extension variant dropdown (only in CAD mode for extension)
      updateVariantVisibility(type);

      panel.setSpringType(type);   // triggers update internally
    });
  });

  // ---- View toggle -------------------------------------------------------
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      _currentView = btn.dataset.view;

      // Show/hide controls sidebar — still useful in both modes
      // Switch scene mode
      scene.setMode(_currentView);

      if (_currentView === 'parametric') {
        // Rebuild parametric geometry
        showParametric(scene, propsPanel, panel._type, panel.getParams());
      } else {
        showCad(scene, panel._type, panel.getParams());
      }

      updateVariantVisibility(panel._type);
    });
  });

  // ---- Extension variant dropdown ----------------------------------------
  document.getElementById('ext-glb-select').addEventListener('change', e => {
    _extGlbFile = e.target.value;
    if (_currentView === 'cad' && panel._type === 'extension') {
      showCad(scene, 'extension', panel.getParams());
    }
  });

  // ---- Reset camera ------------------------------------------------------
  document.getElementById('reset-camera').addEventListener('click', () => {
    scene.resetCamera();
  });

  // ---- Light / dark mode toggle ------------------------------------------
  const themeBtn = document.getElementById('theme-toggle');
  const DARK_BG  = '#0d1117';
  const LIGHT_BG = '#e8ecf0';

  themeBtn.addEventListener('click', () => {
    const isLight = document.documentElement.dataset.theme === 'light';
    if (isLight) {
      delete document.documentElement.dataset.theme;
      themeBtn.textContent = '🌙';
      scene.setSceneBg(DARK_BG);
    } else {
      document.documentElement.dataset.theme = 'light';
      themeBtn.textContent = '☀️';
      scene.setSceneBg(LIGHT_BG);
    }
  });

  // ---- First render ------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const initialType = urlParams.get('type') || 'compression';
  const initialTab = document.querySelector(`.tab[data-type="${initialType}"]`);
  
  if (initialTab) {
    initialTab.click();
  } else {
    panel.setSpringType('compression');
  }
}

/**
 * Show the extension-variant dropdown only when viewing the extension spring
 * in CAD mode.
 */
function updateVariantVisibility(type) {
  const variantEl = document.getElementById('cad-variant');
  variantEl.style.display =
    (type === 'extension' && _currentView === 'cad') ? 'flex' : 'none';
}

init();









