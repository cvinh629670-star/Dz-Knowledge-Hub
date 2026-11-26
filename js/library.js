import { confirmAction, empty, esc, icon, pageHeader, uid } from './ui.js';
import { sectionDefinitions } from './pareto.js';

const maxFiles = 5;
const maxFileBytes = 3 * 1024 * 1024;
const maxSectionLength = 12000;
const subjectIcons = [
  ['folder', 'Thư mục'], ['code', 'Mã lệnh'], ['brain', 'Bộ não'], ['sparkles', 'Ngôi sao'],
  ['target', 'Mục tiêu'], ['book', 'Sách'], ['flask', 'Bình thí nghiệm'], ['layers', 'Các lớp'],
  ['chart', 'Biểu đồ'], ['clock', 'Đồng hồ'], ['user', 'Hồ sơ'],
];

function normalized(value = '') {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
}

function readFile(file) {
  const mimePattern = /^[a-z\d!#$&.+\-^_]+\/[a-z\d!#$&.+\-^_]+$/i;
  const type = mimePattern.test(file.type) ? file.type : 'application/octet-stream';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: uid(),
      name: file.name.slice(0, 180),
      type,
      data: reader.result,
    });
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file.slice(0, file.size, type));
  });
}

function button(label, action, glyph, variant = 'btn-secondary', attributes = '') {
  return `<button type="button" class="btn ${variant}" data-action="${action}" ${attributes}>${icon(glyph)} ${label}</button>`;
}

function iconButton(label, action, glyph, attributes = '') {
  return `<button type="button" class="btn btn-secondary library-icon-btn" data-action="${action}" aria-label="${label}" title="${label}" ${attributes}>${icon(glyph)}</button>`;
}

function formDialog(root, title, content, submitLabel, onClose) {
  const dialog = document.createElement('dialog');
  const headingId = `library-dialog-title-${uid()}`;
  dialog.className = 'library-dialog';
  dialog.setAttribute('aria-labelledby', headingId);
  dialog.innerHTML = `
    <form class="library-dialog-inner">
      <header class="library-dialog-head">
        <h2 id="${headingId}">${title}</h2>
        ${iconButton('Đóng trình chỉnh sửa', 'cancel', 'close')}
      </header>
      <div class="stack library-dialog-content">${content}</div>
      <p class="library-form-error" role="alert" hidden></p>
      <footer class="library-dialog-footer">
        ${button('Hủy', 'cancel', 'close')}
        <button type="submit" class="btn btn-primary">${icon('check')} ${submitLabel}</button>
      </footer>
    </form>
  `;
  root.append(dialog);
  dialog.querySelectorAll('[data-action="cancel"]').forEach((control) => control.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => {
    const attached = dialog.isConnected;
    dialog.remove();
    if (attached) onClose?.(dialog.returnValue);
  }, { once: true });
  dialog.showModal();
  return dialog;
}

function formError(dialog, message = '') {
  const feedback = dialog.querySelector('.library-form-error');
  feedback.textContent = message;
  feedback.hidden = !message;
}

function subjectEditor(ctx, subject, onSaved) {
  const dialog = formDialog(ctx.root, subject ? 'Sửa lĩnh vực' : 'Thêm lĩnh vực', `
    <label class="field">
      <span>Tên lĩnh vực</span>
      <input name="name" value="${esc(subject?.name || '')}" required maxlength="80" autofocus>
    </label>
    <label class="field">
      <span>Mô tả</span>
      <textarea name="description" rows="3" maxlength="600">${esc(subject?.description || '')}</textarea>
    </label>
    <label class="field">
      <span>Biểu tượng</span>
      <select name="icon">
        ${subjectIcons.map(([glyph, label]) => `
          <option value="${glyph}" ${subject?.icon === glyph ? 'selected' : ''}>${label}</option>
        `).join('')}
        ${subject?.icon && !subjectIcons.some(([glyph]) => glyph === subject.icon) ? `<option value="${esc(subject.icon)}" selected>Biểu tượng hiện tại</option>` : ''}
      </select>
    </label>
  `, 'Lưu lĩnh vực');

  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    const id = subject?.id || uid();
    const name = values.get('name').trim();
    if (!name) {
      formError(dialog, 'Nhập tên lĩnh vực.');
      form.elements.namedItem('name').focus();
      return;
    }
    formError(dialog);
    submit.disabled = true;
    try {
      await ctx.update((data) => {
        if (data.subjects.some((item) => item.id !== id && normalized(item.name) === normalized(name))) {
          throw new Error('Tên lĩnh vực đã tồn tại.');
        }
        const changes = { name, description: values.get('description').trim(), icon: values.get('icon') };
        const current = data.subjects.find((item) => item.id === id);
        if (current) Object.assign(current, changes);
        else if (subject) throw new Error('Lĩnh vực đã bị xóa.');
        else data.subjects.push({ id, ...changes, sample: false });
      });
      if (dialog.isConnected) {
        dialog.close();
        onSaved(id);
      }
      ctx.toast('Đã lưu lĩnh vực.');
    } catch (error) {
      formError(dialog, error.message || 'Không thể lưu lĩnh vực.');
    } finally {
      submit.disabled = false;
    }
  });
}

