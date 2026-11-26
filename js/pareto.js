import { empty, esc, icon, pageHeader } from './ui.js';
import { recordActivity } from './gamification.js';

export const sectionDefinitions = [
  ['objective', 'Mục tiêu bài học', 'target'],
  ['core', 'Kiến thức cốt lõi', 'sparkles'],
  ['simple', 'Giải thích đơn giản', 'info'],
  ['formulas', 'Công thức quan trọng', 'code'],
  ['examples', 'Ví dụ thực tế', 'bolt'],
  ['method', 'Phương pháp giải quyết vấn đề', 'tree'],
  ['mistakes', 'Những lỗi thường gặp', 'info'],
  ['summary', 'Tóm tắt bài học', 'file'],
  ['quiz', 'Câu hỏi kiểm tra', 'brain'],
  ['application', 'Bài tập vận dụng', 'flask'],
];

const mathSymbols = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\pi': 'π', '\\sigma': 'σ', '\\phi': 'φ', '\\omega': 'ω',
  '\\Delta': 'Δ', '\\Sigma': 'Σ', '\\infty': '∞', '\\sum': '∑',
  '\\prod': '∏', '\\int': '∫', '\\times': '×', '\\cdot': '·',
  '\\div': '÷', '\\pm': '±', '\\le': '≤', '\\leq': '≤', '\\ge': '≥',
  '\\geq': '≥', '\\neq': '≠', '\\approx': '≈', '\\to': '→',
  '\\in': '∈', '\\cup': '∪', '\\cap': '∩', '\\ldots': '…',
};

function mathMarkup(source, display = 'inline') {
  const tokens = source.match(/\\[a-zA-Z]+|\\.|[0-9]+(?:[.,][0-9]+)?|[^\s]/gu) || [];
  let position = 0;
  const row = (content) => `<mrow>${content}</mrow>`;

  function expression(depth, inGroup = false) {
    let result = '';
    while (position < tokens.length) {
      if (inGroup && tokens[position] === '}') {
        position += 1;
        break;
      }
      let base = atom(depth);
      let below = '';
      let above = '';
      while (tokens[position] === '_' || tokens[position] === '^') {
        const marker = tokens[position++];
        const value = atom(depth);
        if (marker === '_') below += value;
        else above += value;
      }
      if (below && above) base = `<msubsup>${base}${row(below)}${row(above)}</msubsup>`;
      else if (below) base = `<msub>${base}${row(below)}</msub>`;
      else if (above) base = `<msup>${base}${row(above)}</msup>`;
      result += base;
    }
    return result;
  }

  function atom(depth) {
    const token = tokens[position++];
    if (!token) return '<mrow></mrow>';
    if (depth > 20) return `<mtext>${esc(token)}</mtext>`;
    if (token === '{') return row(expression(depth + 1, true));
    if (token === '\\frac') return `<mfrac>${atom(depth + 1)}${atom(depth + 1)}</mfrac>`;
    if (token === '\\sqrt') return `<msqrt>${atom(depth + 1)}</msqrt>`;
    if (token === '\\left' || token === '\\right') return atom(depth + 1);
    if (/^\\(?:sin|cos|tan|log|ln|lim|max|min)$/u.test(token)) {
      return `<mi mathvariant="normal">${esc(token.slice(1))}</mi>`;
    }
    const value = Object.hasOwn(mathSymbols, token) ? mathSymbols[token] : token;
    if (/^[0-9]/u.test(value)) return `<mn>${esc(value)}</mn>`;
    if (/^\p{L}$/u.test(value)) return `<mi>${esc(value)}</mi>`;
    return `<mo>${esc(value)}</mo>`;
  }

  if (tokens.length > 500) return `<code>${esc(source)}</code>`;
  return `<math display="${display}" aria-label="${esc(source)}">${row(expression(0))}</math>`;
}

