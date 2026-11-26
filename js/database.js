const DB_NAME = 'dz-knowledge-hub';
const STORE = 'documents';
const KEY = 'learning-state';
const DB_VERSION = 1;
const DATA_VERSION = 1;
const collections = ['subjects', 'lessons', 'exercises', 'flashcards', 'skills', 'achievements'];
let connection;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Hãy đóng các tab Dz Hub cũ rồi tải lại trang.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); connection = undefined; };
      resolve(db);
    };
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

export async function readState() {
  const db = await openDatabase();
  return requestResult(db.transaction(STORE).objectStore(STORE).get(KEY));
}

// Read and change the latest state in one IndexedDB transaction across all tabs.
async function transact(mutator) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const request = store.get(KEY);
    let updated;
    let failure;
    request.onsuccess = () => {
      try {
        updated = mutator(request.result);
        store.put(updated, KEY);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(updated);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Không thể lưu dữ liệu.'));
  });
}

export async function sampleState() {
  const parts = await Promise.all(collections.map(async key => {
    const response = await fetch(new URL('../data/' + key + '.json', import.meta.url));
    if (!response.ok) throw new Error('Không tải được dữ liệu mẫu ' + key + '.');
    return [key, await response.json()];
  }));
  return {
    version: DATA_VERSION, ...Object.fromEntries(parts),
    progress: {lessons:{}, practice:{}, recall:{}, reviews:{}},
    profile: {name:'Lữ khách', goal:'', dailyGoal:3}, activity: [], lastLessonId: null
  };
}

export async function initState() {
  const saved = await readState();
  if (saved) {
    if (saved.version !== DATA_VERSION) throw new Error('Cần phiên bản Dz Hub tương thích để mở dữ liệu này.');
    return saved;
  }
  const sample = await sampleState();
  validateState(sample);
  return transact(existing => existing ?? sample);
}

export function updateState(mutator) {
  return transact(state => {
    if (state?.version !== DATA_VERSION) throw new Error('Kho dữ liệu chưa sẵn sàng.');
    if (mutator(state)?.then) throw new Error('Thao tác lưu cần được thực hiện đồng bộ.');
    return state;
  });
}

