// Фоторедактор мемов — index.html
(() => {
  const dropzone = document.getElementById('dropzone');
  const dropcard = document.getElementById('dropcard');
  const editorCard = document.getElementById('editorCard');
  const fileInput = document.getElementById('fileInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const capsToggle = document.getElementById('capsToggle');
  const plateToggle = document.getElementById('plateToggle');
  const plateColorInput = document.getElementById('plateColor');

  let img = null;
  let origSrc = null; // исходная картинка без подписей (для Трофеев)
  let cropMode = null; // null | 'square' | 'portrait'
  const MAX_DIM = 1600;

  // --- Подписи: неограниченный список независимых надписей ---
  let captions = []; // {id, text, x, y, fontSize, color, stroke, caps, plate, plateColor}
  let selectedCaptionId = null;
  let nextCaptionId = 1;

  const captionListEl = document.getElementById('captionList');
  const captionEditorEl = document.getElementById('captionEditor');
  const captionTextInput = document.getElementById('captionTextInput');
  const captionFontSize = document.getElementById('captionFontSize');
  const captionColor = document.getElementById('captionColor');
  const captionStroke = document.getElementById('captionStroke');
  const captionCaps = document.getElementById('captionCaps');
  const captionPlate = document.getElementById('captionPlate');
  const captionPlateColor = document.getElementById('captionPlateColor');

  function getSelectedCaption() {
    return captions.find(c => c.id === selectedCaptionId) || null;
  }

  function newCaption(text, x, y) {
    return {
      id: nextCaptionId++,
      text: text || 'НОВАЯ ПОДПИСЬ',
      x: x != null ? x : 0.5,
      y: y != null ? y : Math.min(0.85, 0.15 + captions.length * 0.12),
      fontSize: 46,
      color: '#ffffff',
      stroke: '#000000',
      caps: true,
      plate: false,
      plateColor: '#ffffff'
    };
  }

  function selectCaption(id) {
    selectedCaptionId = id;
    syncCaptionEditor();
    renderCaptionList();
    render();
  }

  function addCaption(text, x, y) {
    const cap = newCaption(text, x, y);
    captions.push(cap);
    selectCaption(cap.id);
    return cap;
  }

  // Используется генератором пар (🎲 Подпись / режим «Событие») — добавляет сразу два новых
  // независимых текста, не трогая уже существующие подписи на картинке.
  function addCaptionPair(top, bottom) {
    addCaption(top, 0.5, Math.min(0.85, 0.15 + captions.length * 0.12));
    addCaption(bottom, 0.5, Math.min(0.9, 0.15 + captions.length * 0.12));
  }

  function deleteCaption(id) {
    captions = captions.filter(c => c.id !== id);
    if (selectedCaptionId === id) selectedCaptionId = null;
    syncCaptionEditor();
    renderCaptionList();
    render();
  }

  function renderCaptionList() {
    captionListEl.innerHTML = '';
    if (!captions.length) {
      captionListEl.innerHTML = '<span class="muted">Подписей пока нет — жми «+ Добавить подпись» или 🎲</span>';
      return;
    }
    captions.forEach(cap => {
      const chip = document.createElement('button');
      chip.textContent = (cap.text || '(пусто)').slice(0, 18) + (cap.text.length > 18 ? '…' : '');
      chip.className = cap.id === selectedCaptionId ? 'active' : '';
      chip.addEventListener('click', () => selectCaption(cap.id));
      captionListEl.appendChild(chip);
    });
  }

  function syncCaptionEditor() {
    const cap = getSelectedCaption();
    if (!cap) { captionEditorEl.style.display = 'none'; return; }
    captionEditorEl.style.display = 'block';
    captionTextInput.value = cap.text;
    captionFontSize.value = cap.fontSize;
    captionColor.value = cap.color;
    captionStroke.value = cap.stroke;
    captionCaps.checked = cap.caps;
    captionPlate.checked = cap.plate;
    captionPlateColor.value = cap.plateColor;
  }

  document.getElementById('addCaptionBtn').addEventListener('click', () => addCaption(''));
  document.getElementById('deleteCaptionBtn').addEventListener('click', () => {
    if (selectedCaptionId != null) deleteCaption(selectedCaptionId);
  });

  [
    [captionTextInput, 'text', el => el.value],
    [captionFontSize, 'fontSize', el => Number(el.value)],
    [captionColor, 'color', el => el.value],
    [captionStroke, 'stroke', el => el.value],
    [captionCaps, 'caps', el => el.checked],
    [captionPlate, 'plate', el => el.checked],
    [captionPlateColor, 'plateColor', el => el.value]
  ].forEach(([el, prop, getVal]) => {
    el.addEventListener('input', () => {
      const cap = getSelectedCaption();
      if (!cap) return;
      cap[prop] = getVal(el);
      if (prop === 'text') renderCaptionList();
      render();
    });
  });

  function loadImageFromSource(src, onLoaded) {
    const image = new Image();
    image.onload = () => {
      img = image;
      origSrc = src;
      cropMode = null;
      stripTop = 0;
      stripBottom = 0;
      stripPanel.style.display = 'none';
      captions = [];
      selectedCaptionId = null;
      dropcard.style.display = 'none';
      editorCard.style.display = 'block';
      if (onLoaded) onLoaded();
      renderCaptionList();
      syncCaptionEditor();
      render();
    };
    image.onerror = () => toast('Не удалось загрузить картинку');
    image.src = src;
  }

  function loadImageFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('Это не картинка');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => loadImageFromSource(e.target.result);
    reader.readAsDataURL(file);
  }

  // --- Загрузка: клик, drag&drop, вставка из буфера ---
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) loadImageFromFile(e.target.files[0]);
  });

  // --- Импорт готового PNG из output/ready/ (File System Access API) ---
  document.getElementById('importPhotoBtn').addEventListener('click', async () => {
    const result = await mmImportProjectFile('photo');
    if (!result.supported) {
      // Браузер не поддерживает FSA (Safari/Firefox) — честный фолбэк: обычный файловый диалог.
      fileInput.click();
      return;
    }
    if (result.cancelled) return;
    if (result.error) { toast('Не удалось открыть файл: ' + result.error.message); return; }
    loadImageFromFile(result.file);
  });

  ['dragenter', 'dragover'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(evt =>
    dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); })
  );
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) loadImageFromFile(file);
  });

  window.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadImageFromFile(item.getAsFile());
        break;
      }
    }
  });

  // --- Кроп ---
  // stripTop/stripBottom — доли высоты исходника (0..0.4), которые обрезаются от краёв,
  // чтобы убрать однотонную полосу с чужой подписью. Работают ТОЛЬКО от края внутрь,
  // поэтому надпись в центре фото они не тронут и содержимое не потеряется.
  let stripTop = 0, stripBottom = 0;

  function getCropRect() {
    if (!img) return null;
    const iw = img.naturalWidth, fullIh = img.naturalHeight;
    const stripTopPx = Math.round(fullIh * stripTop);
    const stripBottomPx = Math.round(fullIh * stripBottom);
    const baseY = stripTopPx;
    const ih = Math.max(1, fullIh - stripTopPx - stripBottomPx);
    if (!cropMode) return { sx: 0, sy: baseY, sw: iw, sh: ih };
    const targetRatio = cropMode === 'square' ? 1 : 4 / 5;
    const curRatio = iw / ih;
    let sw, sh;
    if (curRatio > targetRatio) {
      sh = ih;
      sw = ih * targetRatio;
    } else {
      sw = iw;
      sh = iw / targetRatio;
    }
    return { sx: (iw - sw) / 2, sy: baseY + (ih - sh) / 2, sw, sh };
  }

  document.getElementById('cropSquare').addEventListener('click', () => { cropMode = 'square'; render(); });
  document.getElementById('cropPortrait').addEventListener('click', () => { cropMode = 'portrait'; render(); });
  document.getElementById('cropReset').addEventListener('click', () => { cropMode = null; render(); });

  // --- Обрезка однотонных полос с чужим текстом (сверху/снизу от края) ---
  const MAX_STRIP_FRACTION = 0.35;
  const STRIP_TOLERANCE = 18;
  const stripPanel = document.getElementById('stripPanel');
  const stripTopInput = document.getElementById('stripTopInput');
  const stripBottomInput = document.getElementById('stripBottomInput');

  function detectStripFractions() {
    const w = img.naturalWidth, h = img.naturalHeight;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    let data;
    try {
      data = octx.getImageData(0, 0, w, h).data;
    } catch (e) {
      return null; // например, картинка с внешнего домена без CORS — детект недоступен
    }
    const step = Math.max(1, Math.floor(w / 200));
    const MATCH_FRACTION_THRESHOLD = 0.4; // строка считается частью полосы, даже если в ней есть буквы текста

    function rowBackgroundMatchFraction(y, bgR, bgG, bgB) {
      const rowStart = y * w * 4;
      let matched = 0, total = 0;
      for (let x = 0; x < w; x += step) {
        const idx = rowStart + x * 4;
        total++;
        if (Math.abs(data[idx] - bgR) <= STRIP_TOLERANCE &&
            Math.abs(data[idx + 1] - bgG) <= STRIP_TOLERANCE &&
            Math.abs(data[idx + 2] - bgB) <= STRIP_TOLERANCE) matched++;
      }
      return total ? matched / total : 0;
    }

    // Фон полосы берём из самого крайнего угла (текст мемов почти никогда не касается угла картинки).
    function cornerColor(y) {
      const idx = y * w * 4;
      return [data[idx], data[idx + 1], data[idx + 2]];
    }

    const maxBand = Math.floor(h * MAX_STRIP_FRACTION);
    // Плотные штрихи букв локально могут перекрывать больше половины строки —
    // допускаем «провалы» ниже порога, пока они не станут затяжными (это уже не текст, а фото).
    const GAP_TOLERANCE = Math.max(20, Math.floor(h * 0.05));

    function scanFromEdge(bgR, bgG, bgB, rowAt) {
      let bandEnd = 0;
      let consecutiveMisses = 0;
      for (let i = 0; i < maxBand; i++) {
        if (rowBackgroundMatchFraction(rowAt(i), bgR, bgG, bgB) >= MATCH_FRACTION_THRESHOLD) {
          consecutiveMisses = 0;
          bandEnd = i + 1;
        } else {
          consecutiveMisses++;
          if (consecutiveMisses > GAP_TOLERANCE) break;
        }
      }
      return bandEnd;
    }

    const [tr, tg, tb] = cornerColor(0);
    const top = scanFromEdge(tr, tg, tb, i => i);

    const [br, bg, bb] = cornerColor(h - 1);
    const bottom = scanFromEdge(br, bg, bb, i => h - 1 - i);

    return { top: top / h, bottom: bottom / h };
  }

  document.getElementById('stripDetectBtn').addEventListener('click', () => {
    if (!img) return;
    const detected = detectStripFractions();
    if (!detected) { toast('Не удалось прочитать пиксели этой картинки (внешний источник без CORS)'); return; }
    if (detected.top === 0 && detected.bottom === 0) {
      toast('Однотонных полос у краёв не нашлось — похоже, подпись не в таком формате');
    }
    stripTop = detected.top;
    stripBottom = detected.bottom;
    stripTopInput.value = Math.round(stripTop * 100);
    stripBottomInput.value = Math.round(stripBottom * 100);
    document.getElementById('stripTopVal').textContent = stripTopInput.value;
    document.getElementById('stripBottomVal').textContent = stripBottomInput.value;
    stripPanel.style.display = 'block';
    render();
  });

  const stripTopVal = document.getElementById('stripTopVal');
  const stripBottomVal = document.getElementById('stripBottomVal');

  stripTopInput.addEventListener('input', () => {
    stripTop = Math.min(MAX_STRIP_FRACTION, Number(stripTopInput.value) / 100);
    stripTopVal.textContent = stripTopInput.value;
    render();
  });
  stripBottomInput.addEventListener('input', () => {
    stripBottom = Math.min(MAX_STRIP_FRACTION, Number(stripBottomInput.value) / 100);
    stripBottomVal.textContent = stripBottomInput.value;
    render();
  });
  document.getElementById('stripResetBtn').addEventListener('click', () => {
    stripTop = 0; stripBottom = 0;
    stripTopInput.value = 0; stripBottomInput.value = 0;
    stripTopVal.textContent = '0'; stripBottomVal.textContent = '0';
    stripPanel.style.display = 'none';
    render();
  });

  // --- Рендер ---
  function wrapLines(text, maxWidth, fontPx) {
    ctx.font = `bold ${fontPx}px Impact, "Arial Black", sans-serif`;
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawCaption(cap) {
    if (!cap.text) return null;
    const text = cap.caps ? cap.text.toUpperCase() : cap.text;
    const fontPx = Math.round(Number(cap.fontSize) * (canvas.width / 700));
    const maxWidth = canvas.width * 0.92;
    const lines = wrapLines(text, maxWidth, fontPx);
    const lineHeight = fontPx * 1.15;
    const blockHeight = lineHeight * lines.length;
    const cx = cap.x * canvas.width;
    const cy = cap.y * canvas.height;
    const startY = cy - blockHeight / 2 + lineHeight / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontPx}px Impact, "Arial Black", sans-serif`;

    let maxLineWidth = 0;
    lines.forEach(line => { maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width); });

    if (cap.plate) {
      const padX = fontPx * 0.35, padY = fontPx * 0.25;
      const plateW = maxLineWidth + padX * 2;
      const plateH = blockHeight + padY * 2;
      ctx.fillStyle = cap.plateColor;
      ctx.fillRect(cx - plateW / 2, cy - plateH / 2, plateW, plateH);
    }

    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = cap.stroke;
    ctx.lineWidth = Math.max(2, fontPx * 0.09);
    ctx.fillStyle = cap.color;

    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.strokeText(line, cx, y);
      ctx.fillText(line, cx, y);
    });

    if (cap.id === selectedCaptionId) {
      ctx.save();
      ctx.strokeStyle = '#ffcd00';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      const pad = 8;
      ctx.strokeRect(cx - maxLineWidth / 2 - pad, cy - blockHeight / 2 - pad, maxLineWidth + pad * 2, blockHeight + pad * 2);
      ctx.restore();
    }

    return { id: cap.id, cx, cy, halfW: maxLineWidth / 2, halfH: blockHeight / 2 };
  }

  let hitBoxes = [];

  function render() {
    if (!img) return;
    const rect = getCropRect();
    let w = rect.sw, h = rect.sh;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);

    hitBoxes = captions.map(cap => drawCaption(cap)).filter(Boolean);
  }

  // --- Перетаскивание подписей ---
  let dragging = null; // id перетаскиваемой подписи или null

  function canvasPointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return {
      x: (e.clientX - r.left) * scaleX,
      y: (e.clientY - r.top) * scaleY
    };
  }

  function hitTest(pt) {
    for (let i = hitBoxes.length - 1; i >= 0; i--) {
      const b = hitBoxes[i];
      const pad = 14;
      if (Math.abs(pt.x - b.cx) <= b.halfW + pad && Math.abs(pt.y - b.cy) <= b.halfH + pad) {
        return b.id;
      }
    }
    return null;
  }

  canvas.addEventListener('pointerdown', e => {
    if (!img) return;
    const pt = canvasPointFromEvent(e);
    const hitId = hitTest(pt);
    if (hitId != null) {
      dragging = hitId;
      if (hitId !== selectedCaptionId) selectCaption(hitId);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (dragging == null) return;
    const cap = captions.find(c => c.id === dragging);
    if (!cap) return;
    const pt = canvasPointFromEvent(e);
    cap.x = Math.min(1, Math.max(0, pt.x / canvas.width));
    cap.y = Math.min(1, Math.max(0, pt.y / canvas.height));
    render();
  });

  ['pointerup', 'pointercancel'].forEach(evt =>
    canvas.addEventListener(evt, () => { dragging = null; canvas.style.cursor = 'grab'; })
  );

  // --- Экспорт ---
  document.getElementById('exportBtn').addEventListener('click', () => {
    if (!img) return;
    const link = document.createElement('a');
    link.download = 'mem-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('PNG скачан');
    document.querySelectorAll('#photoChecklist .chk').forEach(c => c.checked = false);
  });

  function resetEditor() {
    img = null;
    cropMode = null;
    stripTop = 0;
    stripBottom = 0;
    stripPanel.style.display = 'none';
    captions = [];
    selectedCaptionId = null;
    renderCaptionList();
    syncCaptionEditor();
    editorCard.style.display = 'none';
    dropcard.style.display = 'block';
    fileInput.value = '';
  }

  document.getElementById('resetBtn').addEventListener('click', resetEditor);
  document.getElementById('closeEditorBtn').addEventListener('click', resetEditor);

  // --- Загрузка трофея (структура + картинка) — вызывается из вкладки «Очередь» ---
  function loadTrophy(t) {
    loadImageFromSource(t.imageDataUrl, () => {
      if (t.captions && t.captions.length) {
        captions = t.captions.map(c => ({ ...c, id: nextCaptionId++ }));
      } else if (t.top || t.bottom) {
        // Совместимость со старыми трофеями (единая пара верх/низ).
        if (t.top) captions.push(newCaption(t.top, (t.textPos && t.textPos.top && t.textPos.top.x) || 0.5, (t.textPos && t.textPos.top && t.textPos.top.y) || 0.08));
        if (t.bottom) captions.push(newCaption(t.bottom, (t.textPos && t.textPos.bottom && t.textPos.bottom.x) || 0.5, (t.textPos && t.textPos.bottom && t.textPos.bottom.y) || 0.9));
        captions.forEach(c => {
          c.fontSize = t.fontSize || 46;
          c.color = t.color || '#ffffff';
          c.stroke = t.stroke || '#000000';
          c.caps = t.caps !== false;
        });
      }
    });
    toast('Трофей загружен в редактор');
  }

  // --- Очередь постов и Трофеи ---
  document.getElementById('queueBtn').addEventListener('click', async () => {
    if (!img) return;
    const plannedDate = prompt('Плановая дата публикации (ГГГГ-ММ-ДД):', new Date().toISOString().slice(0, 10));
    if (plannedDate === null) return;
    const slot = prompt('Слот: утро или вечер?', 'утро') || 'утро';
    const topic = prompt('Тема (для памяти):', '') || '';
    const activeChip = document.querySelector('#nicheChips .active');
    const niche = activeChip ? activeChip.dataset.niche : 'all';
    canvas.toBlob(async blob => {
      if (!blob) { toast('Не удалось собрать PNG'); return; }
      await mmAdd('queue', {
        kind: 'photo', blob, mime: 'image/png',
        plannedDate, slot, topic, createdAt: Date.now(),
        // Для дедупа в published-log достаточно первых двух подписей (историческая пара верх/низ).
        topText: captions[0] ? captions[0].text : '',
        bottomText: captions[1] ? captions[1].text : '',
        niche,
        published: false
      });
      toast('Добавлено в очередь постов');
    }, 'image/png');
  });

  document.getElementById('trophyBtn').addEventListener('click', async () => {
    if (!img || !origSrc) return;
    await mmAdd('trophies', {
      kind: 'photo',
      imageDataUrl: origSrc,
      captions: captions.map(({ id, ...rest }) => rest),
      createdAt: Date.now()
    });
    toast('Сохранено в Трофеи');
  });

  renderCaptionList();

  // Экспонируем для межтабового моста (templates.js/queue.js/captions.js) и программных тестов
  window.__memMachine = { loadImageFromSource, loadTrophy, addCaption, addCaptionPair, render, canvas };
})();
