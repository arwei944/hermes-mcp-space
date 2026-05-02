/**
 * Hermes Agent 管理面板 - 表单组件
 */

function _formGroup(label, inputHtml, hint) {
    return `<div class="form-group"><label class="form-label">${label}</label>${inputHtml}${hint ? `<div class="form-hint">${hint}</div>` : ''}</div>`;
}

function _formInput(name, placeholder, value, type = 'text') {
    return `<input class="form-input" type="${type}" name="${name}" placeholder="${placeholder || ''}" value="${value || ''}">`;
}

function _formTextarea(name, placeholder, value, rows = 5) {
    return `<textarea class="form-textarea" name="${name}" placeholder="${placeholder || ''}" rows="${rows}">${value || ''}</textarea>`;
}

function _formSelect(name, options, value) {
    const opts = options
        .map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            const selected = optValue === value ? 'selected' : '';
            return `<option value="${optValue}" ${selected}>${optLabel}</option>`;
        })
        .join('');
    return `<select class="form-select" name="${name}">${opts}</select>`;
}

function _formSwitch(name, label, checked) {
    return `<label class="form-switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="switch-label">${label}</span></label>`;
}