function safeUrl(value, useImage = false) {
  if (useImage && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/]+=*$/i.test(value)) {
    return value;
  }
  try {
    const url = new URL(value, document.baseURI);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function inlineMarkdown(source) {
  const tokenPattern = /`([^`\n]+)`|(!?)\[([^\]\n]*)\]\(([^\s)]+)\)|\$([^$\n]+)\$|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/gu;
  let offset = 0;
  let html = '';
  for (const match of source.matchAll(tokenPattern)) {
    html += esc(source.slice(offset, match.index));
    const [token, code, bang, label, href, formula, bold, underlinedBold, italic, underlinedItalic] = match;
    if (code) html += `<code>${esc(code)}</code>`;
    else if (href) {
      const url = safeUrl(href, Boolean(bang));
      if (!url) html += esc(token);
      else if (bang) html += `<img src="${esc(url)}" alt="${esc(label)}" loading="lazy" referrerpolicy="no-referrer">`;
      else html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    } else if (formula) html += mathMarkup(formula);
    else if (bold || underlinedBold) html += `<strong>${esc(bold || underlinedBold)}</strong>`;
    else html += `<em>${esc(italic || underlinedItalic)}</em>`;
    offset = match.index + token.length;
  }
  return html + esc(source.slice(offset));
}

export function markdown(source = '') {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length) blocks.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/u);
    const listItem = trimmed.match(/^([-+*]|\d+[.)])\s+(.+)$/u);
    if (!trimmed) flushParagraph();
    else if (trimmed.startsWith('```')) {
      flushParagraph();
      const code = [];
      while (index + 1 < lines.length && !lines[index + 1].trim().startsWith('```')) {
        code.push(lines[++index]);
      }
      if (index + 1 < lines.length) index += 1;
      blocks.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
    } else if (trimmed.startsWith('$$') && (trimmed === '$$' || trimmed.endsWith('$$'))) {
      flushParagraph();
      if (trimmed.length > 2) {
        blocks.push(mathMarkup(trimmed.slice(2, -2), 'block'));
        continue;
      }
      const formula = [];
      while (index + 1 < lines.length && lines[index + 1].trim() !== '$$') formula.push(lines[++index]);
      if (index + 1 < lines.length) index += 1;
      blocks.push(mathMarkup(formula.join(' '), 'block'));
    } else if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length + 2, 6);
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (listItem) {
      flushParagraph();
      const listPattern = /^\d/u.test(listItem[1]) ? /^\d+[.)]\s+(.+)$/u : /^[-+*]\s+(.+)$/u;
      const tag = /^\d/u.test(listItem[1]) ? 'ol' : 'ul';
      const items = [`<li>${inlineMarkdown(listItem[2])}</li>`];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim().match(listPattern);
        if (!next) break;
        items.push(`<li>${inlineMarkdown(next[1])}</li>`);
        index += 1;
      }
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
    } else if (trimmed.startsWith('> ')) {
      flushParagraph();
      blocks.push(`<blockquote>${inlineMarkdown(trimmed.slice(2))}</blockquote>`);
    } else paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks.join('');
}

function button(label, action, iconName, className = 'btn-secondary') {
  return `<button type="button" class="btn ${className}" data-action="${action}">${icon(iconName)} ${label}</button>`;
}

