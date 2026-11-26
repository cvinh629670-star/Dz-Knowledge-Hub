import { confirmAction, empty, esc, icon, pageHeader, uid } from './ui.js';

const route = 'skilltree';
const nodeWidth = 166;
const nodeHeight = 76;
const maxCoordinate = 100000;
const states = {
  locked: ['Chưa mở khóa', 'lock'],
  available: ['Có thể học', 'sparkles'],
  learning: ['Đang học', 'play'],
  completed: ['Đã hoàn thành', 'check'],
  mastered: ['Đã thành thạo', 'trophy'],
};

function lessonEvidence(id, state) {
  const exercises = state.exercises.filter((item) => item.lessonId === id);
  const cards = state.flashcards.filter((item) => item.lessonId === id);
  const practice = exercises.map((item) => state.progress.practice[item.id]);
  const reviews = cards.map((item) => state.progress.reviews[item.id]);
  const recall = [...exercises, ...cards].map((item) => state.progress.recall[item.id]);
  const attempts = recall.reduce((sum, item) => sum + (item?.attempts ?? 0), 0);
  const recalled = recall.reduce((sum, item) => sum + (item?.correct ?? 0), 0);

  return {
    completed: Boolean(state.progress.lessons[id]?.completedAt),
    started: Boolean(state.progress.lessons[id]?.startedAt)
      || practice.some((item) => item?.attempts > 0)
      || reviews.some((item) => item?.lastAt)
      || attempts > 0,
    practiced: practice.some((item) => item?.correct > 0),
    recalled: attempts >= 2 && recalled / attempts >= 0.8,
    retained: reviews.some((item) => item?.repetitions >= 2 && item.correct >= 2),
  };
}

export function skillStates(state) {
  const skills = new Map(state.skills.map((skill) => [skill.id, skill]));
  const status = new Map();
  const evidence = new Map();
  const visiting = new Set();

  function resolve(id) {
    if (status.has(id)) return status.get(id);
    const skill = skills.get(id);
    if (!skill || visiting.has(id)) return 'locked';
    visiting.add(id);
    let value = 'locked';
    if (skill.prerequisiteIds.every((parent) => ['completed', 'mastered'].includes(resolve(parent)))) {
      const lessons = skill.lessonIds.map((lessonId) => {
        if (!evidence.has(lessonId)) evidence.set(lessonId, lessonEvidence(lessonId, state));
        return evidence.get(lessonId);
      });
      const completed = lessons.length > 0 && lessons.every((item) => item.completed);
      value = 'available';
      if (completed) {
        value = lessons.every((item) => item.practiced && item.recalled && item.retained)
          ? 'mastered' : 'completed';
      } else if (lessons.some((item) => item.started || item.completed)) {
        value = 'learning';
      }
    }
    visiting.delete(id);
    status.set(id, value);
    return value;
  }

  skills.forEach((skill) => resolve(skill.id));
  return status;
}

export function deriveSkillStatus(skill, state) {
  return skillStates(state).get(skill.id) ?? 'locked';
}

function statusBadge(value) {
  const [label, symbol] = states[value];
  return `<span class="skill-status" data-status="${value}">${icon(symbol)}${label}</span>`;
}

function coordinate(value) {
  return Math.max(-maxCoordinate, Math.min(maxCoordinate, Number(value) || 0));
}

function edgePath(from, to) {
  const fx = coordinate(from.x);
  const fy = coordinate(from.y);
  const tx = coordinate(to.x);
  const ty = coordinate(to.y);
  if (Math.abs(tx - fx) >= nodeWidth) {
    const forward = tx > fx;
    const a = fx + (forward ? nodeWidth : 0);
    const b = tx + (forward ? 0 : nodeWidth);
    const middle = (a + b) / 2;
    return `M ${a},${fy + nodeHeight / 2} C ${middle},${fy + nodeHeight / 2} ${middle},${ty + nodeHeight / 2} ${b},${ty + nodeHeight / 2}`;
  }
  const down = ty > fy;
  const a = fy + (down ? nodeHeight : 0);
  const b = ty + (down ? 0 : nodeHeight);
  const middle = (a + b) / 2;
  return `M ${fx + nodeWidth / 2},${a} C ${fx + nodeWidth / 2},${middle} ${tx + nodeWidth / 2},${middle} ${tx + nodeWidth / 2},${b}`;
}

