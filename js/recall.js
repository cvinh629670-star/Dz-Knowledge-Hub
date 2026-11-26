import { recordActivity } from './gamification.js';
import { empty, esc, icon, pageHeader } from './ui.js';

function topicKey(lesson) {
  return JSON.stringify([lesson.subjectId, lesson.topic]);
}

function questionsFor(state) {
  const lessons = new Map(state.lessons.map((lesson) => [lesson.id, lesson]));
  const cards = state.flashcards.map((card) => ({
    id: card.id, lesson: lessons.get(card.lessonId), prompt: card.question,
    answer: card.answer, example: card.example, sample: card.sample,
  }));
  const exercises = state.exercises.map((exercise) => ({
    id: exercise.id, lesson: lessons.get(exercise.lessonId), prompt: exercise.prompt,
    answer: exercise.answer, example: exercise.solution, sample: exercise.sample,
    starterCode: exercise.starterCode,
  }));
  return [...cards, ...exercises].filter(({ lesson }) => lesson);
}

function recallStats(state, questions) {
  return questions.reduce((stats, question) => {
    const progress = state.progress.recall[question.id];
    stats.attempts += progress?.attempts ?? 0;
    stats.correct += progress?.correct ?? 0;
    stats.weak += Number(progress?.lastCorrect === false);
    return stats;
  }, { attempts: 0, correct: 0, weak: 0 });
}

function lessonEvidence(state) {
  const evidence = new Map();
  for (const exercise of state.exercises) {
    const result = state.progress.practice[exercise.id];
    if (!result?.attempts) continue;
    const total = evidence.get(exercise.lessonId) ?? { correct: 0, attempts: 0 };
    total.correct += result.correct;
    total.attempts += result.attempts;
    evidence.set(exercise.lessonId, total);
  }
  return evidence;
}

function orderedQuestions(state, questions) {
  const evidence = lessonEvidence(state);
  function priority(question) {
    const result = state.progress.recall[question.id];
    if (result?.lastCorrect === false) return result.correct / result.attempts;
    const practice = state.progress.practice[question.id] ?? evidence.get(question.lesson.id);
    if (!result?.attempts && practice?.attempts && practice.correct < practice.attempts) {
      return 1 + practice.correct / practice.attempts;
    }
    if (!result?.attempts) return 2;
    return 3 + result.correct / result.attempts;
  }
  return [...questions].sort((first, second) => priority(first) - priority(second));
}

function metric(label, value, symbol) {
  return `<div class="study-metric"><span class="study-metric-icon">${icon(symbol)}</span>
    <div><small class="muted">${label}</small><strong>${value}</strong></div></div>`;
}

function historyPanel(state, questions) {
  const stats = recallStats(state, questions);
  const accuracy = stats.attempts ? `${Math.round(100 * stats.correct / stats.attempts)}%` : '—';
  return `<aside class="panel stack study-panel">
    <h2>Kết quả tự kiểm tra</h2>
    ${metric('Tỷ lệ trả lời đúng', accuracy, 'target')}
    ${metric('Lượt tự đánh giá', stats.attempts, 'brain')}
    ${metric('Câu cần nhớ lại', stats.weak, 'clock')}
  </aside>`;
}

function setup(ctx, questions) {
  const subjects = new Map(ctx.state.subjects.map((subject) => [subject.id, subject.name]));
  const topics = new Map(questions.map(({ lesson }) => [
    topicKey(lesson), `${subjects.get(lesson.subjectId) ?? ''} · ${lesson.topic}`,
  ]));
  const routedLesson = ctx.state.lessons.find((lesson) => lesson.id === ctx.params.get('lesson'));
  const initialTopic = routedLesson ? topicKey(routedLesson) : '';
  return `<section class="panel stack study-panel">
    <div class="study-prompt"><h2>Tạo bài tự kiểm tra</h2>
      <p class="muted">Viết câu trả lời từ trí nhớ, sau đó mở đáp án và tự đánh giá. Câu bạn từng trả lời sai sẽ được đưa lên trước.</p>
    </div>
    <form class="stack" data-recall-setup>
      <div class="form-grid">
        <label class="field"><span>Chủ đề</span><select name="topic"><option value="">Tất cả chủ đề</option>
          ${[...topics].map(([value, label]) => `<option value="${esc(value)}" ${value === initialTopic ? 'selected' : ''}>${esc(label)}</option>`).join('')}
        </select></label>
        <label class="field"><span>Số câu tối đa</span><select name="count">
          <option value="5">5 câu</option><option value="10">10 câu</option><option value="all">Toàn bộ câu hỏi</option>
        </select></label>
      </div>
      <div class="study-actions"><button type="submit" class="btn btn-primary">${icon('play')} Bắt đầu kiểm tra</button></div>
    </form>
  </section>`;
}