export function replaceState(state) {
  validateState(state);
  return transact(() => state);
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string';
const filled = value => text(value) && value.trim().length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const date = value => filled(value) && Number.isFinite(Date.parse(value));
const id = value => filled(value) && value.length <= 200 && /^[\w.-]+$/.test(value) &&
  !Object.hasOwn(Object.prototype, value) && value !== 'prototype';
const items = (value, check) => Array.isArray(value) && value.every(check);
const optional = (value, check) => value == null || check(value);

function assert(condition, location) {
  if (!condition) throw new Error('Dữ liệu không hợp lệ tại ' + location + '.');
}

function list(state, key, check) {
  const entries = state[key];
  assert(Array.isArray(entries), key);
  const ids = new Set();
  entries.forEach((item, i) => {
    assert(object(item) && id(item.id) && !ids.has(item.id) && check(item), key + '[' + i + ']');
    ids.add(item.id);
  });
  return ids;
}

function references(value, ids) {
  return items(value, item => ids.has(item));
}

function records(value, ids, check, name) {
  assert(object(value), name);
  for (const [key, item] of Object.entries(value)) {
    assert(ids.has(key) && object(item) && check(item), name + '.' + key);
  }
}

const sectionKeys = ['objective','core','simple','formulas','examples','method','mistakes','summary','quiz','application'];
const exerciseTypes = ['choice','true-false','fill','essay','calculation','code','scenario'];
const difficulties = ['beginner','easy','normal','hard','expert'];
const eventTypes = ['lesson','practice','recall','review','feynman','topic','mastery','project'];
const stringFields = (item, keys) => keys.every(key => text(item[key]));
const attempt = item => natural(item.attempts) && item.attempts > 0 && natural(item.correct) && natural(item.wrong) &&
  item.attempts === item.correct + item.wrong && typeof item.lastCorrect === 'boolean' && date(item.lastAt) &&
  optional(item.lastAnswer, text) && optional(item.lastWrongAnswer, text) && optional(item.lastWrongAt, date) &&
  optional(item.mistakes, value => items(value, mistake => object(mistake) && text(mistake.answer) && date(mistake.at)));

function attachment(item) {
  return object(item) && id(item.id) && filled(item.name) && text(item.type) && text(item.data) &&
    item.data.length <= 4200000 && /^data:[a-z\d!#$&.+\-^_]+\/[a-z\d!#$&.+\-^_]+;base64,[A-Za-z0-9+/]*={0,2}$/i.test(item.data);
}

function assertAcyclic(skills) {
  const waiting = new Map(skills.map(skill => [skill.id, skill.prerequisiteIds.length]));
  const dependents = new Map(skills.map(skill => [skill.id, []]));
  for (const skill of skills) {
    for (const required of skill.prerequisiteIds) dependents.get(required).push(skill.id);
  }
  const ready = skills.filter(skill => !waiting.get(skill.id)).map(skill => skill.id);
  for (const key of ready) {
    for (const dependent of dependents.get(key)) {
      const remaining = waiting.get(dependent) - 1;
      waiting.set(dependent, remaining);
      if (!remaining) ready.push(dependent);
    }
  }
  assert(ready.length === skills.length, 'quan hệ tiên quyết của cây kỹ năng');
}

export function validateState(state) {
  assert(object(state) && state.version === DATA_VERSION, 'phiên bản dữ liệu');
  const subjects = list(state, 'subjects', item => filled(item.name) && optional(item.description, text) && optional(item.icon, text));
  const lessons = list(state, 'lessons', item => subjects.has(item.subjectId) && filled(item.title) &&
    filled(item.topic) && filled(item.chapter) && stringFields(item, ['knowledge','summary']) &&
    natural(item.minutes) && items(item.tags, filled) && object(item.sections) &&
    stringFields(item.sections, sectionKeys) && items(item.attachments, attachment) && item.attachments.length <= 5);
  for (const lesson of state.lessons) assert(references(lesson.relatedIds, lessons), 'bài học liên kết');
  const exercises = list(state, 'exercises', item => lessons.has(item.lessonId) &&
    exerciseTypes.includes(item.type) && difficulties.includes(item.difficulty) &&
    filled(item.prompt) && filled(item.answer) && stringFields(item, ['hint','solution','explanation']) &&
    (item.type !== 'choice' || (items(item.options, filled) && item.options.includes(item.answer))) &&
    optional(item.acceptedAnswers, value => items(value, filled)) &&
    optional(item.tolerance, value => finite(value) && value >= 0) &&
    optional(item.caseSensitive, value => typeof value === 'boolean') && optional(item.starterCode, text));
  const cards = list(state, 'flashcards', item => !exercises.has(item.id) && lessons.has(item.lessonId) &&
    filled(item.question) && filled(item.answer) && text(item.example));
  const skills = list(state, 'skills', item => filled(item.title) && text(item.description) && filled(item.branch) &&
    references(item.lessonIds, lessons) && finite(item.x) && finite(item.y) && Math.abs(item.x) <= 100000 && Math.abs(item.y) <= 100000);
  for (const skill of state.skills) {
    assert(references(skill.prerequisiteIds, skills) && new Set(skill.prerequisiteIds).size === skill.prerequisiteIds.length, 'kỹ năng tiên quyết');
  }
  assertAcyclic(state.skills);
  list(state, 'achievements', item => filled(item.title) && text(item.description));
  assert(object(state.profile) && filled(state.profile.name) && state.profile.name.length <= 40 &&
    text(state.profile.goal) && state.profile.goal.length <= 180 &&
    natural(state.profile.dailyGoal) && state.profile.dailyGoal >= 1 && state.profile.dailyGoal <= 30, 'hồ sơ');
  assert(optional(state.lastLessonId, key => lessons.has(key)), 'bài học gần đây');
  assert(object(state.progress), 'tiến độ');
  records(state.progress.lessons, lessons, item => Boolean(item.startedAt || item.completedAt) &&
    optional(item.startedAt, date) && optional(item.completedAt, date), 'tiến độ bài học');
  records(state.progress.practice, exercises, attempt, 'tiến độ bài tập');
  records(state.progress.recall, new Set([...exercises, ...cards]), attempt, 'tiến độ Active Recall');
  records(state.progress.reviews, cards, item => date(item.dueAt) && date(item.lastAt) &&
    finite(item.interval) && item.interval > 0 && finite(item.ease) && item.ease >= 1.3 &&
    natural(item.repetitions) && natural(item.correct) && natural(item.wrong), 'tiến độ flashcard');
  const awards = new Set();
  list(state, 'activity', event => {
    const valid = eventTypes.includes(event.type) && id(event.entityId) && optional(event.lessonId, id) &&
      optional(event.subjectId, id) && date(event.at) && natural(event.xp) && event.xp <= 500 &&
      natural(event.seconds) && optional(event.correct, value => typeof value === 'boolean') &&
      (event.xp ? filled(event.awardKey) && !awards.has(event.awardKey) : event.awardKey == null);
    if (valid && event.xp) awards.add(event.awardKey);
    return valid;
  });
  return state;
}

export function makeBackup(state, theme) {
  return {app:'Dz-Knowledge Hub', schemaVersion:DATA_VERSION, exportedAt:new Date().toISOString(), theme, data:state};
}

export function parseBackup(source) {
  const backup = JSON.parse(source.replace(/^\uFEFF/, ''));
  assert(object(backup) && backup.app === 'Dz-Knowledge Hub' && backup.schemaVersion === DATA_VERSION && date(backup.exportedAt), 'định dạng bản sao lưu');
  assert(['light', 'dark'].includes(backup.theme), 'giao diện');
  return {...backup, data:validateState(backup.data)};
}
