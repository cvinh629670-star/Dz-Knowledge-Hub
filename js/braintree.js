import {href} from './router.js';
import {confirmAction, esc, icon, pageHeader, uid} from './ui.js';

const rootId = '';
const brainArt = `<svg class="mind-brain-art" viewBox="0 0 160 140" aria-hidden="true" focusable="false">
  <path class="mind-brain-shape" d="M80 23C72 9 51 8 43 24 28 22 17 33 18 47 6 54 7 71 15 80 9 94 21 107 34 107 37 123 55 129 68 120 73 130 78 129 80 122 82 129 87 130 92 120 105 129 123 123 126 107 139 107 151 94 145 80 153 71 154 54 142 47 143 33 132 22 117 24 109 8 88 9 80 23Z"/>
  <path class="mind-brain-folds" d="M80 23v18m0 60v21M43 24c-3 7 0 12 7 17M18 47c9-2 17 2 19 10M15 80c5-5 12-7 18-4M34 107c8-1 12-6 11-12m23 25c-5-5-5-10-2-15M117 24c3 7 0 12-7 17m32 6c-9-2-17 2-19 10m22 23c-5-5-12-7-18-4m-1 31c-8-1-12-6-11-12m-23 25c5-5 5-10 2-15"/>
</svg>`;


function brainNodes(state) {
  if (state.brainNodes) return state.brainNodes;
  const branches = [...new Set(state.skills.map(skill => skill.branch))];
  return [{id:'programming', parentId:rootId, title:'Lập trình', branch:''}].concat(
    branches.map((branch, index) => ({
      id:'branch-' + index, parentId:/^python$/i.test(branch) ? 'programming' : rootId,
      title:branch, branch,
    })),
  );
}

function isBelow(nodes, id, ancestor) {
  const parents = new Map(nodes.map(node => [node.id, node.parentId]));
  while (id) {
    if (id === ancestor) return true;
    id = parents.get(id);
  }
  return false;
}

function editor(ctx, nodes, {node, parentId = rootId}, save) {
  const dialog = document.createElement('dialog');
  dialog.className = 'practice-editor panel';
  dialog.setAttribute('aria-labelledby', 'brain-editor-title');
  const available = nodes.filter(item => !node || !isBelow(nodes, item.id, node.id));
  const branches = [...new Set(ctx.state.skills.map(skill => skill.branch))];
  dialog.innerHTML = `<form class="stack">
    <h2 id="brain-editor-title">${node ? 'Chỉnh nút' : 'Thêm nút con'}</h2>
    <label class="field">Tên nút<input name="title" maxlength="80" required autofocus value="${esc(node?.title)}" placeholder="Ví dụ: Python"></label>
    <label class="field">Nút cha<select name="parentId">
      <option value="">Bộ não</option>
      ${available.map(item => `<option value="${esc(item.id)}" ${item.id === (node?.parentId ?? parentId) ? 'selected' : ''}>${esc(item.title)}</option>`).join('')}
    </select></label>
    <label class="field">Liên kết cây kỹ năng<select name="branch"><option value="">Chưa liên kết</option>
      ${branches.map(branch => `<option value="${esc(branch)}" ${branch === node?.branch ? 'selected' : ''}>${esc(branch)}</option>`).join('')}
    </select></label>
    ${node ? `<div class="inline-actions">
      <button type="button" class="btn btn-secondary" data-child>Thêm nút con</button>
      ${branches.includes(node.branch) ? `<a class="btn btn-secondary" data-open-branch href="${esc(href('skilltree',{branch:node.branch}))}">Mở cây kỹ năng</a>` : ''}
    </div>` : ''}
    <div class="dialog-actions"><button class="btn btn-secondary" data-cancel type="button">Hủy</button><button class="btn btn-primary" type="submit">Lưu nút</button></div>
  </form>`;
  const form = dialog.querySelector('form');
  const opener = document.activeElement;
  dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  dialog.querySelector('[data-child]')?.addEventListener('click', () => {
    dialog.close();
    editor(ctx, nodes, {parentId:node.id}, save);
  });
  dialog.querySelector('[data-open-branch]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); if (opener.isConnected) opener.focus(); }, {once:true});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(form);
    const title = values.get('title').trim();
    if (!title) { ctx.toast('Nhập tên nút.', 'error'); return; }
    const submit = form.querySelector('[type=submit]');
    submit.disabled = true;
    const next = {id:node?.id ?? uid(), title, parentId:values.get('parentId'), branch:values.get('branch')};
    const ok = await save(items => {
      const existing = items.find(item => item.id === next.id);
      if (node && !existing) throw new Error('Nút đã bị xóa.');
      if (next.parentId && !items.some(item => item.id === next.parentId)) throw new Error('Nút cha đã bị xóa.');
      if (isBelow(items, next.parentId, next.id)) throw new Error('Nút cha không hợp lệ.');
      if (existing) Object.assign(existing, next);
      else {
        if (items.length >= 250) throw new Error('Cây hỗ trợ tối đa 250 nút.');
        items.push(next);
      }
    }, next.id);
    if (ok) dialog.close();
    submit.disabled = false;
  });
  document.body.append(dialog);
  dialog.showModal();
}

