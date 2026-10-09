/* rag/query-context: условные оценки, согласованные с текстом и Python-примером. */
const QC_DOCS = [
  { id: "A", text: "Без почты: поддержка, проверка личности и администратор", rel: 0.90 },
  { id: "B", text: "FAQ: та же процедура другими словами", rel: 0.88 },
  { id: "C", text: "Два рабочих дня после всех проверок", rel: 0.75 },
  { id: "D", text: "Тариф зависит от числа участников", rel: 0.30 }
];
const QC_SIM = [
  [1.00, 0.95, 0.20, 0.05],
  [0.95, 1.00, 0.25, 0.10],
  [0.20, 0.25, 1.00, 0.15],
  [0.05, 0.10, 0.15, 1.00]
];

function qcMmrTrace(weight, count = 3){
  const selected = [], trace = [];
  while (selected.length < Math.min(count, QC_DOCS.length)){
    const rows = QC_DOCS.map((doc, i) => {
      if (selected.includes(i)) return null;
      const redundancy = selected.length ? Math.max(...selected.map((j) => QC_SIM[i][j])) : 0;
      const relevance = selected.length ? weight * doc.rel : doc.rel;
      const penalty = selected.length ? (1 - weight) * redundancy : 0;
      return { i, redundancy, relevance, penalty, score: relevance - penalty };
    }).filter(Boolean);
    rows.sort((a, b) => b.score - a.score || a.i - b.i);
    trace.push({ before: [...selected], rows, chosen: rows[0].i });
    selected.push(rows[0].i);
  }
  return trace;
}

function mountQcMmr(box){
  let weight = 0.7;
  box.innerHTML = `
    <div class="fig-stage qc-stage">
      <p class="qc-question">Восстановление корпоративного аккаунта без почты: процедура и срок, v3</p>
      <div class="qc-candidates">${QC_DOCS.map((d) => `<div class="qc-card" data-qc-doc="${d.id}"><b>${d.id}</b><span>${d.text}</span></div>`).join("")}</div>
      <div class="qc-selected" aria-live="polite"></div>
      <div class="table-wrap qc-table">
        <table>
          <thead><tr><th>Кандидат</th><th>Релевантность</th><th>Макс. сходство</th><th>Штраф</th><th>Итог</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    ${vlControls('<label class="fig-range"><span>\\(\\lambda\\)</span><input type="range" min="0" max="100" step="5" value="70" aria-label="Вес релевантности"><output>0,70</output></label>')}
    <p class="fig-say"></p>
    <div class="fig-legend">${legend([
      ['<i class="qc-key qc-kept"></i>', "уже выбран"],
      ['<i class="qc-key qc-next"></i>', "выбирается на этом шаге"]
    ])}</div>`;
  const tbody = box.querySelector("tbody");
  const selectedBox = box.querySelector(".qc-selected");
  const say = box.querySelector(".fig-say");
  const fmt = (n) => fmtN(n, 3);
  const tex = (n) => n.toFixed(3).replace(".", "{,}");

  function draw(step){
    const trace = qcMmrTrace(weight);
    const state = trace[Math.max(0, step - 1)];
    const before = step ? state.before : [];
    const chosen = step ? state.chosen : null;
    const selected = chosen === null ? [] : [...before, chosen];
    selectedBox.textContent = selected.length
      ? "Выбраны: " + selected.map((i) => QC_DOCS[i].id).join(" → ")
      : "Пока ничего не выбрано";
    box.querySelectorAll("[data-qc-doc]").forEach((card, i) => {
      card.classList.toggle("qc-kept", before.includes(i));
      card.classList.toggle("qc-next", chosen === i);
    });
    tbody.innerHTML = state.rows.map((row) => `<tr class="${row.i === chosen ? "qc-winner" : ""}">
      <th scope="row">${QC_DOCS[row.i].id}</th>
      <td>${fmt(row.relevance)}</td><td>${fmt(row.redundancy)}</td>
      <td>${fmt(row.penalty)}</td><td><b>${fmt(row.score)}</b></td>
    </tr>`).join("");
    clearMath(say);
    if (!step){
      say.textContent = "Условные оценки четырёх фрагментов. На первом шаге выбираем максимальную релевантность без штрафа. Далее таблица показывает взвешенную релевантность и штраф относительно уже выбранных.";
    } else if (step === 1){
      say.innerHTML = "Первым берём A: \\(r_A=0.90\\). Это правило инициализации; значение ползунка на первый выбор не влияет.";
    } else {
      const best = state.rows[0];
      const id = QC_DOCS[best.i].id;
      const context = state.before.map((i) => QC_DOCS[i].id).join(", ");
      const comment = id === "D"
        ? " Разнообразие привело к тарифам: они слабо связаны с вопросом. MMR не гарантирует полезный контекст."
        : id === "B"
          ? " B повторяет процедуру A. При большом весе релевантности этот повтор может обойти срок."
          : " C добавляет срок, которого нет в A.";
      say.innerHTML = `Сравниваем с набором ${context}. Выбран ${id}: \\(${tex(best.relevance)}-${tex(best.penalty)}=${tex(best.score)}\\).${comment}`;
      if (step === 3) say.innerHTML += " Штраф определяется максимальным сходством со всем набором, а не только с последним фрагментом.";
    }
  }
  const player = vlPlayer(box, {
    count: () => 4,
    draw,
    label: (i) => i ? `выбор ${i} из 3` : "исходный пул"
  });
  const range = box.querySelector('input[type="range"]');
  range.addEventListener("input", () => {
    weight = Number(range.value) / 100;
    range.nextElementSibling.value = fmtN(weight, 2);
    player.stop();
    player.go(0);
  });
  player.paint();
  return () => player.stop();
}

Object.assign(FIGURES, {
  "qc-mmr": mountQcMmr
});
