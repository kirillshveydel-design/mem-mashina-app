#!/usr/bin/env node
// Тесты без фреймворка и без зависимостей — соответствует правилу проекта «никаких сборок».
// Запуск: node tests/run.js
'use strict';
const path = require('path');
const assert = require('assert');

let failures = 0, passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log('      ' + e.message);
  }
}

// ---------------------------------------------------------------------------
// formats.js — инвариант: длина набора реплик = число слотов формата. Это тот самый
// баг («Дрейк» получал две строки поверх лица), который эти форматы чинят — если
// инвариант сломается снова, applyFormat молча потеряет или обрежет реплики.
// ---------------------------------------------------------------------------
(function testFormats() {
  global.window = {};
  require(path.join(__dirname, '..', 'formats.js'));
  const F = global.window.__memFormats;
  const NICHES = ['vayb', 'net', 'ved', 'work'];

  Object.entries(F.FORMATS).forEach(([key, fmt]) => {
    const need = fmt.slots.length;
    const g = F.GRAMMARS[fmt.grammar];
    test(`formats: ${key} — грамматика "${fmt.grammar}" объявляет ${need} слотов`, () => {
      assert.strictEqual(g.slots, need);
    });
    NICHES.forEach(n => {
      const variants = g.variants(n);
      test(`formats: ${key}/${n} — все наборы длиной ${need}, без пустых строк`, () => {
        variants.forEach((v, i) => {
          assert.strictEqual(v.length, need, `набор #${i}: ${JSON.stringify(v)}`);
          v.forEach(s => assert.ok(typeof s === 'string' && s.trim(), `пустая реплика в наборе #${i}`));
        });
      });
    });
  });

  test('formats: nextVariant отдаёт наборы без повторов, пока не исчерпает колоду', () => {
    const key = 'tpl_181913649.jpg';
    const total = NICHES.reduce((n, niche) => n + F.countFor(key, niche), 0);
    const seen = new Set();
    for (let i = 0; i < total; i++) {
      const v = F.nextVariant(key, 'all');
      assert.ok(v, `вариант #${i} не должен быть null раньше исчерпания колоды`);
      seen.add(JSON.stringify(v));
    }
    assert.strictEqual(seen.size, total, 'все выданные наборы должны быть уникальны в пределах одного прохода колоды');
  });

  test('formats: list() возвращает title/hint/slots/count для каждого формата', () => {
    F.list('all').forEach(f => {
      assert.ok(f.key && f.title && f.hint);
      assert.ok(f.slots > 0);
      assert.ok(f.count >= 0);
    });
  });
})();

