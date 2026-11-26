import { recordActivity } from './gamification.js';
import { href } from './router.js';
import { empty, esc, icon, pageHeader, uid } from './ui.js';

export const exerciseTypes = {
  choice: 'Trắc nghiệm',
  'true-false': 'Đúng hoặc sai',
  fill: 'Điền khuyết',
  essay: 'Tự luận',
  calculation: 'Tính toán',
  code: 'Lập trình',
  scenario: 'Tình huống',
};

const difficulties = {
  beginner: 'Beginner',
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
};
const manualTypes = new Set(['essay', 'code', 'scenario']);
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

function normalize(value, caseSensitive) {
  const plain = String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? plain : plain.toLocaleLowerCase('vi-VN');
}

function numeric(value) {
  const decimal = String(value).trim().replace(',', '.');
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(decimal)
    ? Number(decimal)
    : NaN;
}

export function gradeExercise(exercise, response) {
  if (manualTypes.has(exercise.type)) return null;
  const accepted = [exercise.answer, ...(exercise.acceptedAnswers ?? [])];
  if (exercise.type === 'calculation') {
    const given = numeric(response);
    const tolerance = Number.isFinite(exercise.tolerance) ? Math.max(0, exercise.tolerance) : 1e-9;
    return Number.isFinite(given) && accepted.some((answer) => {
      const expected = numeric(answer);
      return Number.isFinite(expected) && Math.abs(given - expected) <= tolerance;
    });
  }

  const given = normalize(response, exercise.caseSensitive);
  return accepted.some((answer) => given === normalize(answer, exercise.caseSensitive));
}

function practiceUrl(params = {}) {
  return href('practice', Object.entries(params).filter(([, value]) => value));
}

function tabs(isMistakes) {
  return `<nav class="study-tabs" aria-label="Khu vực luyện tập">
    <a class="btn ${isMistakes ? 'btn-secondary' : 'btn-primary'}" href="#practice" ${isMistakes ? '' : 'aria-current="page"'}>Bài luyện tập</a>
    <a class="btn ${isMistakes ? 'btn-primary' : 'btn-secondary'}" href="#practice?tab=mistakes" ${isMistakes ? 'aria-current="page"' : ''}>Sổ tay lỗi sai</a>
  </nav>`;
}

