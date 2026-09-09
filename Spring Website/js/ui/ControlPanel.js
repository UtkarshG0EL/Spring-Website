/**
 * ControlPanel.js — Dynamic slider / dropdown UI for spring parameters.
 *
 * Usage:
 *   const panel = new ControlPanel(element, onChangeCallback);
 *   panel.setSpringType('compression');
 */

import { MATERIALS } from '../springs/SpringMath.js?v=17';

// Default parameters for each spring type
export const DEFAULTS = {
  compression: {
    freeLength:     80,
    wireDiameter:   3,
    coilDiameter:   30,
    numActiveCoils: 8,
    endType:        'closed',
    handedness:     'right',
    material:       'steel',
  },
  extension: {
    wireDiameter:   2.5,
    coilDiameter:   25,
    numActiveCoils: 10,
    handedness:     'right',
    material:       'steel',
  },
  torsion: {
    wireDiameter:  2.5,
    coilDiameter:  20,
    numCoils:      6,
    arm1Length:    30,
    arm1Angle:     0,
    arm2Length:    30,
    arm2Angle:     90,
    handedness:    'right',
    material:      'steel',
  },
  doubleTorsion: {
    wireDiameter:  2.5,
    coilDiameter:  20,
    numCoils:      4,
    arm1Length:    30,
    arm1Angle:     0,
    arm2Length:    30,
    arm2Angle:     180,
    bridgeLength:  20,
    bridgeGap:     15,
    handedness:    'right',
    material:      'steel',
  }
};

// Schema: which sliders/dropdowns each spring type exposes
const SCHEMAS = {
  compression: [
    { type: 'slider', key: 'freeLength',     label: 'Free Length',        min: 20,  max: 300, step: 1,   unit: 'mm' },
    { type: 'slider', key: 'wireDiameter',   label: 'Wire Diameter',      min: 0.5, max: 15,  step: 0.1, unit: 'mm' },
    { type: 'slider', key: 'coilDiameter',   label: 'Coil Diameter (OD)', min: 5,   max: 150, step: 0.5, unit: 'mm' },
    { type: 'slider', key: 'numActiveCoils', label: 'Active Coils',       min: 2,   max: 40,  step: 0.5, unit: ''   },
    { type: 'dropdown', key: 'endType', label: 'End Type', options: [
        { value: 'open',   label: 'Open' },
        { value: 'closed', label: 'Closed (squared)' },
        { value: 'ground', label: 'Closed & Ground' },
    ]},
    { type: 'dropdown', key: 'handedness', label: 'Helix Direction', options: [
        { value: 'right', label: 'Right Hand (RH)' },
        { value: 'left',  label: 'Left Hand (LH)' },
    ]},
  ],
  extension: [
    { type: 'slider', key: 'wireDiameter',   label: 'Wire Diameter',      min: 0.5, max: 10, step: 0.1, unit: 'mm' },
    { type: 'slider', key: 'coilDiameter',   label: 'Coil Diameter (OD)', min: 5,   max: 100, step: 0.5, unit: 'mm' },
    { type: 'slider', key: 'numActiveCoils', label: 'Active Coils',       min: 2,   max: 60,  step: 0.5, unit: ''   },
    { type: 'dropdown', key: 'handedness', label: 'Helix Direction', options: [
        { value: 'right', label: 'Right Hand (RH)' },
        { value: 'left',  label: 'Left Hand (LH)' },
    ]},
  ],
  torsion: [
    { type: 'slider', key: 'wireDiameter', label: 'Wire Diameter',      min: 0.5, max: 10,  step: 0.1, unit: 'mm' },
    { type: 'slider', key: 'coilDiameter', label: 'Coil Diameter (OD)', min: 5,   max: 100, step: 0.5, unit: 'mm' },
    { type: 'slider', key: 'numCoils',     label: 'Number of Coils',    min: 2,   max: 20,  step: 0.5, unit: ''   },
    { type: 'slider', key: 'arm1Length',   label: 'Arm 1 Length',       min: 5,   max: 120, step: 1,   unit: 'mm' },
    { type: 'slider', key: 'arm1Angle',    label: 'Arm 1 Angle',        min: 0,   max: 360, step: 5,   unit: '°'  },
    { type: 'slider', key: 'arm2Length',   label: 'Arm 2 Length',       min: 5,   max: 120, step: 1,   unit: 'mm' },
    { type: 'slider', key: 'arm2Angle',    label: 'Arm 2 Angle',        min: 0,   max: 360, step: 5,   unit: '°'  },
    { type: 'dropdown', key: 'handedness', label: 'Helix Direction', options: [
        { value: 'right', label: 'Right Hand (RH)' },
        { value: 'left',  label: 'Left Hand (LH)' },
    ]},
  ],
  doubleTorsion: [
    { type: 'slider', key: 'wireDiameter', label: 'Wire Diameter',      min: 0.5, max: 10,  step: 0.1, unit: 'mm' },
    { type: 'slider', key: 'coilDiameter', label: 'Coil Diameter (OD)', min: 5,   max: 100, step: 0.5, unit: 'mm' },
    { type: 'slider', key: 'numCoils',     label: 'Coils (per side)',   min: 1,   max: 20,  step: 0.5, unit: ''   },
    { type: 'slider', key: 'arm1Length',   label: 'Arm 1 Length',       min: 5,   max: 120, step: 1,   unit: 'mm' },
    { type: 'slider', key: 'arm1Angle',    label: 'Arm 1 Angle',        min: 0,   max: 360, step: 5,   unit: '°'  },
    { type: 'slider', key: 'arm2Length',   label: 'Arm 2 Length',       min: 5,   max: 120, step: 1,   unit: 'mm' },
    { type: 'slider', key: 'arm2Angle',    label: 'Arm 2 Angle',        min: 0,   max: 360, step: 5,   unit: '°'  },
    { type: 'slider', key: 'bridgeLength', label: 'Center Loop Length', min: 0,   max: 50,  step: 1,   unit: 'mm' },
    { type: 'slider', key: 'bridgeGap',    label: 'Coil Gap',           min: 2,   max: 50,  step: 1,   unit: 'mm' },
    { type: 'dropdown', key: 'handedness', label: 'Top Coil Direction', options: [
        { value: 'right', label: 'Right Hand (RH)' },
        { value: 'left',  label: 'Left Hand (LH)' },
    ]},
  ],
};

