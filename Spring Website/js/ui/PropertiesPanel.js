/**
 * PropertiesPanel.js — Renders the calculated spring properties sidebar.
 */

export class PropertiesPanel {
  /**
   * @param {HTMLElement} el — the right sidebar element
   */
  constructor(el) {
    this._el = el;
  }

  /**
   * Render a new set of properties.
   * @param {object} result — { props: Array<{name,value,unit,state}>, warnings: string[] }
   */
  update(result) {
    if (!result) { this._el.innerHTML = ''; return; }

    const { props = [], warnings = [] } = result;

    let html = '';

    for (const p of props) {
      const cls = p.state === 'warn' ? ' warn'
                : p.state === 'err'  ? ' error'
                : '';
      html += `
        <div class="prop-card">
          <div class="prop-name">${p.name}</div>
          <div class="prop-row">
            <span class="prop-value${cls}">${p.value}</span>
            ${p.unit ? `<span class="prop-unit">${p.unit}</span>` : ''}
          </div>
        </div>`;
    }

    if (warnings.length > 0) {
      html += '<div class="separator"></div>';
      for (const w of warnings) {
        html += `<div class="warning-card">${w}</div>`;
      }
    }

    this._el.innerHTML = html;
  }
}