async function deleteSubject(ctx, subject, redraw) {
  const others = ctx.state.subjects.filter((item) => item.id !== subject.id);
  const count = ctx.state.lessons.filter((item) => item.subjectId === subject.id).length;
  if (count && !others.length) {
    ctx.toast('Thêm một lĩnh vực để chuyển các bài học trước khi xóa.', 'error');
    return;
  }
  async function remove(replacementId) {
    await ctx.update((data) => {
      const affected = data.lessons.filter((item) => item.subjectId === subject.id);
      if (affected.length && !data.subjects.some((item) => item.id === replacementId && item.id !== subject.id)) {
        throw new Error('Chọn một lĩnh vực khác để giữ lại các bài học.');
      }
      for (const lesson of affected) lesson.subjectId = replacementId;
      data.subjects = data.subjects.filter((item) => item.id !== subject.id);
    });
    ctx.toast('Đã xóa lĩnh vực.');
  }

  if (!count) {
    const confirmed = await confirmAction(`Xóa lĩnh vực “${subject.name}”?`, { title: 'Xóa lĩnh vực', label: 'Xóa lĩnh vực' });
    if (!confirmed) return;
    try {
      await remove();
      redraw();
    } catch (error) {
      ctx.toast(error.message || 'Không thể xóa lĩnh vực.', 'error');
    }
    return;
  }

  const dialog = formDialog(ctx.root, 'Xóa lĩnh vực', `
    <p>Lĩnh vực <strong>${esc(subject.name)}</strong> có ${count} bài học. Chọn lĩnh vực để chuyển các bài học trước khi xóa.</p>
    <label class="field">
      <span>Chuyển bài học đến</span>
      <select name="replacement" required autofocus>
        <option value="">Chọn lĩnh vực</option>
        ${others.map((item) => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}
      </select>
    </label>
  `, 'Chuyển bài học và xóa');
  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await remove(new FormData(form).get('replacement'));
      if (dialog.isConnected) {
        dialog.close();
        redraw();
      }
    } catch (error) {
      formError(dialog, error.message || 'Không thể xóa lĩnh vực.');
    } finally {
      submit.disabled = false;
    }
  });
}

