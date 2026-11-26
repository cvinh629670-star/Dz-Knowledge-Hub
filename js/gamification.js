import {uid} from './ui.js';

const XP = {lesson:20, practice:10, review:5, feynman:30, topic:100, mastery:200, project:500};

export function localDay(stamp = Date.now()) {
  const date = new Date(stamp);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function recordActivity(data, {type, id, lessonId, subjectId, correct, awardKey, seconds, at = new Date().toISOString()}) {
  const quantity = type === 'practice' && !correct ? 0 : (XP[type] ?? 0);
  const key = awardKey ?? (type === 'review' ? `review:${id}:${localDay(at)}` : `${type}:${id}`);
  const xp = quantity && !data.activity.some(event => event.awardKey === key) ? quantity : 0;
  data.activity.push({id:uid(), type, entityId:id, lessonId:lessonId ?? (type === 'lesson' ? id : null), subjectId:subjectId ?? null,
    correct:correct ?? null, xp, awardKey:xp ? key : null, seconds:Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0, at});
}

export function levelInfo(activity) {
  const total = activity.reduce((sum, event) => sum + (event.xp || 0), 0);
  let level = 1;
  let earned = total;
  let required = 100;
  while (earned >= required) {
    earned -= required;
    level += 1;
    required = Math.ceil(100 * level ** 1.5);
  }
  return {total, level, earned, required, percentage:Math.floor(earned / required * 100)};
}

export function daysBack(count, date = new Date()) {
  const result = new Date(date);
  result.setDate(result.getDate() - count);
  return result;
}

export function streakDays(activity, now = new Date()) {
  const days = new Set(activity.map(event => localDay(event.at)));
  let offset = days.has(localDay(now)) ? 0 : 1;
  const first = offset;
  while (days.has(localDay(daysBack(offset, now)))) offset += 1;
  return offset - first;
}

export function dueCount(data, now = Date.now()) {
  return data.flashcards.filter(card => {
    const review = data.progress.reviews[card.id];
    return !review?.dueAt || new Date(review.dueAt).getTime() <= now;
  }).length;
}
