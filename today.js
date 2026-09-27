// «⚡ Сегодня» — точка входа в Photo-таб: одна строка про инфоповод → три черновика
// (events.js) → тап открывает готовый мем.
(() => {
  const input = document.getElementById('todayInput');
  const rollBtn = document.getElementById('todayRollBtn');
  const results = document.getElementById('todayResults');

  // Черновик события — пара «что случилось / моя реакция». Она встаёт только на реакционную
  // картинку (грамматика topbottom). Раньше выбирался любой двухслотовый формат, и событие
  // попадало в trade offer как «я получаю: ВСЕ ОБСУЖДАЮТ …» — бессмыслица.
  function pickReactionKey() {
    const F = window.__memFormats;
    const keys = F ? F.reactionKeys() : [];
    if (!keys.length) return null;
    return window.__memStats
      ? window.__memStats.weightedPick(keys, window.__memStats.formatScores())
      : keys[Math.floor(Math.random() * keys.length)];
  }

  function hasLoadedImage() {
    return document.getElementById('editorCard').style.display !== 'none';
  }

  function showEditor() {
    document.getElementById('editorCard').scrollIntoView({ block: 'start' });
  }

  function useDraft(draft) {
    const texts = [draft.top, draft.bottom];
    const current = hasLoadedImage() ? window.__memMachine.currentFormat() : null;
    if (hasLoadedImage() && (!current || current.grammar === 'topbottom')) {
      // Своё фото или реакционная картинка уже открыты — подставляем в них, ничего не сбрасывая.
      if (current) window.__memMachine.applyFormat(current, texts);
      else window.__memMachine.addCaptionPair(draft.top, draft.bottom);
      showEditor();
      return;
    }
    const key = pickReactionKey();
    if (!key) { toast('Шаблоны не загрузились — открой картинку вручную'); return; }
    const fmt = window.__memFormats.formatFor(key);
    if (current) toast(`У «${current.title}» другая форма шутки — открыл «${fmt.title}»`);
    window.__memMachine.loadImageFromSource('templates-pack/' + key, () => {
      window.__memMachine.applyFormat(fmt, texts);
      showEditor();
    });
  }

  rollBtn.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { toast('Сначала одной фразой — что сегодня произошло'); return; }
    const drafts = window.__memEvents.buildEventDrafts(raw);
    results.innerHTML = '';
    drafts.forEach(d => {
      const row = document.createElement('div');
      row.className = 'draft-card';
      row.innerHTML = `
        <div class="top">${mmEscapeHtml(d.top)}</div>
        <div class="bottom">${mmEscapeHtml(d.bottom)}</div>
        <button>Использовать</button>`;
      row.querySelector('button').addEventListener('click', () => useDraft(d));
      results.appendChild(row);
    });
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') rollBtn.click(); });
})();
