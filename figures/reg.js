/* Иллюстрации раздела ml/regularization (префикс: reg).
   Используют genPlot, genStatic, genKey и genPts из figures/gen.js. */

/* ---------- Геометрия: почему L1 даёт нули ---------- */

function mountRegGeometry(box){
  /* потеря (w - w*)^T A (w - w*), A = [[1, .5], [.5, 1]]: собственные векторы (1,1) и (1,-1), числа 1.5 и 0.5 */
  const ws = [2, 0.7], A = [[1, 0.5], [0.5, 1]];
  const loss = (w) => { const d = [w[0] - ws[0], w[1] - ws[1]]; return d[0] * (A[0][0] * d[0] + A[0][1] * d[1]) + d[1] * (A[1][0] * d[0] + A[1][1] * d[1]); };
  const lasso = [2.35 - 2.4 / 2, 0];             /* штраф 2.4·||w||_1: решение на оси, см. текст раздела */
  const t = Math.abs(lasso[0]);                  /* тот же бюджет ||w|| для L2 */
  const ridgeAt = (mu) => {                      /* w = (A + mu I)^{-1} A w* */
    const a = A[0][0] + mu, b = A[0][1], c = A[1][0], d = A[1][1] + mu, det = a * d - b * c;
    const r0 = A[0][0] * ws[0] + A[0][1] * ws[1], r1 = A[1][0] * ws[0] + A[1][1] * ws[1];
    return [(d * r0 - b * r1) / det, (a * r1 - c * r0) / det];
  };
  let lo = 0, hi = 100;
  for (let i = 0; i < 80; i++){ const mid = (lo + hi) / 2; if (Math.hypot(...ridgeAt(mid)) > t) lo = mid; else hi = mid; }
  const ridge = ridgeAt((lo + hi) / 2);
  const ellipse = (c) => Array.from({ length: 121 }, (_, i) => {
    const th = 2 * Math.PI * i / 120, a1 = Math.sqrt(c / 1.5) * Math.cos(th), a2 = Math.sqrt(c / 0.5) * Math.sin(th);
    return [ws[0] + (a1 + a2) / Math.SQRT2, ws[1] + (a1 - a2) / Math.SQRT2];
  });
  const panels = [
    { title: "L2: круг \\(\\lVert w\\rVert_2\\le t\\)", aria: "L2: круг", sol: ridge, region: Array.from({ length: 121 }, (_, i) => [t * Math.cos(2 * Math.PI * i / 120), t * Math.sin(2 * Math.PI * i / 120)]) },
    { title: "L1: ромб \\(\\lVert w\\rVert_1\\le t\\)", aria: "L1: ромб", sol: lasso, region: [[t, 0], [0, t], [-t, 0], [0, -t]] }
  ];
  const X0 = -1.4, X1 = 2.9, Y0 = -1.5, Y1 = 2.1;
  return genStatic(box, `
    <div class="fig-stage gen-pair">
      ${panels.map((pn) => `<div><p class="gen-panel-title">${pn.title}</p><div data-plot></div></div>`).join("")}
    </div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><rect x="2" y="2" width="18" height="10" rx="2" class="reg-region"/></svg>допустимая область весов</span>
      <span>${genKey("reg-contour")}линии уровня потери</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.5" class="reg-ols"/></svg>минимум без штрафа (OLS)</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="reg-sol"/></svg>решение со штрафом</span>
    </div>`, (i, w) => {
    const pn = panels[i], pad = 8, size = Math.min(w, 340);
    const s = (size - 2 * pad) / Math.max(X1 - X0, Y1 - Y0), h = Math.round((Y1 - Y0) * s + 2 * pad);
    const px = (x) => pad + (x - X0) * s, py = (y) => h - pad - (y - Y0) * s;
    const pts = (arr) => arr.map(([x, y]) => `${f1(px(x))},${f1(py(y))}`).join(" ");
    const c0 = loss(pn.sol);
    return `<svg viewBox="0 0 ${size} ${h}" role="img" aria-label="Линии уровня потери и область ${pn.aria}">
      <line class="gen-grid" x1="${f1(px(X0))}" x2="${f1(px(X1))}" y1="${f1(py(0))}" y2="${f1(py(0))}"/>
      <line class="gen-grid" x1="${f1(px(0))}" x2="${f1(px(0))}" y1="${f1(py(Y0))}" y2="${f1(py(Y1))}"/>
      <text class="gen-tick" x="${f1(px(X1) - 4)}" y="${f1(py(0) + 14)}" text-anchor="end">w1</text>
      <text class="gen-tick" x="${f1(px(0) + 5)}" y="${f1(py(Y1) + 11)}">w2</text>
      <polygon class="reg-region" points="${pts(pn.region)}"/>
      ${[0.12, 0.4, 1].map((k) => `<polygon class="reg-contour" points="${pts(ellipse(c0 * k))}"/>`).join("")}
      <circle class="reg-ols" cx="${f1(px(ws[0]))}" cy="${f1(py(ws[1]))}" r="3.5"/>
      <text class="gen-note" x="${f1(px(ws[0]) + 7)}" y="${f1(py(ws[1]) - 6)}">OLS</text>
      <circle class="reg-sol" cx="${f1(px(pn.sol[0]))}" cy="${f1(py(pn.sol[1]))}" r="4.5"/>
    </svg>`;
  });
}