function renderMap(nodes, status, selectedId) {
  const lookup = new Map(nodes.map((node) => [node.id, node]));
  let left = 0;
  let top = 0;
  let right = 0;
  let bottom = 0;
  for (const node of nodes) {
    const x = coordinate(node.x);
    const y = coordinate(node.y);
    left = Math.min(left, x - 48);
    top = Math.min(top, y - 42);
    right = Math.max(right, x + nodeWidth + 48);
    bottom = Math.max(bottom, y + nodeHeight + 42);
  }
  const width = right - left;
  const height = bottom - top;
  const edges = nodes.flatMap((node) => node.prerequisiteIds.map((parentId) => {
    const parent = lookup.get(parentId);
    if (!parent) return '';
    const complete = ['completed', 'mastered'].includes(status.get(parent.id));
    return `<path d="${edgePath(parent, node)}" class="${complete ? 'edge-active' : ''}"></path>`;
  })).join('');

  return `<div class="skill-viewport" tabindex="0" role="region" aria-label="Sơ đồ cây kỹ năng. Dùng phím mũi tên để di chuyển, dấu cộng và trừ để thu phóng." aria-describedby="skill-map-help">
    <div class="skill-world" style="width:${width}px;height:${height}px" data-width="${width}" data-height="${height}">
      <svg class="skill-edges" viewBox="${left} ${top} ${width} ${height}" aria-hidden="true">${edges}</svg>
      ${nodes.map((node) => {
        const value = status.get(node.id);
        return `<button class="skill-node" type="button" data-node="${esc(node.id)}" data-status="${value}"
          style="left:${coordinate(node.x) - left}px;top:${coordinate(node.y) - top}px"
          aria-pressed="${node.id === selectedId}" title="${esc(node.title)}">
          <span class="skill-node-emblem">${icon(value === 'available' ? 'code' : states[value][1], 18)}</span>
          <span class="skill-node-copy"><strong>${esc(node.title)}</strong>${statusBadge(value)}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function detail(skill, state, status) {
  const value = status.get(skill.id);
  const prerequisites = state.skills.filter((node) => skill.prerequisiteIds.includes(node.id));
  const lessons = state.lessons.filter((lesson) => skill.lessonIds.includes(lesson.id));
  const canOpen = value !== 'locked';

  return `<header class="skill-detail-head">
      <div class="skill-detail-icon">${icon(states[value][1])}</div>
      <div>${statusBadge(value)}<h2>${esc(skill.title)}</h2></div>
    </header>
    ${skill.sample ? '<span class="tag skill-sample">Dữ liệu mẫu</span>' : ''}
    ${skill.description ? `<p class="muted">${esc(skill.description)}</p>` : ''}
    <section class="skill-detail-section">
      <h3>Kỹ năng tiên quyết</h3>
      ${prerequisites.length ? `<ul class="skill-detail-list">${prerequisites.map((item) => `<li>
        <button class="skill-dependency" type="button" data-prerequisite="${esc(item.id)}">
          ${esc(item.title)}${statusBadge(status.get(item.id))}
        </button></li>`).join('')}</ul>` : '<p class="muted">Có thể học ngay từ đầu.</p>'}
    </section>
    <section class="skill-detail-section">
      <h3>Bài học liên kết</h3>
      ${lessons.length ? `<ul class="skill-detail-list">${lessons.map((lesson) => `<li>
        <button class="skill-lesson" type="button" data-skill-lesson="${esc(lesson.id)}" ${canOpen ? '' : 'disabled'}>
          ${icon(state.progress.lessons[lesson.id]?.completedAt ? 'check' : 'book')}<span>${esc(lesson.title)}</span>
        </button></li>`).join('')}</ul>` : '<p class="muted">Thêm bài học để theo dõi tiến độ của kỹ năng này.</p>'}
    </section>
    <details class="skill-mastery"><summary>Điều kiện thành thạo</summary>
      <p class="muted">Ở mỗi bài học, hoàn thành bài, giải đúng ít nhất một bài tập, đạt 80% qua ít nhất hai lượt Active Recall và nhớ một flashcard trong hai lần ôn liên tiếp.</p>
    </details>
    <div class="skill-detail-actions">
      <button type="button" class="btn btn-secondary" data-skill-edit>${icon('edit')} Chỉnh sửa</button>
      <button type="button" class="btn btn-secondary" data-skill-delete>${icon('trash')} Xóa kỹ năng</button>
    </div>`;
}

function attachMap(viewport, container) {
  const world = viewport.querySelector('.skill-world');
  const width = Number(world.dataset.width);
  const height = Number(world.dataset.height);
  const zoomLabel = container.querySelector('[data-skill-scale]');
  let zoom = 1;
  let x = 0;
  let y = 0;
  let drag = null;

  function paint() {
    world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitScale() {
    const padding = 16;
    return Math.max(0.0001, Math.min(1, (viewport.clientWidth - padding) / width, (viewport.clientHeight - padding) / height));
  }

  function fit(initial = false) {
    zoom = Math.max(initial ? 0.85 : 0, fitScale());
    x = Math.max((viewport.clientWidth - width * zoom) / 2, 0);
    y = Math.max((viewport.clientHeight - height * zoom) / 2, 0);
    paint();
  }

  function scale(multiplier, cx = viewport.clientWidth / 2, cy = viewport.clientHeight / 2) {
    const next = Math.min(2, Math.max(Math.min(0.08, fitScale()), zoom * multiplier));
    const ratio = next / zoom;
    x = cx - (cx - x) * ratio;
    y = cy - (cy - y) * ratio;
    zoom = next;
    paint();
  }

  container.querySelector('[data-skill-zoom-in]').addEventListener('click', () => scale(1.2));
  container.querySelector('[data-skill-zoom-out]').addEventListener('click', () => scale(1 / 1.2));
  container.querySelector('[data-skill-fit]').addEventListener('click', () => fit());
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button') || drag) return;
    drag = { id: event.pointerId, x: event.clientX - x, y: event.clientY - y };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-panning');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    x = event.clientX - drag.x;
    y = event.clientY - drag.y;
    paint();
  });
  viewport.addEventListener('lostpointercapture', () => {
    drag = null;
    viewport.classList.remove('is-panning');
  });
  viewport.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    scale(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - bounds.left, event.clientY - bounds.top);
  }, { passive: false });
  viewport.addEventListener('keydown', (event) => {
    if (event.target !== viewport) return;
    const directions = { ArrowLeft: [-42, 0], ArrowRight: [42, 0], ArrowUp: [0, -42], ArrowDown: [0, 42] };
    const direction = directions[event.key];
    if (direction) {
      x += direction[0];
      y += direction[1];
      paint();
    } else if (event.key === '+' || event.key === '=') scale(1.2);
    else if (event.key === '-') scale(1 / 1.2);
    else if (event.key === 'Home' || event.key === '0') fit();
    else return;
    event.preventDefault();
  });

  fit(true);

  function reveal(node) {
    if (node.offsetLeft * zoom + x < 0 || (node.offsetLeft + nodeWidth) * zoom + x > viewport.clientWidth
      || node.offsetTop * zoom + y < 0 || (node.offsetTop + nodeHeight) * zoom + y > viewport.clientHeight) {
      x = viewport.clientWidth / 2 - (node.offsetLeft + nodeWidth / 2) * zoom;
      y = viewport.clientHeight / 2 - (node.offsetTop + nodeHeight / 2) * zoom;
      paint();
    }
  }

  viewport.addEventListener('focusin', (event) => {
    const node = event.target.closest('[data-node]');
    if (node) reveal(node);
  });

  return {
    focus(id, keyboard = true) {
      const node = [...viewport.querySelectorAll('[data-node]')].find((item) => item.dataset.node === id);
      if (!node) return;
      reveal(node);
      if (keyboard) node.focus({ preventScroll: true });
    },
  };
}

