const glyphs = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
  logo: '<path d="M12 10C9 7 5 7 3 8v10c3-1 6-1 9 2 3-3 6-3 9-2V8c-2-1-6-1-9 2zm0 0v10M17 2v5m-2.5-2.5h5"/>',
  book: '<path d="M12 6a9 9 0 0 0-9-2v14a9 9 0 0 1 9 2 9 9 0 0 1 9-2V4a9 9 0 0 0-9 2zm0 0v14"/>',
  library: '<path d="M4 5h4v15H4zm6-1h4v16h-4zm6 2 3-1 4 14-3 1z"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-14-4 16"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1.1 6-5.5-2.9-5.5 2.9 1.1-6-4.4-4.3 6.1-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  edit: '<path d="m14 5 5 5M4 20l1-5L16 4a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L9 19z"/>',
  trash: '<path d="M3 6h18m-12 0V3h6v3M5 6l1 14h12l1-14M10 10v6m4-6v6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'arrow-right': '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  'arrow-left': '<path d="M20 12H5m6-6-6 6 6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  paperclip: '<path d="m9 12 5.5-5.5a2.2 2.2 0 0 1 3.1 3.1l-7 7a4 4 0 0 1-5.7-5.7l8-8a5 5 0 0 1 7.1 7.1l-8.3 8.3"/>',
  link: '<path d="m10 14 4-4m-6 5-1 1a3 3 0 1 1-4-4l5-5a3 3 0 0 1 4 0m0 10a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-1 1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filter: '<path d="M4 6h16M7 12h10m-7 6h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  sparkles: '<path d="M12 3l2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1L12 3zm7-1v4m-2-2h4M4 17v4m-2-2h4"/>',
  brain: '<path d="M12 5a3 3 0 0 0-5-2 4 4 0 0 0-3 5 4 4 0 0 0 0 7 4 4 0 0 0 4 5 3 3 0 0 0 4-2 3 3 0 0 0 4 2 4 4 0 0 0 4-5 4 4 0 0 0 0-7 4 4 0 0 0-3-5 3 3 0 0 0-5 2zm0 0v13M8 8l-4 1m5 6-3 1m10-8 4 1m-5 6 3 1"/>',
  flask: '<path d="M9 3h6m-5 0v6l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/>',
  cards: '<rect x="8" y="6" width="12" height="15" rx="2"/><path d="m6 17-2-1a2 2 0 0 1-1-2L6 4a2 2 0 0 1 2-1l8 2M11 11h6m-6 4h4"/>',
  folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 12h6m-6 4h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 4 1-2h4l1 2 2 1 2-.1 2 3-1 2v3l1 2-2 3-2-.1-2 1-1 2h-4l-1-2-2-1-2 .1-2-3 1-2v-3l-1-2 2-3 2 .1z"/>',
  tree: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4m-6 4v-4h12v4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
  moon: '<path d="M20 15a8.5 8.5 0 0 1-11-11 8.6 8.6 0 1 0 11 11z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 2 4 3 8 3s8-1 8-3V5M4 12c0 2 4 3 8 3s8-1 8-3"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  flame: '<path d="M12 22c-5 0-8-3-8-7 0-3 2-5 3-6 0 3 2 4 2 4 3-3 2-7 2-11 5 4 9 8 9 13 0 4-3 7-8 7z"/><path d="M9 19c0-2 2-3 3-5 1 2 3 3 3 5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18M7 16l4-5 4 2 6-7"/>',
  swords: '<path d="m4 3 5 1 12 12-4 4L5 8 4 3zm13 0-4 5m6-5 1 5-5 5m-3 1-5 5m-3-3 5 5m7-5 5 5"/>',
  play: '<path d="m8 5 12 7-12 7z"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  wifi: '<path d="M2 9a16 16 0 0 1 20 0M5 13a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01"/>',
  trophy: '<path d="M7 4h10v7a5 5 0 0 1-10 0zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4m-5 4v4m-4 0h8"/>'
};

export function icon(name, size = 20) {
  const body = Object.hasOwn(glyphs, name) ? glyphs[name] : glyphs.file;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
}

export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

export const uid = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
export const number = value => new Intl.NumberFormat('vi-VN').format(value);
export const formatDate = value => new Intl.DateTimeFormat('vi-VN', {dateStyle:'medium'}).format(new Date(value));

export function pageHeader({title, description, icon: symbol = 'sparkles', actions = ''}) {
  return `<header class="page-header">
    <span class="page-icon">${icon(symbol, 24)}</span>
    <div><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </header>`;
}

export function empty({title, description, icon: symbol = 'folder', action = ''}) {
  return `<div class="empty"><span class="empty-icon">${icon(symbol, 23)}</span><h3>${esc(title)}</h3>
    ${description ? `<p>${esc(description)}</p>` : ''}${action}</div>`;
}

export function confirmAction(message, {title = 'Xác nhận thao tác', label = 'Xác nhận'} = {}) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    const focus = document.activeElement;
    dialog.className = 'confirm-dialog';
    dialog.innerHTML = `<form method="dialog" class="stack">
      <h2 id="confirm-title">${esc(title)}</h2><p>${esc(message)}</p>
      <div class="dialog-actions"><button class="btn btn-secondary" value="cancel" autofocus>Hủy</button>
      <button class="btn btn-danger" value="confirmed">${esc(label)}</button></div>
    </form>`;
    dialog.setAttribute('aria-labelledby', 'confirm-title');
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirmed');
      dialog.remove();
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus();
    }, {once:true});
    dialog.showModal();
  });
}
