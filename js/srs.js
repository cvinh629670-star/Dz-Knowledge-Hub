import { recordActivity } from './gamification.js';
import { href } from './router.js';
import { confirmAction, empty, esc, icon, pageHeader, uid } from './ui.js';

const day = 86_400_000;
const tenMinutes = 600_000;
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const ratings = {
  again: { label: 'Again', quality: 0, tone: 'error', description: 'Quên đáp án' },
  hard: { label: 'Hard', quality: 3, tone: 'warning', description: 'Nhớ khó khăn' },
  good: { label: 'Good', quality: 4, tone: 'success', description: 'Nhớ được' },
  easy: { label: 'Easy', quality: 5, tone: 'info', description: 'Nhớ dễ dàng' },
};

export function scheduleReview(previous = {}, rating, now = new Date()) {
  const choice = ratings[rating];
  if (!choice) throw new RangeError('Mức nhớ không hợp lệ.');
  const correct = choice.quality >= 3;
  const difference = 5 - choice.quality;
  const oldEase = Number.isFinite(previous.ease) ? previous.ease : 2.5;
  const adjustment = 0.1 - difference * (0.08 + difference * 0.02);
  const ease = Math.max(1.3, Number((oldEase + adjustment).toFixed(2)));
  const repetitions = correct ? (previous.repetitions ?? 0) + 1 : 0;
  const oldInterval = previous.interval ?? 0;
  let interval;
  if (!correct) {
    interval = tenMinutes / day;
  } else if (repetitions === 1) {
    interval = { hard: 0.5, good: 1, easy: 4 }[rating];
  } else if (repetitions === 2) {
    interval = { hard: 4, good: 6, easy: 8 }[rating];
  } else {
    // SM-2 ease updates after grading, while the current interval uses the previous ease.
    const modifier = { hard: 0.75, good: 1, easy: 1.3 }[rating];
    interval = Math.min(36_500, Math.max(Math.floor(oldInterval) + 1, Math.round(oldInterval * oldEase * modifier)));
  }
  return {
    lastAt: now.toISOString(),
    dueAt: new Date(now.getTime() + interval * day).toISOString(),
    interval,
    ease,
    repetitions,
    correct: (previous.correct ?? 0) + Number(correct),
    wrong: (previous.wrong ?? 0) + Number(!correct),
    lastRating: rating,
  };
}

function dueTime(review) {
  const date = Date.parse(review?.dueAt);
  return Number.isFinite(date) ? date : null;
}

export function getDueCards(state, now = Date.now(), lessonId = '') {
  return state.flashcards.filter((card) => (
    (!lessonId || card.lessonId === lessonId)
    && (dueTime(state.progress.reviews[card.id]) ?? now) <= now
  )).sort((a, b) => (
    (dueTime(state.progress.reviews[a.id]) ?? now) - (dueTime(state.progress.reviews[b.id]) ?? now)
  ));
}

function intervalLabel(interval) {
  if (interval < 1 / 24) return `${Math.round(interval * 24 * 60)} phút`;
  if (interval < 1) return `${Math.round(interval * 24)} giờ`;
  return `${interval} ngày`;
}

function dateLabel(value, fallback = '—') {
  const date = Date.parse(value);
  return Number.isFinite(date) ? dateTime.format(date) : fallback;
}

function srsUrl(params = {}) {
  return href('srs', Object.entries(params).filter(([, value]) => value));
}

function tabs(isDeck, lesson) {
  return `<nav class="study-tabs" aria-label="Khu vực flashcard">
    <a class="btn ${isDeck ? 'btn-secondary' : 'btn-primary'}" href="${esc(srsUrl({ lesson }))}" ${isDeck ? '' : 'aria-current="page"'}>Ôn hôm nay</a>
    <a class="btn ${isDeck ? 'btn-primary' : 'btn-secondary'}" href="${esc(srsUrl({ tab: 'deck', lesson }))}" ${isDeck ? 'aria-current="page"' : ''}>Bộ flashcard</a>
  </nav>`;
}

function lessonSelector(lessons, selected) {
  return lessons.map((lesson) => `<option value="${esc(lesson.id)}" ${lesson.id === selected ? 'selected' : ''}>${esc(lesson.title)}</option>`).join('');
}

function lessonFilter(lessons, selected) {
  return `<form data-srs-filter><label class="field"><span>Bài học</span>
    <select name="lesson"><option value="">Tất cả bài học</option>${lessonSelector(lessons, selected)}</select>
  </label></form>`;
}