function makeOptions(items, selected) {
  return items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function pageFilters(lessons, filters) {
  return `<form class="form-grid study-filters" data-practice-filters aria-label="Lọc bài tập">
    <label class="field"><span>Bài học</span><select name="lesson">
      <option value="">Tất cả bài học</option>
      ${makeOptions(lessons.map((lesson) => [lesson.id, lesson.title]), filters.lesson)}
    </select></label>
    <label class="field"><span>Dạng bài</span><select name="type">
      <option value="">Tất cả dạng bài</option>${makeOptions(Object.entries(exerciseTypes), filters.type)}
    </select></label>
    <label class="field"><span>Độ khó</span><select name="difficulty">
      <option value="">Tất cả độ khó</option>${makeOptions(Object.entries(difficulties), filters.difficulty)}
    </select></label>
  </form>`;
}

function exerciseRow(exercise, exerciseProgress, href, current) {
  const badge = exerciseProgress?.lastCorrect === true ? 'Đã làm đúng'
    : exerciseProgress?.lastCorrect === false ? 'Cần luyện lại' : difficulties[exercise.difficulty];
  return `<a class="list-row study-item" href="${esc(href)}" ${current ? 'aria-current="page"' : ''}>
    <span class="study-item-main"><strong>${esc(exercise.prompt)}</strong><small class="muted">${esc(exerciseTypes[exercise.type])}</small></span>
    <span class="tag">${esc(badge)}</span>
  </a>`;
}

function answerInput(exercise, response, disabled) {
  const options = exercise.type === 'choice' ? exercise.options
    : exercise.type === 'true-false' ? ['Đúng', 'Sai'] : [];
  if (options.length) return `<fieldset class="study-options" ${disabled ? 'disabled' : ''}>
    <legend class="muted">Chọn một đáp án</legend>
    ${options.map((option, index) => `<label class="study-option">
      <input type="radio" name="response" value="${esc(option)}" ${response === option ? 'checked' : ''} required>
      <span class="tag">${String.fromCharCode(65 + index)}</span><span>${esc(option)}</span>
    </label>`).join('')}
  </fieldset>`;
  if (manualTypes.has(exercise.type)) {
    return `<label class="field"><span>Câu trả lời của bạn</span>
      <textarea class="${exercise.type === 'code' ? 'study-code-input' : ''}" name="response" rows="6" maxlength="12000" ${disabled ? 'readonly' : ''} required>${esc(response)}</textarea>
    </label>`;
  }
  return `<label class="field"><span>Câu trả lời của bạn</span>
    <input name="response" value="${esc(response)}" ${exercise.type === 'calculation' ? 'inputmode="decimal"' : ''} maxlength="200" ${disabled ? 'readonly' : ''} autocomplete="off" required>
  </label>`;
}

function answerDetails(exercise, result) {
  if (!result) return '';
  const message = result.correct === true ? 'Chính xác'
    : result.correct === false ? 'Cần luyện lại' : 'Đối chiếu câu trả lời';
  return `<section class="study-feedback ${result.correct === false ? 'study-feedback-error' : ''}" aria-labelledby="practice-feedback-title">
    <h3 id="practice-feedback-title" tabindex="-1">${message}</h3>
    <div><strong>Đáp án</strong><pre class="study-answer">${esc(exercise.answer)}</pre></div>
    <div><strong>Phương pháp giải</strong><p>${esc(exercise.solution)}</p></div>
    <div><strong>Giải thích lỗi thường gặp</strong><p>${esc(exercise.explanation)}</p></div>
    ${result.correct === null ? `<div class="study-actions">
      <button type="button" class="btn btn-primary" data-assess="true">Tôi làm đúng</button>
      <button type="button" class="btn btn-secondary" data-assess="false">Tôi cần luyện lại</button>
    </div>` : ''}
  </section>`;
}

function practiceCard(exercise, lesson, result, nextHref) {
  const answerButton = manualTypes.has(exercise.type) ? 'Đối chiếu đáp án' : 'Kiểm tra đáp án';
  return `<section class="panel stack study-panel" aria-labelledby="practice-question">
    <div class="study-actions">
      <span class="tag">${esc(exerciseTypes[exercise.type])}</span>
      <span class="tag">${esc(difficulties[exercise.difficulty])}</span>
      ${exercise.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
    </div>
    <div class="study-prompt">
      ${lesson ? `<a class="muted" href="${esc(href('pareto', { id: lesson.id }))}">${esc(lesson.title)}</a>` : ''}
      <h2 id="practice-question">${esc(exercise.prompt)}</h2>
      ${exercise.starterCode ? `<pre class="study-answer">${esc(exercise.starterCode)}</pre>` : ''}
    </div>
    <form class="stack" data-practice-answer>
      ${answerInput(exercise, result?.response ?? '', Boolean(result))}
      <details class="study-hint"><summary>Gợi ý</summary><p>${esc(exercise.hint)}</p></details>
      ${result ? '' : `<div class="study-actions"><button type="submit" class="btn btn-primary">${answerButton}</button></div>`}
    </form>
    ${answerDetails(exercise, result)}
    ${result && result.correct !== null ? `<div class="study-actions">
      <button class="btn btn-secondary" type="button" data-practice-retry>Làm lại</button>
      ${nextHref ? `<a class="btn btn-primary" href="${esc(nextHref)}">Câu tiếp theo ${icon('arrow-right')}</a>`
        : lesson ? `<a class="btn btn-primary" href="${esc(href('recall', { lesson: lesson.id }))}">Tự kiểm tra ${icon('arrow-right')}</a>` : ''}
    </div>` : ''}
  </section>`;
}

function getMistakes(state) {
  return state.exercises.flatMap((exercise) => {
    const attempt = state.progress.practice[exercise.id];
    return attempt?.wrong > 0 ? [{ exercise, attempt }] : [];
  }).sort((first, second) => Date.parse(second.attempt.lastWrongAt ?? second.attempt.lastAt)
    - Date.parse(first.attempt.lastWrongAt ?? first.attempt.lastAt));
}

function wrongAnswers(attempt) {
  if (Array.isArray(attempt.mistakes)) {
    return attempt.mistakes.filter((entry) => typeof entry?.answer === 'string' && typeof entry.at === 'string');
  }
  return attempt.lastWrongAnswer ? [{ answer: attempt.lastWrongAnswer, at: attempt.lastWrongAt }] : [];
}

function formattedDate(value) {
  const date = Date.parse(value);
  return Number.isFinite(date) ? dateTime.format(date) : '';
}

function renderMistakes(ctx) {
  const mistakes = getMistakes(ctx.state);
  const showResolved = ctx.params.get('status') === 'all';
  const visible = showResolved ? mistakes : mistakes.filter(({ attempt }) => !attempt.lastCorrect);
  ctx.root.innerHTML = `${pageHeader({
    title: 'Sổ tay lỗi sai',
    description: 'Xem lại những lần trả lời sai và luyện tập đến khi bạn làm đúng.',
    icon: 'library',
  })}
    ${tabs(true)}
    <section class="panel stack study-panel">
      <form data-mistake-filters>
        <label class="field"><span>Trạng thái</span><select name="status">
          <option value="open" ${showResolved ? '' : 'selected'}>Cần luyện lại</option>
          <option value="all" ${showResolved ? 'selected' : ''}>Tất cả lỗi đã lưu</option>
        </select></label>
      </form>
      ${visible.length ? `<div class="stack">${visible.map(({ exercise, attempt }) => {
        const timestamp = formattedDate(attempt.lastWrongAt ?? attempt.lastAt);
        const earlier = wrongAnswers(attempt).slice(0, -1).reverse();
        return `<article class="study-note stack">
          <div class="study-actions">
            <span class="tag">${attempt.lastCorrect ? 'Đã sửa' : 'Cần luyện lại'}</span>
            <span class="tag">${attempt.wrong} lần sai</span>
          </div>
          <h3>${esc(exercise.prompt)}</h3>
          ${timestamp ? `<p class="muted">Lần sai gần nhất · ${esc(timestamp)}</p>` : ''}
          ${attempt.lastWrongAnswer ? `<div><strong>Câu trả lời đã lưu</strong><pre class="study-answer">${esc(attempt.lastWrongAnswer)}</pre></div>` : ''}
          ${earlier.length ? `<details class="study-hint"><summary>Câu trả lời sai trước đó (${earlier.length})</summary>
            <div class="stack">${earlier.map((entry) => `<div>
              <small class="muted">${esc(formattedDate(entry.at))}</small><pre class="study-answer">${esc(entry.answer)}</pre>
            </div>`).join('')}</div>
          </details>` : ''}
          <details class="study-hint"><summary>Xem giải thích</summary><p>${esc(exercise.explanation)}</p></details>
          <div class="study-actions"><a class="btn btn-secondary" href="${esc(practiceUrl({ exercise: exercise.id }))}">Luyện lại</a></div>
        </article>`;
      }).join('')}</div>` : empty({
        title: showResolved ? 'Chưa có lỗi đã lưu' : 'Chưa có câu cần luyện lại',
        description: 'Câu trả lời sai từ Practice Lab sẽ tự động xuất hiện ở đây.',
        icon: 'library',
        action: '<a class="btn btn-primary" href="#practice">Luyện tập ngay</a>',
      })}
    </section>`;
  ctx.root.querySelector('[data-mistake-filters]').addEventListener('change', (event) => {
    ctx.go('practice', { tab: 'mistakes', status: event.target.value === 'all' ? 'all' : '' });
  });
}

function openExerciseEditor(ctx, lessonId, opener) {
  const dialog = document.createElement('dialog');
  dialog.className = 'practice-editor panel';
  dialog.setAttribute('aria-labelledby', 'practice-editor-title');
  dialog.innerHTML = `<form class="stack">
    <h2 id="practice-editor-title">Thêm bài luyện</h2>
    <div class="form-grid">
      <label class="field">Bài học<select name="lessonId" required>${makeOptions(ctx.state.lessons.map(lesson => [lesson.id, lesson.title]), lessonId)}</select></label>
      <label class="field">Độ khó<select name="difficulty">${makeOptions(Object.entries(difficulties), 'normal')}</select></label>
    </div>
    <label class="field">Dạng bài<select name="type">${makeOptions(Object.entries(exerciseTypes), 'choice')}</select></label>
    <label class="field">Câu hỏi<textarea name="prompt" rows="3" maxlength="4000" required></textarea></label>
    <label class="field" data-options>Phương án <small>Nhập 2–8 phương án, mỗi dòng một phương án.</small><textarea name="options" rows="3" maxlength="1600"></textarea></label>
    <label class="field" data-answer>Đáp án <small data-answer-help></small><textarea name="answer" rows="2" maxlength="12000"></textarea></label>
    <label class="field" data-binary hidden>Đáp án đúng<select name="binary"><option>Đúng</option><option>Sai</option></select></label>
    <label class="field">Gợi ý<textarea name="hint" rows="2" maxlength="4000" required></textarea></label>
    <label class="field">Phương pháp giải<textarea name="solution" rows="3" maxlength="12000" required></textarea></label>
    <label class="field">Giải thích lỗi sai<textarea name="explanation" rows="2" maxlength="4000" required></textarea></label>
    <p class="feedback" role="alert" hidden></p>
    <div class="dialog-actions"><button type="button" class="btn btn-secondary" data-cancel>Hủy</button><button class="btn btn-primary" type="submit">Lưu bài luyện</button></div>
  </form>`;
  const form = dialog.querySelector('form');
  const fields = form.elements;
  const feedback = form.querySelector('.feedback');
  const sync = () => {
    const type = fields.type.value;
    form.querySelector('[data-options]').hidden = type !== 'choice';
    fields.options.required = type === 'choice';
    form.querySelector('[data-binary]').hidden = type !== 'true-false';
    form.querySelector('[data-answer]').hidden = type === 'true-false';
    fields.answer.required = type !== 'true-false';
    fields.answer.maxLength = type === 'fill' || type === 'calculation' ? 200 : 12000;
    const hints = {choice:'Nhập đúng một phương án ở trên.', calculation:'Nhập một số, ví dụ 3,5.', fill:'Nhập nội dung cần điền.'};
    form.querySelector('[data-answer-help]').textContent = hints[type] ?? 'Nhập đáp án mẫu để đối chiếu.';
    feedback.hidden = true;
  };
  fields.type.addEventListener('change', sync);
  sync();
  form.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); opener.focus(); }, {once:true});

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = new FormData(form);
    const get = name => values.get(name).trim();
    const type = get('type');
    const exercise = {
      id: uid(), lessonId:get('lessonId'), type, difficulty:get('difficulty'),
      prompt:get('prompt'), answer:get(type === 'true-false' ? 'binary' : 'answer'),
      hint:get('hint'), solution:get('solution'), explanation:get('explanation'), sample:false,
    };
    const submit = form.querySelector('[type="submit"]');
    feedback.hidden = true;
    try {
      if (![exercise.prompt, exercise.answer, exercise.hint, exercise.solution, exercise.explanation].every(Boolean)) {
        throw new Error('Hãy điền đầy đủ câu hỏi, đáp án, gợi ý và lời giải.');
      }
      if (type === 'choice') {
        exercise.options = get('options').split(/\r?\n/).map(option => option.trim()).filter(Boolean);
        const keys = exercise.options.map(option => normalize(option, false));
        if (keys.length < 2 || keys.length > 8 || new Set(keys).size !== keys.length) {
          throw new Error('Cần từ 2 đến 8 phương án khác nhau.');
        }
        const index = keys.indexOf(normalize(exercise.answer, false));
        if (index < 0) throw new Error('Đáp án phải trùng với một phương án.');
        exercise.answer = exercise.options[index];
      }
      if (type === 'calculation' && !Number.isFinite(numeric(exercise.answer))) {
        throw new Error('Đáp án của bài tính toán phải là một số hữu hạn.');
      }
      if ((type === 'fill' || type === 'calculation') && exercise.answer.length > 200) {
        throw new Error('Đáp án được giới hạn 200 ký tự.');
      }
      submit.disabled = true;
      await ctx.update(data => {
        if (!data.lessons.some(lesson => lesson.id === exercise.lessonId)) throw new Error('Bài học liên kết đã bị xóa.');
        data.exercises.push(exercise);
      });
      dialog.close();
      ctx.toast('Đã lưu bài luyện.');
      if (ctx.root.isConnected) ctx.go('practice', {lesson:exercise.lessonId, exercise:exercise.id});
    } catch (error) {
      feedback.textContent = error.message || 'Không thể lưu bài luyện.';
      feedback.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  ctx.root.append(dialog);
  dialog.showModal();
}

