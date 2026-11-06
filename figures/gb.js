/* Иллюстрация раздела ml/boosting. */

// Долгая задержка, высокая цена, негативный отзыв. Номер заказа — индекс плюс один.
const GB_ORDERS = [
  [0, 0, 0], [0, 1, 0], [0, 0, 0], [0, 1, 1],
  [1, 0, 0], [1, 1, 1], [1, 0, 1], [1, 0, 1]
];

function gbExampleSteps(){
  const sigmoid = (logit) => 1 / (1 + Math.exp(-logit));
  const stages = [];
  let logits = GB_ORDERS.map(() => 0);
  // Разбиения из ручного расчёта: на первом шаге задержка, на втором цена.
  for (const feature of [-1, 0, 1]){
    const probabilities = logits.map(sigmoid);
    const residuals = GB_ORDERS.map((order, i) => order[2] - probabilities[i]);
    let shifts = logits.map(() => 0);
    if (feature >= 0){
      const leaves = [
        { residual: 0, curvature: 0 },
        { residual: 0, curvature: 0 }
      ];
      GB_ORDERS.forEach((order, i) => {
        const leaf = leaves[order[feature]];
        const p = probabilities[i];
        leaf.residual += residuals[i];
        leaf.curvature += p * (1 - p);
      });
      shifts = GB_ORDERS.map((order) => {
        const leaf = leaves[order[feature]];
        return 0.5 * leaf.residual / leaf.curvature;
      });
    }
    logits = logits.map((value, i) => value + shifts[i]);
    const rows = GB_ORDERS.map((order, i) => ({
      label: order[2],
      highLeaf: feature >= 0 && order[feature] === 1,
      before: probabilities[i],
      residual: residuals[i],
      shift: shifts[i],
      after: sigmoid(logits[i])
    }));
    const loss = logits.reduce((sum, f, i) =>
      sum + Math.log1p(Math.exp(f)) - GB_ORDERS[i][2] * f, 0) / rows.length;
    stages.push({ rows, loss });
  }
  return stages;
}

function mountGbSteps(box){
  const stages = gbExampleSteps();
  const names = ["начальная константа", "дерево по задержке", "дерево по цене"];
  const descriptions = [
    "Половина отзывов негативные. У всех заказов одинаковая начальная вероятность.",
    "Выделены заказы с задержкой больше четырёх дней. Их логиты растут, у остальных снижаются.",
    "Выделены заказы дороже 20 тыс. ₽. Для заказа 4 поправка по цене поднимает вероятность после снижения на первом шаге."
  ];
  box.innerHTML = `
    <div class="fig-stage table-wrap" tabindex="0" role="region" aria-label="Расчёты для восьми заказов">
      <table>
        <thead><tr><th scope="col">Заказ</th><th scope="col">Негатив</th><th scope="col">Вероятность до</th><th scope="col">Псевдоостаток</th><th scope="col">Сдвиг логита</th><th scope="col">Вероятность после</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>`;
  const tableBody = box.querySelector("tbody"), say = box.querySelector(".fig-say");
  // Стрелки внутри таблицы прокручивают её, а на кнопках переключают шаг.
  box.querySelector(".table-wrap").addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
  });
  const signed = (value) => (value > 0 ? "+" : "") + fmtN(value, 3);
  function draw(step){
    const { rows, loss } = stages[step];
    tableBody.innerHTML = rows.map((row, i) => `
      <tr${row.highLeaf ? ' style="background:var(--tint)"' : ""}>
        <th scope="row">${i + 1}</th><td>${row.label ? "Да" : "Нет"}</td>
        <td>${fmtN(row.before, 3)}</td><td>${signed(row.residual)}</td>
        <td>${step ? signed(row.shift) : "—"}</td><td><strong>${fmtN(row.after, 3)}</strong></td>
      </tr>`).join("");
    say.innerHTML = `${descriptions[step]} Средняя log-loss равна \\( ${loss.toFixed(3)} \\).`;
  }
  const player = vlPlayer(box, {
    count: () => stages.length,
    draw,
    label: (step) => `Шаг ${step} из ${stages.length - 1} · ${names[step]}`,
    interval: 4000
  });
  player.paint();
  return () => player.stop();
}

Object.assign(FIGURES, {
  "gb-steps": mountGbSteps
});
