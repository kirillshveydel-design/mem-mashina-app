// Блокнот наблюдений — сырьё для вечерних постов
(() => {
  const STORAGE_KEY = 'mm_notes_v1';
  const input = document.getElementById('noteInput');
  const addBtn = document.getElementById('noteAddBtn');
  const list = document.getElementById('notesList');
  const exportBtn = document.getElementById('notesExportBtn');
  const empty = document.getElementById('notesEmpty');

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
