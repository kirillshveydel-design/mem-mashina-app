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

  // --- Замазки: прямоугольники поверх чужого текста (заливка цветом + свой текст внутри) ---
  // Координаты x/y/w/h — доли текущего canvas.width/canvas.height, как и у обычных подписей.
  let patches = [];
  let selectedPatchId = null;
  let nextPatchId = 1;
  let patchMode = false;
  let pipetteMode = false;
  let creatingRect = null; // {x0,y0,x1,y1} в пикселях canvas, пока тянем новый прямоугольник
  let draggingPatchId = null;
  let draggingPatchOffset = null; // {dx, dy} — смещение точки захвата от левого верхнего угла
  let resizingPatch = null; // {id, corner}
  let patchBoxes = []; // [{id,x,y,w,h}] в пикселях canvas — обновляется в render()
  let livePreviewId = null; // id патча, который сейчас активно тащат/ресайзят — на время жеста рисуем дешёвый цвет вместо тяжёлого инпейнтинга
  let scanCandidates = []; // [{x,y,w,h}] доли canvas — найденные автопоиском текстовые блоки, ещё не подтверждённые
  let scanMode = false;

  const patchModeBtn = document.getElementById('patchModeBtn');
  const patchModeHint = document.getElementById('patchModeHint');
  const scanTextBtn = document.getElementById('scanTextBtn');
  const scanHint = document.getElementById('scanHint');
  const patchListEl = document.getElementById('patchList');
  const patchEditorEl = document.getElementById('patchEditor');
  const patchFillColor = document.getElementById('patchFillColor');
  const patchEyedropBtn = document.getElementById('patchEyedropBtn');
  const patchSmartFillBtn = document.getElementById('patchSmartFillBtn');
  const patchRadius = document.getElementById('patchRadius');
  const patchTextInput = document.getElementById('patchTextInput');
  const patchFontScale = document.getElementById('patchFontScale');
  const patchTextColor = document.getElementById('patchTextColor');
  const patchStrokeColor = document.getElementById('patchStrokeColor');
  const patchCaps = document.getElementById('patchCaps');

  function getSelectedPatch() {
    return patches.find(p => p.id === selectedPatchId) || null;
  }

  function setScanMode(on) {
    scanMode = on;
    if (!on) scanCandidates = [];
    scanTextBtn.classList.toggle('active', on);
    scanHint.style.display = on && scanCandidates.length ? 'block' : 'none';
  }

  function setPatchMode(on) {
    patchMode = on;
    if (on) setScanMode(false);
    patchModeBtn.classList.toggle('active', on);
    patchModeHint.style.display = on ? 'block' : 'none';
    canvas.style.cursor = on ? 'crosshair' : 'grab';
  }

  patchModeBtn.addEventListener('click', () => setPatchMode(!patchMode));

  scanTextBtn.addEventListener('click', () => {
    if (!img) return;
    setPatchMode(false);
    const found = detectTextRegions();
    scanCandidates = found;
    setScanMode(found.length > 0);
    if (!found.length) {
      toast('Не нашли явных текстовых блоков — попробуй выделить вручную кнопкой «Замазать текст»');
    } else {
      scanHint.style.display = 'block';
      toast('Нашли ' + found.length + ' — кликни по рамке на картинке, чтобы замазать её');
    }
    render();
  });

  function selectPatch(id) {
    selectedPatchId = id;
    syncPatchEditor();
    renderPatchList();
    render();
  }

  function deletePatch(id) {
    patches = patches.filter(p => p.id !== id);
    if (selectedPatchId === id) selectedPatchId = null;
    syncPatchEditor();
    renderPatchList();
    render();
  }

  function renderPatchList() {
    patchListEl.innerHTML = '';
    if (!patches.length) return;
    patches.forEach(p => {
      const chip = document.createElement('button');
      const label = p.text ? p.text.slice(0, 14) + (p.text.length > 14 ? '…' : '') : '(без текста)';
      chip.textContent = '🩹 ' + label;
      chip.className = p.id === selectedPatchId ? 'active' : '';
      chip.addEventListener('click', () => selectPatch(p.id));
      patchListEl.appendChild(chip);
    });
  }

  function syncPatchEditor() {
    const p = getSelectedPatch();
    if (!p) { patchEditorEl.style.display = 'none'; return; }
    patchEditorEl.style.display = 'block';
    patchFillColor.value = p.fillColor;
    patchRadius.value = p.radius;
    patchTextInput.value = p.text;
    patchFontScale.value = Math.round(p.fontScale * 100);
    patchTextColor.value = p.textColor;
    patchStrokeColor.value = p.strokeColor;
    patchCaps.checked = p.caps;
    patchSmartFillBtn.style.display = p.manualColor ? 'inline-block' : 'none';
  }

  [
    [patchRadius, 'radius', el => Number(el.value)],
    [patchTextInput, 'text', el => el.value],
    [patchFontScale, 'fontScale', el => Number(el.value) / 100],
    [patchTextColor, 'textColor', el => el.value],
    [patchStrokeColor, 'strokeColor', el => el.value],
    [patchCaps, 'caps', el => el.checked]
  ].forEach(([el, prop, getVal]) => {
    el.addEventListener('input', () => {
      const p = getSelectedPatch();
      if (!p) return;
      p[prop] = getVal(el);
      if (prop === 'text') renderPatchList();
      render();
    });
  });

  // Выбор цвета вручную (или пипетка) означает «хочу сам решать чем заливать» —
  // переключаем патч в ручной режим, автоматическая умная заливка перестаёт его трогать.
  patchFillColor.addEventListener('input', () => {
    const p = getSelectedPatch();
    if (!p) return;
    p.fillColor = patchFillColor.value;
    p.manualColor = true;
    patchSmartFillBtn.style.display = 'inline-block';
    render();
  });

  patchSmartFillBtn.addEventListener('click', () => {
    const p = getSelectedPatch();
    if (!p) return;
    p.manualColor = false;
    delete p._fillCache;
    patchSmartFillBtn.style.display = 'none';
    render();
  });

  document.getElementById('deletePatchBtn').addEventListener('click', () => {
    if (selectedPatchId != null) deletePatch(selectedPatchId);
  });

  patchEyedropBtn.addEventListener('click', () => {
    if (!getSelectedPatch()) return;
    pipetteMode = true;
    canvas.style.cursor = 'copy';
    toast('Кликни по картинке, чтобы взять цвет');
  });

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  // Медианный цвет кольца пикселей ВОКРУГ прямоугольника (по чистому фону, без уже
  // нарисованных подписей/замазок) — честная замена инпейнтингу без внешних AI-вызовов:
  // отлично работает на однотонном/слабоградиентном фоне, на сложной текстуре будет заметна заплатка.
  function sampleBorderColor(px, py, pw, ph) {
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const octx = off.getContext('2d', { willReadFrequently: true });
    const rect = getCropRect();
    octx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);
    let data;
    try {
      data = octx.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (e) {
      return '#ffffff';
    }
    const thickness = 4;
    const rs = [], gs = [], bs = [];
    function pushPixel(x, y) {
      x = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
      y = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
      const idx = (y * canvas.width + x) * 4;
      rs.push(data[idx]); gs.push(data[idx + 1]); bs.push(data[idx + 2]);
    }
    for (let x = px - thickness; x <= px + pw + thickness; x += 3) {
      for (let t = 1; t <= thickness; t++) { pushPixel(x, py - t); pushPixel(x, py + ph + t); }
    }
    for (let y = py - thickness; y <= py + ph + thickness; y += 3) {
      for (let t = 1; t <= thickness; t++) { pushPixel(px - t, y); pushPixel(px + pw + t, y); }
    }
    if (!rs.length) return '#ffffff';
    const median = arr => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    return rgbToHex(median(rs), median(gs), median(bs));
  }

  function createPatchAt(x0, y0, w, h) {
    const patch = {
      id: nextPatchId++,
      x: x0 / canvas.width, y: y0 / canvas.height,
      w: w / canvas.width, h: h / canvas.height,
      manualColor: false, // по умолчанию — умная заливка (инпейнтинг); ручной цвет только если сам выберешь
      fillColor: sampleBorderColor(x0, y0, w, h), // стартовое значение на случай, если переключишься на ручной цвет
      radius: 0,
      text: '',
      fontScale: 1,
      textColor: '#ffffff',
      strokeColor: '#000000',
      caps: true
    };
    patches.push(patch);
    selectPatch(patch.id);
    render();
    patchTextInput.focus();
    return patch;
  }

  function finalizeNewPatch(r) {
    const x0 = Math.max(0, Math.min(canvas.width, Math.min(r.x0, r.x1)));
    const y0 = Math.max(0, Math.min(canvas.height, Math.min(r.y0, r.y1)));
    const x1 = Math.max(0, Math.min(canvas.width, Math.max(r.x0, r.x1)));
    const y1 = Math.max(0, Math.min(canvas.height, Math.max(r.y0, r.y1)));
    const w = x1 - x0, h = y1 - y0;
    if (w < 12 || h < 12) {
      toast('Слишком маленькая область — потяни посильнее');
      return;
    }
    createPatchAt(x0, y0, w, h);
  }

  // --- Автопоиск текста на фото (эвристика без ИИ и без внешних вызовов) ---
  // Ищем блоки с плотным локальным контрастом (штрихи букв дают резкие перепады яркости),
  // группируем их в прямоугольники-кандидаты. Работает надёжно на типичных подписях мемов
  // (жирный текст с обводкой), но может промахиваться на сложных фото — это честный компромисс
  // без тяжёлых ИИ-моделей, поэтому ручное выделение («Замазать текст») остаётся как основной способ.
  function detectTextRegions() {
    const rect = getCropRect();
    const ANALYSIS_MAX = 500;
    const scale = Math.min(1, ANALYSIS_MAX / Math.max(canvas.width, canvas.height));
    const aw = Math.max(1, Math.round(canvas.width * scale));
    const ah = Math.max(1, Math.round(canvas.height * scale));

    const off = document.createElement('canvas');
    off.width = aw; off.height = ah;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, aw, ah);
    let data;
    try {
      data = octx.getImageData(0, 0, aw, ah).data;
    } catch (e) {
      return [];
    }

    const gray = new Float32Array(aw * ah);
    for (let i = 0; i < aw * ah; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    const grad = new Float32Array(aw * ah);
    let sum = 0;
    for (let y = 1; y < ah - 1; y++) {
      for (let x = 1; x < aw - 1; x++) {
        const i = y * aw + x;
        const gx = gray[i + 1] - gray[i - 1];
        const gy = gray[i + aw] - gray[i - aw];
        const g = Math.abs(gx) + Math.abs(gy);
        grad[i] = g;
        sum += g;
      }
    }
    const mean = sum / (aw * ah);
    let variance = 0;
    for (let i = 0; i < aw * ah; i++) { const d = grad[i] - mean; variance += d * d; }
    const std = Math.sqrt(variance / (aw * ah));
    const threshold = mean + std * 0.8;

    // Блочная плотность краёв: текст — это локально «частый частокол» контрастных штрихов.
    const BLOCK = Math.max(3, Math.round(Math.min(aw, ah) / 90));
    const bw = Math.ceil(aw / BLOCK), bh = Math.ceil(ah / BLOCK);
    const density = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let edgeCount = 0, total = 0;
        const x0 = bx * BLOCK, y0 = by * BLOCK;
        for (let y = y0; y < Math.min(ah, y0 + BLOCK); y++) {
          for (let x = x0; x < Math.min(aw, x0 + BLOCK); x++) {
            total++;
            if (grad[y * aw + x] > threshold) edgeCount++;
          }
        }
        density[by * bw + bx] = total ? edgeCount / total : 0;
      }
    }

    const DENSITY_MIN = 0.18;
    const candidate = new Uint8Array(bw * bh);
    for (let i = 0; i < bw * bh; i++) candidate[i] = density[i] >= DENSITY_MIN ? 1 : 0;

    // Связные компоненты по сетке блоков (4-связность).
    const visited = new Uint8Array(bw * bh);
    const blobs = [];
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const start = by * bw + bx;
        if (!candidate[start] || visited[start]) continue;
        let minX = bx, maxX = bx, minY = by, maxY = by, count = 0;
        const stack = [[bx, by]];
        visited[start] = 1;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          count++;
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
            const ni = ny * bw + nx;
            if (candidate[ni] && !visited[ni]) { visited[ni] = 1; stack.push([nx, ny]); }
          }
        }
        blobs.push({ minX, maxX, minY, maxY, count });
      }
    }

    const results = [];
    for (const b of blobs) {
      const bxPx0 = b.minX * BLOCK, byPx0 = b.minY * BLOCK;
      const bxPx1 = Math.min(aw, (b.maxX + 1) * BLOCK), byPx1 = Math.min(ah, (b.maxY + 1) * BLOCK);
      const bw_ = bxPx1 - bxPx0, bh_ = byPx1 - byPx0;
      if (bw_ < aw * 0.03 || bh_ < ah * 0.012) continue; // слишком маленькое — скорее шум
      if (bw_ > aw * 0.9 && bh_ > ah * 0.5) continue; // почти весь кадр — не текст, а сложная сцена
      const aspect = bw_ / bh_;
      if (aspect < 1.0 || aspect > 18) continue; // текстовые строки обычно шире, чем выше
      const pad = Math.round(Math.min(bw_, bh_) * 0.15);
      const fx0 = Math.max(0, bxPx0 - pad), fy0 = Math.max(0, byPx0 - pad);
      const fx1 = Math.min(aw, bxPx1 + pad), fy1 = Math.min(ah, byPx1 + pad);
      results.push({ x: fx0 / aw, y: fy0 / ah, w: (fx1 - fx0) / aw, h: (fy1 - fy0) / ah, score: b.count });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 8);
  }

  function useScanCandidate(cand) {
    const x0 = cand.x * canvas.width, y0 = cand.y * canvas.height;
    const w = cand.w * canvas.width, h = cand.h * canvas.height;
    createPatchAt(x0, y0, w, h);
    scanCandidates = scanCandidates.filter(c => c !== cand);
    if (!scanCandidates.length) setScanMode(false);
  }

  function hitTestScanCandidate(pt) {
    for (let i = scanCandidates.length - 1; i >= 0; i--) {
      const c = scanCandidates[i];
      const x = c.x * canvas.width, y = c.y * canvas.height;
      const w = c.w * canvas.width, h = c.h * canvas.height;
      if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) return c;
    }
    return null;
  }

  // --- Умная заливка (упрощённый безИИ-инпейнтинг, идея как у классического Telea/FMM) ---
  // Затравка неизвестной области средним цветом каймы, дальше — гармоническая релаксация
  // (усреднение соседей), которая тянет цвет и мягкий градиент фона внутрь пятна.
  // Честно: даёт гладкое правдоподобное пятно на однотонном/градиентном фоне, на сложной
  // текстуре (лица, волосы, орнамент) выглядит размыто — это ожидаемый предел метода без ИИ.
  function computeInpaint(px, py, pw, ph) {
    const PAD = Math.max(8, Math.round(Math.min(pw, ph) * 0.25));
    const rx0 = Math.max(0, px - PAD), ry0 = Math.max(0, py - PAD);
    const rx1 = Math.min(canvas.width, px + pw + PAD), ry1 = Math.min(canvas.height, py + ph + PAD);
    const rw = rx1 - rx0, rh = ry1 - ry0;

    const base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const bctx = base.getContext('2d', { willReadFrequently: true });
    const rect = getCropRect();
    bctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);

    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(pw));
    out.height = Math.max(1, Math.round(ph));

    let workData;
    try {
      workData = bctx.getImageData(rx0, ry0, rw, rh);
    } catch (e) {
      return out; // без доступа к пикселям (CORS) — вернём пустой прозрачный канвас, ниже есть фолбэк
    }

    // Даунскейл рабочего буфера для скорости релаксации на больших пятнах.
    const MAX_WORK = 130;
    const workScale = Math.min(1, MAX_WORK / Math.max(rw, rh));
    const ww = Math.max(1, Math.round(rw * workScale));
    const wh = Math.max(1, Math.round(rh * workScale));

    const workCanvas = document.createElement('canvas');
    workCanvas.width = rw; workCanvas.height = rh;
    workCanvas.getContext('2d').putImageData(workData, 0, 0);

    const small = document.createElement('canvas');
    small.width = ww; small.height = wh;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(workCanvas, 0, 0, rw, rh, 0, 0, ww, wh);
    const imgData = sctx.getImageData(0, 0, ww, wh);
    const data = imgData.data;

    const mx0 = Math.max(0, Math.round((px - rx0) * workScale));
    const my0 = Math.max(0, Math.round((py - ry0) * workScale));
    const mx1 = Math.min(ww, Math.round((px + pw - rx0) * workScale));
    const my1 = Math.min(wh, Math.round((py + ph - ry0) * workScale));

    const unknown = new Uint8Array(ww * wh);
    for (let y = my0; y < my1; y++) {
      for (let x = mx0; x < mx1; x++) unknown[y * ww + x] = 1;
    }

    let sr = 0, sg = 0, sb = 0, sc = 0;
    for (let i = 0; i < ww * wh; i++) {
      if (!unknown[i]) { const idx = i * 4; sr += data[idx]; sg += data[idx + 1]; sb += data[idx + 2]; sc++; }
    }
    const avgR = sc ? sr / sc : 220, avgG = sc ? sg / sc : 220, avgB = sc ? sb / sc : 220;
    for (let i = 0; i < ww * wh; i++) {
      if (unknown[i]) { const idx = i * 4; data[idx] = avgR; data[idx + 1] = avgG; data[idx + 2] = avgB; }
    }

    const ITERS = 120;
    for (let iter = 0; iter < ITERS; iter++) {
      for (let y = 0; y < wh; y++) {
        for (let x = 0; x < ww; x++) {
          const i = y * ww + x;
          if (!unknown[i]) continue;
          let cr = 0, cg = 0, cb = 0, cnt = 0;
          if (x > 0) { const j = (i - 1) * 4; cr += data[j]; cg += data[j + 1]; cb += data[j + 2]; cnt++; }
          if (x < ww - 1) { const j = (i + 1) * 4; cr += data[j]; cg += data[j + 1]; cb += data[j + 2]; cnt++; }
          if (y > 0) { const j = (i - ww) * 4; cr += data[j]; cg += data[j + 1]; cb += data[j + 2]; cnt++; }
          if (y < wh - 1) { const j = (i + ww) * 4; cr += data[j]; cg += data[j + 1]; cb += data[j + 2]; cnt++; }
          if (!cnt) continue;
          const idx = i * 4;
          data[idx] = cr / cnt; data[idx + 1] = cg / cnt; data[idx + 2] = cb / cnt;
        }
      }
    }

    sctx.putImageData(imgData, 0, 0);

    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.drawImage(small, mx0, my0, Math.max(1, mx1 - mx0), Math.max(1, my1 - my0), 0, 0, out.width, out.height);
    return out;
  }

  function ensurePatchFill(p, x, y, w, h) {
    const sig = `${x},${y},${w},${h},${cropMode}`;
    if (p._fillCache && p._fillCache.sig === sig) return p._fillCache.canvas;
    const tex = computeInpaint(x, y, w, h);
    p._fillCache = { sig, canvas: tex };
    return tex;
  }

  function fitPatchFont(text, w, h) {
    let px = Math.floor(Math.min(h * 0.7, 80));
    const minPx = 8;
    while (px > minPx) {
      const lines = wrapLines(text, w * 0.9, px);
      if (lines.length <= 3 && lines.length * px * 1.15 <= h * 0.9) return px;
      px -= 2;
    }
    return minPx;
  }

  function drawPatch(p) {
    const x = Math.round(p.x * canvas.width), y = Math.round(p.y * canvas.height);
    const w = Math.round(p.w * canvas.width), h = Math.round(p.h * canvas.height);
    const r = Math.max(0, Math.min(p.radius, w / 2, h / 2));

    ctx.save();
    ctx.beginPath();
    if (r > 0) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.clip();

    if (p.manualColor) {
      ctx.fillStyle = p.fillColor;
      ctx.fillRect(x, y, w, h);
    } else if (p.id === livePreviewId) {
      // Пока активно тащим/ресайзим — дешёвый цвет вместо тяжёлой релаксации, для отзывчивости.
      ctx.fillStyle = sampleBorderColor(x, y, w, h);
      ctx.fillRect(x, y, w, h);
    } else {
      const tex = ensurePatchFill(p, x, y, w, h);
      ctx.drawImage(tex, x, y, w, h);
    }
    ctx.restore();

    if (p.text) {
      const rawText = p.caps ? p.text.toUpperCase() : p.text;
      const basePx = fitPatchFont(rawText, w, h);
      const fontPx = Math.max(6, Math.round(basePx * p.fontScale));
      const lines = wrapLines(rawText, w * 0.9, fontPx);
      const lineHeight = fontPx * 1.15;
      const blockH = lineHeight * lines.length;
      const cx = x + w / 2, cy = y + h / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${fontPx}px Impact, "Arial Black", sans-serif`;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = p.strokeColor;
      ctx.lineWidth = Math.max(2, fontPx * 0.09);
      ctx.fillStyle = p.textColor;

      lines.forEach((line, i) => {
        const ly = cy - blockH / 2 + lineHeight / 2 + i * lineHeight;
        ctx.strokeText(line, cx, ly);
        ctx.fillText(line, cx, ly);
      });
    }

    if (p.id === selectedPatchId) {
      ctx.save();
      ctx.strokeStyle = '#ffcd00';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffcd00';
      const HANDLE = 5;
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([hx, hy]) => {
        ctx.fillRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
      });
      ctx.restore();
    }

    return { id: p.id, x, y, w, h };
  }

  function hitTestPatchHandle(pt) {
    if (selectedPatchId == null) return null;
    const box = patchBoxes.find(b => b.id === selectedPatchId);
    if (!box) return null;
    const HANDLE_R = 14;
    const corners = [
      { corner: 'nw', x: box.x, y: box.y },
      { corner: 'ne', x: box.x + box.w, y: box.y },
      { corner: 'sw', x: box.x, y: box.y + box.h },
      { corner: 'se', x: box.x + box.w, y: box.y + box.h }
    ];
    for (const c of corners) {
      if (Math.abs(pt.x - c.x) <= HANDLE_R && Math.abs(pt.y - c.y) <= HANDLE_R) return { id: box.id, corner: c.corner };
    }
    return null;
  }

  function hitTestPatchBody(pt) {
    for (let i = patchBoxes.length - 1; i >= 0; i--) {
      const b = patchBoxes[i];
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return b.id;
    }
    return null;
  }

  function resizePatchTo(r, pt) {
    const patch = patches.find(p => p.id === r.id);
    if (!patch) return;
    let x0 = patch.x * canvas.width, y0 = patch.y * canvas.height;
    let x1 = x0 + patch.w * canvas.width, y1 = y0 + patch.h * canvas.height;
    if (r.corner.includes('w')) x0 = pt.x; else x1 = pt.x;
    if (r.corner.includes('n')) y0 = pt.y; else y1 = pt.y;
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    const w = Math.max(12, maxX - minX), h = Math.max(12, maxY - minY);
    patch.x = Math.max(0, minX) / canvas.width;
    patch.y = Math.max(0, minY) / canvas.height;
    patch.w = Math.min(canvas.width, w) / canvas.width;
    patch.h = Math.min(canvas.height, h) / canvas.height;
  }

  function movePatchTo(id, pt) {
    const patch = patches.find(p => p.id === id);
    if (!patch) return;
    const w = patch.w * canvas.width, h = patch.h * canvas.height;
    let x0 = pt.x - draggingPatchOffset.dx;
    let y0 = pt.y - draggingPatchOffset.dy;
    x0 = Math.max(0, Math.min(canvas.width - w, x0));
    y0 = Math.max(0, Math.min(canvas.height - h, y0));
    patch.x = x0 / canvas.width;
    patch.y = y0 / canvas.height;
  }

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
      patches = [];
      selectedPatchId = null;
      setPatchMode(false);
      setScanMode(false);
      dropcard.style.display = 'none';
      editorCard.style.display = 'block';
      if (onLoaded) onLoaded();
      renderCaptionList();
      syncCaptionEditor();
      renderPatchList();
      syncPatchEditor();
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

    patchBoxes = patches.map(p => drawPatch(p));
    hitBoxes = captions.map(cap => drawCaption(cap)).filter(Boolean);

    if (creatingRect) {
      const x = Math.min(creatingRect.x0, creatingRect.x1);
      const y = Math.min(creatingRect.y0, creatingRect.y1);
      const w = Math.abs(creatingRect.x1 - creatingRect.x0);
      const h = Math.abs(creatingRect.y1 - creatingRect.y0);
      ctx.save();
      ctx.strokeStyle = '#ffcd00';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }

    if (scanMode && scanCandidates.length) {
      ctx.save();
      scanCandidates.forEach((c, i) => {
        const x = c.x * canvas.width, y = c.y * canvas.height;
        const w = c.w * canvas.width, h = c.h * canvas.height;
        ctx.strokeStyle = '#4ade80';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 14px sans-serif';
        const label = String(i + 1);
        const badgeR = 11;
        ctx.beginPath();
        ctx.arc(x + badgeR, y + badgeR, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111214';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + badgeR, y + badgeR + 1);
      });
      ctx.restore();
    }
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

    if (pipetteMode) {
      const px = Math.max(0, Math.min(canvas.width - 1, Math.round(pt.x)));
      const py = Math.max(0, Math.min(canvas.height - 1, Math.round(pt.y)));
      const d = ctx.getImageData(px, py, 1, 1).data;
      const hex = rgbToHex(d[0], d[1], d[2]);
      const p = getSelectedPatch();
      if (p) {
        p.fillColor = hex;
        p.manualColor = true;
        patchFillColor.value = hex;
        patchSmartFillBtn.style.display = 'inline-block';
        render();
      }
      pipetteMode = false;
      canvas.style.cursor = patchMode ? 'crosshair' : 'grab';
      return;
    }

    if (scanMode) {
      const cand = hitTestScanCandidate(pt);
      if (cand) { useScanCandidate(cand); render(); }
      else { setScanMode(false); render(); }
      return;
    }

    if (patchMode) {
      creatingRect = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const handle = hitTestPatchHandle(pt);
    if (handle) {
      resizingPatch = handle;
      livePreviewId = handle.id;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const hitCapId = hitTest(pt);
    if (hitCapId != null) {
      dragging = hitCapId;
      if (hitCapId !== selectedCaptionId) selectCaption(hitCapId);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      return;
    }

    const hitPatchId = hitTestPatchBody(pt);
    if (hitPatchId != null) {
      const box = patchBoxes.find(b => b.id === hitPatchId);
      draggingPatchId = hitPatchId;
      livePreviewId = hitPatchId;
      draggingPatchOffset = { dx: pt.x - box.x, dy: pt.y - box.y };
      if (hitPatchId !== selectedPatchId) selectPatch(hitPatchId);
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('pointermove', e => {
    const pt = canvasPointFromEvent(e);

    if (creatingRect) {
      creatingRect.x1 = pt.x;
      creatingRect.y1 = pt.y;
      render();
      return;
    }
    if (resizingPatch) {
      resizePatchTo(resizingPatch, pt);
      render();
      return;
    }
    if (dragging != null) {
      const cap = captions.find(c => c.id === dragging);
      if (!cap) return;
      cap.x = Math.min(1, Math.max(0, pt.x / canvas.width));
      cap.y = Math.min(1, Math.max(0, pt.y / canvas.height));
      render();
      return;
    }
    if (draggingPatchId != null) {
      movePatchTo(draggingPatchId, pt);
      render();
    }
  });

  ['pointerup', 'pointercancel'].forEach(evt =>
    canvas.addEventListener(evt, () => {
      if (creatingRect) {
        finalizeNewPatch(creatingRect);
        creatingRect = null;
        setPatchMode(false);
        renderPatchList();
        return;
      }
      resizingPatch = null;
      dragging = null;
      draggingPatchId = null;
      canvas.style.cursor = 'grab';
      if (livePreviewId != null) {
        livePreviewId = null;
        render(); // финальный проход умной заливки после отпускания — во время жеста рисовали дешёвый цвет
      }
    })
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

  function resetEditor() {
    img = null;
    cropMode = null;
    stripTop = 0;
    stripBottom = 0;
    stripPanel.style.display = 'none';
    captions = [];
    selectedCaptionId = null;
    patches = [];
    selectedPatchId = null;
    setPatchMode(false);
    setScanMode(false);
    renderCaptionList();
    syncCaptionEditor();
    renderPatchList();
    syncPatchEditor();
    editorCard.style.display = 'none';
    dropcard.style.display = 'block';
    fileInput.value = '';
  }

  document.getElementById('resetBtn').addEventListener('click', resetEditor);
  document.getElementById('closeEditorBtn').addEventListener('click', resetEditor);

  // --- Загрузка трофея (структура + картинка) — вызывается из вкладки «Очередь» ---
  function loadTrophy(t) {
    loadImageFromSource(t.imageDataUrl, () => {
      if (t.patches && t.patches.length) {
        patches = t.patches.map(p => ({ ...p, id: nextPatchId++ }));
      }
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
      patches: patches.map(({ id, _fillCache, ...rest }) => rest),
      createdAt: Date.now()
    });
    toast('Сохранено в Трофеи');
  });

  renderCaptionList();

  // Экспонируем для межтабового моста (templates.js/queue.js/captions.js) и программных тестов
  window.__memMachine = { loadImageFromSource, loadTrophy, addCaption, addCaptionPair, render, canvas };
})();