// ---------------------------------------------------------------------------
// stats.js — петля обратной связи: score должен быть обычным средним, isTrusted должен
// резать по MIN_SAMPLE, weightedPick не должен никогда полностью занулять кандидата.
// ---------------------------------------------------------------------------
(function testStats() {
  global.window = {};
  global.mmPublishedAll = () => global.__fakePublished || [];
  require(path.join(__dirname, '..', 'stats.js'));
  const S = global.window.__memStats;

  test('stats: engagement = likes + comments*2 + reposts*3', () => {
    assert.strictEqual(S.engagement({ likes: 10, comments: 2, reposts: 1 }), 10 + 4 + 3);
    assert.strictEqual(S.engagement({ likes: null, comments: null, reposts: null }), 0);
  });

  test('stats: nicheScores считает среднее по нише и число замеров n', () => {
    global.__fakePublished = [
      { niche: 'vayb', likes: 10, comments: 0, reposts: 0 },
      { niche: 'vayb', likes: 20, comments: 0, reposts: 0 },
      { niche: 'work', likes: 5, comments: 0, reposts: 0 },
    ];
    const s = S.nicheScores();
    assert.strictEqual(s.vayb.n, 2);
    assert.strictEqual(s.vayb.score, 15);
    assert.strictEqual(s.work.n, 1);
  });

  test('stats: записи без likes/comments/reposts (ещё не внесён результат) не считаются', () => {
    global.__fakePublished = [
      { niche: 'vayb', likes: null, comments: null, reposts: null },
      { niche: 'vayb', likes: 10, comments: 0, reposts: 0 },
    ];
    const s = S.nicheScores();
    assert.strictEqual(s.vayb.n, 1, 'запись без единого числа результата не должна попадать в выборку');
  });

  test(`stats: isTrusted требует n >= MIN_SAMPLE (${S.MIN_SAMPLE})`, () => {
    assert.strictEqual(S.isTrusted({ score: 100, n: S.MIN_SAMPLE - 1 }), false);
    assert.strictEqual(S.isTrusted({ score: 0, n: S.MIN_SAMPLE }), true);
    assert.strictEqual(S.isTrusted(null), false);
    assert.strictEqual(S.isTrusted(undefined), false);
  });

  test('stats: weightedPick без доверенных данных ведёт себя как честный равномерный выбор', () => {
    const keys = ['a', 'b', 'c'];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 3000; i++) counts[S.weightedPick(keys, {})]++;
    // при равных весах ни один ключ не должен набрать заметно больше трети — допуск щедрый,
    // чтобы тест не был хрупким к случайности, но ловил реальный перекос (например, деление на 0)
    Object.values(counts).forEach(c => assert.ok(c > 700 && c < 1300, `распределение неровное: ${JSON.stringify(counts)}`));
  });

  test('stats: weightedPick смещает выбор к лучшему по score кандидату, не зануляя остальных', () => {
    const keys = ['good', 'bad'];
    const scores = { good: { score: 50, n: 10 }, bad: { score: 0, n: 10 } };
    const counts = { good: 0, bad: 0 };
    for (let i = 0; i < 3000; i++) counts[S.weightedPick(keys, scores)]++;
    assert.ok(counts.good > counts.bad * 3, `good должен явно обгонять bad: ${JSON.stringify(counts)}`);
    assert.ok(counts.bad > 0, 'bad не должен занулиться полностью — это ломает разнообразие');
  });
})();

// ---------------------------------------------------------------------------
// textutils.js — форматирование тем для «Идей»: капитализация по предложениям и срез
// разметки мема («РЕЗЮМЕ:», кавычки). Обе проверки — регрессии реальных багов,
// найденных при живом тестировании (см. историю сессии).
// ---------------------------------------------------------------------------
(function testTextUtils() {
  global.window = {};
  require(path.join(__dirname, '..', 'textutils.js'));
  const T = global.window.__memTextUtils;

  test('textutils: toSentence капитализирует каждое предложение, а не только первое', () => {
    assert.strictEqual(T.toSentence('ЭТО НЕ МОЙ КОД. НО Я ЗА НЕГО ОТВЕЧАЮ'), 'Это не мой код. Но я за него отвечаю');
  });

  test('textutils: toSentence поднимает букву после кавычки', () => {
    assert.strictEqual(T.toSentence('«СКОЛЬКО ОПЫТА?»'), '«Сколько опыта?»');
  });

  test('textutils: stripScaffolding срезает разметку мема, не трогая остальной текст', () => {
    assert.strictEqual(T.stripScaffolding('РЕЗЮМЕ: 10 ЛЕТ ОПЫТА'), '10 ЛЕТ ОПЫТА');
    assert.strictEqual(T.stripScaffolding('РЕАЛЬНОСТЬ: АГЕНТ, СДЕЛАЙ КРАСИВО'), 'АГЕНТ, СДЕЛАЙ КРАСИВО');
    assert.strictEqual(T.stripScaffolding('«В ПУТИ»'), 'В ПУТИ');
    assert.strictEqual(T.stripScaffolding('ОБЫЧНЫЙ ТЕКСТ БЕЗ РАЗМЕТКИ'), 'ОБЫЧНЫЙ ТЕКСТ БЕЗ РАЗМЕТКИ');
  });
})();

console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
