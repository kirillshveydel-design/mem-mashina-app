// Фоторедактор мемов — index.html
(() => {
  const dropzone = document.getElementById('dropzone');
  const dropcard = document.getElementById('dropcard');
  const editorCard = document.getElementById('editorCard');
  const fileInput = document.getElementById('fileInput');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const topTextInput = document.getElementById('topText');
  const bottomTextInput = document.getElementById('bottomText');
  const fontSizeInput = document.getElementById('fontSize');
  const fontColorInput = document.getElementById('fontColor');
  const strokeColorInput = document.getElementById('strokeColor');
  const capsToggle = document.getElementById('capsToggle');

  let img = null;
  let origSrc = null; // исходная картинка без подписей (для Трофеев)
  let cropMode = null; // null | 'square' | 'portrait'
  const MAX_DIM = 1600;

  const state = {
    textPos: {
      top: { x: 0.5, y: 0.08 },
      bottom: { x: 0.5, y: 0.90 }
    }
  };

  function loadImageFromSource(src) {
    const image = new Image();
    image.onload = () => {
      img = image;
      origSrc = src;
      cropMode = null;
      dropcard.style.display = 'none';
      editorCard.style.display = 'block';
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
  function getCropRect() {
    if (!img) return null;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (!cropMode) return { sx: 0, sy: 0, sw: iw, sh: ih };
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
    return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
  }

  document.getElementById('cropSquare').addEventListener('click', () => { cropMode = 'square'; render(); });
  document.getElementById('cropPortrait').addEventListener('click', () => { cropMode = 'portrait'; render(); });
  document.getElementById('cropReset').addEventListener('click', () => { cropMode = null; render(); });

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

  function drawTextBlock(rawText, xPct, yPct) {
    if (!rawText) return null;
    const text = capsToggle.checked ? rawText.toUpperCase() : rawText;
    const fontPx = Math.round(Number(fontSizeInput.value) * (canvas.width / 700));
    const maxWidth = canvas.width * 0.92;
    const lines = wrapLines(text, maxWidth, fontPx);
    const lineHeight = fontPx * 1.15;
    const blockHeight = lineHeight * lines.length;
    const cx = xPct * canvas.width;
    const cy = yPct * canvas.height;
    const startY = cy - blockHeight / 2 + lineHeight / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontPx}px Impact, "Arial Black", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = strokeColorInput.value;
    ctx.lineWidth = Math.max(2, fontPx * 0.09);
    ctx.fillStyle = fontColorInput.value;

    let maxLineWidth = 0;
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      ctx.strokeText(line, cx, y);
      ctx.fillText(line, cx, y);
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    });

    return { cx, cy, halfW: maxLineWidth / 2, halfH: blockHeight / 2 };
  }

  let hitBoxes = { top: null, bottom: null };

  function render() {
    if (!img) return;
    const rect = getCropRect();
    let w = rect.sw, h = rect.sh;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);

    hitBoxes.top = drawTextBlock(topTextInput.value, state.textPos.top.x, state.textPos.top.y);
    hitBoxes.bottom = drawTextBlock(bottomTextInput.value, state.textPos.bottom.x, state.textPos.bottom.y);
  }

  [topTextInput, bottomTextInput, fontSizeInput, fontColorInput, strokeColorInput, capsToggle]
    .forEach(el => el.addEventListener('input', render));

  // --- Перетаскивание подписей ---
  let dragging = null; // 'top' | 'bottom' | null

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
    for (const key of ['top', 'bottom']) {
      const b = hitBoxes[key];
      if (!b) continue;
      const pad = 14;
      if (Math.abs(pt.x - b.cx) <= b.halfW + pad && Math.abs(pt.y - b.cy) <= b.halfH + pad) {
        return key;
      }
    }
    return null;
  }

  canvas.addEventListener('pointerdown', e => {
    if (!img) return;
    const pt = canvasPointFromEvent(e);
    dragging = hitTest(pt);
    if (dragging) {
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    const pt = canvasPointFromEvent(e);
    state.textPos[dragging].x = Math.min(1, Math.max(0, pt.x / canvas.width));
    state.textPos[dragging].y = Math.min(1, Math.max(0, pt.y / canvas.height));
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
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    img = null;
    cropMode = null;
    topTextInput.value = '';
    bottomTextInput.value = '';
    state.textPos = { top: { x: 0.5, y: 0.08 }, bottom: { x: 0.5, y: 0.90 } };
    editorCard.style.display = 'none';
    dropcard.style.display = 'block';
    fileInput.value = '';
  });

  // --- Загрузка трофея (структура + картинка) — вызывается из вкладки «Очередь» ---
  function loadTrophy(t) {
    loadImageFromSource(t.imageDataUrl);
    topTextInput.value = t.top || '';
    bottomTextInput.value = t.bottom || '';
    fontSizeInput.value = t.fontSize || 46;
    fontColorInput.value = t.color || '#ffffff';
    strokeColorInput.value = t.stroke || '#000000';
    capsToggle.checked = t.caps !== false;
    if (t.textPos) state.textPos = t.textPos;
    toast('Трофей загружен в редактор');
  }

  // --- Очередь постов и Трофеи ---
  document.getElementById('queueBtn').addEventListener('click', async () => {
    if (!img) return;
    const plannedDate = prompt('Плановая дата публикации (ГГГГ-ММ-ДД):', new Date().toISOString().slice(0, 10));
    if (plannedDate === null) return;
    const slot = prompt('Слот: утро или вечер?', 'утро') || 'утро';
    const topic = prompt('Тема (для памяти):', '') || '';
    canvas.toBlob(async blob => {
      if (!blob) { toast('Не удалось собрать PNG'); return; }
      await mmAdd('queue', {
        kind: 'photo', blob, mime: 'image/png',
        plannedDate, slot, topic, createdAt: Date.now()
      });
      toast('Добавлено в очередь постов');
    }, 'image/png');
  });

  document.getElementById('trophyBtn').addEventListener('click', async () => {
    if (!img || !origSrc) return;
    await mmAdd('trophies', {
      kind: 'photo',
      imageDataUrl: origSrc,
      top: topTextInput.value,
      bottom: bottomTextInput.value,
      fontSize: Number(fontSizeInput.value),
      color: fontColorInput.value,
      stroke: strokeColorInput.value,
      caps: capsToggle.checked,
      textPos: state.textPos,
      createdAt: Date.now()
    });
    toast('Сохранено в Трофеи');
  });

  // Экспонируем для межтабового моста (templates.js/queue.js) и программных тестов
  window.__memMachine = { loadImageFromSource, loadTrophy, render, canvas };
})();
