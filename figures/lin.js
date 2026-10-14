/* Иллюстрации раздела ml/linear-models (префикс: lin).
   Используют genPlot, genStatic, genKey и genPts из figures/gen.js. */

const linSigmoid = (t) => 1 / (1 + Math.exp(-t));

function mountLinLoss(box){
  const ts = Array.from({ length: 241 }, (_, i) => -6 + i / 20);
  const logLoss = ts.map((t) => [t, Math.log1p(Math.exp(-t))]);                 /* -log sigma(t) */
  const mse = ts.map((t) => [t, (1 - linSigmoid(t)) ** 2]);
  const gLog = ts.map((t) => [t, 1 - linSigmoid(t)]);                           /* |d/dt| log-loss */
  const gMse = ts.map((t) => { const s = linSigmoid(t); return [t, 2 * (1 - s) * s * (1 - s)]; });
  const panels = [
    { title: "Потеря при \\(y=1\\)", ymax: 4, ticks: [0, 1, 2, 3, 4], a: logLoss, b: mse },
    { title: "Модуль градиента по логиту", ymax: 1.05, ticks: [0, 0.25, 0.5, 0.75, 1], a: gLog, b: gMse }
  ];
  return genStatic(box, `
    <div class="fig-stage gen-pair">
      ${panels.map((pn) => `<div><p class="gen-panel-title">${pn.title}</p><div data-plot></div></div>`).join("")}
    </div>
    <div class="fig-legend">
      <span>${genKey("lin-c-log")}log-loss</span>
      <span>${genKey("lin-c-mse")}MSE поверх сигмоиды</span>
    </div>`, (i, w) => {
    const pn = panels[i];
    return genPlot({
      id: `lin-loss${i}`, w, h: 210, aria: pn.title.replace(/\\[()]/g, ""),
      x: { min: -6, max: 6, label: "логит t", ticks: [-6, -3, 0, 3, 6].map((v) => [v, String(v).replace("-", "−")]) },
      y: { min: 0, max: pn.ymax, ticks: pn.ticks },
      body: (sx, sy) => `<polyline class="lin-c-mse" points="${genPts(pn.b, sx, sy)}"/><polyline class="lin-c-log" points="${genPts(pn.a, sx, sy)}"/>`
    });
  });
}

function mountLinSep(box){
  /* градиентный спуск по средней log-loss на сгруппированных отзывах: 10 со словом, 30 без него */
  const run = (negWith, steps = 100000) => {
    let w = 0, b = 0, next = 1;
    const out = [];
    for (let t = 1; t <= steps; t++){
      const pw = linSigmoid(w + b), p0 = linSigmoid(b);
      const gw = (10 * pw - negWith) / 40, gb = gw + (30 * p0 - 6) / 40;
      w -= gw; b -= gb;
      if (t >= next || t === steps){ out.push([t, w]); next = t * 1.06; }   /* точки равномерно по логарифму */
    }
    return out;
  };
  const conv = run(8), sep = run(10);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span>${genKey("lin-c-conv")}8 из 10 отзывов со словом негативные</span>
      <span>${genKey("lin-c-sep")}все 10 негативные: данные разделимы</span>
      <span>${genKey("gen-c-noise", true)}MLE \\(\\hat w=2.773\\)</span>
    </div>`, (_, w) => genPlot({
    id: "lin-sep", w, h: 230, m: { r: 34 }, aria: "Вес слова в зависимости от числа шагов градиентного спуска",
    x: { min: 1, max: 100000, log: true, label: "число шагов градиентного спуска",
      ticks: [1, 10, 100, 1000, 10000, 100000].map((v) => [v, v >= 1000 ? `${v / 1000} тыс.` : String(v)]) },
    y: { min: 0, max: 12, ticks: [0, 3, 6, 9, 12] },
    body: (sx, sy) => `
      <line class="gen-c-noise" x1="${f1(sx(1))}" x2="${f1(sx(100000))}" y1="${f1(sy(2.773))}" y2="${f1(sy(2.773))}" stroke-dasharray="4 3"/>
      <polyline class="lin-c-conv" points="${genPts(conv, sx, sy)}"/>
      <polyline class="lin-c-sep" points="${genPts(sep, sx, sy)}"/>`
  }));
}

Object.assign(FIGURES, {
  "lin-loss": mountLinLoss,
  "lin-sep": mountLinSep
});
