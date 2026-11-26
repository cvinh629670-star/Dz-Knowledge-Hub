import {initState, readState, updateState} from './database.js';
import {renderDashboard} from './dashboard.js';
import {dueCount, levelInfo} from './gamification.js';
import {renderLibrary} from './library.js';
import {renderPareto} from './pareto.js';
import {renderPractice} from './practice.js';
import {renderRecall} from './recall.js';
import {currentRoute, href, routes} from './router.js';
import {renderSettings} from './settings.js';
import {renderSkillTree} from './skilltree.js';
import {renderSrs} from './srs.js';
import {empty, esc, icon} from './ui.js';

const pages = {dashboard:renderDashboard,library:renderLibrary,pareto:renderPareto,practice:renderPractice,
  recall:renderRecall,srs:renderSrs,skilltree:renderSkillTree,settings:renderSettings};
const groups = {main:'HỌC TẬP',training:'LUYỆN TẬP',progress:'TIẾN ĐỘ',settings:'HỆ THỐNG'};
const main = document.querySelector('main');
const sidebar = document.querySelector('#sidebar');
const topbar = document.querySelector('#topbar');
const overlay = document.querySelector('#nav-overlay');
const desktop = matchMedia('(min-width: 981px)');
const channel = 'BroadcastChannel' in window ? new BroadcastChannel('dz-hub-sync') : null;
const THEME = 'dz-hub-theme';
let state;
let generation = 0;
let offlineReady = false;
let activeTheme = 'dark';

try { if (localStorage.getItem(THEME) === 'light') activeTheme = 'light'; } catch { /* Temporary browser session. */ }

function toast(message, type = 'success') {
  const item = document.createElement('div');
  item.className = 'toast ' + type;
  item.innerHTML = `${icon(type === 'success' ? 'check' : 'info',18)}<span>${esc(message)}</span>`;
  const region = document.querySelector('#toasts');
  while (region.children.length >= 2) region.firstElementChild.remove();
  region.append(item);
  setTimeout(() => item.remove(), 4200);
}

function setTheme(theme, persist = true) {
  activeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = activeTheme;
  document.querySelector('meta[name=theme-color]').content = activeTheme === 'dark' ? '#0f1020' : '#f6f5fb';
  if (persist) {
    try { localStorage.setItem(THEME, activeTheme); } catch { /* Theme applies to the current tab. */ }
  }
  paintTheme();
  const selector = document.querySelector('#theme-choice');
  if (selector) selector.value = activeTheme;
}

function paintTheme() {
  const button = document.querySelector('#theme-toggle');
  if (!button) return;
  const light = activeTheme === 'light';
  button.innerHTML = icon(light ? 'moon' : 'sun',20);
  button.setAttribute('aria-label', light ? 'Bật chế độ tối' : 'Bật chế độ sáng');
  button.title = button.getAttribute('aria-label');
}

function setNav(open, restoreFocus = false) {
  const expanded = !desktop.matches && open;
  sidebar.classList.toggle('is-open', expanded);
  sidebar.inert = !desktop.matches && !expanded;
  document.querySelector('.app-shell').inert = expanded;
  document.querySelector('.skip-link').inert = expanded;
  overlay.hidden = !expanded;
  document.body.classList.toggle('nav-is-open', expanded);
  const toggle = document.querySelector('#menu-toggle');
  toggle?.setAttribute('aria-expanded', String(expanded));
  toggle?.setAttribute('aria-label', expanded ? 'Đóng điều hướng' : 'Mở điều hướng');
  if (expanded) sidebar.querySelector('[aria-current="page"]')?.focus();
  if (restoreFocus) document.querySelector('#menu-toggle')?.focus();
}

function go(route, query = {}) {
  const destination = href(route, query);
  if (location.hash === destination) renderPage();
  else location.hash = destination;
}

function avatar(size = '') {
  return `<span class="avatar ${size}"><img alt="" width="38" height="38" src="./assets/characters/traveler.svg"></span>`;
}

function paintState() {
  if (!state) return;
  const level = levelInfo(state.activity);
  const name = esc(state.profile.name);
  const due = dueCount(state);
  const profile = document.querySelector('#side-profile');
  if (profile) {
    profile.innerHTML = `${avatar()}<span><strong>${name}</strong><small>Level ${level.level} · ${level.total} EXP</small></span>${icon('chevron-right',16)}`;
  }
  const topProfile = document.querySelector('#top-profile');
  if (topProfile) {
    topProfile.innerHTML = `${avatar('avatar-small')}<span>${name}</span>${icon('chevron-down',13)}`;
  }
  const count = sidebar.querySelector('[data-due-count]');
  if (count) { count.hidden = !due; count.textContent = due; }
  paintNetwork();
}

function paintNetwork() {
  const label = document.querySelector('#network-status');
  if (!label) return;
  const status = navigator.onLine ? offlineReady ? 'Sẵn sàng học offline' : 'Lưu trên thiết bị' : 'Đang ngoại tuyến';
  label.querySelector('span').textContent = status;
  document.querySelector('#footer-network').textContent = status;
  label.dataset.offline = String(!navigator.onLine);
}