function reviewInfo(card, current, dueCount) {
  return `<aside class="panel stack study-panel">
    <h2>Lịch ôn tập</h2>
    <dl class="study-definition">
      <div><dt>Thẻ đến hạn</dt><dd>${dueCount}</dd></div>
      ${card ? `
        <div><dt>Lần ôn gần nhất</dt><dd>${dateLabel(current?.lastAt, 'Chưa ôn')}</dd></div>
        <div><dt>Khoảng cách ôn tập</dt><dd>${current?.interval > 0 ? intervalLabel(current.interval) : '—'}</dd></div>
        <div><dt>Lượt nhớ đúng</dt><dd>${current?.correct ?? 0}</dd></div>
        <div><dt>Lượt chưa nhớ</dt><dd>${current?.wrong ?? 0}</dd></div>` : ''}
    </dl>
  </aside>`;
}

function reviewCard(card, lesson, previous, revealed, now) {
  return `<section class="panel stack study-panel srs-review-card" aria-labelledby="srs-question">
    <div class="section-head">
      <span class="tag">${previous?.lastAt ? 'Đến hạn ôn' : 'Thẻ mới'}</span>
      ${card.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
    </div>
    <div class="srs-card-face stack">
      <div>
        <p class="muted">${esc(lesson?.topic ?? '')} · ${esc(lesson?.title ?? '')}</p>
        <h2 id="srs-question">${esc(card.question)}</h2>
      </div>
      ${revealed ? `<div class="study-feedback">
        <h3 id="srs-answer" tabindex="-1">Mặt sau</h3>
        <pre class="study-answer">${esc(card.answer)}</pre>
        ${card.example ? `<p class="muted">${esc(card.example)}</p>` : ''}
      </div>` : ''}
    </div>
    ${revealed ? `<div class="srs-ratings" role="group" aria-label="Đánh giá khả năng ghi nhớ">
      ${Object.entries(ratings).map(([id, rating]) => `<button class="btn btn-secondary srs-rating srs-rate-${rating.tone}" type="button" data-srs-rating="${id}">
        <strong>${rating.label}</strong><span>${rating.description}</span><small>${intervalLabel(scheduleReview(previous, id, new Date(now)).interval)}</small>
      </button>`).join('')}
    </div>` : '<div class="study-actions"><button class="btn btn-primary" type="button" data-srs-reveal>Lật thẻ</button></div>'}
  </section>`;
}

function deck(ctx, lessonId, now) {
  const { state } = ctx;
  const lessons = new Map(state.lessons.map((lesson) => [lesson.id, lesson]));
  const cards = state.flashcards.filter((card) => !lessonId || card.lessonId === lessonId);
  return `<section class="panel stack study-panel">
    <div class="section-head"><h2>Bộ flashcard</h2><span class="tag">${cards.length} thẻ</span></div>
    ${cards.length ? `<div class="stack">
      ${cards.map((card) => {
        const current = state.progress.reviews[card.id];
        const lesson = lessons.get(card.lessonId);
        const due = dueTime(current);
        return `<article class="study-note stack">
          <div class="section-head">
            <div class="study-item-main"><h3>${esc(card.question)}</h3><small class="muted">${esc(lesson?.title ?? '')}</small></div>
            <div class="study-actions">
              <span class="tag">${due === null ? 'Thẻ mới' : due <= now ? 'Đến hạn ôn' : 'Đã lên lịch'}</span>
              ${card.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
            </div>
          </div>
          <dl class="study-definition">
            <div><dt>Lần ôn gần nhất</dt><dd>${dateLabel(current?.lastAt, 'Chưa ôn')}</dd></div>
            <div><dt>Ngày ôn tiếp theo</dt><dd>${dateLabel(current?.dueAt, 'Bất cứ lúc nào')}</dd></div>
            <div><dt>Khoảng cách</dt><dd>${current?.interval > 0 ? intervalLabel(current.interval) : '—'}</dd></div>
            <div><dt>Nhớ đúng / Chưa nhớ</dt><dd>${current?.correct ?? 0} / ${current?.wrong ?? 0}</dd></div>
          </dl>
          <details class="study-hint"><summary>Xem mặt sau</summary><pre class="study-answer">${esc(card.answer)}</pre>
            ${card.example ? `<p class="muted">${esc(card.example)}</p>` : ''}
          </details>
          <div class="study-actions">
            <a class="btn btn-secondary" href="${esc(srsUrl({ tab: 'deck', lesson: lessonId, edit: card.id }))}">Sửa thẻ</a>
            <button class="btn btn-secondary" type="button" data-delete-card="${esc(card.id)}">Xóa thẻ</button>
          </div>
        </article>`;
      }).join('')}
    </div>` : empty({
      title: 'Chưa có flashcard',
      description: 'Tạo câu hỏi và đáp án ngắn cho một bài học để bắt đầu ôn tập.',
      icon: 'layers',
      action: `<a class="btn btn-primary" href="${esc(srsUrl({ tab: 'deck', lesson: lessonId, new: '1' }))}">Tạo flashcard</a>`,
    })}
  </section>`;
}

