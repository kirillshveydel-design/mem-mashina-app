// Видеоредактор мемов «pile-on» — video.html
(() => {
  const dropzone = document.getElementById('videoDropzone');
  const dropcard = document.getElementById('videoDropcard');
  const editorArea = document.getElementById('editorArea');
  const fileInput = document.getElementById('videoFileInput');
  const video = document.getElementById('video');
  const stage = document.getElementById('stage');
  const overlayLayer = document.getElementById('overlayLayer');
  const eventPlaqueEl = document.getElementById('eventPlaque');
  const playBtn = document.getElementById('playBtn');
  const timeLabel = document.getElementById('timeLabel');
  const timelineTrack = document.getElementById('timelineTrack');
  const playheadLine = document.getElementById('playheadLine');
  const tracksContainer = document.getElementById('tracksContainer');
  const badgeEditor = document.getElementById('badgeEditor');
  const badgeText = document.getElementById('badgeText');
  const badgeFontSize = document.getElementById('badgeFontSize');
  const badgeColor = document.getElementById('badgeColor');
  const badgeStroke = document.getElementById('badgeStroke');
  const badgeStart = document.getElementById('badgeStart');
  const badgeEnd = document.getElementById('badgeEnd');
  const kfList = document.getElementById('kfList');
  const eventTextInput = document.getElementById('eventText');
  const exportStatus = document.getElementById('exportStatus');
  const muteToggle = document.getElementById('muteToggle');

  const STORAGE_KEY = 'mm_video_project_v1';

  let state = {
    badges: [],   // {id, text, fontSize, color, stroke, start, end, keyframes:[{t,x,y}]}
    eventText: ''
  };
  let selectedId = null;
  let nextId = 1;
  let dragCtx = null; // для перетаскивания плашки по видео
  let barDragCtx = null; // для перетаскивания/тримминга на таймлайне
  let pendingTrophy = null; // структура плашек, ждущая следующего загруженного видео
  let trimStart = 0, trimEnd = 0; // диапазон экспорта
  let lastWebmBlob = null, lastMp4Blob = null; // для тестов/диагностики

  function newBadge() {
    const dur = video.duration || 5;
    const start = video.currentTime || 0;
    const end = Math.min(dur, start + 3);
    return {
      id: nextId++,
      text: 'Новая плашка',
      fontSize: 22,
      color: '#ffffff',
      stroke: '#000000',
      start, end,
      keyframes: [
        { t: start, x: 0.5, y: 0.3 },
        { t: end, x: 0.5, y: 0.3 }
      ],
      liveOverride: null
    };
  }

  // --- Загрузка видео ---
  function loadVideoFile(file) {
    if (!file || !file.type.startsWith('video/')) {
      toast('Это не видео');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast('Файл больше 100 МБ — может тормозить, но попробуем');
    }
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();
    video.onloadedmetadata = async () => {
      // Chromium-баг: видео, записанные через MediaRecorder (например, свои
      // скринкасты для pile-on), иногда репортят duration=Infinity/NaN/~0
      // до первой перемотки в конец. Форсируем корректную длительность.
      if (!isFinite(video.duration) || video.duration < 0.05) {
        await new Promise(res => {
          video.currentTime = 1e9;
          video.ontimeupdate = () => { video.currentTime = 0; res(); };
          setTimeout(res, 1500);
        });
      }
      dropcard.style.display = 'none';
      editorArea.style.display = 'block';
      trimStart = 0;
      trimEnd = video.duration;
      updateLengthWarning();
      restoreOrInit();
    };
  }

  function updateLengthWarning() {
    const warnEl = document.getElementById('lengthWarning');
    const trimStartInput = document.getElementById('trimStart');
    const trimEndInput = document.getElementById('trimEnd');
    trimStartInput.value = trimStart.toFixed(1);
    trimEndInput.value = trimEnd.toFixed(1);
    trimStartInput.max = video.duration;
    trimEndInput.max = video.duration;
    if (video.duration > 60) {
      warnEl.style.display = 'block';
      warnEl.textContent = `⚠️ Видео длиннее 60 секунд (${video.duration.toFixed(0)}с) — экспорт займёт время, MP4-конвертация может подвесить вкладку. Обрежь диапазон ниже (сейчас экспортируется ${trimStart.toFixed(1)}–${trimEnd.toFixed(1)}с).`;
    } else {
      warnEl.style.display = 'none';
    }
  }

  function applyTrimInputs() {
    const trimStartInput = document.getElementById('trimStart');
    const trimEndInput = document.getElementById('trimEnd');
    let s = Number(trimStartInput.value), e = Number(trimEndInput.value);
    if (!isFinite(s)) s = 0;
    if (!isFinite(e) || e <= s) e = Math.min(video.duration, s + 1);
    trimStart = Math.max(0, s);
    trimEnd = Math.min(video.duration, e);
    updateLengthWarning();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => { if (e.target.files[0]) loadVideoFile(e.target.files[0]); });
  ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) loadVideoFile(f); });

  function restoreOrInit() {
    let restored = false;
    if (pendingTrophy) {
      const t = pendingTrophy;
      pendingTrophy = null;
      state.badges = t.badges || [];
      state.eventText = t.eventText || '';
      nextId = (Math.max(0, ...state.badges.map(b => b.id)) || 0) + 1;
      restored = true;
      toast('Структура из Трофеев применена к новому видео');
      eventTextInput.value = state.eventText;
      renderAll();
      autosave();
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        state.badges = saved.badges || [];
        state.eventText = saved.eventText || '';
        nextId = (Math.max(0, ...state.badges.map(b => b.id)) || 0) + 1;
        restored = state.badges.length > 0 || !!state.eventText;
      }
    } catch (e) { console.warn('Не удалось восстановить проект', e); }
    eventTextInput.value = state.eventText;
    if (restored) toast('Восстановлен предыдущий проект из этого браузера');
    renderAll();
  }

  function autosave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ badges: state.badges, eventText: state.eventText }));
    } catch (e) { console.warn('Автосохранение не удалось', e); }
  }

  // --- Интерполяция позиции плашки по ключевым кадрам ---
  function interpPos(badge, t) {
    const kfs = [...badge.keyframes].sort((a, b) => a.t - b.t);
    if (!kfs.length) return { x: 0.5, y: 0.5 };
    if (kfs.length === 1 || t <= kfs[0].t) return { x: kfs[0].x, y: kfs[0].y };
    if (t >= kfs[kfs.length - 1].t) return { x: kfs[kfs.length - 1].x, y: kfs[kfs.length - 1].y };
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i], b = kfs[i + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t || 1;
        const f = (t - a.t) / span;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return { x: kfs[kfs.length - 1].x, y: kfs[kfs.length - 1].y };
  }

  // --- DOM-превью плашек (без canvas, кроме экспорта) ---
  function renderOverlay() {
    const t = video.currentTime;
    overlayLayer.querySelectorAll('.badge-dom').forEach(n => n.remove());
    state.badges.forEach(b => {
      if (t < b.start || t > b.end) return;
      const pos = b.liveOverride || interpPos(b, t);
      const el = document.createElement('div');
      el.className = 'badge-dom' + (b.id === selectedId ? ' selected' : '');
      el.style.left = (pos.x * 100) + '%';
      el.style.top = (pos.y * 100) + '%';
      el.style.fontSize = b.fontSize + 'px';
      el.style.color = b.color;
      el.style.setProperty('--stroke', b.stroke);
      el.textContent = b.text;
      el.dataset.id = b.id;
      el.addEventListener('pointerdown', onBadgePointerDown);
      overlayLayer.appendChild(el);
    });
    if (state.eventText) {
      eventPlaqueEl.style.display = 'block';
      eventPlaqueEl.textContent = state.eventText;
    } else {
      eventPlaqueEl.style.display = 'none';
    }
    timeLabel.textContent = `${t.toFixed(2)} / ${(video.duration || 0).toFixed(2)}`;
    const dur = video.duration || 1;
    playheadLine.style.left = (t / dur * 100) + '%';
  }

  function onBadgePointerDown(e) {
    const id = Number(e.currentTarget.dataset.id);
    selectedId = id;
    syncBadgeEditor();
    const stageRect = stage.getBoundingClientRect();
    dragCtx = { id, stageRect };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  }

  overlayLayer.addEventListener('pointermove', e => {
    if (!dragCtx) return;
    const b = state.badges.find(x => x.id === dragCtx.id);
    if (!b) return;
    const x = Math.min(1, Math.max(0, (e.clientX - dragCtx.stageRect.left) / dragCtx.stageRect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - dragCtx.stageRect.top) / dragCtx.stageRect.height));
    b.liveOverride = { x, y };
    renderOverlay();
  });
  window.addEventListener('pointerup', () => { dragCtx = null; });

  // --- Плеер ---
  playBtn.addEventListener('click', () => {
    if (video.paused) { video.play(); playBtn.textContent = '⏸ Pause'; }
    else { video.pause(); playBtn.textContent = '▶ Play'; }
  });
  video.addEventListener('ended', () => { playBtn.textContent = '▶ Play'; });
  video.addEventListener('timeupdate', () => {
    state.badges.forEach(b => b.liveOverride = null);
    renderOverlay();
  });

  timelineTrack.addEventListener('click', e => {
    if (barDragCtx) return;
    const r = timelineTrack.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    video.currentTime = frac * (video.duration || 0);
  });

  // --- Таймлайн: дорожки плашек ---
  function renderTracks() {
    tracksContainer.innerHTML = '';
    const dur = video.duration || 1;
    state.badges.forEach(b => {
      const row = document.createElement('div');
      row.className = 'badge-row';
      const bar = document.createElement('div');
      bar.className = 'badge-bar' + (b.id === selectedId ? ' selected' : '');
      bar.style.left = (b.start / dur * 100) + '%';
      bar.style.width = Math.max(1, (b.end - b.start) / dur * 100) + '%';
      bar.textContent = b.text;
      bar.addEventListener('pointerdown', e => startBarDrag(e, b, 'move'));

      const lh = document.createElement('div');
      lh.className = 'handle left';
      lh.addEventListener('pointerdown', e => { e.stopPropagation(); startBarDrag(e, b, 'left'); });
      const rh = document.createElement('div');
      rh.className = 'handle right';
      rh.addEventListener('pointerdown', e => { e.stopPropagation(); startBarDrag(e, b, 'right'); });

      bar.appendChild(lh);
      bar.appendChild(rh);
      row.appendChild(bar);
      tracksContainer.appendChild(row);
    });
  }

  function startBarDrag(e, badge, mode) {
    e.stopPropagation();
    selectedId = badge.id;
    syncBadgeEditor();
    const r = timelineTrack.getBoundingClientRect();
    barDragCtx = { badge, mode, startX: e.clientX, r, origStart: badge.start, origEnd: badge.end };
    window.addEventListener('pointermove', onBarDragMove);
    window.addEventListener('pointerup', onBarDragUp);
  }

  function onBarDragMove(e) {
    if (!barDragCtx) return;
    const { badge, mode, startX, r, origStart, origEnd } = barDragCtx;
    const dur = video.duration || 1;
    const dt = (e.clientX - startX) / r.width * dur;
    if (mode === 'move') {
      let ns = origStart + dt, ne = origEnd + dt;
      const span = origEnd - origStart;
      ns = Math.max(0, Math.min(dur - span, ns));
      ne = ns + span;
      badge.start = ns; badge.end = ne;
    } else if (mode === 'left') {
      badge.start = Math.max(0, Math.min(origEnd - 0.1, origStart + dt));
    } else if (mode === 'right') {
      badge.end = Math.min(dur, Math.max(origStart + 0.1, origEnd + dt));
    }
    renderTracks();
    syncBadgeEditor(true);
    renderOverlay();
  }

  function onBarDragUp() {
    barDragCtx = null;
    window.removeEventListener('pointermove', onBarDragMove);
    window.removeEventListener('pointerup', onBarDragUp);
    autosave();
  }

  // --- Редактор выбранной плашки ---
  function syncBadgeEditor(skipFieldFill) {
    const b = state.badges.find(x => x.id === selectedId);
    if (!b) { badgeEditor.style.display = 'none'; return; }
    badgeEditor.style.display = 'block';
    if (!skipFieldFill) {
      badgeText.value = b.text;
      badgeFontSize.value = b.fontSize;
      badgeColor.value = b.color;
      badgeStroke.value = b.stroke;
    }
    badgeStart.value = b.start.toFixed(2);
    badgeEnd.value = b.end.toFixed(2);
    kfList.innerHTML = '';
    [...b.keyframes].sort((a, c) => a.t - c.t).forEach((k, idx) => {
      const div = document.createElement('div');
      div.className = 'kf-item';
      div.innerHTML = `<span>#${idx + 1} — t=${k.t.toFixed(2)}с, x=${(k.x * 100).toFixed(0)}%, y=${(k.y * 100).toFixed(0)}%</span>`;
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => {
        b.keyframes = b.keyframes.filter(kk => kk !== k);
        syncBadgeEditor();
        renderOverlay();
        autosave();
      });
      div.appendChild(delBtn);
      kfList.appendChild(div);
    });
  }

  document.getElementById('addBadgeBtn').addEventListener('click', () => {
    const b = newBadge();
    state.badges.push(b);
    selectedId = b.id;
    renderTracks();
    syncBadgeEditor();
    renderOverlay();
    autosave();
  });

  document.getElementById('deleteBadgeBtn').addEventListener('click', () => {
    if (selectedId == null) return;
    state.badges = state.badges.filter(b => b.id !== selectedId);
    selectedId = null;
    renderTracks();
    syncBadgeEditor();
    renderOverlay();
    autosave();
  });

  [badgeText, badgeFontSize, badgeColor, badgeStroke].forEach(el => el.addEventListener('input', () => {
    const b = state.badges.find(x => x.id === selectedId);
    if (!b) return;
    b.text = badgeText.value;
    b.fontSize = Number(badgeFontSize.value);
    b.color = badgeColor.value;
    b.stroke = badgeStroke.value;
    renderTracks();
    renderOverlay();
    autosave();
  }));

  [badgeStart, badgeEnd].forEach(el => el.addEventListener('change', () => {
    const b = state.badges.find(x => x.id === selectedId);
    if (!b) return;
    let s = Number(badgeStart.value), en = Number(badgeEnd.value);
    if (en <= s) en = s + 0.1;
    b.start = Math.max(0, s);
    b.end = Math.min(video.duration || en, en);
    renderTracks();
    renderOverlay();
    autosave();
  }));

  document.getElementById('addKeyBtn').addEventListener('click', () => {
    const b = state.badges.find(x => x.id === selectedId);
    if (!b) return;
    const pos = b.liveOverride || interpPos(b, video.currentTime);
    b.keyframes = b.keyframes.filter(k => Math.abs(k.t - video.currentTime) > 0.01);
    b.keyframes.push({ t: video.currentTime, x: pos.x, y: pos.y });
    b.liveOverride = null;
    syncBadgeEditor();
    renderOverlay();
    autosave();
    toast('Ключевой кадр добавлен');
  });

  eventTextInput.addEventListener('input', () => {
    state.eventText = eventTextInput.value;
    renderOverlay();
    autosave();
  });

  document.getElementById('trimStart').addEventListener('change', applyTrimInputs);
  document.getElementById('trimEnd').addEventListener('change', applyTrimInputs);

  function renderAll() {
    renderTracks();
    syncBadgeEditor();
    renderOverlay();
  }

  // --- Проект: сохранение/загрузка JSON ---
  document.getElementById('saveProjectBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ badges: state.badges, eventText: state.eventText }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = 'mem-video-project-' + Date.now() + '.json';
    link.href = URL.createObjectURL(blob);
    link.click();
    toast('Проект сохранён');
  });

  function applyProjectJson(text) {
    const data = JSON.parse(text);
    state.badges = data.badges || [];
    state.eventText = data.eventText || '';
    nextId = (Math.max(0, ...state.badges.map(b => b.id)) || 0) + 1;
    eventTextInput.value = state.eventText;
    selectedId = null;
    renderAll();
    autosave();
  }

  document.getElementById('loadProjectInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        applyProjectJson(ev.target.result);
        toast('Проект загружен');
      } catch (err) {
        toast('Битый JSON проекта');
      }
    };
    reader.readAsText(file);
  });

  // --- Импорт проекта из output/ready/ (File System Access API) + фолбэк для Safari/Firefox ---
  const importVideoFallback = document.getElementById('importVideoFallback');
  document.getElementById('importVideoBtn').addEventListener('click', async () => {
    const result = await mmImportProjectFile('video');
    if (!result.supported) {
      importVideoFallback.style.display = 'flex';
      toast('Браузер не поддерживает быстрый импорт — вставь JSON вручную ниже');
      return;
    }
    if (result.cancelled) return;
    if (result.error) { toast('Не удалось открыть файл: ' + result.error.message); return; }
    try {
      applyProjectJson(await result.file.text());
      toast('Проект импортирован из ' + result.file.name);
    } catch (err) {
      toast('Битый JSON проекта');
    }
  });

  document.getElementById('importVideoTextareaApplyBtn').addEventListener('click', () => {
    const textarea = document.getElementById('importVideoTextarea');
    try {
      applyProjectJson(textarea.value);
      textarea.value = '';
      toast('Проект импортирован');
    } catch (err) {
      toast('Битый JSON проекта');
    }
  });

  document.getElementById('newVideoBtn').addEventListener('click', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    editorArea.style.display = 'none';
    dropcard.style.display = 'block';
    fileInput.value = '';
  });

  // --- Экспорт: рендер плашек на canvas только во время записи ---
  function drawBadgeOnCanvas(ctx, cw, ch, badge, t) {
    if (t < badge.start || t > badge.end) return;
    const pos = interpPos(badge, t);
    const x = pos.x * cw, y = pos.y * ch;
    ctx.font = `bold ${badge.fontSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, badge.fontSize * 0.18);
    ctx.strokeStyle = badge.stroke;
    ctx.strokeText(badge.text, x, y);
    ctx.fillStyle = badge.color;
    ctx.fillText(badge.text, x, y);
  }

  function drawEventPlaque(ctx, cw, ch) {
    if (!state.eventText) return;
    const fontPx = Math.round(ch * 0.045);
    ctx.font = `bold ${fontPx}px -apple-system, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const padY = fontPx * 0.6, padX = 16;
    const w = ctx.measureText(state.eventText).width + padX * 2;
    const x = cw / 2, y = ch * 0.97 - fontPx * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(x - w / 2, y - fontPx * 0.5 - padY / 2, w, fontPx + padY);
    ctx.fillStyle = '#fff';
    ctx.fillText(state.eventText, x, y);
  }

  // AudioContext + MediaElementSource создаются один раз на элемент <video>
  // (createMediaElementSource бросает исключение при повторном вызове на том же элементе).
  let audioCtx = null, audioSourceNode = null, audioDestNode = null;
  function getAudioDestination() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioSourceNode = audioCtx.createMediaElementSource(video);
      audioDestNode = audioCtx.createMediaStreamDestination();
      audioSourceNode.connect(audioCtx.destination); // чтобы слышать звук во время экспорта
      audioSourceNode.connect(audioDestNode);
    }
    return audioDestNode;
  }

  async function renderToWebmBlob() {
    if (!video.duration) { toast('Сначала загрузи видео'); return null; }
    const cw = video.videoWidth, ch = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');

    let mediaStream;
    try {
      const vStream = canvas.captureStream(30);
      const tracks = [...vStream.getVideoTracks()];
      if (!muteToggle.checked) {
        const dest = getAudioDestination();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        tracks.push(...dest.stream.getAudioTracks());
      }
      mediaStream = new MediaStream(tracks);
    } catch (e) {
      toast('captureStream/AudioContext не поддерживается в этом браузере');
      return null;
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(mediaStream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    const rangeStart = Math.max(0, trimStart || 0);
    const rangeEnd = trimEnd > rangeStart ? trimEnd : video.duration;
    exportStatus.textContent = `Экспортирую диапазон ${rangeStart.toFixed(1)}–${rangeEnd.toFixed(1)}с...`;
    video.pause();
    video.currentTime = rangeStart;
    await new Promise(res => { video.onseeked = res; });

    let stopped = false;
    // setInterval вместо requestAnimationFrame: rAF троттлится (или вовсе не тикает)
    // в свёрнутой/неактивной вкладке, из-за чего экспорт в фоне мог зависнуть
    // с пустым результатом. setInterval продолжает работать независимо от фокуса вкладки.
    function drawFrame() {
      ctx.drawImage(video, 0, 0, cw, ch);
      const t = video.currentTime;
      state.badges.forEach(b => drawBadgeOnCanvas(ctx, cw, ch, b, t));
      drawEventPlaque(ctx, cw, ch);
    }
    const drawIntervalId = setInterval(drawFrame, 1000 / 30);

    const finished = new Promise(resolve => {
      function stop() {
        if (stopped) return;
        stopped = true;
        clearInterval(drawIntervalId);
        video.pause();
        recorder.stop();
        resolve();
      }
      video.onended = stop;
      video.ontimeupdate = () => { if (video.currentTime >= rangeEnd) stop(); };
    });

    recorder.start();
    video.play();
    drawFrame();
    await finished;

    return new Blob(chunks, { type: 'video/webm' });
  }

  const MP4_RATE_KEY = 'mm_mp4_conversion_rate_sec_per_10s';

  function updateMp4RateHint() {
    const hintEl = document.getElementById('mp4RateHint');
    if (!hintEl) return;
    const rate = localStorage.getItem(MP4_RATE_KEY);
    hintEl.textContent = rate ? `Ориентир: конвертация в MP4 ~${rate} сек на каждые 10 сек видео (по замеру на этом устройстве).` : '';
  }

  async function exportVideo(kind) {
    const webmBlob = await renderToWebmBlob();
    if (!webmBlob) return;
    lastWebmBlob = webmBlob;

    if (kind === 'webm') {
      downloadBlob(webmBlob, 'mem-' + Date.now() + '.webm');
      exportStatus.textContent = 'WebM готов и скачан.';
      return;
    }

    if (kind === 'mp4') {
      const rangeSec = (trimEnd || video.duration) - (trimStart || 0);
      if (rangeSec > 60) {
        toast('Долгое видео — MP4-конвертация может занять минуту и подвесить вкладку, не закрывай её');
      }
      exportStatus.textContent = 'Загружаю ffmpeg.wasm для конвертации в MP4...';
      try {
        await ensureFFmpeg();
        exportStatus.textContent = 'Конвертирую в MP4... 0%';
        const t0 = performance.now();
        const mp4Blob = await convertToMp4(webmBlob, pct => {
          exportStatus.textContent = `Конвертирую в MP4... ${pct}%`;
        });
        const elapsedSec = (performance.now() - t0) / 1000;
        const ratePer10s = (elapsedSec / (rangeSec / 10)).toFixed(1);
        localStorage.setItem(MP4_RATE_KEY, ratePer10s);
        updateMp4RateHint();
        lastMp4Blob = mp4Blob;
        downloadBlob(mp4Blob, 'mem-' + Date.now() + '.mp4');
        exportStatus.textContent = `MP4 готов и скачан (конвертация заняла ${elapsedSec.toFixed(1)} сек).`;
      } catch (e) {
        console.warn('ffmpeg.wasm недоступен', e);
        downloadBlob(webmBlob, 'mem-' + Date.now() + '.webm');
        exportStatus.textContent = 'MP4-конвертация недоступна (нет сети или ffmpeg.wasm не загрузился). Скачан WebM — Threads его принимает, либо сконвертируй любым конвертером.';
      }
      return;
    }

    if (kind === 'queue') {
      const plannedDate = prompt('Плановая дата публикации (ГГГГ-ММ-ДД):', new Date().toISOString().slice(0, 10));
      if (plannedDate === null) return;
      const slot = prompt('Слот: утро или вечер?', 'утро') || 'утро';
      const topic = prompt('Тема (для памяти):', '') || '';
      await mmAdd('queue', {
        kind: 'video', blob: webmBlob, mime: 'video/webm',
        plannedDate, slot, topic, createdAt: Date.now()
      });
      exportStatus.textContent = 'Добавлено в очередь постов (WebM).';
      toast('Добавлено в очередь постов');
    }
  }

  function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
  }

  let ffmpegInstance = null;
  async function ensureFFmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    await loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');
    const { FFmpeg } = window.FFmpegWASM || {};
    if (!FFmpeg) throw new Error('FFmpeg global not found');
    const ff = new FFmpeg();
    await ff.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
    });
    ffmpegInstance = ff;
    return ff;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function convertToMp4(webmBlob, onProgress) {
    const ff = ffmpegInstance;
    const inName = 'in.webm', outName = 'out.mp4';
    const buf = new Uint8Array(await webmBlob.arrayBuffer());
    await ff.writeFile(inName, buf);
    const progressHandler = ({ progress }) => {
      if (onProgress && isFinite(progress)) onProgress(Math.min(100, Math.round(progress * 100)));
    };
    if (ff.on) ff.on('progress', progressHandler);
    await ff.exec(['-i', inName, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', outName]);
    if (ff.off) ff.off('progress', progressHandler);
    const data = await ff.readFile(outName);
    return new Blob([data.buffer], { type: 'video/mp4' });
  }

  document.getElementById('exportWebmBtn').addEventListener('click', () => exportVideo('webm'));
  document.getElementById('exportMp4Btn').addEventListener('click', () => exportVideo('mp4'));
  document.getElementById('saveDraftBtn').addEventListener('click', () => exportVideo('queue'));

  document.getElementById('videoTrophyBtn').addEventListener('click', async () => {
    if (!state.badges.length && !state.eventText) { toast('Нечего сохранять — добавь плашки'); return; }
    await mmAdd('trophies', {
      kind: 'video',
      badges: state.badges,
      eventText: state.eventText,
      createdAt: Date.now()
    });
    toast('Структура сохранена в Трофеи (без видео — подставь новое видео при повторном использовании)');
  });

  updateMp4RateHint();

  // Экспонируем для межтабового моста (queue.js) и тестов
  window.__memMachineVideo = {
    state, interpPos,
    setPendingTrophy(t) { pendingTrophy = t; toast('Загрузи видео — структура плашек применится автоматически'); },
    get lastWebmBlob() { return lastWebmBlob; },
    get lastMp4Blob() { return lastMp4Blob; }
  };
})();