function activeQuestion(session) {
  const question = session.questions[session.results.length];
  const response = session.response ?? '';
  const revealed = session.response !== null;
  const total = session.questions.length;
  const done = session.results.length;
  return `<section class="panel stack study-panel" aria-labelledby="recall-question-title">
    <div class="section-head"><span class="tag">Câu ${done + 1}/${total}</span>
      ${question.sample ? '<span class="tag">Dữ liệu mẫu</span>' : ''}
    </div>
    <progress class="study-progress" max="${total}" value="${done}" aria-label="Số câu đã tự đánh giá"></progress>
    <div class="study-prompt">
      <p class="muted">${esc(question.lesson.title)}</p>
      <h2 id="recall-question-title" tabindex="-1">${esc(question.prompt)}</h2>
      ${question.starterCode ? `<pre class="study-answer">${esc(question.starterCode)}</pre>` : ''}
    </div>
    <form class="stack" data-recall-response>
      <label class="field"><span>Câu trả lời từ trí nhớ</span>
        <textarea name="response" rows="5" maxlength="12000" required ${revealed ? 'readonly' : ''}>${esc(response)}</textarea>
      </label>
      ${revealed ? '' : '<div class="study-actions"><button type="submit" class="btn btn-primary">Mở đáp án</button></div>'}
    </form>
    ${revealed ? `<section class="study-feedback" aria-labelledby="recall-feedback-title">
      <h3 id="recall-feedback-title" tabindex="-1">Đáp án tham khảo</h3>
      <pre class="study-answer">${esc(question.answer)}</pre>
      ${question.example ? `<p>${esc(question.example)}</p>` : ''}
      <div class="study-actions">
        <button type="button" class="btn btn-primary" data-recall-assess="true">Tôi nhớ đúng</button>
        <button type="button" class="btn btn-secondary" data-recall-assess="false">Tôi cần ôn lại</button>
      </div>
    </section>` : ''}
    <div class="study-actions"><button class="btn btn-secondary" type="button" data-recall-reset>Thoát bài kiểm tra</button></div>
  </section>`;
}

function summary(session) {
  const total = session.results.length;
  const correct = session.results.filter((result) => result.correct).length;
  const accuracy = Math.round(100 * correct / total);
  return `<section class="panel stack study-panel" aria-labelledby="recall-summary-title">
    <div class="study-prompt">
      <span class="tag">Đã hoàn thành</span>
      <h2 id="recall-summary-title" tabindex="-1">Kết quả bài tự kiểm tra</h2>
      <p class="muted">Bạn tự đánh giá đúng ${correct}/${total} câu · ${accuracy}%</p>
    </div>
    ${session.results.some((result) => !result.correct) ? `<div class="stack">
      <h3>Câu cần nhớ lại</h3>
      <ul class="study-summary-list">${session.results.filter((result) => !result.correct).map(({ question }) => `<li>${esc(question.prompt)}</li>`).join('')}</ul>
    </div>` : ''}
    <div class="study-actions">
      <button type="button" class="btn btn-primary" data-recall-reset>Tạo bài kiểm tra mới</button>
      <a class="btn btn-secondary" href="#srs">Ôn flashcard ${icon('arrow-right')}</a>
    </div>
  </section>`;
}