function cardEditor(ctx, lessonId, card) {
  if (!ctx.state.lessons.length) return empty({
    title: 'Cần có bài học',
    description: 'Tạo một bài học trong thư viện để gắn flashcard với chủ đề.',
    icon: 'book',
    action: '<a class="btn btn-primary" href="#library">Mở thư viện</a>',
  });
  const selectedLesson = card?.lessonId ?? lessonId;
  return `<section class="panel stack study-panel">
    <h2>${card ? 'Sửa flashcard' : 'Thêm flashcard'}</h2>
    <form class="stack" data-card-editor>
      <label class="field"><span>Bài học</span>
        <select name="lessonId" required><option value="">Chọn bài học</option>${lessonSelector(ctx.state.lessons, selectedLesson)}</select>
      </label>
      <label class="field"><span>Câu hỏi</span><textarea name="question" maxlength="2000" rows="2" required>${esc(card?.question ?? '')}</textarea></label>
      <label class="field"><span>Đáp án</span><textarea name="answer" maxlength="12000" rows="4" required>${esc(card?.answer ?? '')}</textarea></label>
      <label class="field"><span>Ví dụ (không bắt buộc)</span><textarea name="example" maxlength="5000" rows="3">${esc(card?.example ?? '')}</textarea></label>
      <div class="study-actions">
        <button class="btn btn-primary" type="submit">Lưu flashcard</button>
        <a class="btn btn-secondary" href="${esc(srsUrl({ tab: 'deck', lesson: lessonId }))}">Hủy</a>
      </div>
    </form>
  </section>`;
}

