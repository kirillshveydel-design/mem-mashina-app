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

function mmShowUpdateBanner() {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = 'Доступно обновление, нажмите чтобы применить ↻';
  span.style.cursor = 'pointer';
  span.addEventListener('click', mmForceUpdate);
  el.appendChild(span);
  el.style.display = 'block';
}

async function mmForceUpdate() {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  const keys = await caches.keys();
  for (const k of keys) await caches.delete(k);
  window.location.reload();
}

async function mmShowSwVersion() {
  const el = document.getElementById('swVersion');
  if (!el) return;
  try {
    const res = await fetch('sw.js', { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/CACHE_NAME = '([^']+)'/);
    if (m) el.textContent = m[1].replace('mem-mashina-', '');
  } catch (e) { /* тихо игнорируем — версия не критична для работы */ }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            mmShowUpdateBanner();
          }
        });
      });
    }).catch(err => {
      console.warn('SW registration failed', err);
    });
  });
  mmShowSwVersion();
}

document.addEventListener('click', e => {
  if (e.target && e.target.id === 'updateAppBtn') mmForceUpdate();
});

// --- Общее хранилище очереди постов и трофеев (IndexedDB, без внешних сервисов) ---
const MM_DB_NAME = 'mem-mashina';
const MM_DB_VERSION = 2;

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
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles'); // out-of-line keys: 'outputReadyDir' -> FileSystemDirectoryHandle
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function mmSaveHandle(key, handle) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const req = tx.objectStore('handles').put(handle, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function mmGetHandle(key) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function mmVerifyPermission(handle, mode) {
  const opts = { mode };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
  } catch (e) { /* пользователь мог отозвать доступ в системе — просто просим заново */ }
  return false;
}

// --- Импорт проекта из output/ready/ (File System Access API, если браузер поддерживает) ---
const MM_DIR_HANDLE_KEY = 'outputReadyDir';

const MM_FILE_TYPES = {
  video: [{ description: 'JSON проект видео', accept: { 'application/json': ['.json'] } }],
  photo: [{ description: 'PNG картинка', accept: { 'image/png': ['.png'] } }]
};

async function mmImportProjectFile(kind) {
  if (!window.showOpenFilePicker) return { supported: false };

  let dirHandle = await mmGetHandle(MM_DIR_HANDLE_KEY).catch(() => null);
  if (dirHandle && !(await mmVerifyPermission(dirHandle, 'read'))) dirHandle = null;

  if (!dirHandle && window.showDirectoryPicker) {
    toast('Выбери папку output/ready/ — запомню её на будущее');
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      await mmSaveHandle(MM_DIR_HANDLE_KEY, dirHandle);
    } catch (e) {
      dirHandle = null; // пользователь отменил выбор папки — всё равно откроем обычный пикер файла
    }
  }

  const opts = { types: MM_FILE_TYPES[kind], excludeAcceptAllOption: false };
  if (dirHandle) opts.startIn = dirHandle;

  try {
    const [fileHandle] = await window.showOpenFilePicker(opts);
    const file = await fileHandle.getFile();
    return { supported: true, file };
  } catch (e) {
    if (e && e.name === 'AbortError') return { supported: true, cancelled: true };
    return { supported: true, error: e };
  }
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

async function mmPut(storeName, entry) {
  const db = await mmOpenDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(entry);
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
const MM_BACKUP_SIZE_WARN = 50 * 1024 * 1024; // 50 МБ

async function mmBuildBackup(liteMode) {
  const lsSnapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    lsSnapshot[k] = localStorage.getItem(k);
  }
  let queueSerialized = [];
  let queueSkipped = 0;
  if (liteMode) {
    queueSkipped = (await mmGetAll('queue')).length;
  } else {
    const queueItems = await mmGetAll('queue');
    for (const it of queueItems) {
      const { blob, ...rest } = it;
      queueSerialized.push({ ...rest, blobDataUrl: await mmBlobToDataUrl(blob) });
    }
  }
  let trophyItems = await mmGetAll('trophies');
  let trophySkipped = 0;
  if (liteMode) {
    const before = trophyItems.length;
    trophyItems = trophyItems.filter(t => t.kind !== 'photo'); // фото-трофеи содержат картинку — это медиа
    trophySkipped = before - trophyItems.length;
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    liteMode: !!liteMode,
    skippedCounts: { queue: queueSkipped, trophies: trophySkipped },
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
    if (!blobDataUrl) continue; // lite-бэкап: медиа не сохранено, запись пропускаем
    const blob = await mmDataUrlToBlob(blobDataUrl);
    await mmAdd('queue', { ...rest, blob });
  }
  await mmClearStore('trophies');
  for (const it of data.trophies || []) {
    const { id, ...rest } = it;
    await mmAdd('trophies', rest);
  }
}

function mmDownloadBackup(data) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = 'mem-mashina-backup-' + Date.now() + '.json';
  link.href = URL.createObjectURL(blob);
  link.click();
  const skipped = data.skippedCounts || {};
  const skipMsg = data.liteMode ? ` (без медиа: пропущено ${skipped.queue || 0} черновиков, ${skipped.trophies || 0} фото-трофеев)` : '';
  toast('Бэкап сохранён' + skipMsg);
}

function mmShowBackupSizeDialog(fullData, sizeMb) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = '';
  el.style.display = 'block';
  const msg = document.createElement('div');
  msg.textContent = `Бэкап ${sizeMb} МБ, это много из-за видео в очереди.`;
  el.appendChild(msg);
  const row = document.createElement('div');
  row.style.marginTop = '6px';
  row.style.display = 'flex';
  row.style.gap = '8px';
  row.style.justifyContent = 'center';

  const liteBtn = document.createElement('button');
  liteBtn.textContent = 'Только тексты и настройки';
  liteBtn.addEventListener('click', async () => {
    el.style.display = 'none';
    const liteData = await mmBuildBackup(true);
    mmDownloadBackup(liteData);
  });

  const fullBtn = document.createElement('button');
  fullBtn.textContent = 'Всё равно всё';
  fullBtn.addEventListener('click', () => {
    el.style.display = 'none';
    mmDownloadBackup(fullData);
  });

  row.appendChild(liteBtn);
  row.appendChild(fullBtn);
  el.appendChild(row);
}

function mmInitBackupUI() {
  const backupBtn = document.getElementById('backupBtn');
  const restoreInput = document.getElementById('restoreInput');
  if (!backupBtn || !restoreInput) return;

  backupBtn.addEventListener('click', async () => {
    const data = await mmBuildBackup(false);
    const sizeBytes = new Blob([JSON.stringify(data)]).size;
    if (sizeBytes > MM_BACKUP_SIZE_WARN) {
      mmShowBackupSizeDialog(data, (sizeBytes / (1024 * 1024)).toFixed(1));
    } else {
      mmDownloadBackup(data);
    }
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
