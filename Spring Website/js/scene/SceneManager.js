/**
 * SceneManager.js — Three.js scene, camera, lighting, render loop,
 *                   and GLB/GLTF CAD model loading.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';

export class SceneManager {
  constructor(canvas) {
    // ---- Renderer -------------------------------------------------------
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace  = THREE.SRGBColorSpace;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.localClippingEnabled = true;   // needed for per-material clipping planes

    // ---- Scene ----------------------------------------------------------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 800, 2000);

    // ---- Camera ---------------------------------------------------------
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 4000);
    this.camera.position.set(120, 90, 200);

    // ---- Controls -------------------------------------------------------
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance   = 5;
    this.controls.maxDistance   = 1500;

    // ---- Lights ---------------------------------------------------------
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(120, 200, 150);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far  = 1000;
    [-200, 200].forEach(v => {
      key.shadow.camera.left = key.shadow.camera.bottom = v < 0 ? v : -200;
      key.shadow.camera.right = key.shadow.camera.top  = v > 0 ? v :  200;
    });
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x99bbff, 0.7);
    fill.position.set(-120, 60, -100);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, -80, 120);
    this.scene.add(rim);

    // ---- Grid -----------------------------------------------------------
    const grid = new THREE.GridHelper(800, 40, 0x1e2235, 0x171d2e);
    grid.position.y = -120;
    this.scene.add(grid);

    // ---- Spring / CAD groups -------------------------------------------
    this._springGroup = new THREE.Group();
    this._cadGroup    = new THREE.Group();
    this.scene.add(this._springGroup);
    this.scene.add(this._cadGroup);

    // ---- GLTF loader ---------------------------------------------------
    this._loader    = new GLTFLoader();
    this._cadCache  = {};          // url → THREE.Group (cached after first load)
    this._currentMode = 'parametric';

    // ---- Resize handling -----------------------------------------------
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(canvas.parentElement);
    this._onResize();

    // ---- Animation loop ------------------------------------------------
    this._animate();
  }

  // -----------------------------------------------------------------------
  // Theme
  // -----------------------------------------------------------------------

  /** Update the Three.js scene background to match the active CSS theme. */
  setSceneBg(hex) {
    this.scene.background = new THREE.Color(hex);
    this.renderer.setClearColor(new THREE.Color(hex), 1);
  }

  // -----------------------------------------------------------------------
  // Parametric spring
  // -----------------------------------------------------------------------

  setSpring(group) {
    this._springGroup.traverse(child => {
      if (child.isMesh) { child.geometry?.dispose(); child.material?.dispose(); }
    });
    this._springGroup.clear();
    if (group) group.children.slice().forEach(c => this._springGroup.add(c));
  }

  // -----------------------------------------------------------------------
  // View mode
  // -----------------------------------------------------------------------

  /**
   * @param {'parametric'|'cad'} mode
   */
  setMode(mode) {
    this._currentMode = mode;
    this._springGroup.visible = (mode === 'parametric');
    this._cadGroup.visible    = (mode === 'cad');
  }

  /** Clear the CAD group without loading a new model. */
  clearCadModel() {
    this._cadGroup.clear();
  }

  // -----------------------------------------------------------------------
  // CAD model loader
  // -----------------------------------------------------------------------

  /**
   * Load a GLB file by URL and display it in CAD mode.
   * The cache is keyed by URL only; material is re-applied on every call
   * so changing material in parametric mode is reflected in CAD mode too.
   *
   * @param {string}                 url      — relative URL, e.g. 'Part2OPP-2943Final.glb'
   * @param {THREE.MeshPhysicalMaterial} mat  — material to apply to all meshes
   * @param {function}               onProgress
   * @returns {Promise<void>}
   */
  async loadCadModel(url, mat, onProgress) {
    this._cadGroup.clear();

    if (this._cadCache[url]) {
      const clone = this._cadCache[url].clone();
      this._normalizeCadModel(clone);   // ← scale & centre to TARGET_SIZE
      this._applyCADMaterial(clone, mat);
      this._cadGroup.add(clone);
      this._fitCadToView();
      return;
    }

    return new Promise((resolve, reject) => {
      this._loader.load(
        url,
        (gltf) => {
          const root = gltf.scene;
          this._cadCache[url] = root;           // cache raw (original units)
          const clone = root.clone();
          this._normalizeCadModel(clone);        // ← scale & centre to TARGET_SIZE
          this._applyCADMaterial(clone, mat);
          this._cadGroup.add(clone);
          this._fitCadToView();
          resolve();
        },
        onProgress,
        reject,
      );
    });
  }

  /**
   * Re-apply a material to all meshes in a group/scene.
   * Uses the provided material (cloned per mesh) so CAD view matches
   * whatever material the user has selected.
   *
   * @param {THREE.Object3D}             root
   * @param {THREE.MeshPhysicalMaterial} mat
   */
  _applyCADMaterial(root, mat) {
    root.traverse(child => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.material      = mat.clone();
      }
    });
  }

  /**
   * Scale and centre the CAD model so it always appears at a sensible size
   * regardless of the original file units (metres, mm, inches, etc.).
   *
   * Target: longest dimension = TARGET_SIZE scene units (~100 mm).
   * The model is also translated so its bounding-box centre sits at the origin.
   */
  _normalizeCadModel(root) {
    const TARGET_SIZE = 100;   // scene units (≈ 100 mm in our convention)

    // Measure BEFORE scaling
    const box     = new THREE.Box3().setFromObject(root);
    const size    = box.getSize(new THREE.Vector3());
    const center  = box.getCenter(new THREE.Vector3());
    const maxDim  = Math.max(size.x, size.y, size.z);

    if (maxDim === 0) return;

    const scale = TARGET_SIZE / maxDim;

    // Apply uniform scale, then shift so bounding-box centre is at origin
    root.scale.setScalar(scale);
    root.position.set(
      -center.x * scale,
      -center.y * scale,
      -center.z * scale,
    );
  }

  /**
   * Auto-fit the camera to whatever is currently in the CAD group.
   * Reads the actual (post-normalisation) bounding box.
   */
  _fitCadToView() {
    const box    = new THREE.Box3().setFromObject(this._cadGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const span   = Math.max(size.x, size.y, size.z);

    // Guard against empty / degenerate model
    if (!isFinite(span) || span === 0) return;

    this.controls.target.copy(center);
    this.camera.position.set(
      center.x + span * 0.8,
      center.y + span * 0.5,
      center.z + span * 1.4,
    );
    this.controls.update();
  }

  // -----------------------------------------------------------------------
  // Camera helpers
  // -----------------------------------------------------------------------

  frameTo(springHeight = 80, springDiam = 30) {
    const span = Math.max(springHeight, springDiam) * 2.5;
    this.camera.position.set(span * 0.55, span * 0.35, span);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resetCamera() {
    this.camera.position.set(120, 90, 200);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  _onResize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const pr = this.renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * pr) || canvas.height !== Math.floor(h * pr)) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}