function paintPractice(ctx, result = null) {
  const { state, params } = ctx;
  const filters = {
    lesson: params.get('lesson') ?? '',
    type: params.get('type') ?? '',
    difficulty: params.get('difficulty') ?? '',
  };
  const exercises = state.exercises.filter((exercise) => (
    (!filters.lesson || exercise.lessonId === filters.lesson)
    && (!filters.type || exercise.type === filters.type)
    && (!filters.difficulty || exercise.difficulty === filters.difficulty)
  ));
  const exercise = exercises.find((item) => item.id === params.get('exercise')) ?? exercises[0];
  const lesson = exercise && state.lessons.find((item) => item.id === exercise.lessonId);
  const next = exercises[exercises.indexOf(exercise) + 1];
  const correct = exercises.filter((item) => state.progress.practice[item.id]?.correct > 0).length;
  ctx.root.innerHTML = `${pageHeader({
    title: 'Practice Lab',
    description: 'Luyện tập qua bảy dạng bài và xem phương pháp giải ngay sau khi trả lời.',
    icon: 'flask',
    actions: state.lessons.length
      ? `<button type="button" class="btn btn-primary" data-add-exercise>${icon('plus', 17)} Thêm bài luyện</button>`
      : '<a class="btn btn-secondary" href="#library">Tạo bài học để thêm bài luyện</a>',
  })}
    ${tabs(false)}
    <section class="panel study-filter-panel">${pageFilters(state.lessons, filters)}</section>
    ${exercise ? `<div class="workspace-grid study-workspace">
      ${practiceCard(exercise, lesson, result, next && practiceUrl({ ...filters, exercise: next.id }))}
      <aside class="panel stack study-panel study-queue">
        <div class="section-head"><h2>Danh sách bài tập</h2><span class="tag">${correct}/${exercises.length} đã giải</span></div>
        <div class="stack">${exercises.map((item) => exerciseRow(
          item, state.progress.practice[item.id], practiceUrl({ ...filters, exercise: item.id }), item.id === exercise.id,
        )).join('')}</div>
      </aside>
    </div>` : empty({
      title: 'Không tìm thấy bài tập',
      description: 'Thử đổi bài học, dạng bài hoặc mức độ khó.',
      icon: 'flask',
      action: '<a class="btn btn-secondary" href="#practice">Bỏ bộ lọc</a>',
    })}`;

  const add = ctx.root.querySelector('[data-add-exercise]');
  add?.addEventListener('click', () => openExerciseEditor(ctx, filters.lesson, add));
  const filterForm = ctx.root.querySelector('[data-practice-filters]');
  filterForm.addEventListener('change', () => ctx.go('practice', Object.fromEntries(new FormData(filterForm))));
  if (!exercise) return;

  const answerForm = ctx.root.querySelector('[data-practice-answer]');
  let isSaving = false;
  const saveAttempt = async (response, isCorrect) => {
    if (isSaving) return;
    isSaving = true;
    const buttons = [...ctx.root.querySelectorAll('[data-assess], [data-practice-answer] button')];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await ctx.update((data) => {
        if (!data.exercises.some((item) => item.id === exercise.id)) {
          throw new Error('Bài tập đã bị xóa.');
        }
        const prev = data.progress.practice[exercise.id] ?? {};
        const lastAt = new Date().toISOString();
        data.progress.practice[exercise.id] = {
          ...prev,
          lessonId: exercise.lessonId,
          attempts: (prev.attempts ?? 0) + 1,
          correct: (prev.correct ?? 0) + Number(isCorrect),
          wrong: (prev.wrong ?? 0) + Number(!isCorrect),
          lastCorrect: isCorrect,
          lastAnswer: response,
          lastAt,
          ...(!isCorrect ? {
            lastWrongAnswer: response,
            lastWrongAt: lastAt,
            mistakes: [...wrongAnswers(prev), { answer: response, at: lastAt }],
          } : {}),
        };
        recordActivity(data, {
          type: 'practice', id: exercise.id, lessonId: exercise.lessonId,
          subjectId: lesson?.subjectId, correct: isCorrect, at: lastAt,
        });
      });
      if (ctx.root.isConnected && ctx.root.querySelector('[data-practice-answer]') === answerForm) {
        paintPractice(ctx, { response, correct: isCorrect });
        ctx.root.querySelector('#practice-feedback-title')?.focus();
        if (!isCorrect) ctx.toast('Đã lưu câu trả lời vào Sổ tay lỗi sai.', 'info');
      }
    } catch {
      ctx.toast('Chưa lưu được kết quả. Hãy thử lại.', 'error');
    } finally {
      isSaving = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  };

  answerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (result) return;
    const response = String(new FormData(answerForm).get('response') ?? '');
    if (!response.trim()) {
      ctx.toast('Hãy nhập câu trả lời trước khi tiếp tục.', 'error');
      answerForm.querySelector('[name="response"]')?.focus();
      return;
    }
    const correct = gradeExercise(exercise, response);
    if (correct === null) {
      paintPractice(ctx, { response, correct });
      ctx.root.querySelector('#practice-feedback-title')?.focus();
    } else {
      void saveAttempt(response, correct);
    }
  });
  ctx.root.querySelectorAll('[data-assess]').forEach((button) => {
    button.addEventListener('click', () => void saveAttempt(result.response, button.dataset.assess === 'true'));
  });
  ctx.root.querySelector('[data-practice-retry]')?.addEventListener('click', () => {
    paintPractice(ctx);
    ctx.root.querySelector('[data-practice-answer] input, [data-practice-answer] textarea')?.focus();
  });
}

export function renderPractice(ctx) {
  if (ctx.params.get('tab') === 'mistakes') {
    renderMistakes(ctx);
  } else {
    paintPractice(ctx);
  }
}
