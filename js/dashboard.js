import {daysBack, dueCount, levelInfo, localDay, streakDays} from './gamification.js';
import {href} from './router.js';
import {skillStates} from './skilltree.js';
import {empty, esc, icon, number} from './ui.js';

const shortDay = new Intl.DateTimeFormat('vi-VN', {weekday:'short'});

function stat({title, value, description, symbol, color, link, progress}) {
  return `<article class="panel stat-card">
    <div class="stat-heading"><span class="tile-icon ${color}">${icon(symbol,20)}</span><span>${title}</span>${link ? `<a class="stat-link" href="${link}" aria-label="${title}">${icon('chevron-right',17)}</a>` : ''}</div>
    <strong class="stat-value">${value}</strong>
    <div class="stat-caption">${description}</div>
    ${progress == null ? '' : `<progress class="stat-progress" value="${progress}" max="100" aria-label="Tiến độ lên cấp"></progress>`}
  </article>`;
}

function activityChart(activity, now) {
  const dayCounts = new Map();
  for (const event of activity) {
    const date = localDay(event.at);
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
  }
  const days = Array.from({length:7}, (_, i) => {
    const date = daysBack(6 - i, now);
    return {label:shortDay.format(date).replace('Th ', 'T'), count:dayCounts.get(localDay(date)) ?? 0};
  });
  const step = Math.max(1, Math.ceil(Math.max(...days.map(day => day.count)) / 4));
  const scale = step * 4;
  const total = days.reduce((sum, item) => sum + item.count, 0);
  const ticks = Array.from({length:5}, (_, i) => {
    const y = 12 + i * 28;
    return `<text x="27" y="${y + 4}" text-anchor="end">${number(scale - step*i)}</text><line x1="39" y1="${y}" x2="620" y2="${y}"/>`;
  }).join('');
  const bars = days.map((day, i) => {
    const x = 80 + i * 83;
    const height = day.count / scale * 112;
    return `<g><title>${day.label}, ${day.count} hoạt động</title><rect x="${x-15}" y="${124-height}" width="30" height="${height}" rx="5" fill="url(#chart-bar)"/>
      ${day.count ? '' : `<path class="chart-zero" d="M${x-9} 123h18"/>`}<text x="${x}" y="148" text-anchor="middle">${day.label}</text></g>`;
  }).join('');
  return `<section class="panel dashboard-panel activity-panel">
    <div class="dashboard-section-head"><div><h2>Hoạt động học tập</h2><p>${total ? number(total) + ' hoạt động trong 7 ngày qua' : 'Hoạt động học sẽ xuất hiện tại đây'}</p></div><span class="tag time-tag">${icon('calendar',15)} 7 ngày qua</span></div>
    <svg class="activity-chart" viewBox="0 0 632 155" role="img" aria-label="${esc(days.map(day => day.label + ', ' + day.count + ' hoạt động').join('. '))}">
      <defs><linearGradient id="chart-bar" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox"><stop stop-color="#6640cd"/><stop offset="1" stop-color="#b19aff"/></linearGradient></defs>
      ${ticks}${bars}
    </svg>
  </section>`;
}

function dailyTasks(lesson, today) {
  const count = type => today.filter(event => event.type === type && (type !== 'practice' || event.correct)).length;
  const tasks = [
    ['book','violet','Hoàn thành một bài học','Đọc và tóm tắt kiến thức cốt lõi','lesson',lesson ? href('pareto',{id:lesson.id}) : '#library'],
    ['flask','blue','Giải đúng một bài tập','Vận dụng điều vừa học','practice','#practice'],
    ['cards','teal','Ôn một flashcard','Củng cố trí nhớ dài hạn','review','#srs']
  ];
  return `<section class="panel dashboard-panel task-panel">
    <div class="dashboard-section-head"><div><h2>Nhiệm vụ hôm nay</h2><p>${tasks.filter(task => count(task[4])).length}/3 nhiệm vụ hoàn thành</p></div><span class="panel-head-icon gold">${icon('target',20)}</span></div>
    <div class="task-list">${tasks.map(([symbol,color,title,description,type,link]) => {
      const done = Boolean(count(type));
      return `<a class="task-row" href="${link}"><span class="tile-icon ${color}">${icon(symbol,17)}</span><span class="task-copy"><strong>${title}</strong><small>${description}</small></span>
        <span class="task-check ${done ? 'is-done' : ''}" aria-label="${done ? 'Đã hoàn thành' : 'Chưa hoàn thành'}">${done ? icon('check',15) : ''}</span></a>`;
    }).join('')}</div>
  </section>`;
}

function continuePanel(state, lesson) {
  const completed = state.lessons.filter(item => state.progress.lessons[item.id]?.completedAt).length;
  return `<section class="panel dashboard-panel">
    <div class="dashboard-section-head"><div><h2>Kiến thức đang học</h2><p>${number(completed)}/${number(state.lessons.length)} bài học hoàn thành</p></div><a class="text-link" href="#library">Thư viện ${icon('chevron-right',16)}</a></div>
    ${lesson ? `<a class="continue-row" href="${href('pareto',{id:lesson.id})}"><span class="tile-icon violet">${icon('code',23)}</span>
      <span><small>${esc(lesson.topic)}${lesson.sample ? ' · Dữ liệu mẫu' : ''}</small><strong>${esc(lesson.title)}</strong><small>${icon('clock',13)} ${number(lesson.minutes)} phút dự kiến</small></span>
      <span class="continue-arrow">${icon('arrow-right',19)}</span></a>` : empty({title:'Chưa có bài học',description:'Thêm bài học đầu tiên trong thư viện.',icon:'book'})}
  </section>`;
}