function choices(items, chosen, field) {
  return items.map(([id, label]) => `<label class="skill-check">
    <input type="checkbox" name="${field}" value="${esc(id)}" ${chosen.includes(id) ? 'checked' : ''}>
    <span>${esc(label)}</span>
  </label>`).join('');
}

function firstFreeSlot(nodes) {
  const rowSize = 15;
  for (let index = 0; index < rowSize * rowSize; index++) {
    const x = 48 + index % rowSize * 210;
    const y = 64 + Math.floor(index / rowSize) * 115;
    const free = nodes.every((node) => Math.abs(node.x - x) > nodeWidth
      || Math.abs(node.y - y) > nodeHeight);
    if (free) return { x, y };
  }
  return { x: 48, y: 64 };
}

function validateNode(draft, node, newTree, editing) {
  const nodes = new Map(draft.skills.map((item) => [item.id, item]));
  if (editing && !nodes.has(node.id)) return 'Kỹ năng này đã bị xóa.';
  if (newTree && draft.skills.some((item) => item.branch === node.branch)) {
    return 'Tên cây kỹ năng này đã tồn tại.';
  }
  if (node.lessonIds.some((id) => !draft.lessons.some((lesson) => lesson.id === id))) {
    return 'Một bài học đã thay đổi. Mở lại biểu mẫu để chọn lại.';
  }
  for (const id of node.prerequisiteIds) {
    if (!nodes.has(id)) return 'Một kỹ năng tiên quyết đã bị xóa. Mở lại biểu mẫu để chọn lại.';
    const seen = new Set();
    const pending = [id];
    while (pending.length) {
      const next = pending.pop();
      if (next === node.id) return 'Quan hệ tiên quyết tạo thành một vòng lặp.';
      if (seen.has(next)) continue;
      seen.add(next);
      pending.push(...(nodes.get(next)?.prerequisiteIds ?? []));
    }
  }
  return '';
}

