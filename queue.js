// Очередь постов и Трофеи — queue.html
(() => {
  const queueList = document.getElementById('queueList');
  const queueEmpty = document.getElementById('queueEmpty');
  const trophyList = document.getElementById('trophyList');
  const trophyEmpty = document.getElementById('trophyEmpty');
  const ammoCount = document.getElementById('ammoCount');
  const sortSelect = document.getElementById('sortSelect');

  function fmtDate(d) {
    if (!d) return '—';
    return d;
  }

  let queueObjectUrls = [];

  async function loadQueue() {
    queueObjectUrls.forEach(u => URL.revokeObjectURL(u));
    queueObjectUrls = [];
    let items = await mmGetAll('queue');
    const mode = sortSelect.value;
    items.sort((a, b) => {
      if (mode === 'created-desc') return b.createdAt - a.createdAt;
      const da = a.plannedDate || '9999', db = b.plannedDate || '9999';
      return mode === 'date-desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

    queueList.innerHTML = '';
    queueEmpty.style.display = items.length ? 'none' : 'block';

    const n = items.length;
    ammoCount.textContent = `${n}/6`;
    ammoCount.className = 'ammo ' + (n >= 6 ? 'ok' : (n <= 2 ? 'low' : ''));

    items.forEach(item => {
      const url = URL.createObjectURL(item.blob);
      queueObjectUrls.push(url);
      const div = document.createElement('div');
      div.className = 'draft-card';
      const thumbHtml = item.kind === 'photo'
        ? `<img class="thumb" src="${url}">`
        : `<video class="thumb" src="${url}" muted></video>`;
      div.innerHTML = `
        ${thumbHtml}
        <div class="info">
          <div class="title">${item.kind === 'photo' ? '🖼️ Фото' : '🎬 Видео'} — ${fmtDate(item.plannedDate)} (${item.slot || '—'})</div>
          <div class="muted">${item.topic || ''}</div>
        </div>
        <div class="row">
          <button class="dlBtn">Скачать</button>
          <button class="delBtn">Удалить</button>
        </div>`;
      div.querySelector('.dlBtn').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mem-' + item.id + (item.kind === 'photo' ? '.png' : '.webm');
        a.click();
      });
      div.querySelector('.delBtn').addEventListener('click', async () => {
        await mmDelete('queue', item.id);
        loadQueue();
      });
      queueList.appendChild(div);
    });
  }

  async function loadTrophies() {
    const items = await mmGetAll('trophies');
    items.sort((a, b) => b.createdAt - a.createdAt);
    trophyList.innerHTML = '';
    trophyEmpty.style.display = items.length ? 'none' : 'block';

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'draft-card';
      if (item.kind === 'photo') {
        div.innerHTML = `
          <img class="thumb" src="${item.imageDataUrl}">
          <div class="info">
            <div class="title">🖼️ Фото-трофей</div>
            <div class="muted">${item.top || ''} / ${item.bottom || ''}</div>
          </div>
          <div class="row">
            <button class="useBtn">Открыть в редакторе</button>
            <button class="delBtn">Удалить</button>
          </div>`;
        div.querySelector('.useBtn').addEventListener('click', () => {
          window.mmSwitchTab('photo');
          window.__memMachine.loadTrophy(item);
        });
      } else {
        div.innerHTML = `
          <div class="thumb" style="display:flex; align-items:center; justify-content:center; font-size:28px;">🎬</div>
          <div class="info">
            <div class="title">Видео-структура — ${item.badges.length} плашек</div>
            <div class="muted">${item.eventText || ''}</div>
          </div>
          <div class="row">
            <button class="useBtn">Открыть в видеоредакторе</button>
            <button class="delBtn">Удалить</button>
          </div>`;
        div.querySelector('.useBtn').addEventListener('click', () => {
          window.mmSwitchTab('video');
          window.__memMachineVideo.setPendingTrophy(item);
        });
      }
      div.querySelector('.delBtn').addEventListener('click', async () => {
        await mmDelete('trophies', item.id);
        loadTrophies();
      });
      trophyList.appendChild(div);
    });
  }

  sortSelect.addEventListener('change', loadQueue);

  function refresh() {
    loadQueue();
    loadTrophies();
  }

  refresh();
  window.__memMachineQueue = { refresh };
})();
