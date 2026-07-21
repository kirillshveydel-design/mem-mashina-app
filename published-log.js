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

// entry: {type: 'caption'|'topic'|'pileon', text_top, text_bottom, text, niche}
function mmPublishedAdd(entry) {
  const list = mmPublishedAll();
  list.push({
    id: Date.now() + Math.random(),
    date_published: new Date().toISOString().slice(0, 10),
    ...entry
  });
  mmPublishedSaveAll(list);
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