function paintShell() {
  sidebar.innerHTML = `<a class="brand" href="#dashboard">
    <span class="brand-mark">${icon('logo',26)}</span><span><strong>Dz-Knowledge</strong><small>HUB</small></span>
  </a>
  <nav class="side-nav">${Object.entries(groups).map(([key,label]) => `<div class="nav-group"><p>${label}</p>
    ${routes.filter(route => route.group === key).map(route => `<a class="nav-link" href="#${route.id}" data-route="${route.id}">${icon(route.icon,19)}
      <span>${route.label}</span>${route.id === 'srs' ? '<span data-due-count class="nav-count" hidden></span>' : ''}</a>`).join('')}</div>`).join('')}</nav>
  <div class="nav-bottom"><a id="side-profile" class="side-profile" href="#settings" aria-label="Cài đặt hồ sơ"></a></div>`;
  topbar.innerHTML = `<div class="topbar-inner">
    <div class="topbar-location">
      <button id="menu-toggle" class="icon-btn menu-toggle" type="button" aria-label="Mở điều hướng" aria-controls="sidebar" aria-expanded="false">${icon('menu',23)}</button>
      <a class="topbar-brand" href="#dashboard">Dz Hub</a>${icon('chevron-right',15)}<span id="breadcrumb"></span>
    </div>
    <div class="topbar-actions">
      <span id="network-status" class="network-status"><i></i><span></span></span>
      <a class="icon-btn top-search" href="#library?focus=search" aria-label="Tìm kiếm tri thức" title="Tìm kiếm tri thức">${icon('search',20)}</a>
      <button class="icon-btn" id="theme-toggle" type="button"></button>
      <a class="top-profile" id="top-profile" href="#settings" aria-label="Hồ sơ cá nhân"></a>
    </div></div>`;
  document.querySelector('#menu-toggle').addEventListener('click', () => setNav(!sidebar.classList.contains('is-open')));
  document.querySelector('#theme-toggle').addEventListener('click', () => setTheme(activeTheme === 'light' ? 'dark' : 'light'));
  sidebar.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link && sidebar.classList.contains('is-open')) setNav(false, link.hash === location.hash);
  });
  paintTheme();
  paintState();
  setNav(false);
}

function errorPage(error, retry) {
  main.setAttribute('aria-busy', 'false');
  main.innerHTML = empty({title:'Không thể mở kho tri thức',description:error.message || 'Vui lòng thử lại.',icon:'info',
    action:'<button class="btn btn-primary" type="button" id="retry-app">Thử lại</button>'});
  main.querySelector('#retry-app').addEventListener('click', retry, {once:true});
}

function adopt(data, broadcast = true) {
  state = data;
  paintState();
  if (broadcast) channel?.postMessage('updated');
}

async function renderPage({focus = false} = {}) {
  if (!state) return;
  const renderId = ++generation;
  const {route, params} = currentRoute();
  const next = document.createElement('div');
  next.className = 'route-content';
  main.replaceChildren(next);
  main.setAttribute('aria-busy', 'true');
  sidebar.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === route.id) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('#breadcrumb').textContent = route.label;
  document.title = route.label + ' · Dz-Knowledge Hub';
  const ctx = {
    root: next, params, state, go, toast, theme:() => activeTheme, setTheme, adopt,
    refresh:() => { if (next.isConnected) renderPage(); },
    async update(mutator) {
      const updated = await updateState(mutator);
      ctx.state = updated;
      adopt(updated);
      return updated;
    }
  };
  try {
    await pages[route.id](ctx);
    if (renderId !== generation) return;
    main.setAttribute('aria-busy', 'false');
    if (focus && !next.contains(document.activeElement) && !document.querySelector('dialog[open]')) {
      const target = next.querySelector('h1') ?? main;
      target.tabIndex = -1;
      target.focus({preventScroll:true});
    }
  } catch (error) {
    if (renderId === generation) errorPage(error, renderPage);
    console.error(error);
  }
}

async function start() {
  main.setAttribute('aria-busy','true');
  main.innerHTML = '<div class="startup" role="status"><span class="spinner"></span> Đang mở kho tri thức…</div>';
  try {
    state = await initState();
    paintShell();
    await renderPage();
  } catch (error) { errorPage(error, start); }
}

overlay.addEventListener('click', () => setNav(false, true));
desktop.addEventListener('change', () => setNav(false));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setNav(false, true);
});
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  setNav(false);
  renderPage({focus:true});
});
window.addEventListener('online', paintNetwork);
window.addEventListener('offline', paintNetwork);
window.addEventListener('storage', event => { if (event.key === THEME) setTheme(event.newValue, false); });
if (channel) channel.onmessage = async () => {
  if (!state) return;
  try {
    const latest = await readState();
    if (latest) adopt(latest, false);
    if (currentRoute().route.id === 'dashboard') renderPage();
  } catch (error) { console.error(error); }
};

setTheme(activeTheme, false);
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    offlineReady = true;
    paintNetwork();
  }).catch(error => console.warn('Không bật được chế độ ngoại tuyến.', error));
}
start();
