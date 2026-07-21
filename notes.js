// Идеи — сырьё для вечерних постов + генератор тем
(() => {
  const STORAGE_KEY = 'mm_notes_v1';
  const input = document.getElementById('noteInput');
  const addBtn = document.getElementById('noteAddBtn');
  const list = document.getElementById('notesList');
  const exportBtn = document.getElementById('notesExportBtn');
  const empty = document.getElementById('notesEmpty');
  const ideaGenBtn = document.getElementById('ideaGenBtn');

  const TOPIC_BANK = [
    'Агент сделал мою работу, пока я выбирал шрифт',
    'Клиент спросил «а точно агент не наврёт?» — а я не знаю',
    'Таможня завернула груз из-за запятой в инвойсе',
    'Написал «давай синергию» — ответили через полгода',
    'Партнёр пропал после предоплаты',
    'Попросил агента починить баг — он переписал всё',
    'Инвестор лайкнул пост, оказался бот',
    'Срок доставки 14 дней, идёт 47-й',
    'Сказал маме, что я вайбкодер — она молчит',
    'Продакшн упал ночью, починил агент, я спал',
    'На нетворкинге обменялся визитками — никто не пишет',
    'Курс вырос, маржа испарилась',
    'Клиент: «что с грузом?» — груз в пути, где — тайна',
    'Записал цели на год — не узнаю этого человека',
    'Ревью кода делает агент, я при нём стажёр'
  ];

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function save(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function render() {
    const notes = load();
    list.innerHTML = '';
    empty.style.display = notes.length ? 'none' : 'block';
    notes.slice().reverse().forEach(n => {
      const row = document.createElement('div');
      row.className = 'note-row';
      row.innerHTML = `
        <div class="note-text">${n.text}</div>
        <div class="note-date muted">${fmtDate(n.ts)}</div>
        <button class="note-publish" title="Отметить опубликованной — больше не предлагать">✅</button>
        <button class="note-del">✕</button>`;
      row.querySelector('.note-publish').addEventListener('click', () => {
        mmPublishedAdd({ type: 'topic', text: n.text });
        save(load().filter(x => x.id !== n.id));
        render();
        toast('Тема отмечена опубликованной — не предложится снова');
      });
      row.querySelector('.note-del').addEventListener('click', () => {
        save(load().filter(x => x.id !== n.id));
        render();
      });
      list.appendChild(row);
    });
  }

  function addNote() {
    const text = input.value.trim();
    if (!text) return;
    const notes = load();
    notes.push({ id: Date.now() + Math.random(), text, ts: Date.now() });
    save(notes);
    input.value = '';
    render();
  }

  addBtn.addEventListener('click', addNote);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') addNote(); });

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  ideaGenBtn.addEventListener('click', () => {
    const available = TOPIC_BANK.filter(text => !mmPublishedHasTopic(text));
    if (!available.length) { toast('Все темы банка уже опубликованы'); return; }
    const picked = shuffle(available).slice(0, 5);
    const notes = load();
    const now = Date.now();
    picked.forEach((text, i) => notes.push({ id: now + i + Math.random(), text, ts: now + i }));
    save(notes);
    render();
    refreshBankStatus();
    toast(`Добавлено ${picked.length} тем`);
  });

  // --- Индикатор старения банка тем ---
  function refreshBankStatus() {
    const el = document.getElementById('topicBankStatus');
    if (!el) return;
    const total = TOPIC_BANK.length;
    const remaining = TOPIC_BANK.filter(text => !mmPublishedHasTopic(text)).length;
    el.textContent = `Темы: осталось ${remaining}/${total} неопубликованных`;
    const isLow = total > 0 && remaining / total <= 0.2;
    el.classList.toggle('chip-low', isLow);
    el.title = isLow
      ? 'Банк почти исчерпан — попроси Claude в чате дополнить его новыми темами на основе того, что реально залетело'
      : '';
  }
  refreshBankStatus();

  // --- Ручное добавление подписей в банк (custom-captions), без похода в Claude Code ---
  const CUSTOM_CAPTIONS_KEY = 'mm_custom_captions_v1';
  const VALID_NICHES = ['vayb', 'net', 'ved', 'work'];

  function loadCustomCaptions() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_CAPTIONS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCustomCaptions(list) {
    localStorage.setItem(CUSTOM_CAPTIONS_KEY, JSON.stringify(list));
  }

  document.getElementById('customCaptionsAddBtn').addEventListener('click', () => {
    const raw = document.getElementById('customCaptionsInput').value;
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast('Вставь хотя бы одну строку в формате ниша | верх | низ'); return; }

    const parsed = [];
    const errors = [];
    lines.forEach((line, i) => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        errors.push(`строка ${i + 1}: нужно ровно 3 поля через "|"`);
        return;
      }
      const [niche, top, bottom] = parts;
      if (!VALID_NICHES.includes(niche)) {
        errors.push(`строка ${i + 1}: ниша "${niche}" неизвестна (доступны: ${VALID_NICHES.join(', ')})`);
        return;
      }
      parsed.push({ niche, top, bottom });
    });

    if (errors.length) {
      toast('Ошибки: ' + errors.join('; '));
      return;
    }

    const existing = loadCustomCaptions();
    saveCustomCaptions(existing.concat(parsed));
    document.getElementById('customCaptionsInput').value = '';
    toast(`Добавлено ${parsed.length} подписей в custom-банк`);
    if (window.__memMachineCaptions) window.__memMachineCaptions.refreshChipCounts();
  });

  function renderCustomCaptionsList() {
    const container = document.getElementById('customCaptionsList');
    const items = loadCustomCaptions();
    container.innerHTML = items.length
      ? items.map(c => `<div class="muted" style="padding:4px 0; border-bottom:1px solid var(--border);">[${c.niche}] ${c.top} / ${c.bottom}</div>`).join('')
      : '<div class="muted">Custom-банк пуст.</div>';
  }

  document.getElementById('customCaptionsShowBtn').addEventListener('click', () => {
    const container = document.getElementById('customCaptionsList');
    const isHidden = container.style.display === 'none';
    if (isHidden) renderCustomCaptionsList();
    container.style.display = isHidden ? 'block' : 'none';
  });

  document.getElementById('customCaptionsClearBtn').addEventListener('click', () => {
    saveCustomCaptions([]);
    renderCustomCaptionsList();
    toast('Custom-банк очищен');
    if (window.__memMachineCaptions) window.__memMachineCaptions.refreshChipCounts();
  });

  window.__memMachineNotes = { refreshBankStatus };

  exportBtn.addEventListener('click', async () => {
    const notes = load();
    if (!notes.length) { toast('Блокнот пуст'); return; }
    const text = notes.map(n => `[${fmtDate(n.ts)}] ${n.text}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast('Скопировано в буфер — вставь в Claude Code');
    } catch (e) {
      toast('Буфер недоступен, скопируй вручную из консоли');
      console.log(text);
    }
  });

  render();
})();