function openEditor(ctx, branch, skill, newTree = false) {
  const inBranch = ctx.state.skills.filter((node) => node.branch === branch && node.id !== skill?.id);
  const prerequisites = ctx.state.skills.filter((node) => node.id !== skill?.id);
  const { x, y } = skill ?? firstFreeSlot(newTree ? [] : inBranch);
  const title = skill ? 'Chỉnh sửa kỹ năng' : newTree ? 'Tạo cây kỹ năng' : 'Thêm kỹ năng';
  const dialog = document.createElement('dialog');
  dialog.className = 'skill-editor panel';
  dialog.setAttribute('aria-labelledby', 'skill-editor-title');
  dialog.innerHTML = `<form class="stack">
    <header class="skill-editor-head">
      <h2 id="skill-editor-title">${title}</h2>
      <button type="button" class="btn btn-secondary" data-skill-cancel aria-label="Đóng">${icon('close')}</button>
    </header>
    ${newTree ? '<label class="field"><span>Tên cây kỹ năng</span><input name="branch" maxlength="80" required autofocus></label>' : ''}
    <label class="field"><span>Tên kỹ năng</span><input name="title" maxlength="80" value="${esc(skill?.title ?? '')}" ${newTree ? '' : 'autofocus'} required></label>
    <label class="field"><span>Mô tả</span><textarea name="description" maxlength="600" rows="3">${esc(skill?.description ?? '')}</textarea></label>
    <fieldset>
      <legend>Bài học liên kết</legend>
      <div class="skill-checks">${ctx.state.lessons.length ? choices(ctx.state.lessons.map((lesson) => [lesson.id, lesson.title]), skill?.lessonIds ?? [], 'lessons') : '<p class="muted">Thư viện chưa có bài học.</p>'}</div>
    </fieldset>
    ${prerequisites.length ? `<fieldset>
      <legend>Kỹ năng tiên quyết</legend>
      <div class="skill-checks">${choices(prerequisites.map((item) => [
        item.id, item.branch === branch ? item.title : `${item.branch} · ${item.title}`,
      ]), skill?.prerequisiteIds ?? [], 'prerequisites')}</div>
    </fieldset>` : ''}
    <details class="skill-mastery"><summary>Vị trí trên sơ đồ</summary>
      <div class="form-grid skill-coordinates">
        <label class="field"><span>Ngang (x)</span><input name="x" type="number" min="-${maxCoordinate}" max="${maxCoordinate}" step="any" value="${coordinate(x)}" required></label>
        <label class="field"><span>Dọc (y)</span><input name="y" type="number" min="-${maxCoordinate}" max="${maxCoordinate}" step="any" value="${coordinate(y)}" required></label>
      </div>
    </details>
    <p class="skill-form-error" role="alert" hidden></p>
    <div class="skill-detail-actions">
      <button type="submit" class="btn btn-primary">${skill ? 'Lưu thay đổi' : 'Tạo kỹ năng'}</button>
      <button type="button" class="btn btn-secondary" data-skill-cancel>Hủy</button>
    </div>
  </form>`;
  const form = dialog.querySelector('form');
  const error = dialog.querySelector('[role="alert"]');
  const submit = dialog.querySelector('[type="submit"]');
  dialog.querySelectorAll('[data-skill-cancel]').forEach((button) => button.addEventListener('click', () => {
    if (!submit.disabled) dialog.close();
  }));
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('cancel', (event) => {
    if (submit.disabled) event.preventDefault();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const next = {
      id: skill?.id ?? uid(),
      title: String(data.get('title')).trim(),
      branch: newTree ? String(data.get('branch')).trim() : branch,
      description: String(data.get('description')).trim(),
      lessonIds: data.getAll('lessons'),
      prerequisiteIds: data.getAll('prerequisites'),
      x: Number(data.get('x')),
      y: Number(data.get('y')),
      sample: skill?.sample ?? false,
    };
    error.hidden = true;
    submit.disabled = true;
    try {
      if (!next.title || !next.branch) throw new Error('Nhập tên kỹ năng và tên cây kỹ năng.');
      await ctx.update((draft) => {
        const message = validateNode(draft, next, newTree, Boolean(skill));
        if (message) throw new Error(message);
        const index = draft.skills.findIndex((item) => item.id === next.id);
        if (index < 0) draft.skills.push(next);
        else draft.skills[index] = next;
      });
      dialog.close();
      ctx.toast(skill ? 'Đã cập nhật kỹ năng.' : 'Đã thêm kỹ năng.');
      ctx.go(route, { branch: next.branch, id: next.id });
    } catch (cause) {
      error.textContent = cause.message || 'Không thể lưu kỹ năng.';
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  document.body.append(dialog);
  dialog.showModal();
}

export function renderSkillTree(ctx) {
  const branches = [...new Set(ctx.state.skills.map((skill) => skill.branch))];
  const initialSkill = ctx.state.skills.find((skill) => skill.id === ctx.params.get('id'));
  const requested = ctx.params.get('branch');
  const branch = branches.includes(requested) ? requested : initialSkill?.branch ?? branches[0];
  const nodes = ctx.state.skills.filter((skill) => skill.branch === branch);
  const status = skillStates(ctx.state);
  let selected = initialSkill?.branch === branch ? initialSkill : nodes[0];
  const complete = nodes.filter((skill) => ['completed', 'mastered'].includes(status.get(skill.id))).length;

  ctx.root.innerHTML = `${pageHeader({
    title: 'Cây kỹ năng',
    description: 'Mở khóa kỹ năng từ các bài học và theo dõi mức độ thành thạo.',
    icon: 'tree',
    actions: `<button type="button" class="btn btn-primary" data-new-tree>${icon('plus')} Tạo cây kỹ năng</button>`,
  })}
  ${nodes.length ? `<div class="skill-layout">
    <section class="panel skill-map-panel">
      <div class="skill-map-header">
        <label class="field"><span>Cây kỹ năng</span><select data-skill-branch>
          ${branches.map((item) => `<option value="${esc(item)}" ${item === branch ? 'selected' : ''}>${esc(item)}</option>`).join('')}
        </select></label>
        <div class="skill-branch-progress">
          <label for="skill-completion">Tiến độ nhánh <strong>${complete}/${nodes.length}</strong></label>
          <progress id="skill-completion" max="${nodes.length}" value="${complete}"></progress>
        </div>
        <button type="button" class="btn btn-secondary" data-add-skill>${icon('plus')} Thêm kỹ năng</button>
      </div>
      ${renderMap(nodes, status, selected.id)}
      <div class="skill-map-footer">
        <p class="muted" id="skill-map-help">Kéo nền hoặc dùng phím mũi tên để di chuyển.</p>
        <div class="skill-zoom" aria-label="Điều khiển sơ đồ">
          <button type="button" class="btn btn-secondary" data-skill-zoom-out aria-label="Thu nhỏ">−</button>
          <output data-skill-scale aria-label="Mức thu phóng">100%</output>
          <button type="button" class="btn btn-secondary" data-skill-zoom-in aria-label="Phóng to">+</button>
          <button type="button" class="btn btn-secondary" data-skill-fit>Vừa khung</button>
        </div>
      </div>
      <div class="skill-legend" aria-label="Các trạng thái kỹ năng">
        ${Object.keys(states).map(statusBadge).join('')}
      </div>
    </section>
    <aside class="panel skill-detail" data-skill-detail>${detail(selected, ctx.state, status)}</aside>
  </div>` : empty({ title: 'Chưa có cây kỹ năng', description: 'Tạo cây đầu tiên và liên kết kỹ năng với bài học.', icon: 'tree' })}`;

  ctx.root.querySelector('[data-new-tree]').addEventListener('click', () => openEditor(ctx, '', undefined, true));
  if (ctx.params.get('new') === '1') openEditor(ctx, '', undefined, true);
  if (!nodes.length) return;
  const panel = ctx.root.querySelector('.skill-map-panel');
  const map = attachMap(panel.querySelector('.skill-viewport'), panel);
  const detailPanel = ctx.root.querySelector('[data-skill-detail]');
  const select = (node, reveal = false) => {
    selected = node;
    panel.querySelectorAll('[data-node]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.node === node.id));
    });
    detailPanel.innerHTML = detail(node, ctx.state, status);
    if (reveal) map.focus(node.id);
  };
  map.focus(selected.id, false);

  panel.querySelector('[data-skill-branch]').addEventListener('change', (event) => {
    ctx.go(route, { branch: event.target.value });
  });
  panel.querySelector('[data-add-skill]').addEventListener('click', () => openEditor(ctx, branch));
  panel.querySelector('.skill-viewport').addEventListener('click', (event) => {
    const node = nodes.find((item) => item.id === event.target.closest('[data-node]')?.dataset.node);
    if (node) select(node);
  });
  detailPanel.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.prerequisite) {
      const node = ctx.state.skills.find((item) => item.id === button.dataset.prerequisite);
      if (node?.branch === branch) select(node, true);
      else if (node) ctx.go(route, { branch: node.branch, id: node.id });
    } else if (button.dataset.skillLesson) {
      ctx.go('pareto', { id: button.dataset.skillLesson });
    } else if (button.hasAttribute('data-skill-edit')) {
      openEditor(ctx, branch, selected);
    } else if (button.hasAttribute('data-skill-delete')) {
      const node = selected;
      const confirmed = await confirmAction(`Xóa kỹ năng “${node.title}” và các liên kết tiên quyết trỏ đến kỹ năng này?`, {
        title: 'Xóa kỹ năng', label: 'Xóa kỹ năng',
      });
      if (!confirmed) return;
      try {
        await ctx.update((draft) => {
          draft.skills = draft.skills.filter((item) => item.id !== node.id);
          draft.skills.forEach((item) => {
            item.prerequisiteIds = item.prerequisiteIds.filter((id) => id !== node.id);
          });
        });
        ctx.toast('Đã xóa kỹ năng.');
        ctx.go(route, { branch });
      } catch (error) {
        ctx.toast(error.message || 'Không thể xóa kỹ năng.', 'error');
      }
    }
  });
}
