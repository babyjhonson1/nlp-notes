/* Иллюстрация раздела reference/probability-information (префикс: prob).
   Использует genPlot, genStatic и genKey из figures/gen.js. */

function mountProbKl(box){
  const s0 = 0.6, mu0 = 2;                       /* p = 0.5 N(-2, 0.6^2) + 0.5 N(2, 0.6^2) */
  const gpdf = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
  const p = (x) => 0.5 * gpdf(x, -mu0, s0) + 0.5 * gpdf(x, mu0, s0);
  const fwd = { m: 0, s: Math.sqrt(s0 * s0 + mu0 * mu0) };   /* KL(p||q): совпадение моментов */
  const rev = { m: 2, s: 0.6 };                  /* KL(q||p): поиск по сетке, проверен tools/test-probability.py */
  const xs = Array.from({ length: 401 }, (_, i) => -5 + i / 40);
  const curve = (g) => xs.map((x) => [x, g(x)]);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><rect x="2" y="3" width="18" height="8" rx="2" class="prob-area"/></svg>\\(p\\): смесь двух гауссиан</span>
      <span>${genKey("prob-fwd")}\\(q\\) по \\(\\mathrm{KL}(p\\,\\|\\,q)\\): накрывает обе моды</span>
      <span>${genKey("prob-rev")}\\(q\\) по \\(\\mathrm{KL}(q\\,\\|\\,p)\\): садится на одну</span>
    </div>`, (_, w) => genPlot({
    id: "prob-kl", w, h: 230, aria: "Гауссиана, подобранная к двухмодальному распределению по двум направлениям KL",
    x: { min: -5, max: 5, label: "x", ticks: [-4, -2, 0, 2, 4].map((v) => [v, String(v).replace("-", "−")]) },
    y: { min: 0, max: 0.7, ticks: [0, 0.2, 0.4, 0.6] },
    body: (sx, sy) => `
      <path class="prob-area" d="M${f1(sx(-5))},${f1(sy(0))} L${genPts(curve(p), sx, sy).replace(/ /g, " L")} L${f1(sx(5))},${f1(sy(0))} Z"/>
      <polyline class="prob-fwd" points="${genPts(curve((x) => gpdf(x, fwd.m, fwd.s)), sx, sy)}"/>
      <polyline class="prob-rev" points="${genPts(curve((x) => gpdf(x, rev.m, rev.s)), sx, sy)}"/>`
  }));
}

Object.assign(FIGURES, {
  "prob-kl": mountProbKl
});
