/* Иллюстрация раздела rag/lexical-search: влияние параметров BM25. */

function mountLexBm25Params(box){
  const nDocs = 1000;
  const avgLen = 100;
  const terms = [
    { key: "bm25", label: "bm25", docFreq: 10, cls: "rare" },
    { key: "index", label: "index", docFreq: 100, cls: "common" }
  ];
  const docs = [
    { id: "A", len: 80, tf: { bm25: 2, index: 1 } },
    { id: "B", len: 150, tf: { bm25: 4, index: 0 } },
    { id: "C", len: 60, tf: { bm25: 1, index: 3 } }
  ];
  let k1 = 1.2;
  let b = 0.75;

  box.innerHTML = `
    <div class="fig-stage lex-stage">
      <div class="lex-query"><span>запрос</span><b>BM25 index</b><small>\\(N=1000\\), \\(\\operatorname{avgdl}=100\\)</small></div>
      <div class="lex-docs" aria-label="Статистики документов">
        ${docs.map((doc) => `<div class="lex-doc"><b>${doc.id}</b><span>${doc.len} токенов</span><span><i class="lex-dot rare"></i>bm25 × ${doc.tf.bm25}</span><span><i class="lex-dot common"></i>index × ${doc.tf.index}</span></div>`).join("")}
      </div>
      <div class="lex-ranking" aria-live="polite"></div>
    </div>
    <div class="fig-row">
      <label class="fig-range"><span>\\(k_1\\)</span><input type="range" min="10" max="300" step="10" value="120" data-range="k1"><output>1,2</output></label>
      <label class="fig-range"><span>\\(b\\)</span><input type="range" min="0" max="100" step="5" value="75" data-range="b"><output>0,75</output></label>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="lex-key rare"></i>вклад редкого термина bm25</span>
      <span><i class="lex-key common"></i>вклад термина index</span>
    </div>`;

  const ranking = box.querySelector(".lex-ranking");
  const say = box.querySelector(".fig-say");
  const fmt = (value, digits = 2) => value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const idf = (docFreq) => Math.log(1 + (nDocs - docFreq + 0.5) / (docFreq + 0.5));

  function calculate(doc){
    const lengthNorm = 1 - b + b * doc.len / avgLen;
    const contributions = {};
    let total = 0;
    for (const term of terms){
      const tf = doc.tf[term.key];
      const value = tf === 0 ? 0 : idf(term.docFreq) * tf * (k1 + 1) / (tf + k1 * lengthNorm);
      contributions[term.key] = value;
      total += value;
    }
    return { ...doc, lengthNorm, contributions, total };
  }

  function explanation(rows){
    const winner = rows[0];
    const frequency = k1 < 0.6
      ? "Частота почти бинарна: дополнительные повторения дают мало."
      : k1 > 2.4
        ? "Насыщение медленное: повторения продолжают заметно повышать оценку."
        : "Повторения полезны, но их вклад уже насыщается.";
    const length = b < 0.2
      ? "Длина почти не учитывается."
      : b > 0.8
        ? "Поправка на длину сильная и заметно поддерживает короткие документы."
        : "Длина нормализуется умеренно.";
    return `${frequency} ${length} Сейчас лидирует документ ${winner.id} с оценкой ${fmt(winner.total)}.`;
  }

  function draw(){
    const rows = docs.map(calculate).sort((a, z) => z.total - a.total);
    const maxScore = rows[0].total;
    ranking.innerHTML = rows.map((row, rank) => {
      const rareWidth = 100 * row.contributions.bm25 / maxScore;
      const commonWidth = 100 * row.contributions.index / maxScore;
      return `<div class="lex-rank-row" aria-label="Место ${rank + 1}, документ ${row.id}, оценка ${fmt(row.total)}">
        <span class="lex-rank">${rank + 1}</span>
        <b class="lex-doc-id">${row.id}</b>
        <div class="lex-bar" aria-hidden="true"><i class="rare" style="width:${rareWidth}%"></i><i class="common" style="width:${commonWidth}%"></i></div>
        <strong>${fmt(row.total)}</strong>
      </div>`;
    }).join("");
    say.textContent = explanation(rows);
  }

  box.querySelector('[data-range="k1"]').addEventListener("input", (event) => {
    k1 = Number(event.target.value) / 100;
    event.target.nextElementSibling.value = fmt(k1, 1);
    draw();
  });
  box.querySelector('[data-range="b"]').addEventListener("input", (event) => {
    b = Number(event.target.value) / 100;
    event.target.nextElementSibling.value = fmt(b, 2);
    draw();
  });
  draw();
}

Object.assign(FIGURES, {
  "lex-bm25-params": mountLexBm25Params
});
