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
        <button class="note-del">✕</button>`;
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
    const picked = shuffle(TOPIC_BANK).slice(0, 5);
    const notes = load();
    const now = Date.now();
    picked.forEach((text, i) => notes.push({ id: now + i + Math.random(), text, ts: now + i }));
    save(notes);
    render();
    toast('Добавлено 5 тем');
  });

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