export class ControlPanel {
  /**
   * @param {HTMLElement}   el         — the sidebar element to render into
   * @param {function}      onChange   — called with (springType, params) when any control changes
   */
  constructor(el, onChange) {
    this._el       = el;
    this._onChange = onChange;
    this._type     = 'compression';
    // Live copies of each spring type's params
    this._params = {
      compression:   { ...DEFAULTS.compression },
      extension:     { ...DEFAULTS.extension   },
      torsion:       { ...DEFAULTS.torsion     },
      doubleTorsion: { ...DEFAULTS.doubleTorsion },
    };
    this._render();
  }

  // -----------------------------------------------------------------------
  // Public
  // -----------------------------------------------------------------------

  /** Switch which spring type's controls are visible. */
  setSpringType(type) {
    this._type = type;
    this._render();
    this._notify();
  }

  /** Current params for the active spring type (includes material). */
  getParams() {
    return { ...this._params[this._type] };
  }

  // -----------------------------------------------------------------------
  // Private — rendering
  // -----------------------------------------------------------------------

  _render() {
    this._el.innerHTML = '';

    // Material selector (shared across all types)
    this._el.appendChild(this._makeSection('Material'));
    const matSel = this._makeSelect(
      'material',
      Object.entries(MATERIALS).map(([value, { label }]) => ({ value, label })),
      this._params[this._type].material,
    );
    this._el.appendChild(matSel);
    matSel.querySelector('select').addEventListener('change', e => {
      this._params[this._type].material = e.target.value;
      this._notify();
    });

    this._el.appendChild(this._makeDivider());
    this._el.appendChild(this._makeSection('Parameters'));

    const schema = SCHEMAS[this._type] || [];
    for (const field of schema) {
      if (field.type === 'slider') {
        const sliderEl = this._makeSlider(field);
        this._el.appendChild(sliderEl);
      } else if (field.type === 'dropdown') {
        const dropEl = this._makeDropdown(field);
        this._el.appendChild(dropEl);
      }
    }
  }

  _makeSection(label) {
    const div = document.createElement('div');
    div.className = 'section-title';
    div.textContent = label;
    return div;
  }

  _makeDivider() {
    const hr = document.createElement('div');
    hr.className = 'separator';
    return hr;
  }

  _makeSlider({ key, label, min, max, step, unit }) {
    const value = this._params[this._type][key] ?? min;
    const displayVal = this._formatVal(value, unit);

    const wrapper = document.createElement('div');
    wrapper.className = 'slider-group';
    wrapper.innerHTML = `
      <div class="slider-header">
        <span class="slider-label">${label}</span>
        <span class="slider-value" data-key="${key}">${displayVal}</span>
      </div>
      <input type="range"
             min="${min}" max="${max}" step="${step}" value="${value}"
             class="spring-slider" data-key="${key}" data-unit="${unit}">
    `;

    wrapper.querySelector('input').addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      this._params[this._type][key] = v;
      wrapper.querySelector(`[data-key="${key}"]`).textContent = this._formatVal(v, unit);
      this._notify();
    });

    return wrapper;
  }

  _makeSelect(id, options, defaultVal) {
    const wrapper = document.createElement('div');
    wrapper.className = 'select-group';

    const opts = options
      .map(o => `<option value="${o.value}"${o.value === defaultVal ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    wrapper.innerHTML = `<select id="sel-${id}">${opts}</select>`;
    return wrapper;
  }

  _makeDropdown({ key, label, options }) {
    const value = this._params[this._type][key];
    const opts = options
      .map(o => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`)
      .join('');

    const wrapper = document.createElement('div');
    wrapper.className = 'dropdown-group';
    wrapper.innerHTML = `
      <label>${label}</label>
      <select data-key="${key}">${opts}</select>
    `;

    wrapper.querySelector('select').addEventListener('change', e => {
      this._params[this._type][key] = e.target.value;
      this._notify();
    });

    return wrapper;
  }

  _formatVal(v, unit) {
    const display = Number.isInteger(v) ? v : v.toFixed(unit === '°' ? 0 : 1);
    return unit ? `${display} ${unit}` : `${display}`;
  }

  _notify() {
    this._onChange(this._type, this.getParams());
  }
}