function lessonEditor(ctx, lesson, subjectId, onClose) {
  const { subjects, lessons } = ctx.state;
  if (!subjects.length) {
    ctx.toast('Thêm một lĩnh vực trước khi tạo bài học.', 'error');
    return;
  }
  const chosenSubject = lesson?.subjectId || subjectId;
  const description = 'Dùng Markdown cho tiêu đề, danh sách, liên kết, hình ảnh và khối mã. Viết công thức bằng $…$ hoặc $$…$$.';
  const related = lessons.filter((item) => item.id !== lesson?.id);
  let attachments = [...(lesson?.attachments || [])];
  let reading = false;
  const dialog = formDialog(ctx.root, lesson ? 'Sửa bài học' : 'Thêm bài học', `
    <label class="field">
      <span>Tên bài học</span>
      <input name="title" value="${esc(lesson?.title || '')}" required maxlength="120" autofocus>
    </label>
    <div class="form-grid">
      <label class="field">
        <span>Lĩnh vực</span>
        <select name="subjectId" required>
          ${subjects.map((subject) => `<option value="${esc(subject.id)}" ${subject.id === chosenSubject ? 'selected' : ''}>${esc(subject.name)}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Thời lượng dự kiến (phút)</span>
        <input name="minutes" type="number" min="1" max="600" required value="${Number(lesson?.minutes || 15)}">
      </label>
      <label class="field">
        <span>Chủ đề</span>
        <input name="topic" list="library-topic-list" value="${esc(lesson?.topic || '')}" required maxlength="80" placeholder="VD Python">
        <datalist id="library-topic-list"></datalist>
      </label>
      <label class="field">
        <span>Chương</span>
        <input name="chapter" list="library-chapter-list" value="${esc(lesson?.chapter || '')}" required maxlength="80" placeholder="VD Biến và kiểu dữ liệu">
        <datalist id="library-chapter-list"></datalist>
      </label>
    </div>
    <label class="field">
      <span>Mô tả ngắn</span>
      <textarea name="summary" rows="2" maxlength="400">${esc(lesson?.summary || '')}</textarea>
    </label>
    <label class="field">
      <span>Thẻ chủ đề, phân cách bằng dấu phẩy</span>
      <input name="tags" value="${esc((lesson?.tags || []).join(', '))}" maxlength="360" placeholder="VD Python, nền tảng">
    </label>
    <label class="field">
      <span>Kiến thức bổ sung</span>
      <textarea name="knowledge" rows="4" maxlength="${maxSectionLength}" aria-describedby="library-markdown-help">${esc(lesson?.knowledge || '')}</textarea>
    </label>
    <p class="muted" id="library-markdown-help">${description}</p>
    <details class="library-section-fields" open>
      <summary>Nội dung Pareto</summary>
      <div class="stack">
        ${sectionDefinitions.map(([key, title]) => `
          <label class="field">
            <span>${title}</span>
            <textarea name="section-${key}" rows="3" maxlength="${maxSectionLength}">${esc(lesson?.sections?.[key] || '')}</textarea>
          </label>
        `).join('')}
      </div>
    </details>
    ${related.length ? `
      <details class="library-section-fields">
        <summary>Kiến thức liên quan</summary>
        <div class="stack">
          ${related.map((item) => `
            <label class="library-check">
              <input type="checkbox" name="related" value="${esc(item.id)}" ${lesson?.relatedIds?.includes(item.id) ? 'checked' : ''}>
              <span>${esc(item.title)}</span>
            </label>
          `).join('')}
        </div>
      </details>
    ` : ''}
    <div class="stack">
      <label class="field">
        <span>Tài liệu đính kèm</span>
        <input type="file" multiple data-files aria-describedby="library-file-help">
      </label>
      <p id="library-file-help" class="muted">Tối đa ${maxFiles} tệp, mỗi tệp tối đa 3 MB.</p>
      <ul class="library-attachment-list" aria-label="Tệp đã chọn"></ul>
    </div>
  `, 'Lưu bài học', onClose);

  const form = dialog.querySelector('form');
  const subjectSelect = form.elements.namedItem('subjectId');
  const topicInput = form.elements.namedItem('topic');
  const submit = form.querySelector('[type="submit"]');
  const attachmentList = form.querySelector('.library-attachment-list');
  const options = (values) => [...new Set(values)].filter(Boolean)
    .map((value) => `<option value="${esc(value)}"></option>`).join('');

  function updateSuggestions() {
    const matching = ctx.state.lessons.filter((item) => item.subjectId === subjectSelect.value);
    form.querySelector('#library-topic-list').innerHTML = options(matching.map((item) => item.topic));
    const topic = normalized(topicInput.value);
    form.querySelector('#library-chapter-list').innerHTML = options(matching
      .filter((item) => !topic || normalized(item.topic) === topic).map((item) => item.chapter));
  }

  function updateAttachments() {
    attachmentList.hidden = attachments.length === 0;
    attachmentList.innerHTML = attachments.map((item, index) => `
      <li><span>${icon('paperclip')} ${esc(item.name)}</span>
        ${iconButton('Gỡ tệp', 'remove-file', 'close', `data-file-index="${index}"`)}
      </li>
    `).join('');
  }

  subjectSelect.addEventListener('change', updateSuggestions);
  topicInput.addEventListener('input', updateSuggestions);
  updateSuggestions();
  updateAttachments();

  attachmentList.addEventListener('click', (event) => {
    const control = event.target.closest('[data-file-index]');
    if (!control) return;
    attachments = attachments.filter((_, index) => index !== Number(control.dataset.fileIndex));
    updateAttachments();
    attachmentList.querySelector('button')?.focus();
    if (!attachments.length) form.querySelector('[data-files]').focus();
  });

  form.querySelector('[data-files]').addEventListener('change', async (event) => {
    const input = event.currentTarget;
    const selected = Array.from(input.files);
    if (!selected.length || reading) return;
    if (selected.some((file) => file.size > maxFileBytes) || attachments.length + selected.length > maxFiles) {
      formError(dialog, 'Chọn tối đa 5 tệp, mỗi tệp tối đa 3 MB.');
      input.value = '';
      return;
    }
    formError(dialog);
    reading = true;
    submit.disabled = true;
    input.disabled = true;
    try {
      attachments.push(...await Promise.all(selected.map(readFile)));
      updateAttachments();
    } catch (error) {
      formError(dialog, error.message);
    } finally {
      reading = false;
      submit.disabled = false;
      input.disabled = false;
      input.value = '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (reading || submit.disabled) return;
    formError(dialog);
    const values = new FormData(form);
    const id = lesson?.id || uid();
    const text = (name) => values.get(name).trim();
    const trimmedFields = ['title', 'topic', 'chapter'];
    const missing = trimmedFields.find((name) => !text(name));
    if (missing) {
      formError(dialog, 'Nhập đầy đủ tên bài học, chủ đề và chương.');
      form.elements.namedItem(missing).focus();
      return;
    }
    const tags = [...new Set(text('tags').split(',').map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      formError(dialog, 'Dùng tối đa 20 thẻ, mỗi thẻ tối đa 40 ký tự.');
      form.elements.namedItem('tags').focus();
      return;
    }
    const draft = {
      subjectId: values.get('subjectId'),
      title: text('title'),
      topic: text('topic'),
      chapter: text('chapter'),
      summary: text('summary'),
      knowledge: text('knowledge'),
      minutes: Number(values.get('minutes')),
      tags,
      sections: Object.fromEntries(sectionDefinitions.map(([key]) => [key, text(`section-${key}`)])),
      relatedIds: values.getAll('related'),
      attachments: [...attachments],
    };
    submit.disabled = true;
    try {
      await ctx.update((data) => {
        if (!data.subjects.some((item) => item.id === draft.subjectId)) throw new Error('Lĩnh vực đã bị xóa.');
        draft.relatedIds = draft.relatedIds.filter((relatedId) => data.lessons.some((item) => item.id === relatedId));
        const current = data.lessons.find((item) => item.id === id);
        if (current) Object.assign(current, draft);
        else if (lesson) throw new Error('Bài học đã bị xóa.');
        else data.lessons.push({ id, ...draft, sample: false, favorite: false });
      });
      if (dialog.isConnected) dialog.close(id);
      ctx.toast('Đã lưu bài học.');
    } catch (error) {
      formError(dialog, error.message || 'Không thể lưu bài học.');
    } finally {
      submit.disabled = false;
    }
  });
}

async function deleteLesson(ctx, lesson, redraw) {
  const confirmed = await confirmAction(
    `Xóa bài học “${lesson.title}” cùng bài tập, flashcard và tiến độ gắn với bài học?`,
    { title: 'Xóa bài học', label: 'Xóa bài học' },
  );
  if (!confirmed) return;
  try {
    await ctx.update((data) => {
      const exercises = data.exercises.filter((item) => item.lessonId === lesson.id);
      const flashcards = data.flashcards.filter((item) => item.lessonId === lesson.id);
      for (const item of exercises) {
        delete data.progress.practice[item.id];
        delete data.progress.recall[item.id];
      }
      for (const item of flashcards) {
        delete data.progress.reviews[item.id];
        delete data.progress.recall[item.id];
      }
      delete data.progress.lessons[lesson.id];
      data.lessons = data.lessons.filter((item) => item.id !== lesson.id);
      data.exercises = data.exercises.filter((item) => item.lessonId !== lesson.id);
      data.flashcards = data.flashcards.filter((item) => item.lessonId !== lesson.id);
      for (const item of data.lessons) item.relatedIds = (item.relatedIds || []).filter((id) => id !== lesson.id);
      for (const skill of data.skills) skill.lessonIds = (skill.lessonIds || []).filter((id) => id !== lesson.id);
      if (data.lastLessonId === lesson.id) data.lastLessonId = null;
    });
    ctx.toast('Đã xóa bài học.');
    redraw();
  } catch (error) {
    ctx.toast(error.message || 'Không thể xóa bài học.', 'error');
  }
}

function lessonCard(state, lesson) {
  const progress = state.progress.lessons[lesson.id];
  const status = progress?.completedAt
    ? '<span class="tag status-complete">Đã hoàn thành</span>'
    : progress?.startedAt ? '<span class="tag">Đang học</span>' : '';
  return `
    <article class="panel library-card">
      <div class="library-card-main">
        <div class="library-card-glyph" aria-hidden="true">${icon('book')}</div>
        <div>
          <h3><button type="button" data-action="open-lesson" data-id="${esc(lesson.id)}">${esc(lesson.title)}</button></h3>
          ${lesson.summary ? `<p class="muted">${esc(lesson.summary)}</p>` : ''}
          <div class="library-breadcrumb">
            ${lesson.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
            ${status}
            ${lesson.minutes ? `<span class="tag">${icon('clock')} ${Number(lesson.minutes)} phút</span>` : ''}
            ${(lesson.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="library-actions">
        ${iconButton(lesson.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích', 'favorite-lesson', 'star', `data-id="${esc(lesson.id)}" aria-pressed="${Boolean(lesson.favorite)}"`)}
        ${iconButton('Sửa bài học', 'edit-lesson', 'edit', `data-id="${esc(lesson.id)}"`)}
        ${iconButton('Xóa bài học', 'delete-lesson', 'trash', `data-id="${esc(lesson.id)}"`)}
      </div>
    </article>
  `;
}

function groupLessons(state, lessons, includeSubject) {
  const groups = new Map();
  const subjects = new Map(state.subjects.map((item) => [item.id, item.name]));
  for (const lesson of lessons) {
    const groupKey = JSON.stringify([lesson.subjectId, lesson.topic, lesson.chapter]);
    const group = groups.get(groupKey) || {
      trail: [includeSubject ? subjects.get(lesson.subjectId) : '', lesson.topic, lesson.chapter].filter(Boolean),
      items: [],
    };
    group.items.push(lesson);
    groups.set(groupKey, group);
  }
  return [...groups.values()].map(({ trail, items }) => `
    <section class="library-group">
      <h2 class="library-breadcrumb">${trail.map((part, index) => `${index ? icon('chevron-right') : ''}<span>${esc(part)}</span>`).join('')}</h2>
      ${items.map((item) => lessonCard(state, item)).join('')}
    </section>
  `).join('');
}

export function renderLibrary(ctx) {
  const { root, params } = ctx;
  let subjectId = '';
  let favorites = false;
  root.innerHTML = pageHeader({
    title: 'Thư viện tri thức',
    description: 'Tổ chức và tìm lại kiến thức theo lĩnh vực, chủ đề và chương.',
    icon: 'library',
    actions: button('Thêm lĩnh vực', 'new-subject', 'folder') + button('Thêm bài học', 'new-lesson', 'plus', 'btn-primary'),
  }) + `
    <div class="library-layout">
      <nav class="panel library-nav" aria-label="Lọc theo lĩnh vực"></nav>
      <section class="stack library-catalog" aria-label="Danh sách bài học">
        <div class="panel library-filters">
          <div class="library-toolbar">
            <label class="field">
              <span>Tìm trong thư viện</span>
              <input type="search" data-filter="query" placeholder="Tìm bài học, ghi chú, thẻ…">
            </label>
            <label class="field">
              <span>Thẻ chủ đề</span>
              <select data-filter="tag"></select>
            </label>
            ${button('Yêu thích', 'filter-favorites', 'star', 'btn-secondary', 'aria-pressed="false"')}
          </div>
        </div>
        <div class="library-subject-info"></div>
        <div class="library-count muted" role="status"></div>
        <div class="library-list"></div>
      </section>
    </div>
  `;
  const queryInput = root.querySelector('[data-filter="query"]');
  const tagSelect = root.querySelector('[data-filter="tag"]');
  const list = root.querySelector('.library-list');
  const nav = root.querySelector('.library-nav');
  const subjectInfo = root.querySelector('.library-subject-info');

  function filterSubjects() {
    const { subjects, lessons } = ctx.state;
    const counts = new Map();
    for (const lesson of lessons) counts.set(lesson.subjectId, (counts.get(lesson.subjectId) || 0) + 1);
    const navButton = (id, name, glyph, count) => `
      <button type="button" data-action="filter-subject" data-id="${esc(id)}" aria-pressed="${subjectId === id}" title="${esc(name)}">
        ${icon(glyph || 'folder')} <span>${esc(name)}</span><small>${count}</small>
      </button>
    `;
    nav.innerHTML = `
      <h2>Lĩnh vực</h2>
      <div class="library-subject-list">
        ${navButton('', 'Tất cả lĩnh vực', 'layers', lessons.length)}
        ${subjects.map((subject) => navButton(subject.id, subject.name, subject.icon, counts.get(subject.id) || 0)).join('')}
      </div>
    `;

    const subject = subjects.find((item) => item.id === subjectId);
    subjectInfo.innerHTML = subject ? `
      <div class="panel library-toolbar">
        <div>
          <div class="library-breadcrumb">
            <h2>${esc(subject.name)}</h2>
            ${subject.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
          </div>
          ${subject.description ? `<p class="muted">${esc(subject.description)}</p>` : ''}
        </div>
        <div class="library-actions">
          ${iconButton('Sửa lĩnh vực', 'edit-subject', 'edit', `data-id="${esc(subject.id)}"`)}
          ${iconButton('Xóa lĩnh vực', 'delete-subject', 'trash', `data-id="${esc(subject.id)}"`)}
        </div>
      </div>
    ` : '';
    subjectInfo.hidden = !subject;
  }

  function updateTags() {
    const previous = tagSelect.value;
    const tags = [...new Set(ctx.state.lessons.filter((item) => !subjectId || item.subjectId === subjectId)
      .flatMap((item) => item.tags || []))].sort((a, b) => a.localeCompare(b, 'vi'));
    tagSelect.innerHTML = '<option value="">Tất cả thẻ</option>'
      + tags.map((tag) => `<option value="${esc(tag)}">${esc(tag)}</option>`).join('');
    if (tags.includes(previous)) tagSelect.value = previous;
  }

  function updateResults() {
    if (!list.isConnected) return;
    const tokens = normalized(queryInput.value).split(/\s+/).filter(Boolean);
    const selectedTag = tagSelect.value;
    const state = ctx.state;
    const subjects = new Map(state.subjects.map((item) => [item.id, item.name]));
    const results = state.lessons.filter((lesson) => {
      if (subjectId && lesson.subjectId !== subjectId) return false;
      if (favorites && !lesson.favorite) return false;
      if (selectedTag && !lesson.tags?.includes(selectedTag)) return false;
      if (!tokens.length) return true;
      const search = normalized([
        lesson.title, lesson.summary, lesson.knowledge, lesson.topic, lesson.chapter, subjects.get(lesson.subjectId),
        ...(lesson.tags || []), ...Object.values(lesson.sections || {}),
      ].filter(Boolean).join(' '));
      return tokens.every((word) => search.includes(word));
    });

    root.querySelector('.library-count').textContent = `${results.length} bài học`;
    const filtered = tokens.length || selectedTag || favorites;
    list.innerHTML = results.length ? groupLessons(state, results, !subjectId) : empty({
      title: filtered ? 'Không tìm thấy bài học phù hợp' : 'Chưa có bài học',
      description: filtered ? 'Bạn có thể đổi từ khóa hoặc xóa bộ lọc.' : 'Thêm bài học đầu tiên cho lĩnh vực này.',
      icon: 'book',
      action: filtered ? button('Xóa bộ lọc', 'clear-filters', 'filter') : button('Thêm bài học', 'new-lesson', 'plus', 'btn-primary'),
    });
  }

  function redraw() {
    if (!nav.isConnected) return;
    if (subjectId && !ctx.state.subjects.some((item) => item.id === subjectId)) subjectId = '';
    filterSubjects();
    updateTags();
    updateResults();
  }

  function openLessonEditor(lesson) {
    if (!ctx.state.subjects.length) {
      subjectEditor(ctx, undefined, (id) => {
        subjectId = id;
        redraw();
        openLessonEditor(undefined);
      });
      return;
    }
    lessonEditor(ctx, lesson, subjectId, (savedId) => {
      if (savedId) ctx.go('pareto', { id: savedId });
      else if (params.has('edit') && lesson) ctx.go('pareto', { id: lesson.id });
    });
  }

  function setFavoriteFilter(value) {
    favorites = value;
    root.querySelector('[data-action="filter-favorites"]').setAttribute('aria-pressed', String(favorites));
  }

  queryInput.addEventListener('input', updateResults);
  tagSelect.addEventListener('change', updateResults);
  root.querySelector('[data-action="new-subject"]').addEventListener('click', () => {
    subjectEditor(ctx, undefined, (id) => {
      subjectId = id;
      redraw();
    });
  });
  root.querySelector('[data-action="new-lesson"]').addEventListener('click', () => openLessonEditor(undefined));
  root.querySelector('[data-action="filter-favorites"]').addEventListener('click', () => {
    setFavoriteFilter(!favorites);
    updateResults();
  });
  nav.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action="filter-subject"]');
    if (!control) return;
    subjectId = control.dataset.id;
    redraw();
    [...nav.querySelectorAll('button')].find((item) => item.dataset.id === subjectId)?.focus();
  });
  subjectInfo.addEventListener('click', (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const subject = ctx.state.subjects.find((item) => item.id === control.dataset.id);
    if (!subject) return;
    if (control.dataset.action === 'edit-subject') subjectEditor(ctx, subject, redraw);
    if (control.dataset.action === 'delete-subject') deleteSubject(ctx, subject, redraw);
  });
  list.addEventListener('click', async (event) => {
    const control = event.target.closest('[data-action]');
    if (!control) return;
    const { action, id } = control.dataset;
    if (action === 'clear-filters') {
      queryInput.value = '';
      tagSelect.value = '';
      setFavoriteFilter(false);
      updateResults();
      queryInput.focus();
    }
    if (action === 'new-lesson') openLessonEditor(undefined);
    const lesson = ctx.state.lessons.find((item) => item.id === id);
    if (!lesson) return;
    if (action === 'open-lesson') ctx.go('pareto', { id });
    if (action === 'edit-lesson') openLessonEditor(lesson);
    if (action === 'delete-lesson') deleteLesson(ctx, lesson, redraw);
    if (action === 'favorite-lesson') {
      control.disabled = true;
      try {
        await ctx.update((data) => {
          const current = data.lessons.find((item) => item.id === id);
          if (current) current.favorite = !current.favorite;
        });
        if (control.isConnected) {
          updateResults();
          const replacement = [...list.querySelectorAll('[data-action="favorite-lesson"]')].find((item) => item.dataset.id === id);
          (replacement || queryInput).focus();
        }
      } catch {
        ctx.toast('Không thể cập nhật yêu thích.', 'error');
        control.disabled = false;
      }
    }
  });
  redraw();
  if (params.has('edit')) {
    const lesson = ctx.state.lessons.find((item) => item.id === params.get('edit'));
    if (lesson) openLessonEditor(lesson);
    else ctx.toast('Không tìm thấy bài học để chỉnh sửa.', 'error');
  } else if (params.get('focus') === 'search') queryInput.focus({ preventScroll: true });
}
