// Генератор подписей в голосе Кирилла — вкладка «Фото»
(() => {
  const CAPTION_BANK = {
    vayb: [
      ['НАПИСАЛ АГЕНТА ЗА ЧАС', 'ТЕПЕРЬ ОН ИЩЕТ МНЕ КЛИЕНТОВ, А Я ИЩУ, КАК ОБЪЯСНИТЬ МАМЕ, ЧЕМ Я ЗАНИМАЮСЬ'],
      ['Я: ПИШУ КОД САМ, КАК В 2010-М', 'МОЙ АГЕНТ: УЖЕ ДЕПЛОИТ И ИЗВИНЯЕТСЯ ЗА МЕНЯ'],
      ['ВАЙБКОДИНГ — ЭТО КОГДА КОД РАБОТАЕТ', 'А ПОЧЕМУ РАБОТАЕТ — ЭТО УЖЕ НЕ КО МНЕ ВОПРОС'],
      ['ПОПРОСИЛ АГЕНТА ПОЧИНИТЬ ОДИН БАГ', 'ОН ПЕРЕПИСАЛ ВСЁ. БАГ БЫЛ ВО МНЕ'],
      ['ТЗ НА 40 СТРАНИЦ', 'Я: НАПИШИ ПРИЛОЖЕНИЕ, НУ ТЫ ПОНЯЛ'],
      ['РЕЗЮМЕ: 10 ЛЕТ ОПЫТА', 'РЕАЛЬНОСТЬ: АГЕНТ, СДЕЛАЙ КРАСИВО'],
      ['ГОВОРИЛИ, ИИ ОТБЕРЁТ РАБОТУ', 'ОН ЗАБРАЛ ТОЛЬКО МОИ ОТМАЗКИ'],
      ['РАССКАЖИТЕ ПРО ВАШ СТЕК', 'МОЙ СТЕК: ПРОМПТ, МОЛИТВА, КНОПКА DEPLOY'],
      ['ПРОДАКШЕН УПАЛ В 3 НОЧИ', 'СПОКОЙНО, АГЕНТ ПОЧИНИЛ. Я УЗНАЛ ИЗ ЕГО ОТЧЁТА'],
      ['РЕВЬЮ КОДА ОТ СИНЬОРА', 'СИНЬОР — ЭТО АГЕНТ. Я — СТАЖЁР ПРИ НЁМ']
    ],
    net: [
      ['4000 КОНТАКТОВ В ЛИНКЕДИН', 'И НИКОГО ПОЗВАТЬ НА ДР. ЗАТО СИНЕРГИЯ'],
      ['«ДАВАЙ СОЗВОНИМСЯ, ЕСТЬ ИДЕЯ»', 'ИДЕИ НЕТ. ЗВОНКА ТОЖЕ. МЫ ОБА ЭТО ЗНАЕМ'],
      ['НАПИСАЛ: «КОЛЛЕГА, ДАВАЙТЕ СИНЕРГИЮ»', 'ОТВЕТИЛИ ЧЕРЕЗ 3 ГОДА. НУ ЧТО, НАЧНЁМ?'],
      ['МОЙ ЛИНКЕДИН: МЫСЛИТЕЛЬ, ВИЗИОНЕР', 'МОЯ ПЕРЕПИСКА: «ЗДРАВСТВУЙТЕ, ЭТО СНОВА Я»'],
      ['ПОЗНАКОМИЛИСЬ НА НЕТВОРКИНГЕ', 'ОБМЕНЯЛИСЬ ВИЗИТКАМИ И МЕЧТАМИ. НЕ ОТВЕЧАЕТ'],
      ['«Я ВАМ НАПИШУ»', 'КЛАССИКА ЖАНРА. ОН НЕ НАПИШЕТ. Я ТОЖЕ'],
      ['ИНВЕСТОР ЛАЙКНУЛ МОЙ ПОСТ', 'УЖЕ ВИДЕЛ ТЕРМШИТ. ЭТО БЫЛ БОТ'],
      ['ЭКСПЕРТ С 500+ КОНТАКТАМИ', 'И НУЛЁМ ДЕЛ. ЗАТО 500+ КОНТАКТОВ']
    ],
    ved: [
      ['ОТПРАВИЛ ГРУЗ БЕЗ ЕДИНОЙ ОШИБКИ В ДОКУМЕНТАХ', 'ШУЧУ. ТАМОЖНЯ НАШЛА. ОНА ВСЕГДА НАХОДИТ'],
      ['ПАРТНЁР: ВСЁ СТРОГО ПО КОНТРАКТУ', 'ПРОПАЛ ПОСЛЕ ПРЕДОПЛАТЫ. КОНТРАКТ БЫЛ КРАСИВЫЙ'],
      ['ИНВОЙС НА 40 ПОЗИЦИЙ', 'ЗАВЕРНУЛИ ИЗ-ЗА ЗАПЯТОЙ. Я ГОРЖУСЬ ЭТОЙ ЗАПЯТОЙ'],
      ['СРОК ДОСТАВКИ — 14 ДНЕЙ', 'ДЕНЬ 47. КОНТЕЙНЕР ЖИВЁТ СВОЮ ЛУЧШУЮ ЖИЗНЬ'],
      ['КЛИЕНТ: «ЧТО ТАМ С ГРУЗОМ?»', 'Я: «ОН В ПУТИ». ГДЕ ЭТОТ ПУТЬ — КОММЕРЧЕСКАЯ ТАЙНА'],
      ['ВЫУЧИЛ ВСЕ ИНКОТЕРМС', 'ЖИЗНЬ ПРИДУМАЛА НОВЫЙ: «САМ РАЗБЕРИСЬ»'],
      ['КУРС ВАЛЮТ ВЫРОС', 'МОЯ МАРЖА — НЕТ. ОНА ВООБЩЕ В ДРУГУЮ СТОРОНУ']
    ],
    work: [
      ['5:00 ПОДЪЁМ, МЕДИТАЦИЯ, ЛЕДЯНОЙ ДУШ', '7:40 ПАНИКА. АГЕНТ УЖЕ СДЕЛАЛ ВСЮ РАБОТУ'],
      ['МОЙ ПРОДУКТИВНЫЙ ДЕНЬ', '3 ЧАСА ВЫБИРАЛ ШРИФТ ДЛЯ ПРЕЗЕНТАЦИИ'],
      ['ЗАПИСАЛ ЦЕЛИ НА ГОД', 'ЯНВАРЬ: НЕ ЗНАЮ ЭТОГО АМБИЦИОЗНОГО ЧЕЛОВЕКА'],
      ['РАБОТАЮ НА СЕБЯ', 'НАЧАЛЬНИК — ТИРАН. НАЧАЛЬНИК — ЭТО Я'],
      ['НЕ ОТВЕЧАЮ НА ПИСЬМА ПОСЛЕ 18:00', 'И ДО 18:00 НЕ ОТВЕЧАЮ. БАЛАНС']
    ]
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const CUSTOM_KEY = 'mm_custom_captions_v1';

  function loadCustomCaptions() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function fullBankForNiche(niche) {
    const builtin = CAPTION_BANK[niche] || [];
    const custom = loadCustomCaptions().filter(c => c.niche === niche).map(c => [c.top, c.bottom]);
    return builtin.concat(custom);
  }

  function poolForNiche(niche) {
    const pool = niche === 'all'
      ? Object.keys(CAPTION_BANK).flatMap(n => fullBankForNiche(n))
      : fullBankForNiche(niche);
    // Никогда повторно не предлагаем уже опубликованную пару.
    return pool.filter(([top, bottom]) => !mmPublishedHasCaption(top, bottom));
  }

  // Колода без повторов на нишу: тасуем один раз, раздаём по одной, когда кончается — тасуем заново.
  const decks = {};
  function nextPair(niche) {
    if (!decks[niche] || decks[niche].length === 0) {
      decks[niche] = shuffle(poolForNiche(niche));
    }
    // Дополнительная подстраховка: если пару опубликовали уже после того, как колода
    // была построена, пропускаем её и берём следующую.
    while (decks[niche].length) {
      const pair = decks[niche].pop();
      if (!mmPublishedHasCaption(pair[0], pair[1])) return pair;
    }
    decks[niche] = shuffle(poolForNiche(niche));
    return decks[niche].length ? decks[niche].pop() : null;
  }

  let currentNiche = 'all';

  const captionRollBtn = document.getElementById('captionRollBtn');
  const eventModePanel = document.getElementById('eventModePanel');

  document.querySelectorAll('#nicheChips [data-niche]').forEach(chip => {
    chip.addEventListener('click', () => {
      currentNiche = chip.dataset.niche;
      document.querySelectorAll('#nicheChips [data-niche]').forEach(c => c.classList.toggle('active', c === chip));
      const isEvent = currentNiche === 'event';
      captionRollBtn.style.display = isEvent ? 'none' : 'block';
      eventModePanel.style.display = isEvent ? 'block' : 'none';
    });
  });

  // --- Индикатор старения банка: «осталось X/Y» на каждом чипе ниши ---
  const REAL_NICHES = Object.keys(CAPTION_BANK); // vayb, net, ved, work

  function refreshChipCounts() {
    REAL_NICHES.forEach(niche => {
      const total = fullBankForNiche(niche).length;
      const remaining = poolForNiche(niche).length;
      const chip = document.querySelector(`#nicheChips [data-niche="${niche}"]`);
      if (!chip) return;
      let fracEl = chip.querySelector('.chip-frac');
      if (!fracEl) {
        fracEl = document.createElement('span');
        fracEl.className = 'chip-frac';
        chip.appendChild(fracEl);
      }
      fracEl.textContent = `${remaining}/${total}`;
      const isLow = total > 0 && remaining / total <= 0.2;
      chip.classList.toggle('chip-low', isLow);
      chip.title = isLow
        ? 'Банк почти исчерпан — попроси Claude в чате дополнить его новыми подписями на основе того, что реально залетело'
        : '';
    });
  }

  refreshChipCounts();
  window.__memMachineCaptions = { refreshChipCounts };

  captionRollBtn.addEventListener('click', () => {
    const pair = nextPair(currentNiche);
    if (!pair) { toast('В этой нише все пары уже опубликованы — добавь свои в следующем обновлении банка'); return; }
    const [top, bottom] = pair;
    const topInput = document.getElementById('topText');
    const bottomInput = document.getElementById('bottomText');
    topInput.value = top;
    bottomInput.value = bottom;
    topInput.dispatchEvent(new Event('input'));
    bottomInput.dispatchEvent(new Event('input'));
  });

  // --- Режим «⚡ Событие» — механическая заготовка из 3 шаблонов, без внешних вызовов ---
  const DAILY_DETAILS = [
    'ВЫБИРАЛ ШРИФТ ДЛЯ ПОСТА',
    'ДОПИСЫВАЮ ЭТОТ ТВИТ ТРЕТИЙ ЧАС',
    'ИЩУ, КАК ЭТО ОБЪЯСНИТЬ МАМЕ',
    'ПРОСТО СМОТРЮ НА ЭТО И МОЛЧУ',
    'ДУМАЮ, КАК ЭТО ВСТАВИТЬ В ПОСТ',
    'ВЫБИРАЮ, КАКОЙ ШРИФТ ПОСТАВИТЬ НА ЭТО'
  ];

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildEventDrafts(rawEvent) {
    const event = rawEvent.trim().toUpperCase();
    return [
      { top: event, bottom: 'А Я ТУТ ' + randomPick(DAILY_DETAILS) },
      { top: 'ВСЕ ОБСУЖДАЮТ: ' + event, bottom: 'Я УЗНАЛ ОБ ЭТОМ ИЗ ЭТОГО ЖЕ ПОСТА' },
      { top: event, bottom: 'ЖДУ, КОГДА ЭТО СТАНЕТ МЕМОМ БЫСТРЕЕ, ЧЕМ Я УСПЕЮ ПОШУТИТЬ' }
    ];
  }

  document.getElementById('eventRollBtn').addEventListener('click', () => {
    const raw = document.getElementById('eventInput').value.trim();
    if (!raw) { toast('Сначала опиши, что произошло'); return; }
    const drafts = buildEventDrafts(raw);
    const container = document.getElementById('eventResults');
    container.innerHTML = '';
    drafts.forEach(d => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.padding = '8px';
      row.style.marginBottom = '6px';
      row.innerHTML = `
        <div style="font-size:13px;">${d.top}</div>
        <div style="font-size:13px; color:var(--muted);">${d.bottom}</div>
        <button style="margin-top:6px;">Использовать</button>`;
      row.querySelector('button').addEventListener('click', () => {
        const topInput = document.getElementById('topText');
        const bottomInput = document.getElementById('bottomText');
        topInput.value = d.top;
        bottomInput.value = d.bottom;
        topInput.dispatchEvent(new Event('input'));
        bottomInput.dispatchEvent(new Event('input'));
        toast('Черновик подставлен — доводи руками');
      });
      container.appendChild(row);
    });
  });
})();
