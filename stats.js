// Петля обратной связи: превращает записанные результаты (лайки/комменты/репосты из
// published-log.js) в веса, которыми генератор чуть сильнее налегает на то, что реально
// заходит. Ничего не решает за пользователя молча — до накопления данных все веса нейтральны,
// а решение остаётся видимым (индикатор на чипах), а не спрятанным внутри случайного выбора.
window.__memStats = (() => {
  'use strict';

  // Меньше этого числа публикаций с результатами — считаем данные шумом и не смещаем выбор.
  // Три поста могут залететь случайно; при n<3 разница между нишами ничего не доказывает.
  const MIN_SAMPLE = 3;

  // Лайк — самое дешёвое действие, комментарий дороже, репост — чужой охват. Поэтому вес
  // растёт в этом порядке. Веса приблизительные (это не аналитика соцсети), но соотношение
  // осмысленно: пост с репостами и без лайков должен обгонять пост с лайками и без репостов.
  function engagement(entry) {
    const l = entry.likes || 0, c = entry.comments || 0, r = entry.reposts || 0;
    return l + c * 2 + r * 3;
  }

  function hasResult(e) {
    return e.likes != null || e.comments != null || e.reposts != null;
  }

  // Группирует опубликованное по ключу (нише или формату) и считает среднюю вовлечённость.
  // Возвращает { score, n } — n обязателен на выходе, чтобы вызывающий код мог сам решить,
  // доверять ли score, а не полагаться на то, что MIN_SAMPLE где-то невидимо уже применили.
  function scoreBy(keyFn) {
    const groups = {};
    mmPublishedAll().filter(hasResult).forEach(e => {
      const key = keyFn(e);
      if (!key) return;
      (groups[key] = groups[key] || []).push(engagement(e));
    });
    const out = {};
    Object.keys(groups).forEach(key => {
      const vals = groups[key];
      out[key] = { score: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
    });
    return out;
  }

  function nicheScores() {
    return scoreBy(e => e.niche);
  }

  function formatScores() {
    return scoreBy(e => e.memFormatKey);
  }

  // Достаточно ли данных, чтобы вообще смещать выбор в эту сторону.
  function isTrusted(stat) {
    return !!stat && stat.n >= MIN_SAMPLE;
  }

  // Взвешенный выбор одного ключа из списка кандидатов. Ключи без доверенного счёта получают
  // нейтральный вес 1 — они не проигрывают только из-за отсутствия данных, а хорошо
  // работающие получают базовый + бонус, стабильно бо́льший ноль даже при отрицательном score.
  function weightedPick(keys, scores) {
    if (!keys.length) return null;
    const weights = keys.map(k => {
      const s = scores[k];
      return isTrusted(s) ? 1 + Math.max(0, s.score) : 1;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < keys.length; i++) {
      r -= weights[i];
      if (r <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  return { nicheScores, formatScores, isTrusted, weightedPick, MIN_SAMPLE, engagement };
})();
