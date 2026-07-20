// Общие утилиты для всех страниц PWA «Мем-машина»

function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = 'none'; }, ms);
}

function fitFont(candidates) {
  // Возвращает первый доступный шрифт из списка через document.fonts.check,
  // с фолбэком на дефолтный набор, если API недоступен.
  if (!window.queueMicrotask) return candidates[candidates.length - 1];
  return candidates[0];
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// --- Общее хранилище очереди постов и трофеев (IndexedDB, без внешних сервисов) ---
const MM_DB_NAME = 'mem-mashina';
const MM_DB_VERSION = 1;

function mmOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MM_DB_NAME, MM_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('trophies')) {
        db.createObjectStore('trophies', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mmAdd(storeName, entry) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mmGetAll(storeName) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mmDelete(storeName, id) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function mmClearStore(storeName) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function mmBlobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function mmDataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// --- Бэкап/восстановление одной кнопкой (localStorage целиком + IndexedDB) ---
async function mmBuildBackup() {
  const lsSnapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    lsSnapshot[k] = localStorage.getItem(k);
  }
  const queueItems = await mmGetAll('queue');
  const queueSerialized = [];
  for (const it of queueItems) {
    const { blob, ...rest } = it;
    queueSerialized.push({ ...rest, blobDataUrl: await mmBlobToDataUrl(blob) });
  }
  const trophyItems = await mmGetAll('trophies');
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage: lsSnapshot,
    queue: queueSerialized,
    trophies: trophyItems
  };
}

async function mmRestoreBackup(data) {
  if (data.localStorage) {
    Object.entries(data.localStorage).forEach(([k, v]) => {
      try { localStorage.setItem(k, v); } catch (e) { console.warn('Не удалось восстановить ключ', k, e); }
    });
  }
  await mmClearStore('queue');
  for (const it of data.queue || []) {
    const { id, blobDataUrl, ...rest } = it;
    const blob = await mmDataUrlToBlob(blobDataUrl);
    await mmAdd('queue', { ...rest, blob });
  }
  await mmClearStore('trophies');
  for (const it of data.trophies || []) {
    const { id, ...rest } = it;
    await mmAdd('trophies', rest);
  }
}

function mmInitBackupUI() {
  const backupBtn = document.getElementById('backupBtn');
  const restoreInput = document.getElementById('restoreInput');
  if (!backupBtn || !restoreInput) return;

  backupBtn.addEventListener('click', async () => {
    const data = await mmBuildBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'mem-mashina-backup-' + Date.now() + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    toast('Бэкап сохранён');
  });

  restoreInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await mmRestoreBackup(data);
      toast('Восстановлено — перезагружаю страницу...');
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      console.warn('Ошибка восстановления', err);
      toast('Не удалось прочитать файл бэкапа');
    }
    restoreInput.value = '';
  });

  const HINT_KEY = 'mm_backup_hint_shown';
  if (!localStorage.getItem(HINT_KEY)) {
    localStorage.setItem(HINT_KEY, '1');
    setTimeout(() => toast('Делай бэкап раз в неделю (кнопка 💾) — очистка кэша браузера стирает данные', 6000), 1500);
  }
}

window.addEventListener('DOMContentLoaded', mmInitBackupUI);
if (document.readyState !== 'loading') mmInitBackupUI();