export function renderBrainTree(ctx) {
  const {root, state} = ctx;
  const nodes = brainNodes(state);
  const lookup = new Map(nodes.map(node => [node.id,node]));
  const groups = new Map();
  for (const node of nodes) {
    if (!groups.has(node.parentId)) groups.set(node.parentId, []);
    groups.get(node.parentId).push(node);
  }
  const points = new Map();
  const tiers = new Map();
  let slot = 0;
  function layout(id, depth) {
    tiers.set(id, (depth - 1) % 3);
    const children = groups.get(id) ?? [];
    const columns = children.map(child => layout(child.id, depth + 1));
    const x = columns.length ? (columns[0] + columns.at(-1)) / 2 : 95 + slot++ * 162;
    const saved = id ? lookup.get(id) : state.brainOrigin;
    points.set(id, {x:saved?.x ?? x, y:saved?.y ?? 90 + depth * 160});
    return x;
  }
  layout(rootId, 0);
  if (!state.brainOrigin && nodes.every(node => node.x == null)) {
    const offset = Math.max(0, Math.round((root.clientWidth - 64 - (slot - 1) * 162) / 2 - 95));
    for (const point of points.values()) point.x += offset;
  }
  root.innerHTML = pageHeader({title:'Cây bộ não', icon:'brain',
    description:'Sắp xếp lĩnh vực, chủ đề và kỹ năng theo cách bạn học.',
    actions:`<button class="btn btn-primary" data-action="add" type="button">${icon('plus',17)} Thêm nhánh</button>`}) + `
    <section class="panel panel-pad mind-map" aria-label="Sơ đồ bộ não">
      <div class="mind-toolbar">
        <p class="mind-help muted">Kéo nút đến vị trí bất kỳ. Nhấp đúp để chỉnh sửa. Kéo nút ra ngoài khung đến khi chuyển đỏ rồi thả để xóa.</p>
        <div class="inline-actions" aria-label="Thu phóng sơ đồ">
          <button class="icon-btn" type="button" data-zoom-out aria-label="Thu nhỏ">−</button>
          <output data-zoom-level aria-label="Mức thu phóng"></output>
          <button class="icon-btn" type="button" data-zoom-in aria-label="Phóng to">+</button>
          <button class="btn btn-secondary btn-small" type="button" data-zoom-fit>Vừa khung</button>
        </div>
      </div>
      <div class="mind-scroll" tabindex="0" aria-label="Bản đồ cây, cuộn để xem các nhánh">
        <div class="mind-world"><div class="mind-diagram">
          <svg class="mind-wires" aria-hidden="true">${nodes.map(() => '<path/>').join('')}</svg>
          <div class="mind-root mind-node" data-node="">${brainArt}<span>Bộ não</span></div>
          ${nodes.map(node => `<div class="mind-node" data-node="${esc(node.id)}" data-tier="${tiers.get(node.id)}" id="mind-${esc(node.id)}" tabindex="0"
            title="${esc(node.title)}" aria-description="Nhấn Enter hoặc nhấp đúp để chỉnh sửa."><span>${esc(node.title)}</span></div>`).join('')}
        </div></div>
      </div>
    </section>`;
  const map = root.querySelector('.mind-scroll');
  const world = root.querySelector('.mind-world');
  const diagram = root.querySelector('.mind-diagram');
  const paths = [...root.querySelectorAll('.mind-wires path')];
  const elements = new Map([...root.querySelectorAll('[data-node]')].map(node => [node.dataset.node, node]));
  const zoomLevel = root.querySelector('[data-zoom-level]');
  let zoom = 1;
  let width;
  let height;

  function paint() {
    for (const [id, point] of points) {
      const element = elements.get(id);
      element.style.left = point.x + 'px';
      element.style.top = point.y + 'px';
    }
    nodes.forEach((node, index) => {
      const a = points.get(node.parentId);
      const b = points.get(node.id);
      const bend = Math.min(52, Math.hypot(b.x - a.x, b.y - a.y) * .2);
      const controlX = (a.x + b.x) / 2 - Math.sign(b.y - a.y) * bend;
      const controlY = (a.y + b.y) / 2 + Math.sign(b.x - a.x) * bend;
      paths[index].setAttribute('d', `M ${a.x} ${a.y} Q ${controlX} ${controlY} ${b.x} ${b.y}`);
    });
  }

  function resize(scale) {
    width = Math.max(1200, map.clientWidth / scale, ...[...points.values()].map(point => point.x + 250));
    height = Math.max(900, map.clientHeight / scale, ...[...points.values()].map(point => point.y + 250));
    Object.assign(diagram.style, {width:width + 'px',height:height + 'px',transform:`scale(${scale})`});
    Object.assign(world.style, {width:width * scale + 'px',height:height * scale + 'px'});
  }

  function setZoom(scale, center) {
    const anchor = center ?? {
      x:(map.scrollLeft + map.clientWidth / 2) / zoom, y:(map.scrollTop + map.clientHeight / 2) / zoom,
    };
    zoom = Math.min(2, Math.max(.002, scale));
    resize(zoom);
    map.scrollTo(anchor.x * zoom - map.clientWidth / 2, anchor.y * zoom - map.clientHeight / 2);
    zoomLevel.value = Math.round(zoom * 1000) / 10 + '%';
  }

  function fit() {
    const all = [...points.values()];
    const [xs, ys] = [all.map(point => point.x), all.map(point => point.y)];
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    setZoom(Math.min(1, map.clientWidth / (right - left + 180), map.clientHeight / (bottom - top + 180)),
      {x:(left + right) / 2, y:(top + bottom) / 2});
  }

  map.addEventListener("restore-mind-view", event => {
    setZoom(event.detail.zoom);
    map.scrollTo(event.detail.scrollLeft, event.detail.scrollTop);
  });
  paint();
  fit();
  root.querySelector('[data-zoom-in]').onclick = () => setZoom(zoom * 1.25);
  root.querySelector('[data-zoom-out]').onclick = () => setZoom(zoom / 1.25);
  root.querySelector('[data-zoom-fit]').onclick = fit;

  async function save(change, focusId) {
    try {
      await ctx.update(data => {
        const items = brainNodes(data);
        change(items,data);
        data.brainNodes = items;
      });
      const {scrollLeft, scrollTop} = map;
      ctx.refresh();
      const nextMap = document.querySelector(".mind-scroll");
      nextMap?.dispatchEvent(new CustomEvent("restore-mind-view", {detail:{zoom,scrollLeft,scrollTop}}));
      if (focusId) document.getElementById('mind-' + focusId)?.focus({preventScroll:true});
      return true;
    } catch (error) {
      ctx.toast(error.message || 'Không thể lưu sơ đồ.', 'error');
      return false;
    }
  }

  root.querySelector('[data-action="add"]').onclick = () => editor(ctx, nodes, {}, save);
  const edit = id => {
    const node = nodes.find(item => item.id === id);
    if (node) editor(ctx, nodes, {node}, save);
  };

  const remove = id => save(items => {
    const index = items.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Nút đã bị xóa.');
    const [removed] = items.splice(index, 1);
    const children = items.filter(item => item.parentId === id);
    for (const child of children) {
      child.parentId = removed.parentId;
      items.splice(items.indexOf(child), 1);
    }
    items.splice(index, 0, ...children);
  });

  map.addEventListener('dblclick', event => edit(event.target.closest('[data-node]')?.dataset.node));
  map.addEventListener('keydown', async event => {
    const id = event.target.closest('[data-node]')?.dataset.node;
    if (!id || !['Enter','Delete'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter') edit(id);
    else if (await confirmAction('Xóa nút này? Các nút con sẽ được chuyển lên một cấp.', {label:'Xóa nút'})) await remove(id);
  });

  let drag;
  const finish = () => {
    drag.ghost?.remove();
    drag.node.classList.remove('is-removing');
    const previous = drag;
    drag = null;
    return previous;
  };

  function track(event) {
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    const frame = map.getBoundingClientRect();
    drag.outside = Boolean(drag.id) && (event.clientX < frame.left || event.clientX > frame.right ||
      event.clientY < frame.top || event.clientY > frame.bottom);
    if (drag.outside && !drag.ghost) {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'mind-node mind-ghost is-removing';
      drag.ghost.dataset.tier = drag.node.dataset.tier;
      drag.ghost.textContent = drag.node.textContent;
      drag.ghost.setAttribute('aria-hidden','true');
      document.body.append(drag.ghost);
    }
    drag.node.classList.toggle('is-removing', drag.outside);
    if (drag.ghost) {
      drag.ghost.hidden = !drag.outside;
      drag.ghost.style.left = event.clientX + 'px';
      drag.ghost.style.top = event.clientY + 'px';
    }
    if (!drag.outside) {
      points.set(drag.id, {
        x:Math.round(Math.min(100000, width - 70, Math.max(70, drag.original.x + (dx + map.scrollLeft - drag.scrollX) / zoom))),
        y:Math.round(Math.min(100000, height - 70, Math.max(70, drag.original.y + (dy + map.scrollTop - drag.scrollY) / zoom))),
      });
      paint();
    }
  }

  map.addEventListener('pointerdown', event => {
    const node = event.target.closest('[data-node]');
    if (!node || !event.isPrimary || event.button !== 0 || drag) return;
    const id = node.dataset.node;
    drag = {node,id,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,
      original:points.get(id),scrollX:map.scrollLeft,scrollY:map.scrollTop};
    node.setPointerCapture(event.pointerId);
  });
  map.addEventListener('pointermove', event => {
    if (drag?.pointer === event.pointerId) track(event);
  });
  map.addEventListener('pointerup', async event => {
    if (drag?.pointer !== event.pointerId) return;
    track(event);
    const {id,moved,outside,original} = finish();
    if (!moved) return;
    const point = points.get(id);
    const ok = outside ? await remove(id) : await save((items,data) => {
      // Freeze the auto layout when a node is first positioned by hand.
      for (const item of items) {
        if (item.id === id) Object.assign(item,point);
        else if (item.x == null && points.has(item.id)) Object.assign(item,points.get(item.id));
      }
      if (!id) data.brainOrigin = point;
      else data.brainOrigin ??= points.get(rootId);
    },id);
    if (!ok) { points.set(id,original); paint(); }
  });
  for (const type of ['pointercancel','lostpointercapture']) {
    map.addEventListener(type, event => {
      if (drag?.pointer !== event.pointerId) return;
      const {id,original} = finish();
      points.set(id,original);
      paint();
    });
  }
}
