// «⚡ Сегодня» — точка входа в Photo-таб. Раньше первым, что видел пользователь, был банк
// готовых шуток про вайбкодинг вообще; но мем про сегодняшний инфоповод из своей ленты почти
// всегда обгоняет мем из консервов. Переиспользует движок режима «Событие» из captions.js
// (buildEventDrafts) — это не новая генерация, а вынос уже работавшей механики на видное место.
(() => {
  const input = document.getElementById('todayInput');
  const rollBtn = document.getElementById('todayRollBtn');
  const results = document.getElementById('todayResults');

  // Драфты события — это пара «верх/низ», без формы под конкретный формат. Подходят только
  // двухслотовые форматы (Дрейк, кот, trade offer) — у них ровно два места под текст, как и
  // у любой пары верх/низ. Форматы с 3-4 слотами (План Грю, мозги) сюда не годятся.
  function pickTwoSlotFormatKey() {
    const F = window.__memFormats;
    if (!F) return null;
    const twoSlot = Object.keys(F.FORMATS).filter(k => F.FORMATS[k].slots.length === 2);
    return twoSlot.length ? twoSlot[Math.floor(Math.random() * twoSlot.length)] : null;
  }

  function hasLoadedImage() {
    return document.getElementById('editorCard').style.display !== 'none';
  }

  function useDraft(draft) {
    if (hasLoadedImage()) {
      // Картинка уже открыта — просто подставляем текст, ничего в редакторе не сбрасываем.
      window.__memMachine.addCaptionPair(draft.top, draft.bottom);
      document.getElementById('editorCard').scrollIntoView({ block: 'start' });
      return;
    }
    // Картинки ещё нет — сами подбираем формат под пару текста, а не оставляем чистый холст.
    const key = pickTwoSlotFormatKey();
    if (!key) { toast('Форматы не загрузились — открой картинку вручную'); return; }
    const fmt = window.__memFormats.formatFor(key);
    window.__memMachine.loadImageFromSource('templates-pack/' + key, () => {
      window.__memMachine.applyFormat(fmt, [draft.top, draft.bottom]);
      document.getElementById('editorCard').scrollIntoView({ block: 'start' });
    });
  }

  rollBtn.addEventListener('click', () => {
    const raw = input.value.trim();
    if (!raw) { toast('Сначала одной фразой — что сегодня произошло'); return; }
    if (!window.__memMachineCaptions) { toast('Генератор ещё не загрузился'); return; }
    const drafts = window.__memMachineCaptions.buildEventDrafts(raw);
    results.innerHTML = '';
    drafts.forEach(d => {
      const row = document.createElement('div');
      row.className = 'draft-card';
      row.innerHTML = `
        <div class="top">${mmEscapeHtml(d.top)}</div>
        <div class="bottom">${mmEscapeHtml(d.bottom)}</div>
        <button style="margin-top:6px;">Использовать</button>`;
      row.querySelector('button').addEventListener('click', () => useDraft(d));
      results.appendChild(row);
    });
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') rollBtn.click(); });
})();
