/* Иллюстрации раздела ml/boosting-libraries. */

function mountBlGain(box){
  box.innerHTML = `
    <div class="fig-stage">
      <svg viewBox="0 0 420 146" role="img" aria-label="Кандидат на разбиение по задержке"
           style="max-width:540px;margin-inline:auto"></svg>
    </div>
    <div class="fig-row">
      <label class="fig-range" for="bl-lambda">Штраф за вес \\(\\lambda\\)
        <input id="bl-lambda" type="range" min="0" max="4" step="0.1" value="1">
        <output for="bl-lambda"></output>
      </label>
      <label class="fig-range" for="bl-gamma">Штраф за лист \\(\\gamma\\)
        <input id="bl-gamma" type="range" min="0" max="1.2" step="0.1" value="0.3">
        <output for="bl-gamma"></output>
      </label>
    </div>
    <p class="fig-say" aria-live="polite"></p>`;
  const lambda = box.querySelector("#bl-lambda"), gamma = box.querySelector("#bl-gamma");
  const lambdaValue = box.querySelector('output[for="bl-lambda"]');
  const gammaValue = box.querySelector('output[for="bl-gamma"]');
  const diagram = box.querySelector("svg"), say = box.querySelector(".fig-say");
  function draw(){
    const weight = 1 / (1 + Number(lambda.value));
    // G родителя равна нулю, у детей G = ±1 и H = 1.
    const gain = weight - Number(gamma.value);
    const improves = gain > 1e-12;
    lambdaValue.value = fmtN(Number(lambda.value), 1);
    gammaValue.value = fmtN(Number(gamma.value), 1);
    const branch = (x, leafWeight) => `
      <rect x="${x - 86}" y="85" width="172" height="55" rx="7"
            fill="${improves ? "var(--tint)" : "var(--bg)"}"
            stroke="${improves ? "var(--chapter)" : "var(--rule)"}"/>
      <text x="${x}" y="107" font-size="15">4 заказа</text>
      <text x="${x}" y="128" font-size="15">Вес листа ${leafWeight > 0 ? "+" : ""}${fmtN(leafWeight, 3)}</text>`;
    diagram.innerHTML = `
      <g text-anchor="middle" fill="var(--ink)">
        <rect x="105" y="6" width="210" height="39" rx="7" fill="var(--bg)" stroke="var(--rule)"/>
        <text x="210" y="31" font-size="16">Задержка больше 4 дней?</text>
        <path d="M210 45 L104 85 M210 45 L316 85" fill="none"
              stroke="var(--muted)" stroke-dasharray="${improves ? "none" : "4 4"}"/>
        <text x="134" y="65" font-size="14">Нет</text>
        <text x="286" y="65" font-size="14">Да</text>
        ${branch(104, -weight)}
        ${branch(316, weight)}
      </g>`;
    const cleanGain = Math.abs(gain) < 1e-12 ? 0 : gain;
    say.innerHTML = `Выигрыш до штрафа равен \\(${weight.toFixed(3)}\\), после штрафа \\(${cleanGain.toFixed(3)}\\). <b>${improves
      ? "Разбиение улучшает приближённую цель."
      : "По этому критерию лист оставляем целым."}</b>`;
  }
  lambda.addEventListener("input", draw);
  gamma.addEventListener("input", draw);
  draw();
}

// Номер заказа, продавец, метка негатива. Строки стоят в учебной перестановке.
const BL_ORDERS = [
  [4, "А", 1], [2, "А", 0], [5, "Б", 0], [6, "А", 1]
];

function mountBlOrdered(box){
  const stat = (rows) => (rows.reduce((sum, row) => sum + row[2], 0) + 1) / (rows.length + 2);
  const prefixes = BL_ORDERS.map((row, i) =>
    BL_ORDERS.slice(0, i).filter(previous => previous[1] === row[1]));
  box.innerHTML = `
    <div class="fig-stage table-wrap" tabindex="0" role="region" aria-label="Статистика продавца по заказам">
      <table>
        <thead><tr><th scope="col">Заказ</th><th scope="col">Продавец</th><th scope="col">Негатив</th><th scope="col">По всем строкам</th><th scope="col">По предыдущим</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>`;
  const body = box.querySelector("tbody"), say = box.querySelector(".fig-say");
  box.querySelector(".table-wrap").addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
  });
  function draw(step){
    const [order, seller] = BL_ORDERS[step];
    const used = prefixes[step];
    body.innerHTML = BL_ORDERS.map((row, i) => {
      const [id, name, label] = row;
      const full = stat(BL_ORDERS.filter(other => other[1] === name));
      let highlight = "";
      if (i === step) highlight = ' aria-current="step" style="outline:2px solid var(--chapter);outline-offset:-2px"';
      else if (used.includes(row)) highlight = ' style="background:var(--tint)"';
      return `<tr${highlight}><th scope="row">${id}</th><td>${name}</td><td>${label ? "Да" : "Нет"}</td>
        <td>${fmtN(full, 3)}</td><td>${i <= step ? fmtN(stat(prefixes[i]), 3) : "—"}</td></tr>`;
    }).join("");
    const positives = used.reduce((sum, row) => sum + row[2], 0);
    const context = used.length
      ? `В расчёт идут заказы ${joinRu(used.map(row => String(row[0])))}.`
      : "Предыдущих заказов этого продавца пока нет.";
    say.innerHTML = `Заказ ${order}, продавец ${seller}. ${context} Код равен \\(\\frac{${positives}+1}{${used.length}+2}\\).`;
  }
  const player = vlPlayer(box, {
    count: () => BL_ORDERS.length,
    draw,
    label: (i, n) => `Шаг ${i + 1} из ${n} · заказ ${BL_ORDERS[i][0]}`,
    interval: 3600
  });
  player.paint();
  return () => player.stop();
}

Object.assign(FIGURES, {
  "bl-gain": mountBlGain,
  "bl-ordered": mountBlOrdered
});