/* ---------- Ортонормированные признаки: что штраф делает с коэффициентом ---------- */

function mountRegThreshold(box){
  const zs = Array.from({ length: 241 }, (_, i) => -3 + i / 40);
  const soft = (z) => Math.sign(z) * Math.max(Math.abs(z) - 1, 0);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span>${genKey("gen-c-noise", true)}без штрафа: \\(\\hat w=z\\)</span>
      <span>${genKey("reg-c-l2")}L2: \\(z/(1+\\lambda)\\)</span>
      <span>${genKey("reg-c-l1")}L1: \\(\\operatorname{sign}(z)\\,(\\lvert z\\rvert-\\lambda)_+\\)</span>
      <span>${genKey("reg-c-l0")}L0: \\(z\\cdot[\\lvert z\\rvert&gt;\\sqrt{2\\lambda_0}]\\)</span>
    </div>`, (_, w) => genPlot({
    id: "reg-thr", w, h: 240, aria: "Оценка коэффициента в зависимости от коэффициента OLS для разных штрафов",
    x: { min: -3, max: 3, label: "коэффициент без штрафа z", ticks: [-3, -2, -1, 0, 1, 2, 3].map((v) => [v, String(v).replace("-", "−")]) },
    y: { min: -3, max: 3, ticks: [-3, -2, -1, 0, 1, 2, 3] },
    body: (sx, sy) => `
      <line class="gen-c-noise" x1="${f1(sx(-3))}" y1="${f1(sy(-3))}" x2="${f1(sx(3))}" y2="${f1(sy(3))}" stroke-dasharray="4 3"/>
      <polyline class="reg-c-l0" points="${genPts([[-3, -3], [-1, -1]], sx, sy)}"/>
      <polyline class="reg-c-l0" points="${genPts([[-1, 0], [1, 0]], sx, sy)}"/>
      <polyline class="reg-c-l0" points="${genPts([[1, 1], [3, 3]], sx, sy)}"/>
      <polyline class="reg-c-l2" points="${genPts(zs.map((z) => [z, z / 2]), sx, sy)}"/>
      <polyline class="reg-c-l1" points="${genPts(zs.map((z) => [z, soft(z)]), sx, sy)}"/>`
  }));
}

/* ---------- Путь регуляризации на отзывах ---------- */

const REG_WORDS = ["сломался", "брак", "бракованный", "отлично", "быстро", "курьер"];

/* 60 условных отзывов: оценка 1–5 как линейная функция слов плюс шум; брак и бракованный коррелированы */
function regData(){
  const r = rng(1), X = [], y = [];
  for (let i = 0; i < 60; i++){
    const s = r() < 0.2 ? 1 : 0, b = r() < 0.15 ? 1 : 0;
    const bb = b ? (r() < 0.85 ? 1 : 0) : (r() < 0.04 ? 1 : 0);
    const o = r() < 0.3 ? 1 : 0, f = r() < 0.3 ? 1 : 0, c = r() < 0.25 ? 1 : 0;
    X.push([s, b, bb, o, f, c]);
    y.push(4 - 1.4 * s - 0.6 * b - 0.6 * bb + 0.7 * o + 0.3 * f + 0.6 * gauss(r));
  }
  const n = X.length, d = 6;
  const mu = Array.from({ length: d }, (_, j) => X.reduce((a, row) => a + row[j], 0) / n);
  const sd = mu.map((m, j) => Math.sqrt(X.reduce((a, row) => a + (row[j] - m) ** 2, 0) / n));
  const ym = y.reduce((a, v) => a + v, 0) / n;
  return { Z: X.map((row) => row.map((v, j) => (v - mu[j]) / sd[j])), yc: y.map((v) => v - ym), n, d };
}

function regSolve(A, b){
  const n = A.length, M = A.map((row, i) => row.concat([b[i]]));
  for (let c = 0; c < n; c++){
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c){ const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

function regPaths(){
  const { Z, yc, n, d } = regData();
  const ridge = [];
  for (let k = 0; k <= 60; k++){
    const lam = 10 ** (-1 + 5 * k / 60);
    const A = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, c) => Z.reduce((s, row) => s + row[a] * row[c], 0) + (a === c ? lam : 0)));
    ridge.push([lam, regSolve(A, Array.from({ length: d }, (_, a) => Z.reduce((s, row, i) => s + row[a] * yc[i], 0)))]);
  }
  /* лассо: (1/2n)||y - Zw||^2 + alpha ||w||_1, покоординатный спуск с тёплым стартом; (1/n)||z_j||^2 = 1 */
  const amax = Math.max(...Array.from({ length: d }, (_, j) => Math.abs(Z.reduce((s, row, i) => s + row[j] * yc[i], 0)) / n));
  const w = new Array(d).fill(0), res = yc.slice(), lasso = [];
  for (let k = 0; k <= 80; k++){
    const alpha = amax * 10 ** (0.15 - 3.3 * k / 80);
    for (let it = 0; it < 2000; it++){
      let delta = 0;
      for (let j = 0; j < d; j++){
        const rho = Z.reduce((s, row, i) => s + row[j] * (res[i] + row[j] * w[j]), 0) / n;
        const nw = Math.sign(rho) * Math.max(Math.abs(rho) - alpha, 0);
        if (nw !== w[j]){ Z.forEach((row, i) => { res[i] -= row[j] * (nw - w[j]); }); delta = Math.max(delta, Math.abs(nw - w[j])); w[j] = nw; }
      }
      if (delta < 1e-12) break;
    }
    lasso.push([alpha, w.slice()]);
  }
  return { ridge, lasso, amax };
}

function mountRegPath(box){
  const { ridge, lasso } = regPaths();
  const colors = ["var(--r1)", "var(--r8)", "var(--r2)", "var(--r6)", "var(--r5)", "var(--r4)"];
  const panels = [
    { title: "L2: \\(\\lVert y-Xw\\rVert^2+\\lambda\\lVert w\\rVert_2^2\\)", aria: "L2", path: ridge, min: 0.1, max: 10000, label: "сила штрафа λ", ticks: [0.1, 1, 10, 100, 1000, 10000] },
    { title: "L1: \\(\\tfrac{1}{2n}\\lVert y-Xw\\rVert^2+\\alpha\\lVert w\\rVert_1\\)", aria: "L1", path: lasso, min: lasso[lasso.length - 1][0], max: lasso[0][0], label: "сила штрафа α", ticks: [0.001, 0.01, 0.1, 1] }
  ];
  return genStatic(box, `
    <div class="fig-stage gen-pair">
      ${panels.map((pn) => `<div><p class="gen-panel-title">${pn.title}</p><div data-plot></div></div>`).join("")}
    </div>
    <div class="fig-legend">
      ${REG_WORDS.map((word, j) => `<span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="reg-path" style="stroke:${colors[j]}"/></svg>${word}</span>`).join("")}
    </div>`, (i, wdt) => {
    const pn = panels[i];
    return genPlot({
      id: `reg-path${i}`, w: wdt, h: 230, aria: `Путь регуляризации ${pn.aria}: веса слов в зависимости от силы штрафа`,
      x: { min: pn.min, max: pn.max, log: true, label: pn.label, ticks: pn.ticks.map((v) => [v, genNum(v)]) },
      y: { min: -0.7, max: 0.3, ticks: [-0.6, -0.4, -0.2, 0, 0.2] },
      body: (sx, sy) => REG_WORDS.map((_, j) => `<polyline class="reg-path" style="stroke:${colors[j]}" points="${genPts(pn.path.map(([lam, ws]) => [lam, ws[j]]), sx, sy)}"/>`).join("")
    });
  });
}

Object.assign(FIGURES, {
  "reg-geometry": mountRegGeometry,
  "reg-threshold": mountRegThreshold,
  "reg-path": mountRegPath
});
