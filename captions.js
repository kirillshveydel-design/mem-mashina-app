// Генератор подписей в голосе Кирилла — вкладка «Фото»
(() => {
  // --- Курированные пары: написаны вручную, самые острые. Выдаются первыми. ---
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

  // --- Комбинаторный движок ---
  // Плоский список готовых пар кончается: одна использованная пара = минус одна шутка навсегда.
  // Поэтому шутка разбирается на «форму» и словари подстановок, и одна новая фраза в словаре
  // добавляет не одну шутку, а сразу пачку комбинаций.
  //
  // ВАЖНО про перемешивание. Свободно (декартовым произведением) комбинируются ТОЛЬКО те половины,
  // которые самодостаточны: низ не ссылается местоимением или числом на то, чего в верхе может не
  // оказаться, и не начинается с собственного «СЛОВО:» (после «РЕАЛЬНОСТЬ:» вышло бы двойное
  // двоеточие). Всё, где низ синтаксически привязан к конкретному верху — диалоги («потому что…»,
  // «вернётся»), «первый урок» к курсу, «почти все лайки» к лайкам — лежит готовыми парами
  // в paired и не перемешивается. Иначе получается связный по форме, но бессмысленный текст.
  const VOCAB = {
    vayb: {
      free: [
        { top: 'РЕЗЮМЕ: {a}', bottom: 'РЕАЛЬНОСТЬ: {b}',
          a: ['10 ЛЕТ В РАЗРАБОТКЕ', 'СЕНЬОР-РАЗРАБОТЧИК', 'АРХИТЕКТОР ВЫСОКИХ НАГРУЗОК', 'ФУЛЛСТЕК', 'ТЕХЛИД КОМАНДЫ', 'ЭКСПЕРТ ПО ИИ', 'ПИШУ НА ПЯТИ ЯЗЫКАХ', 'МЕНТОР ДЛЯ ДЖУНОВ'],
          b: ['АГЕНТ, СДЕЛАЙ КРАСИВО', 'ЖМУ ENTER И МОЛЮСЬ', 'ГУГЛЮ, КАК ВЫЙТИ ИЗ VIM', 'МОЙ ГЛАВНЫЙ НАВЫК — ПЕРЕЗАПУСТИТЬ', 'ЧИНЮ, УДАЛЯЯ СТРОЧКИ НАУГАД', 'НЕ ЗНАЮ, ПОЧЕМУ ЭТО РАБОТАЕТ', 'СПРАШИВАЮ У АГЕНТА, ЧТО Я НАПИСАЛ', 'ДВА ЧАСА ИСКАЛ ЗАПЯТУЮ'] },
        { top: '{a}', bottom: '{b}',
          a: ['ПОПРОСИЛ ПОЧИНИТЬ ОДИН БАГ', 'СКАЗАЛ, ЧТО ЭТО НЕБОЛЬШАЯ ПРАВКА', 'ЗАПЛАНИРОВАЛ РЕФАКТОРИНГ НА ЧАС', 'РЕШИЛ ПРОСТО ОБНОВИТЬ БИБЛИОТЕКУ', 'ХОТЕЛ ПОМЕНЯТЬ ОДИН ЦВЕТ'],
          b: ['АГЕНТ ПЕРЕПИСАЛ ВСЁ. БАГ БЫЛ ВО МНЕ', 'ТРЕТИЙ ДЕНЬ. ПРОЕКТ НЕ СОБИРАЕТСЯ', 'ТЕПЕРЬ ЭТО ДРУГОЕ ПРИЛОЖЕНИЕ', 'СЛОМАЛОСЬ ВСЁ, КРОМЕ ТОГО, ЧТО ЧИНИЛ', 'ОТКАТИЛСЯ. ТИХО ЗАКРЫЛ НОУТБУК'] }
      ],
      paired: [
        ['ЗАДЕПЛОИЛ В ПЯТНИЦУ ВЕЧЕРОМ', 'ТЕСТЫ Я ПРОСТО УДАЛИЛ'],
        ['МОЙ КОД ПРОШЁЛ РЕВЬЮ', 'ПИСАЛ АГЕНТ. РЕВЬЮ ТОЖЕ ДЕЛАЛ ОН'],
        ['СОБРАЛ MVP ЗА ВЫХОДНЫЕ', 'РАБОТАЕТ ТОЛЬКО У МЕНЯ НА НОУТЕ'],
        ['ЗАКРЫЛ ВСЕ ТАСКИ В СПРИНТЕ', 'ТАСКИ Я САМ ЖЕ И ЗАВЁЛ'],
        ['«РАССКАЖИТЕ ПРО ВАШ СТЕК»', 'МОЙ СТЕК: ПРОМПТ, МОЛИТВА, КНОПКА DEPLOY'],
        ['«А ВЫ ПОНИМАЕТЕ, КАК ЭТО РАБОТАЕТ?»', 'ПОНИМАЮ. НО ОБЪЯСНИТЬ НЕ МОГУ'],
        ['«ПОКАЖИТЕ КОД»', 'ЭТО НЕ МОЙ КОД. НО Я ЗА НЕГО ОТВЕЧАЮ'],
        ['«СКОЛЬКО У ВАС ОПЫТА?»', 'ОПЫТ БОЛЬШОЙ. ПАМЯТЬ КОРОТКАЯ']
      ]
    },
    net: {
      free: [
        { top: 'РЕЗЮМЕ: {a}', bottom: 'РЕАЛЬНОСТЬ: {b}',
          a: ['4000 КОНТАКТОВ В ЛИНКЕДИН', 'ЛИДЕР МНЕНИЙ', 'СТРОЮ КОМЬЮНИТИ', 'ЭКСПЕРТ, СПИКЕР, НАСТАВНИК', 'МОЙ НЕТВОРК — МОЙ КАПИТАЛ', 'ЗНАЮ ВСЕХ В ОТРАСЛИ'],
          b: ['И НИКОГО ПОЗВАТЬ НА ДР', 'В ПЕРЕПИСКЕ ТОЛЬКО «ЗДРАВСТВУЙТЕ, ЭТО СНОВА Я»', 'ПОСЛЕДНИЙ ОТВЕТ БЫЛ В МАРТЕ', 'КОМЬЮНИТИ — ЭТО Я И ДВА БОТА', 'ЛАЙКАЮ СЕБЯ СО ВТОРОГО АККАУНТА'] },
        { top: '{a}', bottom: '{b}',
          a: ['НАПИСАЛ: «КОЛЛЕГА, ДАВАЙТЕ СИНЕРГИЮ»', 'ДОГОВОРИЛИСЬ СОЗВОНИТЬСЯ', 'ОБМЕНЯЛИСЬ ВИЗИТКАМИ', 'ОБЕЩАЛИ ПОЗНАКОМИТЬ С ИНВЕСТОРОМ'],
          b: ['ОТВЕТИЛИ ЧЕРЕЗ 3 ГОДА. НУ ЧТО, НАЧНЁМ?', 'ПРОШЁЛ ГОД. МЫ ОБА ДЕЛАЕМ ВИД, ЧТО ПОМНИМ', 'С ТЕХ ПОР ТИШИНА В ОБЕ СТОРОНЫ', 'ОКАЗАЛОСЬ, ЭТО БЫЛ БОТ'] }
      ],
      paired: [
        ['СХОДИЛ НА КОНФЕРЕНЦИЮ', 'ЗАПОМНИЛ ТОЛЬКО, ГДЕ БЫЛ КОФЕ'],
        ['ВЫСТУПИЛ НА ПАНЕЛЬНОЙ ДИСКУССИИ', 'МОЯ ЧАСТЬ БЫЛА «СОГЛАСЕН С КОЛЛЕГОЙ»'],
        ['СОБРАЛ 200 ЛАЙКОВ НА ПОСТ', 'ПОЧТИ ВСЕ — ОТ МОИХ ЖЕ ЗНАКОМЫХ'],
        ['«Я ВАМ НАПИШУ»', 'ОН НЕ НАПИШЕТ. Я ТОЖЕ'],
        ['«ДАВАЙ СОЗВОНИМСЯ, ЕСТЬ ИДЕЯ»', 'ИДЕИ НЕТ. ЗВОНКА ТОЖЕ. МЫ ОБА ЭТО ЗНАЕМ'],
        ['«НАДО ПОДУМАТЬ, Я ВЕРНУСЬ»', 'ВЕРНЁТСЯ. В СЛЕДУЮЩЕЙ ЖИЗНИ'],
        ['«ОТПРАВЬТЕ ПРЕЗЕНТАЦИЮ»', 'ОТПРАВИЛ. ПРЕЗЕНТАЦИЯ УШЛА В НИКУДА']
      ]
    },
    ved: {
      free: [
        { top: 'РЕЗЮМЕ: {a}', bottom: 'РЕАЛЬНОСТЬ: {b}',
          a: ['ВЫУЧИЛ ВСЕ ИНКОТЕРМС', 'РАБОТАЮ С КИТАЕМ 10 ЛЕТ', 'У МЕНЯ ВСЁ ПО КОНТРАКТУ', 'ЛОГИСТИКА ВЫСТРОЕНА', 'ЗНАЮ ТАМОЖНЮ КАК СВОИ ПЯТЬ ПАЛЬЦЕВ'],
          b: ['ЖИЗНЬ ПРИДУМАЛА СВОЙ ИНКОТЕРМС: «САМ РАЗБЕРИСЬ»', 'ГУГЛ-ПЕРЕВОДЧИК — МОЙ СТАРШИЙ ПАРТНЁР', 'КОНТРАКТ КРАСИВЫЙ. ДЕНЕГ НЕТ', 'КОНТЕЙНЕР ЖИВЁТ СВОЮ ЛУЧШУЮ ЖИЗНЬ', 'ТАМОЖНЯ ЗНАЕТ МЕНЯ ЛУЧШЕ, ЧЕМ МАМА'] }
      ],
      paired: [
        ['СРОК ДОСТАВКИ — 14 ДНЕЙ', 'ДЕНЬ 47. КОНТЕЙНЕР ГДЕ-ТО ЕСТЬ'],
        ['ОТПРАВИЛ ГРУЗ БЕЗ ЕДИНОЙ ОШИБКИ', 'ТАМОЖНЯ НАШЛА ОШИБКУ. ОНА ВСЕГДА НАХОДИТ'],
        ['ПАРТНЁР ОБЕЩАЛ ВСЁ СТРОГО ПО КОНТРАКТУ', 'ПРОПАЛ ПОСЛЕ ПРЕДОПЛАТЫ. КОНТРАКТ БЫЛ КРАСИВЫЙ'],
        ['ОБЕЩАЛИ РАСТАМОЖИТЬ ЗА ДЕНЬ', 'ДЕНЬ ЧЕТВЁРТЫЙ. ДОКУМЕНТЫ «УТОЧНЯЮТ»'],
        ['ЗАКРЫЛ СДЕЛКУ', 'МАРЖА УШЛА НА ХРАНЕНИЕ В ПОРТУ'],
        ['НАШЁЛ ПОСТАВЩИКА ДЕШЕВЛЕ', 'ТОВАР ПРИШЁЛ. НО НЕ ТОТ'],
        ['ОФОРМИЛ ВСЕ ДОКУМЕНТЫ САМ', 'ПРИНЯЛИ С ЧЕТВЁРТОГО РАЗА'],
        ['«ЧТО ТАМ С ГРУЗОМ?»', 'ОН В ПУТИ. ГДЕ ЭТОТ ПУТЬ — КОММЕРЧЕСКАЯ ТАЙНА'],
        ['«А ПОЧЕМУ ТАК ДОРОГО?»', 'ПОТОМУ ЧТО КУРС. ВСЕГДА КУРС'],
        ['«МЫ ЖЕ ДОГОВАРИВАЛИСЬ НА ПРОШЛОЙ НЕДЕЛЕ»', 'ДОГОВАРИВАЛИСЬ. ПОТОМ БЫЛА ТАМОЖНЯ'],
        ['«ВЫ ТОЧНО ПРОВЕРИЛИ ДОКУМЕНТЫ?»', 'ПРОВЕРИЛ. ДВАЖДЫ. ВСЁ РАВНО ЗАВЕРНУЛИ']
      ]
    },
    work: {
      free: [
        { top: 'РЕЗЮМЕ: {a}', bottom: 'РЕАЛЬНОСТЬ: {b}',
          a: ['РАБОТАЮ НА СЕБЯ', 'У МЕНЯ ЖЁСТКИЙ ТАЙМ-МЕНЕДЖМЕНТ', 'СОБЛЮДАЮ WORK-LIFE BALANCE', 'ВСТАЮ В 5 УТРА', 'ЗАКРЫВАЮ ЗАДАЧИ ПО СИСТЕМЕ'],
          b: ['НАЧАЛЬНИК — ТИРАН. НАЧАЛЬНИК — ЭТО Я', 'ВСЯ СИСТЕМА — ЭТО ПАНИКА В ЧЕТВЕРГ', 'НЕ ОТВЕЧАЮ НИКОМУ И НИКОГДА. ЭТО И ЕСТЬ БАЛАНС', 'ВСТАЮ В 5. СИЖУ В ТЕЛЕФОНЕ ДО 7', 'МОЙ ПЛАННЕР ЖИВЁТ ЛУЧШЕ МЕНЯ'] }
      ],
      paired: [
        ['ЗАПИСАЛ ЦЕЛИ НА ГОД', 'ЯНВАРЬ: НЕ ЗНАЮ ЭТОГО АМБИЦИОЗНОГО ЧЕЛОВЕКА'],
        ['КУПИЛ КУРС ПО ПРОДУКТИВНОСТИ', 'СМОТРЕЛ ПЕРВЫЙ УРОК. ДВАЖДЫ. ЗАСНУЛ'],
        ['НАЧАЛ ВЕСТИ ДНЕВНИК', 'ТРИ ЗАПИСИ. ПОСЛЕДНЯЯ: «ЗАВТРА НАЧНУ»'],
        ['РЕШИЛ ВСТАВАТЬ РАНЬШЕ', 'ВСТАЛ РАНЬШЕ. ЛЁГ ОБРАТНО'],
        ['МОЙ ПРОДУКТИВНЫЙ ДЕНЬ', '3 ЧАСА ВЫБИРАЛ ШРИФТ ДЛЯ ПРЕЗЕНТАЦИИ'],
        ['ЗАКРЫЛ ВАЖНУЮ ЗАДАЧУ', 'ЗАДАЧА БЫЛА «ОТВЕТИТЬ НА ОДНО ПИСЬМО»'],
        ['ПРОВЁЛ ГЛУБОКУЮ РАБОТУ', 'ГЛУБОКО СИДЕЛ В ЛЕНТЕ'],
        ['«ТЫ ЖЕ САМ СЕБЕ НАЧАЛЬНИК»', 'ИМЕННО. ПОЭТОМУ РАБОТАЮ В ВОСКРЕСЕНЬЕ'],
        ['«НУ ТЫ ЖЕ ДОМА, ТЕБЕ ЖЕ ЛЕГЧЕ»', 'ЛЕГЧЕ. РАБОЧИЙ ДЕНЬ ТЕПЕРЬ КРУГЛОСУТОЧНЫЙ'],
        ['«А ЧЕМ ТЫ ВООБЩЕ ЗАНИМАЕШЬСЯ?»', 'ОБЪЯСНЯЛ МАМЕ. ОНА ДО СИХ ПОР МОЛЧИТ'],
        ['«МОЖЕШЬ ЖЕ В ЛЮБОЕ ВРЕМЯ ОТДОХНУТЬ»', 'МОГУ. И ОТДЫХАЮ. С ЧУВСТВОМ ВИНЫ']
      ]
    }
  };

  function generatedPairsForNiche(niche) {
    const v = VOCAB[niche];
    if (!v) return [];
    const out = [];
    (v.free || []).forEach(f => {
      f.a.forEach(a => f.b.forEach(b => out.push([f.top.replace('{a}', a), f.bottom.replace('{b}', b)])));
    });
    (v.paired || []).forEach(p => out.push([p[0], p[1]]));
    return out;
  }

  const generatedCache = {};
  function generatedForNiche(niche) {
    if (!generatedCache[niche]) generatedCache[niche] = generatedPairsForNiche(niche);
    return generatedCache[niche];
  }

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

  // Курированное = ручные пары + добавленные пользователем. Их выдаём раньше сгенерированных.
  function curatedForNiche(niche) {
    const builtin = CAPTION_BANK[niche] || [];
    const custom = loadCustomCaptions().filter(c => c.niche === niche).map(c => [c.top, c.bottom]);
    return builtin.concat(custom);
  }

  const REAL_NICHES = Object.keys(CAPTION_BANK); // vayb, net, ved, work
  const nichesOf = niche => (niche === 'all' ? REAL_NICHES : [niche]);
  const unpublished = pairs => pairs.filter(([top, bottom]) => !mmPublishedHasCaption(top, bottom));

  function curatedPool(niche) {
    return unpublished(nichesOf(niche).flatMap(n => curatedForNiche(n)));
  }
  function generatedPool(niche) {
    return unpublished(nichesOf(niche).flatMap(n => generatedForNiche(n)));
  }

  // Колода без повторов: тасуем один раз, раздаём по одной. Курированные лежат в конце,
  // потому что раздаём через pop() — значит выходят первыми, пока не кончатся.
  const decks = {};
  function buildDeck(niche) {
    return shuffle(generatedPool(niche)).concat(shuffle(curatedPool(niche)));
  }

  function nextPair(niche) {
    if (!decks[niche] || decks[niche].length === 0) decks[niche] = buildDeck(niche);
    // Подстраховка: пару могли опубликовать уже после того, как колода была построена.
    while (decks[niche].length) {
      const pair = decks[niche].pop();
      if (!mmPublishedHasCaption(pair[0], pair[1])) return pair;
    }
    decks[niche] = buildDeck(niche);
    return decks[niche].length ? decks[niche].pop() : null;
  }

  let currentNiche = 'all';

  // Когда выбрано «Все» и уже накопилось достаточно результатов (см. stats.js), 🎲 чуть
  // сильнее налегает на нишу, которая реально приносит вовлечённость — вместо честного
  // равномерного микса. Без данных (или с выбранной конкретной нишей) ведёт себя как раньше.
  function resolveNiche(niche) {
    if (niche !== 'all' || !window.__memStats) return niche;
    const scores = window.__memStats.nicheScores();
    const anyTrusted = REAL_NICHES.some(n => window.__memStats.isTrusted(scores[n]));
    if (!anyTrusted) return niche;
    return window.__memStats.weightedPick(REAL_NICHES, scores) || niche;
  }

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

  // --- Счётчик на чипах: сколько неопубликованных вариантов осталось в нише ---
  // Плюс — если по нише накопилось хотя бы 3 результата (см. stats.js), лучшая по
  // вовлечённости ниша получает значок 🔥. Не догадка, а то же число, что решает 🎲.
  function refreshChipCounts() {
    const scores = window.__memStats ? window.__memStats.nicheScores() : {};
    let bestNiche = null, bestScore = -Infinity;
    REAL_NICHES.forEach(n => {
      const s = scores[n];
      if (window.__memStats && window.__memStats.isTrusted(s) && s.score > bestScore) {
        bestScore = s.score; bestNiche = n;
      }
    });
    REAL_NICHES.forEach(niche => {
      const total = curatedForNiche(niche).length + generatedForNiche(niche).length;
      const remaining = curatedPool(niche).length + generatedPool(niche).length;
      const chip = document.querySelector(`#nicheChips [data-niche="${niche}"]`);
      if (!chip) return;
      let fracEl = chip.querySelector('.chip-frac');
      if (!fracEl) {
        fracEl = document.createElement('span');
        fracEl.className = 'chip-frac';
        chip.appendChild(fracEl);
      }
      fracEl.textContent = `${remaining}`;
      const isLow = total > 0 && remaining / total <= 0.2;
      chip.classList.toggle('chip-low', isLow);
      chip.classList.toggle('chip-top', niche === bestNiche);
      const s = scores[niche];
      const scoreNote = s ? ` · средняя вовлечённость ${s.score.toFixed(1)} (n=${s.n})` : '';
      chip.title = (isLow
        ? 'Комбинации в этой нише почти исчерпаны — попроси Claude в чате дополнить словари'
        : `${remaining} неопубликованных вариантов из ${total}`) + scoreNote
        + (niche === bestNiche ? ' — лучшая ниша по опубликованным результатам' : '');
    });
  }

  refreshChipCounts();

  // --- Кнопка 🎲 знает, какой формат сейчас открыт ---
  // На своём фото это по-прежнему «верх/низ». Но если открыт шаблон с рецептом (Дрейк,
  // мозги, план Грю), кнопка собирает шутку нужной формы и раскладывает её по слотам
  // картинки — а не кидает две строки поверх лица, как раньше.
  const formatHint = document.getElementById('formatHint');

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  function syncFormat() {
    const fmt = window.__memMachine && window.__memMachine.currentFormat
      ? window.__memMachine.currentFormat()
      : null;
    if (fmt) {
      captionRollBtn.textContent = `🎲 Собрать мем: ${fmt.title}`;
      const n = fmt.slots.length;
      formatHint.textContent = `Формат «${fmt.title}» — ${fmt.hint}. Текст встанет в ${n} ${plural(n, 'готовое место', 'готовых места', 'готовых мест')} на картинке.`;
      formatHint.style.display = 'block';
    } else {
      captionRollBtn.textContent = '🎲 Подпись';
      formatHint.style.display = 'none';
    }
  }

  window.__memMachineCaptions = { refreshChipCounts, generatedForNiche, curatedForNiche, REAL_NICHES, nextPair, syncFormat, buildEventDrafts };

  captionRollBtn.addEventListener('click', () => {
    const niche = resolveNiche(currentNiche);
    const fmt = window.__memMachine.currentFormat && window.__memMachine.currentFormat();
    if (fmt) {
      const texts = window.__memFormats.nextVariant(fmt.key, niche);
      if (!texts) { toast('Для этого формата в выбранной нише заготовок нет — переключи нишу'); return; }
      window.__memMachine.applyFormat(fmt, texts);
      return;
    }
    const pair = nextPair(niche);
    if (!pair) { toast('В этой нише все варианты уже опубликованы — добавь свои или попроси дополнить словари'); return; }
    const [top, bottom] = pair;
    window.__memMachine.addCaptionPair(top, bottom);
  });

  // --- Режим «⚡ Событие»: привязывает свежий инфоповод к той же механике самоиронии ---
  // Раньше здесь было 3 жёстких шаблона (у двух низ вообще не менялся) — узнаваемо с третьего раза.
  // Теперь низ собирается из тех же словарей, что и основной банк, поэтому вариантов сотни.
  // Мелкие бытовые дела от первого лица. Отдельный список, а не переиспользование truth/shame:
  // те фразы стоят в прошедшем времени и в конструкцию «а я тут ...» встают коряво.
  const EVENT_TAILS = [
    'ТРЕТИЙ ЧАС ВЫБИРАЮ ШРИФТ ДЛЯ ПОСТА',
    'ПЕРЕКЛАДЫВАЮ ЗАДАЧИ ИЗ СПИСКА В СПИСОК',
    'ЧИНЮ ТО, ЧТО САМ ЖЕ И СЛОМАЛ',
    'ПЯТЫЙ РАЗ ПЕРЕЧИТЫВАЮ ОДНО ПИСЬМО',
    'ЖДУ, КОГДА ЗАГРУЗИТСЯ ПРЕВЬЮ',
    'ОБЪЯСНЯЮ МАМЕ, ЧЕМ Я ЗАНИМАЮСЬ',
    'ИЩУ, КУДА ДЕЛСЯ МОЙ ПОНЕДЕЛЬНИК',
    'СМОТРЮ НА ЭТО И МОЛЧУ'
  ];

  const EVENT_SHAPES = [
    { top: e => e, bottom: v => 'А Я ТУТ ' + v.tail },
    { top: e => 'ВСЕ ОБСУЖДАЮТ: ' + e, bottom: v => 'Я В ЭТО ВРЕМЯ ' + v.tail },
    { top: e => 'МИР: ' + e, bottom: v => 'Я: ' + v.shame },
    { top: e => e, bottom: () => 'Я УЗНАЛ ОБ ЭТОМ ИЗ ЭТОГО ЖЕ ПОСТА' },
    { top: e => e, bottom: () => 'ЖДУ, КОГДА ЭТО СТАНЕТ МЕМОМ БЫСТРЕЕ, ЧЕМ Я УСПЕЮ ПОШУТИТЬ' }
  ];

  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildEventDrafts(rawEvent) {
    const event = rawEvent.trim().toUpperCase();
    // Самоиронию тянем из всех ниш сразу — инфоповод обычно не привязан к одной теме.
    // «Позорную правду» берём из нижней половины формулы «РЕЗЮМЕ/РЕАЛЬНОСТЬ» — это ровно те
    // самодостаточные фразы, что корректно встают после «Я:».
    const shamePool = REAL_NICHES.flatMap(n => (VOCAB[n].free[0] || {}).b || []);
    return shuffle(EVENT_SHAPES).slice(0, 3).map(shape => ({
      top: shape.top(event),
      bottom: shape.bottom({ tail: randomPick(EVENT_TAILS), shame: randomPick(shamePool) })
    }));
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
        <div style="font-size:13px;">${mmEscapeHtml(d.top)}</div>
        <div style="font-size:13px; color:var(--muted);">${mmEscapeHtml(d.bottom)}</div>
        <button style="margin-top:6px;">Использовать</button>`;
      row.querySelector('button').addEventListener('click', () => {
        window.__memMachine.addCaptionPair(d.top, d.bottom);
        toast('Черновик подставлен — доводи руками');
      });
      container.appendChild(row);
    });
  });
})();
