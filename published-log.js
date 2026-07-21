// Лог опубликованного — простое хранилище в localStorage.
// Используется генераторами (captions.js, notes.js, video.js), чтобы никогда
// повторно не предлагать уже вышедшую подпись/тему/pile-on концепцию.
const MM_PUBLISHED_KEY = 'mm_published_log_v1';

function mmPublishedAll() {
  try {
    return JSON.parse(localStorage.getItem(MM_PUBLISHED_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function mmPublishedSaveAll(list) {
  localStorage.setItem(MM_PUBLISHED_KEY, JSON.stringify(list));
}

// entry: {type: 'caption'|'topic'|'pileon', text_top, text_bottom, text, niche,
//         slot, topic, format, likes, comments, reposts, note}
// likes/comments/reposts/note опциональны — заполняются позже, когда появится статистика.
function mmPublishedAdd(entry) {
  const list = mmPublishedAll();
  const id = Date.now() + Math.random();
  list.push({
    id,
    date_published: new Date().toISOString().slice(0, 10),
    likes: null, comments: null, reposts: null, note: null,
    ...entry
  });
  mmPublishedSaveAll(list);
  return id;
}

function mmPublishedUpdate(id, patch) {
  const list = mmPublishedAll();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], ...patch };
  mmPublishedSaveAll(list);
  return true;
}

function mmPublishedGet(id) {
  return mmPublishedAll().find(e => e.id === id) || null;
}

// CSV для /scorecard: date,slot,topic,format,likes,comments,reposts,notes —
// только записи, где есть хотя бы одно число результата.
function mmPublishedExportCsv() {
  const rows = mmPublishedAll().filter(e => e.likes != null || e.comments != null || e.reposts != null);
  const header = 'date,slot,topic,format,likes,comments,reposts,notes';
  const csvEscape = v => {
    const s = (v == null ? '' : String(v));
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = rows.map(e => [
    e.date_published || '',
    e.slot || '',
    e.topic || (e.text_top ? `${e.text_top} / ${e.text_bottom}` : (e.text || '')),
    e.format || e.type || '',
    e.likes != null ? e.likes : '',
    e.comments != null ? e.comments : '',
    e.reposts != null ? e.reposts : '',
    e.note || ''
  ].map(csvEscape).join(','));
  return [header, ...lines].join('\n');
}

function mmPublishedHasCaption(top, bottom) {
  return mmPublishedAll().some(e => e.type === 'caption' && e.text_top === top && e.text_bottom === bottom);
}

function mmPublishedHasTopic(text) {
  return mmPublishedAll().some(e => e.type === 'topic' && e.text === text);
}

function mmPublishedHasPileon(eventText) {
  return mmPublishedAll().some(e => e.type === 'pileon' && e.text === eventText);
}

function mmPublishedCount() {
  return mmPublishedAll().length;
}
