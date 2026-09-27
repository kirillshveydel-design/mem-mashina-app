// Вкладка «Радар» — читает app/radar/feed.json, который наполняет /radar (radar_kit.py)
// из свежих инфоповодов (X/Threads/видео-интервью). Сама генерация текста и выбор момента —
// работа агента в чате, не браузера: здесь только витрина готового и мост в редактор.
(() => {
  const list = document.getElementById('radarList');
  const empty = document.getElementById('radarEmpty');

  const URGENCY_LABEL = { 'срочно': '🔥 Срочно', 'растёт': '📈 Растёт', 'вечнозелёное': '♻️ Вечнозелёное' };

  // Картинка уже открыта в редакторе — подставляем вариант поверх нынешних слотов раскадровки,
  // ничего не перезагружая. Иначе открываем саму раскадровку и сразу раскладываем первый вариант.
  function useVariant(item, variantIdex) {
    const fmt = { key: 'radar:' + item.id, title: item.title, slots: item.slots };
    const texts = item.variants[variantIdex];
    window.mmSwitchTab('photo');
    window.__memMachine.loadImageFromSource(item.image, () => {
      window.__memMachine.applyFormat(fmt, texts);
    });
  }

  function renderItem(item) {
    const el = document.createElement('div');
    el.className = 'card radar-card';
    const variantBtns = item.variants.map((v, i) =>
      `<button class="radar-variant-btn" data-i="${i}">Вариант ${i + 1}</button>`
    ).join('');
    el.innerHTML = `
      <div class="row" style="justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div style="font-weight:700;">${mmEscapeHtml(item.title)}</div>
          <div class="muted" style="margin-top:2px;">${mmEscapeHtml(URGENCY_LABEL[item.urgency] || item.urgency)} · ${mmEscapeHtml(item.kind)}</div>
        </div>
        <a href="${mmEscapeHtml(item.source.url)}" target="_blank" rel="noopener noreferrer" class="muted">${mmEscapeHtml(item.source.label || 'источник')} ↗</a>
      </div>
      <img class="radar-thumb" src="${mmEscapeHtml(item.image)}" loading="lazy" alt="">
      <div class="muted"><b>Почему сейчас:</b> ${mmEscapeHtml(item.why)}</div>
      <div class="muted"><b>Новизна:</b> ${mmEscapeHtml(item.novelty)}</div>
      <div class="row radar-variants">${variantBtns}</div>`;
    el.querySelectorAll('.radar-variant-btn').forEach(btn => {
      btn.addEventListener('click', () => useVariant(item, Number(btn.dataset.i)));
    });
    return el;
  }

  async function refresh() {
    let feed;
    try {
      // no-store поверх сетевого-первым поведения sw.js для radar/* — двойная страховка
      // от вчерашней ленты, застрявшей в кэше.
      const res = await fetch('radar/feed.json', { cache: 'no-store' });
      feed = res.ok ? await res.json() : { items: [] };
    } catch (e) {
      feed = { items: [] };
    }
    const items = feed.items || [];
    list.innerHTML = '';
    empty.style.display = items.length ? 'none' : 'block';
    items.forEach(item => list.appendChild(renderItem(item)));
  }

  window.__memMachineRadar = { refresh };
})();