function skillsPanel(state) {
  const skills = state.skills.slice(0, 4);
  const states = skillStates(state);
  const positions = new Map(skills.map((skill, index) => [skill.id, 50 + index * 100]));
  const edges = skills.flatMap(skill => skill.prerequisiteIds.filter(id => positions.has(id)).map(id => {
    const from = positions.get(id);
    const to = positions.get(skill.id);
    const distance = Math.abs(from - to);
    const curve = distance > 110 ? 2 : 21;
    return `M${from} 21 Q${(from + to) / 2} ${curve} ${to} 21`;
  }));
  const labels = {locked:'Chưa mở khóa', available:'Có thể học', learning:'Đang học', completed:'Đã hoàn thành', mastered:'Đã thành thạo'};
  return `<section class="panel dashboard-panel skills-panel">
    <div class="dashboard-section-head"><div><h2>Cây kỹ năng</h2><p>${number([...states.values()].filter(status => ['completed','mastered'].includes(status)).length)}/${number(state.skills.length)} kỹ năng đã hoàn thành</p></div><a class="text-link" href="#skilltree">Mở cây ${icon('chevron-right',16)}</a></div>
    ${skills.length ? `<div class="mini-skills"><svg viewBox="0 0 400 43" preserveAspectRatio="none" aria-hidden="true"><path d="${edges.join(' ')}" fill="none" stroke="currentColor" stroke-dasharray="3 4"/></svg>${skills.map(skill => {
      const status = states.get(skill.id);
      const symbol = status === 'locked' ? 'lock' : ['completed','mastered'].includes(status) ? 'check' : 'code';
      return `<a class="mini-skill ${status}" href="${href('skilltree',{id:skill.id})}" aria-label="${esc(skill.title)} · ${labels[status]}"><span>${icon(symbol,19)}</span><small>${esc(skill.title)}</small></a>`;
    }).join('')}</div>` : empty({title:'Chưa có kỹ năng',icon:'tree'})}
  </section>`;
}

export function renderDashboard({root, state}) {
  const now = new Date();
  const today = state.activity.filter(event => localDay(event.at) === localDay(now));
  const level = levelInfo(state.activity);
  const streak = streakDays(state.activity, now);
  const due = dueCount(state, now.getTime());
  const last = state.lessons.find(item => item.id === state.lastLessonId);
  const next = (last && !state.progress.lessons[last.id]?.completedAt ? last : null) ??
    state.lessons.find(item => !state.progress.lessons[item.id]?.completedAt);
  const lessonLink = next ? href('pareto',{id:next.id}) : '#library';
  const date = new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long'}).format(now);
  const dayLabel = date.charAt(0).toLocaleUpperCase('vi-VN') + date.slice(1);
  root.innerHTML = `<div class="dashboard">
    <div class="dashboard-heading"><div><p>Hành trình học tập của bạn</p><h1>Tổng quan</h1></div><span class="dashboard-date">${icon('calendar',17)} ${esc(dayLabel)}</span></div>
    <section class="hero">
      <div class="hero-copy"><div class="hero-kicker">${icon('sparkles',17)} SECOND BRAIN FOR A BETTER YOU</div>
        <h2>Chào, ${esc(state.profile.name)}!</h2>
        <p>${state.profile.goal ? esc(state.profile.goal) : 'Hiểu sâu, nhớ lâu và vận dụng kiến thức qua từng buổi học.'}</p>
        <a class="btn btn-primary hero-action" href="${lessonLink}">${icon('play',17)} ${next ? last?.id === next.id ? 'Tiếp tục học' : 'Bắt đầu học' : 'Mở thư viện'} ${icon('arrow-right',17)}</a>
      </div>
    </section>
    <div class="metric-grid">
      ${stat({title:'Cấp độ',value:'Level ' + level.level,description:number(level.earned) + ' / ' + number(level.required) + ' EXP lên cấp',symbol:'sparkles',color:'violet',progress:level.percentage})}
      ${stat({title:'Tổng kinh nghiệm',value:number(level.total) + ' EXP',description:'Tích lũy từ hoạt động học',symbol:'bolt',color:'gold'})}
      ${stat({title:'Chuỗi ngày học',value:number(streak) + ' ngày',description:streak ? 'Các ngày học liên tiếp' : 'Hoàn thành hoạt động đầu tiên',symbol:'flame',color:'rose'})}
      ${stat({title:'Flashcard cần ôn',value:number(due) + ' thẻ',description:due ? 'Đã đến lịch ôn tập' : 'Bạn đã ôn hết thẻ đến hạn',symbol:'cards',color:'blue',link:'#srs'})}
    </div>
    <div class="dashboard-grid">${activityChart(state.activity, now)}${dailyTasks(next,today)}${continuePanel(state,next ?? last)}${skillsPanel(state)}</div>
    <section class="panel dashboard-panel goal-panel">
      <div class="section-head"><span class="tile-icon teal">${icon('target',19)}</span><div><h2>Mục tiêu hiện tại</h2><p>${state.profile.goal ? esc(state.profile.goal) : 'Đặt mục tiêu cho hành trình học của bạn.'}</p></div></div>
      <div class="goal-progress"><span>${number(today.length)}/${number(state.profile.dailyGoal)} hoạt động hôm nay</span><progress value="${Math.min(today.length,state.profile.dailyGoal)}" max="${state.profile.dailyGoal}" aria-label="Mục tiêu hoạt động hôm nay"></progress></div>
      <a href="#settings" class="btn btn-secondary">${icon('edit',16)} Chỉnh mục tiêu</a>
    </section>
  </div>`;
}