function downloadAttachment(attachment) {
  const data = attachment.data.match(/^data:[^,]*;base64,([a-z0-9+/=]*)$/i);
  if (!data) throw new Error('Tệp đính kèm không hợp lệ.');
  const bytes = Uint8Array.from(atob(data[1]), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderPareto(ctx) {
  const { root, state, params } = ctx;
  const lesson = state.lessons.find((item) => item.id === params.get('id'));
  if (!lesson) {
    const recent = !params.has('id') && state.lessons.find((item) => item.id === state.lastLessonId);
    root.innerHTML = pageHeader({
      title: 'Bài học Pareto',
      description: 'Học phần cốt lõi, sau đó vận dụng qua ví dụ và câu hỏi.',
      icon: 'book',
    }) + empty({
      title: recent?.title ?? (params.has('id') ? 'Không tìm thấy bài học' : 'Chọn bài học để bắt đầu'),
      description: recent ? recent.summary : 'Các bài học và ghi chú của bạn nằm trong Thư viện tri thức.',
      icon: 'book',
      action: recent
        ? button('Tiếp tục học', 'resume', 'play', 'btn-primary') + button('Mở thư viện', 'library', 'library')
        : button('Mở thư viện', 'library', 'arrow-right', 'btn-primary'),
    });
    root.querySelector('[data-action="library"]').addEventListener('click', () => ctx.go('library'));
    root.querySelector('[data-action="resume"]')?.addEventListener('click', () => ctx.go('pareto', { id: recent.id }));
    return;
  }

  const subject = state.subjects.find((item) => item.id === lesson.subjectId);
  const completed = Boolean(state.progress.lessons[lesson.id]?.completedAt);
  const sections = sectionDefinitions.filter(([key]) => lesson.sections?.[key]?.trim());
  const related = (lesson.relatedIds || []).map((id) => state.lessons.find((item) => item.id === id)).filter(Boolean);
  const attachments = lesson.attachments || [];
  const breadcrumb = [subject?.name, lesson.topic, lesson.chapter].filter(Boolean);
  const metadata = [
    ...breadcrumb.map((value) => `<span class="tag">${esc(value)}</span>`),
    lesson.minutes ? `<span class="tag">${icon('clock')} ${Number(lesson.minutes)} phút</span>` : '',
    lesson.sample ? '<span class="tag">Dữ liệu mẫu</span>' : '',
    completed ? '<span class="tag status-complete">Đã hoàn thành</span>' : '',
  ].join('');

  root.innerHTML = pageHeader({
    title: lesson.title,
    description: lesson.summary,
    icon: 'book',
    actions: button('Thư viện', 'library', 'arrow-left') + button('Sửa bài học', 'edit', 'edit'),
  }) + `
    <div class="lesson-breadcrumb" aria-label="Thông tin bài học">${metadata}</div>
    <div class="lesson-layout">
      <div class="stack lesson-content">
        ${sections.map(([key, title, glyph]) => `
          <article class="panel lesson-section" id="pareto-${key}" tabindex="-1">
            <h2>${icon(glyph)} ${title}</h2>
            <div class="markdown-body">${markdown(lesson.sections[key])}</div>
          </article>
        `).join('')}
        ${lesson.knowledge ? `
          <article class="panel lesson-section" id="pareto-knowledge" tabindex="-1">
            <h2>${icon('layers')} Kiến thức bổ sung</h2>
            <div class="markdown-body">${markdown(lesson.knowledge)}</div>
          </article>
        ` : ''}
        ${sections.length || lesson.knowledge ? '' : empty({
          title: 'Bài học chưa có nội dung',
          description: 'Thêm các mục Pareto hoặc ghi chú kiến thức trong trình chỉnh sửa.',
          icon: 'book',
        })}
        <section class="panel lesson-section">
          <h2>${icon('target')} Tiếp tục học</h2>
          <div class="lesson-actions">
            ${completed ? '' : button('Hoàn thành bài học', 'complete', 'check', 'btn-primary')}
            ${button('Luyện tập', 'practice', 'flask')}
            ${button('Tự kiểm tra', 'recall', 'brain')}
            ${button('Ôn flashcard', 'srs', 'cards')}
          </div>
        </section>
      </div>
      <aside class="stack lesson-aside" aria-label="Tài nguyên bài học">
        ${sections.length || lesson.knowledge ? `
          <nav class="panel lesson-section lesson-toc" aria-label="Mục lục bài học">
            <h2>Mục lục</h2>
            ${sections.map(([key, title]) => `<button type="button" data-section="${key}">${title}</button>`).join('')}
            ${lesson.knowledge ? '<button type="button" data-section="knowledge">Kiến thức bổ sung</button>' : ''}
          </nav>
        ` : ''}
        ${lesson.tags?.length ? `
          <section class="panel lesson-section">
            <h2>Thẻ chủ đề</h2>
            <div class="lesson-breadcrumb">${lesson.tags.map((tag) => `<span class="tag">${esc(tag)}</span>`).join('')}</div>
          </section>
        ` : ''}
        ${related.length ? `
          <section class="panel lesson-section lesson-toc">
            <h2>Kiến thức liên quan</h2>
            ${related.map((item, index) => `<button type="button" data-related="${index}">${icon('link')} ${esc(item.title)}</button>`).join('')}
          </section>
        ` : ''}
        ${attachments.length ? `
          <section class="panel lesson-section lesson-toc">
            <h2>Tài liệu đính kèm</h2>
            ${attachments.map((item, index) => `<button type="button" data-attachment="${index}">${icon('download')} ${esc(item.name)}</button>`).join('')}
          </section>
        ` : ''}
      </aside>
    </div>
  `;

  if (state.lastLessonId !== lesson.id || !state.progress.lessons[lesson.id]?.startedAt) {
    ctx.update((data) => {
      if (!data.lessons.some((item) => item.id === lesson.id)) return;
      const current = data.progress.lessons[lesson.id] || {};
      data.progress.lessons[lesson.id] = { ...current, startedAt: current.startedAt || new Date().toISOString() };
      data.lastLessonId = lesson.id;
    }).catch(() => ctx.toast('Chưa thể lưu bài học đang mở.', 'error'));
  }

  root.querySelectorAll('[data-section]').forEach((control) => control.addEventListener('click', () => {
    root.querySelector(`#pareto-${control.dataset.section}`)?.focus();
  }));
  root.querySelectorAll('[data-related]').forEach((control) => control.addEventListener('click', () => {
    ctx.go('pareto', { id: related[Number(control.dataset.related)].id });
  }));
  root.querySelectorAll('[data-attachment]').forEach((control) => control.addEventListener('click', () => {
    try {
      downloadAttachment(attachments[Number(control.dataset.attachment)]);
    } catch {
      ctx.toast('Không thể tải tệp đính kèm.', 'error');
    }
  }));
  root.querySelector('[data-action="library"]').addEventListener('click', () => ctx.go('library'));
  root.querySelector('[data-action="edit"]').addEventListener('click', () => ctx.go('library', { edit: lesson.id }));
  for (const route of ['practice', 'recall', 'srs']) {
    root.querySelector(`[data-action="${route}"]`).addEventListener('click', () => ctx.go(route, { lesson: lesson.id }));
  }
  root.querySelector('[data-action="complete"]')?.addEventListener('click', async (event) => {
    const control = event.currentTarget;
    control.disabled = true;
    try {
      await ctx.update((data) => {
        if (data.progress.lessons[lesson.id]?.completedAt) return;
        const currentLesson = data.lessons.find((item) => item.id === lesson.id);
        if (!currentLesson) throw new Error('Bài học đã bị xóa.');
        const currentProgress = data.progress.lessons[lesson.id];
        const completedAt = new Date().toISOString();
        data.progress.lessons[lesson.id] = {
          ...currentProgress,
          startedAt: currentProgress?.startedAt || completedAt,
          completedAt,
        };
        data.lastLessonId = lesson.id;
        recordActivity(data, { type: 'lesson', id: lesson.id, subjectId: currentLesson.subjectId, correct: true, at: completedAt });
      });
      ctx.toast('Đã hoàn thành bài học.');
      if (control.isConnected) ctx.refresh();
    } catch (error) {
      ctx.toast(error.message || 'Chưa thể lưu tiến độ.', 'error');
      control.disabled = false;
    }
  });
}