function bindEditor(ctx, lessonId, existingCard) {
  const editor = ctx.root.querySelector('[data-card-editor]');
  editor?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fields = Object.fromEntries([...new FormData(editor)].map(([key, value]) => [key, String(value).trim()]));
    if (!fields.question || !fields.answer || !fields.lessonId) {
      ctx.toast('Hãy nhập bài học, câu hỏi và đáp án.', 'error');
      return;
    }
    const submit = editor.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      await ctx.update((data) => {
        if (!data.lessons.some((lesson) => lesson.id === fields.lessonId)) {
          throw new Error('Bài học đã bị xóa.');
        }
        if (!existingCard) {
          data.flashcards.push({ id: uid(), ...fields, sample: false });
          return;
        }
        const index = data.flashcards.findIndex((item) => item.id === existingCard.id);
        if (index < 0) throw new Error('Thẻ đã bị xóa.');
        data.flashcards[index] = { ...data.flashcards[index], ...fields };
        const recall = data.progress.recall[existingCard.id];
        if (recall) recall.lessonId = fields.lessonId;
      });
      if (ctx.root.isConnected && ctx.root.querySelector('[data-card-editor]') === editor) {
        ctx.toast('Đã lưu flashcard.');
        ctx.go('srs', { tab: 'deck', lesson: lessonId ? fields.lessonId : '' });
      }
    } catch {
      ctx.toast('Chưa lưu được flashcard. Hãy thử lại.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
}

function bindDeck(ctx) {
  let deleting = false;
  const deleteButtons = [...ctx.root.querySelectorAll('[data-delete-card]')];
  for (const button of deleteButtons) {
    button.addEventListener('click', async () => {
      if (deleting) return;
      deleting = true;
      const id = button.dataset.deleteCard;
      const accepted = await confirmAction('Lịch ôn và kết quả tự kiểm tra của thẻ này cũng sẽ bị xóa.', {
        title: 'Xóa flashcard', label: 'Xóa thẻ',
      });
      if (!accepted) {
        deleting = false;
        return;
      }
      deleteButtons.forEach((item) => { item.disabled = true; });
      try {
        await ctx.update((data) => {
          data.flashcards = data.flashcards.filter((card) => card.id !== id);
          delete data.progress.reviews[id];
          delete data.progress.recall[id];
        });
        if (ctx.root.isConnected && ctx.root.contains(button)) {
          ctx.toast('Đã xóa flashcard.');
          ctx.refresh();
        }
      } catch {
        ctx.toast('Chưa xóa được flashcard. Hãy thử lại.', 'error');
      } finally {
        deleting = false;
        deleteButtons.forEach((item) => { item.disabled = false; });
      }
    });
  }
}

function paintSrs(ctx, revealedCardId = null) {
  const { state, params } = ctx;
  const lessonId = params.get('lesson') ?? '';
  const isDeck = params.get('tab') === 'deck';
  const editingId = isDeck ? params.get('edit') : '';
  const editorCard = state.flashcards.find((card) => card.id === editingId);
  const editing = isDeck && (editorCard || params.get('new') === '1');
  const now = Date.now();
  const due = isDeck ? [] : getDueCards(state, now, lessonId);
  const card = due[0];
  const current = card && state.progress.reviews[card.id];
  const lesson = card && state.lessons.find((item) => item.id === card.lessonId);
  const next = isDeck || card ? null : state.flashcards.reduce((earliest, item) => {
    if (lessonId && item.lessonId !== lessonId) return earliest;
    const time = dueTime(state.progress.reviews[item.id]);
    return time > now && (earliest === null || time < earliest) ? time : earliest;
  }, null);
  const deckHref = srsUrl({ tab: 'deck', lesson: lessonId });
  const editorHref = srsUrl({ tab: 'deck', lesson: lessonId, new: '1' });

  ctx.root.innerHTML = `${pageHeader({
    title: 'SRS Flashcard',
    description: 'Ôn theo lịch thích ứng với mức độ ghi nhớ của bạn.',
    icon: 'layers',
    actions: editing ? '' : `<a class="btn btn-primary" href="${esc(editorHref)}">${icon('plus')} Tạo flashcard</a>`,
  })}
    ${tabs(isDeck, lessonId)}
    ${editing ? '' : `<section class="panel study-filter-panel">${lessonFilter(state.lessons, lessonId)}</section>`}
    ${editing ? cardEditor(ctx, lessonId, editorCard) : ''}
    ${isDeck && !editing ? (editingId ? empty({
      title: 'Không tìm thấy flashcard',
      description: 'Thẻ có thể đã bị xóa khỏi bộ flashcard.',
      icon: 'layers',
      action: `<a class="btn btn-secondary" href="${esc(deckHref)}">Về bộ flashcard</a>`,
    }) : deck(ctx, lessonId, now)) : ''}
    ${isDeck ? '' : `<div class="workspace-grid study-workspace">
      ${card ? reviewCard(card, lesson, current, card.id === revealedCardId, now) : empty({
        title: 'Không có thẻ đến hạn',
        description: next ? `Lượt ôn tiếp theo vào ${dateTime.format(next)}.` : 'Thẻ mới sẽ xuất hiện ở đây ngay sau khi được tạo.',
        icon: 'layers',
        action: `<div class="study-actions">
          ${next ? '<button class="btn btn-primary" type="button" data-srs-recheck>Kiểm tra lại</button>' : ''}
          <a class="btn btn-secondary" href="${esc(deckHref)}">Xem bộ flashcard</a>
        </div>`,
      })}
      ${reviewInfo(card, current, due.length)}
    </div>`}`;

  ctx.root.querySelector('[data-srs-filter]')?.addEventListener('change', (event) => {
    ctx.go('srs', { tab: isDeck ? 'deck' : '', lesson: event.target.value });
  });
  ctx.root.querySelector('[data-srs-recheck]')?.addEventListener('click', () => {
    paintSrs(ctx);
    ctx.root.querySelector('[data-srs-reveal], [data-srs-recheck]')?.focus();
  });
  if (editing) bindEditor(ctx, lessonId, editorCard);
  if (isDeck && !editing) bindDeck(ctx);
  if (isDeck || !card) return;
  ctx.root.querySelector('[data-srs-reveal]')?.addEventListener('click', () => {
    paintSrs(ctx, card.id);
    ctx.root.querySelector('#srs-answer')?.focus();
  });

  let saving = false;
  const rateButtons = [...ctx.root.querySelectorAll('[data-srs-rating]')];
  for (const button of rateButtons) {
    button.addEventListener('click', async () => {
      if (saving) return;
      saving = true;
      rateButtons.forEach((item) => { item.disabled = true; });
      const rating = button.dataset.srsRating;
      let updatedReview;
      try {
        await ctx.update((data) => {
          if (!data.flashcards.some((item) => item.id === card.id)) throw new Error('Thẻ đã bị xóa.');
          const latest = data.progress.reviews[card.id];
          const reviewTime = new Date();
          if ((dueTime(latest) ?? 0) > reviewTime.getTime()) throw new Error('Thẻ đã được ôn.');
          updatedReview = scheduleReview(latest, rating, reviewTime);
          data.progress.reviews[card.id] = updatedReview;
          recordActivity(data, {
            type: 'review', id: card.id, lessonId: card.lessonId, subjectId: lesson?.subjectId,
            correct: rating !== 'again', at: updatedReview.lastAt,
          });
        });
        if (ctx.root.isConnected && ctx.root.contains(button)) {
          ctx.toast(`Đã lên lịch ôn lại sau ${intervalLabel(updatedReview.interval)}.`);
          paintSrs(ctx);
          ctx.root.querySelector('[data-srs-reveal]')?.focus();
        }
      } catch {
        ctx.toast('Chưa lưu được lượt ôn. Hãy thử lại.', 'error');
      } finally {
        saving = false;
        rateButtons.forEach((item) => { item.disabled = false; });
      }
    });
  }
}

export function renderSrs(ctx) {
  paintSrs(ctx);
}
