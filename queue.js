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

  // Разворачиваемая мини-форма «внести результат» — общая для карточки очереди и истории.
  function buildResultsFormHtml(entry) {
    return `
      <div class="row" style="margin-top:6px;">
        <input type="number" class="res-likes" placeholder="Лайки" style="width:80px;" value="${entry.likes != null ? entry.likes : ''}">
        <input type="number" class="res-comments" placeholder="Комменты" style="width:80px;" value="${entry.comments != null ? entry.comments : ''}">
        <input type="number" class="res-reposts" placeholder="Репосты" style="width:80px;" value="${entry.reposts != null ? entry.reposts : ''}">
      </div>
      <input type="text" class="res-note" placeholder="Заметка (например: залетело из-за цифры в панчлайне)" style="width:100%; margin-top:6px;" value="${entry.note || ''}">
      <button class="res-save" style="margin-top:6px;">Сохранить результат</button>`;
  }

  function attachResultsForm(formEl, entryId, onSaved) {
    formEl.querySelector('.res-save').addEventListener('click', () => {
      const likesVal = formEl.querySelector('.res-likes').value;
      const commentsVal = formEl.querySelector('.res-comments').value;
      const repostsVal = formEl.querySelector('.res-reposts').value;
      const note = formEl.querySelector('.res-note').value.trim();
      mmPublishedUpdate(entryId, {
        likes: likesVal === '' ? null : Number(likesVal),
        comments: commentsVal === '' ? null : Number(commentsVal),
        reposts: repostsVal === '' ? null : Number(repostsVal),
        note: note || null
      });
      toast('Результат сохранён');
      if (onSaved) onSaved();
    });
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

    const unpublished = items.filter(it => !it.published);
    const n = unpublished.length;
    ammoCount.textContent = `${n}/6`;
    ammoCount.className = 'ammo ' + (n >= 6 ? 'ok' : (n <= 2 ? 'low' : ''));

    document.getElementById('publishedCount').textContent = mmPublishedCount();

    items.forEach(item => {
      const url = URL.createObjectURL(item.blob);
      queueObjectUrls.push(url);
      const div = document.createElement('div');
      div.className = 'draft-card';
      const thumbHtml = item.kind === 'photo'
        ? `<img class="thumb" src="${url}">`
        : `<video class="thumb" src="${url}" muted></video>`;
      div.className += ' draft-card-wrap';
      div.innerHTML = `
        <div class="row" style="width:100%;">
          ${thumbHtml}
          <div class="info">
            <div class="title">${item.published ? '✅ ' : ''}${item.kind === 'photo' ? '🖼️ Фото' : '🎬 Видео'} — ${fmtDate(item.plannedDate)} (${item.slot || '—'})</div>
            <div class="muted">${item.topic || ''}</div>
          </div>
          <div class="row">
            <button class="dlBtn">Скачать</button>
            ${item.published ? '<button class="resultsToggleBtn">📊 Результат</button>' : '<button class="publishBtn">✅ Опубликовано</button>'}
            <button class="delBtn">Удалить</button>
          </div>
        </div>
        ${item.published ? `<div class="resultsForm" style="display:none; width:100%;"></div>` : ''}`;
      div.querySelector('.dlBtn').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mem-' + item.id + (item.kind === 'photo' ? '.png' : '.webm');
        a.click();
      });
      const publishBtn = div.querySelector('.publishBtn');
      if (publishBtn) {
        publishBtn.addEventListener('click', async () => {
          let logId = null;
          if (item.kind === 'photo' && (item.topText || item.bottomText)) {
            logId = mmPublishedAdd({
              type: 'caption',
              text_top: item.topText || '',
              text_bottom: item.bottomText || '',
              niche: item.niche || 'all',
              slot: item.slot, topic: item.topic, format: 'photo'
            });
          } else if (item.kind === 'video' && item.eventText) {
            logId = mmPublishedAdd({
              type: 'pileon', text: item.eventText,
              slot: item.slot, topic: item.topic, format: 'video'
            });
          } else {
            logId = mmPublishedAdd({
              type: item.kind === 'video' ? 'pileon' : 'caption',
              slot: item.slot, topic: item.topic, format: item.kind
            });
          }
          item.published = true;
          item.publishedLogId = logId;
          await mmPut('queue', item);
          toast('Отмечено как опубликовано');
          loadQueue();
        });
      }
      const resultsToggleBtn = div.querySelector('.resultsToggleBtn');
      if (resultsToggleBtn && item.publishedLogId != null) {
        resultsToggleBtn.addEventListener('click', () => {
          const formEl = div.querySelector('.resultsForm');
          const isHidden = formEl.style.display === 'none';
          if (isHidden) {
            const entry = mmPublishedGet(item.publishedLogId) || {};
            formEl.innerHTML = buildResultsFormHtml(entry);
            attachResultsForm(formEl, item.publishedLogId, () => loadQueue());
          }
          formEl.style.display = isHidden ? 'block' : 'none';
        });
      }
      div.querySelector('.delBtn').addEventListener('click', async () => {
        await mmDelete('queue', item.id);
        loadQueue();
      });
      queueList.appendChild(div);
    });
  }

  function renderHistoryPanel() {
    const panel = document.getElementById('publishedHistoryPanel');
    const entries = mmPublishedAll().slice().reverse();
    panel.innerHTML = '';
    if (!entries.length) {
      panel.innerHTML = '<div class="muted">Пока ничего не опубликовано.</div>';
      return;
    }
    entries.forEach(e => {
      const label = e.type === 'caption' ? `${e.text_top} / ${e.text_bottom}` : (e.text || '');
      const resultLabel = (e.likes != null || e.comments != null || e.reposts != null)
        ? ` — 👍${e.likes ?? '?'} 💬${e.comments ?? '?'} 🔁${e.reposts ?? '?'}`
        : '';
      const row = document.createElement('div');
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px solid var(--border)';
      row.innerHTML = `
        <div class="row" style="justify-content:space-between; align-items:center;">
          <div class="muted">${e.date_published} — ${label}${resultLabel}</div>
          <button class="hist-results-toggle">Внести результат</button>
        </div>
        <div class="hist-results-form" style="display:none;"></div>`;
      row.querySelector('.hist-results-toggle').addEventListener('click', () => {
        const formEl = row.querySelector('.hist-results-form');
        const isHidden = formEl.style.display === 'none';
        if (isHidden) {
          formEl.innerHTML = buildResultsFormHtml(e);
          attachResultsForm(formEl, e.id, () => renderHistoryPanel());
        }
        formEl.style.display = isHidden ? 'block' : 'none';
      });
      panel.appendChild(row);
    });
  }

  document.getElementById('exportScorecardBtn').addEventListener('click', () => {
    const csv = mmPublishedExportCsv();
    const rowCount = csv.split('\n').length - 1;
    if (rowCount <= 0) { toast('Нет ни одной записи с результатами — сначала внеси лайки/комменты хотя бы для одного поста'); return; }
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.download = 'stats-export.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    toast(`Экспортировано ${rowCount} записей — передай файл Claude Code для /scorecard`);
  });

  document.getElementById('showHistoryBtn').addEventListener('click', () => {
    const panel = document.getElementById('publishedHistoryPanel');
    const isHidden = panel.style.display === 'none';
    if (isHidden) renderHistoryPanel();
    panel.style.display = isHidden ? 'block' : 'none';
  });

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
            <div class="muted">${item.captions ? item.captions.map(c => c.text).filter(Boolean).join(' / ') : `${item.top || ''} / ${item.bottom || ''}`}</div>
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