function paintRecall(ctx, session = null) {
  const questions = questionsFor(ctx.state);
  const finished = session && session.results.length === session.questions.length;
  ctx.root.innerHTML = `${pageHeader({
    title: 'Active Recall',
    description: 'Chủ động gọi lại kiến thức trước khi nhìn đáp án.',
    icon: 'brain',
  })}
    ${questions.length ? `<div class="workspace-grid study-workspace">
      ${session ? (finished ? summary(session) : activeQuestion(session)) : setup(ctx, questions)}
      ${historyPanel(ctx.state, questions)}
    </div>` : empty({
      title: 'Chưa có câu hỏi tự kiểm tra',
      description: 'Câu hỏi được lấy từ bài tập và flashcard của bạn.',
      icon: 'brain',
      action: '<a class="btn btn-primary" href="#srs?tab=deck&new=1">Tạo flashcard</a>',
    })}`;

  const setupForm = ctx.root.querySelector('[data-recall-setup]');
  const answerForm = ctx.root.querySelector('[data-recall-response]');
  ctx.root.querySelector('[data-recall-reset]')?.addEventListener('click', () => {
    paintRecall(ctx);
    ctx.root.querySelector('[data-recall-setup] select')?.focus();
  });
  setupForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = new FormData(setupForm);
    const topic = values.get('topic');
    const count = values.get('count');
    const available = orderedQuestions(ctx.state, questions.filter(({ lesson }) => !topic || topicKey(lesson) === topic));
    if (!available.length) {
      ctx.toast('Chủ đề này chưa có câu hỏi.', 'error');
      return;
    }
    paintRecall(ctx, { questions: count === 'all' ? available : available.slice(0, Number(count)), results: [], response: null });
    ctx.root.querySelector('#recall-question-title')?.focus();
  });
  answerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (session.response !== null) return;
    const response = String(new FormData(answerForm).get('response') ?? '').trim();
    if (!response) {
      ctx.toast('Hãy nhập câu trả lời trước khi mở đáp án.', 'error');
      answerForm.elements.response.focus();
      return;
    }
    paintRecall(ctx, { ...session, response });
    ctx.root.querySelector('#recall-feedback-title')?.focus();
  });
  const assessButtons = [...ctx.root.querySelectorAll('[data-recall-assess]')];
  let saving = false;
  for (const button of assessButtons) {
    button.addEventListener('click', async () => {
      if (saving) return;
      saving = true;
      assessButtons.forEach((item) => { item.disabled = true; });
      const correct = button.dataset.recallAssess === 'true';
      const question = session.questions[session.results.length];
      try {
        await ctx.update((data) => {
          const exists = [...data.flashcards, ...data.exercises].some((item) => item.id === question.id);
          if (!exists) throw new Error('Câu hỏi đã bị xóa.');
          const prev = data.progress.recall[question.id] ?? {};
          const lastAt = new Date().toISOString();
          data.progress.recall[question.id] = {
            ...prev,
            lessonId: question.lesson.id,
            attempts: (prev.attempts ?? 0) + 1,
            correct: (prev.correct ?? 0) + Number(correct),
            wrong: (prev.wrong ?? 0) + Number(!correct),
            lastCorrect: correct,
            lastAnswer: session.response,
            lastAt,
          };
          recordActivity(data, {
            type: 'recall', id: question.id, lessonId: question.lesson.id,
            subjectId: question.lesson.subjectId, correct, at: lastAt,
          });
        });
        if (ctx.root.isConnected && ctx.root.querySelector('[data-recall-response]') === answerForm) {
          paintRecall(ctx, { ...session, results: [...session.results, { question, correct }], response: null });
          ctx.root.querySelector('#recall-question-title, #recall-summary-title')?.focus();
        }
      } catch {
        ctx.toast('Chưa lưu được đánh giá. Hãy thử lại.', 'error');
      } finally {
        saving = false;
        assessButtons.forEach((item) => { item.disabled = false; });
      }
    });
  }
}

export function renderRecall(ctx) {
  paintRecall(ctx);
}
