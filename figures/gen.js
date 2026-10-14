/* Иллюстрации раздела ml/generalization (префикс: gen): ёмкость kNN, разложение bias–variance,
   кривые обучения, концентрация расстояний и double descent. */

function mountGenKnn(box){
  const KS = [1, 3, 5, 7, 9, 13, 17, 23, 31, 41, 55, 71, 99];
  const N_TRAIN = 100, N_VAL = 1500, NOISE = 0.12, GRID = 40;
  /* истинная граница: класс 1 вероятнее выше кривой */
  const boundary = (x) => 0.5 + 0.28 * Math.sin(2 * Math.PI * 1.4 * (x - 0.12));
  function sample(seed, n){
    const r = rng(seed), pts = [];
    for (let i = 0; i < n; i++){
      const x = r(), y = r();
      const p = 1 / (1 + Math.exp(-(y - boundary(x)) / NOISE));
      pts.push({ x, y, c: r() < p ? 1 : 0, bayes: p >= 0.5 ? 1 : 0 });
    }
    return pts;
  }
  const train = sample(42, N_TRAIN), val = sample(1042, N_VAL);
  /* для каждой точки запроса — число голосов за класс 1 среди j ближайших, j = 1..n */
  function votes(q){
    const d = train.map((p) => [(p.x - q.x) ** 2 + (p.y - q.y) ** 2, p.c]).sort((a, b) => a[0] - b[0]);
    const out = new Uint8Array(d.length);
    let acc = 0;
    d.forEach(([, c], j) => { acc += c; out[j] = acc; });
    return out;
  }
  const predict = (v, k) => (2 * v[k - 1] > k ? 1 : 0);
  const trainVotes = train.map(votes), valVotes = val.map(votes);
  const cells = [];
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++){
    const q = { x: (i + 0.5) / GRID, y: (j + 0.5) / GRID };
    cells.push({ i, j, v: votes(q) });
  }
  const errRate = (vs, pts, k) => vs.reduce((e, v, i) => e + (predict(v, k) !== pts[i].c ? 1 : 0), 0) / pts.length;
  const curve = KS.map((k) => ({ k, tr: errRate(trainVotes, train, k), va: errRate(valVotes, val, k) }));
  const bayes = val.reduce((e, p) => e + (p.bayes !== p.c ? 1 : 0), 0) / N_VAL;
  const best = curve.reduce((a, b) => (b.va < a.va ? b : a));
  let idx = 0;

  /* плоскость признаков: y растёт вверх */
  const S = 300, sx = (x) => x * S, sy = (y) => S - y * S;
  const truePath = Array.from({ length: 121 }, (_, i) => {
    const x = i / 120;
    return `${f1(sx(x))},${f1(sy(Math.min(1, Math.max(0, boundary(x)))))}`;
  }).join(" ");
  /* график ошибок */
  const W = 320, H = 230, L = 36, R = 10, T = 12, B = 36, YMAX = 0.55;
  const px = (i) => L + i * (W - L - R) / (KS.length - 1);
  const py = (e) => T + (1 - e / YMAX) * (H - T - B);
  const pct = (e) => fmtN(100 * e, 1) + " %";
  const line = (key) => curve.map((c, i) => `${f1(px(i))},${f1(py(c[key]))}`).join(" ");
  const yTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5];

  box.innerHTML = `
    <div class="fig-stage gen-stage">
      <svg class="gen-plane" viewBox="0 0 ${S} ${S}" role="img" aria-label="Граница решения kNN на плоскости двух признаков">
        <g class="gen-cells"></g>
        <polyline class="gen-true" points="${truePath}"/>
        <g class="gen-pts"></g>
        <rect class="gen-frame" x="0.5" y="0.5" width="${S - 1}" height="${S - 1}"/>
      </svg>
      <svg class="gen-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ошибка на обучении и на validation в зависимости от числа соседей">
        <g class="gen-axis">
          ${yTicks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${f1(py(t))}" y2="${f1(py(t))}"/><text x="${L - 6}" y="${f1(py(t) + 3.5)}" text-anchor="end">${Math.round(100 * t)}%</text>`).join("")}
          ${KS.map((k, i) => `<text x="${f1(px(i))}" y="${H - B + 15}" text-anchor="middle">${k}</text>`).join("")}
          <text x="${f1((L + W - R) / 2)}" y="${H - 4}" text-anchor="middle">число соседей k</text>
        </g>
        <line class="gen-bayes" x1="${L}" x2="${W - R}" y1="${f1(py(bayes))}" y2="${f1(py(bayes))}"/>
        <polyline class="gen-line train" points="${line("tr")}"/>
        <polyline class="gen-line val" points="${line("va")}"/>
        <g class="gen-cursor"></g>
      </svg>
    </div>
    <div class="fig-row">
      <label class="fig-range"><span>\\(k\\)</span><input type="range" min="0" max="${KS.length - 1}" step="1" value="0" aria-label="Число соседей"><output>1</output></label>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="gen-pt c0"/></svg>класс 0</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="gen-pt c1"/></svg>класс 1</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3" class="gen-pt c0"/><circle cx="11" cy="7" r="5.6" class="gen-miss"/></svg>ошибка на обучении</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="gen-true"/></svg>истинная граница</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="gen-line train"/></svg>ошибка на train</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="gen-line val"/></svg>ошибка на validation</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="gen-bayes"/></svg>байесовская ошибка</span>
    </div>`;

  const gCells = box.querySelector(".gen-cells"), gPts = box.querySelector(".gen-pts");
  const gCursor = box.querySelector(".gen-cursor"), say = box.querySelector(".fig-say");
  const input = box.querySelector('input[type="range"]'), output = box.querySelector("output");
  const cw = S / GRID;

  const neighbours = (n) => {
    const m10 = n % 10, m100 = n % 100;
    const word = m10 === 1 && m100 !== 11 ? "сосед" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "соседа" : "соседей";
    return `${n} ${word}`;
  };
  function explain(c){
    const nums = `Ошибка на обучении ${pct(c.tr)}, на validation ${pct(c.va)}, байесовская ${pct(bayes)}.`;
    if (c.k === 1) return `<b>Один сосед:</b> каждая точка обучения предсказывает сама себя, поэтому ошибка на обучении нулевая, а граница обходит каждую зашумлённую метку. ${nums} Модель выучила шум выборки — высокая дисперсия.`;
    if (c.k === KS[KS.length - 1]) return `<b>${neighbours(c.k)} из ${N_TRAIN} точек:</b> голосует почти вся выборка, и модель почти везде отвечает одним классом. ${nums} Это предельное смещение: форма зависимости потеряна.`;
    if (c.va <= best.va + 0.01) return `<b>${neighbours(c.k)}:</b> около минимума ошибки на validation. Граница повторяет изгибы истинной, а отдельные зашумлённые метки уже не создают своих островков. ${nums}`;
    if (c.k < best.k) return `<b>${neighbours(c.k)}:</b> усреднение начинает подавлять шум — островки вокруг отдельных точек исчезают, ошибка на validation падает. ${nums}`;
    return `<b>${neighbours(c.k)}:</b> окрестность стала шире изгибов истинной границы, и граница их срезает: ошибка на validation растёт — растёт смещение. Ошибки на обучении и на validation сблизились; разница в пару процентов в любую сторону здесь — шум выборки из ${N_TRAIN} точек. ${nums}`;
  }

  function draw(){
    const c = curve[idx], k = c.k;
    gCells.innerHTML = cells.map((cell) => `<rect class="gen-cell c${predict(cell.v, k)}" x="${f1(cell.i * cw)}" y="${f1(S - (cell.j + 1) * cw)}" width="${f1(cw + 0.3)}" height="${f1(cw + 0.3)}"/>`).join("");
    gPts.innerHTML = train.map((p, i) => {
      const miss = predict(trainVotes[i], k) !== p.c;
      return `<circle class="gen-pt c${p.c}" cx="${f1(sx(p.x))}" cy="${f1(sy(p.y))}" r="3.6"/>` +
        (miss ? `<circle class="gen-miss" cx="${f1(sx(p.x))}" cy="${f1(sy(p.y))}" r="6.4"/>` : "");
    }).join("");
    gCursor.innerHTML = `<line x1="${f1(px(idx))}" x2="${f1(px(idx))}" y1="${T}" y2="${H - B}"/>` +
      `<circle class="gen-dot train" cx="${f1(px(idx))}" cy="${f1(py(c.tr))}" r="4"/>` +
      `<circle class="gen-dot val" cx="${f1(px(idx))}" cy="${f1(py(c.va))}" r="4"/>`;
    output.value = String(k);
    say.innerHTML = explain(c);
  }

  input.addEventListener("input", () => { idx = Number(input.value); draw(); });
  draw();
}

/* ---------- Статичные графики: общий рисовальщик осей ---------- */

/* Ширина viewBox подстраивается под блок, чтобы подписи на телефоне не мельчали. */
const genWidth = (el) => Math.round(Math.max(290, Math.min(640, el.getBoundingClientRect().width || 560)));
const genNum = (v) => String(v).replace(".", ",").replace("-", "−");
const genPts = (pts, sx, sy) => pts.map(([x, y]) => `${f1(sx(x))},${f1(sy(y))}`).join(" ");

function genPlot(o){
  const m = Object.assign({ l: 42, r: 14, t: 12, b: 40 }, o.m || {});
  const X0 = m.l, X1 = o.w - m.r, Y0 = o.h - m.b, Y1 = m.t;
  const tx = o.x.log ? Math.log : (v) => v;
  const sx = (v) => X0 + (tx(v) - tx(o.x.min)) / (tx(o.x.max) - tx(o.x.min)) * (X1 - X0);
  const sy = (v) => Y0 - (Math.min(v, o.y.max * 50) - o.y.min) / (o.y.max - o.y.min) * (Y0 - Y1);
  const yTicks = o.y.ticks.map((v) => `<line class="gen-grid" x1="${X0}" x2="${X1}" y1="${f1(sy(v))}" y2="${f1(sy(v))}"/>` +
    `<text class="gen-tick" x="${X0 - 6}" y="${f1(sy(v) + 3.5)}" text-anchor="end">${genNum(v)}</text>`).join("");
  const xTicks = o.x.ticks.map(([v, lab]) => `<line class="gen-grid" x1="${f1(sx(v))}" x2="${f1(sx(v))}" y1="${Y0}" y2="${Y0 + 4}"/>` +
    `<text class="gen-tick" x="${f1(sx(v))}" y="${Y0 + 16}" text-anchor="middle">${lab}</text>`).join("");
  return `<svg viewBox="0 0 ${o.w} ${o.h}" role="img" aria-label="${o.aria}">
    <defs><clipPath id="${o.id}-clip"><rect x="${X0}" y="${Y1}" width="${X1 - X0}" height="${Y0 - Y1}"/></clipPath></defs>
    ${yTicks}${xTicks}
    <line class="gen-axis-line" x1="${X0}" x2="${X1}" y1="${Y0}" y2="${Y0}"/>
    <text class="gen-tick" x="${f1((X0 + X1) / 2)}" y="${o.h - 6}" text-anchor="middle">${o.x.label}</text>
    <g clip-path="url(#${o.id}-clip)">${o.body(sx, sy)}</g>
    ${o.over ? o.over(sx, sy, { X0, X1, Y0, Y1 }) : ""}
  </svg>`;
}

/* Перерисовка только SVG-части при изменении ширины: подписи с формулами вне SVG не трогаем. */
function genStatic(box, html, draw){
  box.innerHTML = html;
  const plots = [...box.querySelectorAll("[data-plot]")];
  const redraw = () => plots.forEach((el, i) => { el.innerHTML = draw(i, genWidth(el)); });
  redraw();
  return cbResize(box, redraw);
}
const genKey = (cls, dash) => `<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="${cls}"${dash ? ' stroke-dasharray="4 3"' : ""}/></svg>`;

/* ---------- Смещение и дисперсия на мишени ---------- */

function mountGenTargets(box){
  const cases = [
    { bias: false, varHigh: false, title: "низкое смещение,<br>низкая дисперсия" },
    { bias: true, varHigh: false, title: "высокое смещение,<br>низкая дисперсия" },
    { bias: false, varHigh: true, title: "низкое смещение,<br>высокая дисперсия" },
    { bias: true, varHigh: true, title: "высокое смещение,<br>высокая дисперсия" }
  ];
  const r = rng(11);
  const shots = cases.map((c) => {
    const [cx, cy] = c.bias ? [22, -17] : [0, 0], sd = c.varHigh ? 11 : 4.5;
    return Array.from({ length: 14 }, () => {
      const x = cx + sd * gauss(r), y = cy + sd * gauss(r), d = Math.hypot(x, y);
      return d > 54 ? [x * 54 / d, y * 54 / d] : [x, y];   /* все выстрелы — в пределах мишени */
    });
  });
  const target = (pts) => {
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    return `<svg viewBox="-60 -60 120 120" role="img" aria-label="Мишень с прогнозами моделей">
      <circle r="56" class="gen-ring a"/><circle r="38" class="gen-ring b"/><circle r="20" class="gen-ring a"/>
      <circle r="3.4" class="gen-bull"/>
      ${pts.map(([x, y]) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="3.1" class="gen-shot"/>`).join("")}
      <circle cx="${f1(mx)}" cy="${f1(my)}" r="6" class="gen-mean"/>
    </svg>`;
  };
  box.innerHTML = `
    <div class="fig-stage gen-targets">
      ${cases.map((c, i) => `<div class="gen-target">${target(shots[i])}<p>${c.title}</p></div>`).join("")}
    </div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.4" class="gen-bull"/></svg>истинное значение \\(f(x_0)\\)</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.1" class="gen-shot"/></svg>прогноз модели, обученной на одной выборке</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="5" class="gen-mean"/></svg>средний прогноз \\(\\bar f(x_0)\\)</span>
    </div>`;
}

/* ---------- U-кривая: точное разложение для kNN-регрессии ---------- */

function genKnnCurve(){
  const n = 50, nTest = 400, sigma2 = 0.25;
  const f = (x) => Math.sin(2 * Math.PI * x) + 0.5 * Math.sin(6 * Math.PI * x);
  const xs = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
  const bias2 = new Array(n + 1).fill(0);
  for (let t = 0; t < nTest; t++){
    const x0 = (t + 0.5) / nTest;
    const near = xs.slice().sort((a, b) => Math.abs(a - x0) - Math.abs(b - x0));
    let acc = 0;
    near.forEach((x, j) => { acc += f(x); bias2[j + 1] += (f(x0) - acc / (j + 1)) ** 2 / nTest; });
  }
  return Array.from({ length: n }, (_, j) => {
    const k = j + 1, b2 = bias2[k], v = sigma2 / k;
    return { k, c: n / k, b2, v, total: sigma2 + b2 + v, sigma2 };
  });
}

function mountGenBvCurve(box){
  const rows = genKnnCurve(), sigma2 = rows[0].sigma2, n = rows.length;
  const best = rows.reduce((a, b) => (b.total < a.total ? b : a));
  const series = (key) => rows.map((r) => [r.c, r[key]]);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span>${genKey("gen-c-bias")}\\(\\text{bias}^2\\)</span>
      <span>${genKey("gen-c-var")}variance \\(\\sigma^2/k\\)</span>
      <span>${genKey("gen-c-noise", true)}шум \\(\\sigma^2\\)</span>
      <span>${genKey("gen-c-total")}ожидаемая ошибка: сумма трёх</span>
    </div>`, (_, w) => genPlot({
    id: "gen-bv", w, h: 250, aria: "Квадрат смещения, дисперсия и суммарная ошибка kNN-регрессии в зависимости от числа соседей",
    x: { min: 1, max: n, log: true, label: "число соседей k (правее — сложнее модель)",
      ticks: [50, 20, 10, 5, 2, 1].map((k) => [n / k, String(k)]) },
    y: { min: 0, max: 0.9, ticks: [0, 0.2, 0.4, 0.6, 0.8] },
    body: (sx, sy) => `
      <line class="gen-c-noise" x1="${f1(sx(1))}" x2="${f1(sx(n))}" y1="${f1(sy(sigma2))}" y2="${f1(sy(sigma2))}" stroke-dasharray="4 3"/>
      <polyline class="gen-c-bias" points="${genPts(series("b2"), sx, sy)}"/>
      <polyline class="gen-c-var" points="${genPts(series("v"), sx, sy)}"/>
      <polyline class="gen-c-total" points="${genPts(series("total"), sx, sy)}"/>`,
    over: (sx, sy) => `<circle class="gen-c-best" cx="${f1(sx(best.c))}" cy="${f1(sy(best.total))}" r="4.5"/>
      <text class="gen-note" x="${f1(sx(best.c))}" y="${f1(sy(best.total) - 10)}" text-anchor="middle">минимум, k = ${best.k}</text>`
  }));
}

/* ---------- Кривые обучения: точные ожидания для линейной регрессии ---------- */

function mountGenLearning(box){
  /* s2 — шум вместе с вкладом пропущенных признаков; p — число признаков модели */
  const panels = [
    { p: 40, s2: 1, title: "40 признаков, все нужные: высокая дисперсия",
      note: [230, 2.2, "разрыв сокращается с ростом n"] },
    { p: 2, s2: 2.5, title: "2 признака, часть сигнала пропущена: высокое смещение",
      note: [225, 3.05, "плато 2,5: данные не помогут"] }
  ];
  const ns = Array.from({ length: 351 }, (_, i) => 50 + i);
  return genStatic(box, `
    <div class="fig-stage gen-pair">
      ${panels.map((pn) => `<div><p class="gen-panel-title">${pn.title}</p><div data-plot></div></div>`).join("")}
    </div>
    <div class="fig-legend">
      <span>${genKey("gen-c-train")}ошибка на обучении</span>
      <span>${genKey("gen-c-test")}ошибка на новых данных</span>
      <span>${genKey("gen-c-noise", true)}неустранимая ошибка \\(\\sigma^2=1\\)</span>
    </div>`, (i, w) => {
    const pn = panels[i];
    const train = ns.map((n) => [n, pn.s2 * (n - pn.p) / n]);
    const test = ns.map((n) => [n, pn.s2 * (1 + pn.p / (n - pn.p - 1))]);
    return genPlot({
      id: `gen-lc${i}`, w, h: 220, aria: `Кривые обучения: ${pn.title}`,
      x: { min: 50, max: 400, label: "размер обучающей выборки n", ticks: [50, 100, 200, 300, 400].map((v) => [v, String(v)]) },
      y: { min: 0, max: 3.5, ticks: [0, 1, 2, 3] },
      body: (sx, sy) => `
        <line class="gen-c-noise" x1="${f1(sx(50))}" x2="${f1(sx(400))}" y1="${f1(sy(1))}" y2="${f1(sy(1))}" stroke-dasharray="4 3"/>
        <polyline class="gen-c-test" points="${genPts(test, sx, sy)}"/>
        <polyline class="gen-c-train" points="${genPts(train, sx, sy)}"/>`,
      over: (sx, sy) => `<text class="gen-note" x="${f1(sx(pn.note[0]))}" y="${f1(sy(pn.note[1]))}" text-anchor="middle">${pn.note[2]}</text>`
    });
  });
}

/* ---------- Концентрация расстояний ---------- */

function mountGenDist(box){
  const dims = [2, 10, 100, 768], N = 1000;
  const r = rng(5);
  const rows = dims.map((d) => {
    const q = Array.from({ length: d }, r);
    const dist = Array.from({ length: N }, () => {
      let s = 0;
      for (let j = 0; j < d; j++){ const t = r() - q[j]; s += t * t; }
      return Math.sqrt(s);
    });
    const mean = dist.reduce((a, b) => a + b, 0) / N;
    const z = dist.map((v) => v / mean).sort((a, b) => a - b);
    const at = (p) => z[Math.round(p * (N - 1))];
    return { d, min: z[0], max: z[N - 1], p05: at(0.05), p95: at(0.95), med: at(0.5) };
  });
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="gen-d-range"/></svg>от ближайшей до самой дальней точки</span>
      <span><svg viewBox="0 0 22 14"><rect x="2" y="3" width="18" height="8" rx="2" class="gen-d-mid"/></svg>90% расстояний (от 5-го до 95-го процентиля)</span>
    </div>`, (_, w) => {
    const h = 64 + 38 * rows.length, top = 12, rowH = 38;
    return genPlot({
      id: "gen-dist", w, h, m: { l: 62, r: 92, t: top, b: 40 }, aria: "Разброс расстояний от запроса до случайных точек при разной размерности",
      x: { min: 0, max: 2.4, label: "расстояние / среднее расстояние", ticks: [0, 0.5, 1, 1.5, 2].map((v) => [v, genNum(v)]) },
      y: { min: 0, max: 1, ticks: [] },
      body: () => "",
      over: (sx, _, a) => `<line class="gen-grid" x1="${f1(sx(1))}" x2="${f1(sx(1))}" y1="${a.Y1}" y2="${a.Y0}"/>` + rows.map((row, i) => {
        const y = top + rowH * (i + 0.5) + 4;
        return `<text class="gen-tick" x="${a.X0 - 8}" y="${f1(y + 4)}" text-anchor="end">d = ${row.d}</text>
          <line class="gen-d-range" x1="${f1(sx(row.min))}" x2="${f1(sx(row.max))}" y1="${f1(y)}" y2="${f1(y)}"/>
          <rect class="gen-d-mid" x="${f1(sx(row.p05))}" y="${f1(y - 7)}" width="${f1(Math.max(2, sx(row.p95) - sx(row.p05)))}" height="14" rx="3"/>
          <line class="gen-d-med" x1="${f1(sx(row.med))}" x2="${f1(sx(row.med))}" y1="${f1(y - 9)}" y2="${f1(y + 9)}"/>
          <text class="gen-tick" x="${a.X1 + 8}" y="${f1(y + 4)}">max/min: ${fmtN(row.max / row.min, row.max / row.min < 10 ? 2 : 0)}</text>`;
      }).join("")
    });
  });
}

/* ---------- Double descent: точный риск для p из D гауссовских признаков ---------- */

function genDdRisk(p, n, beta2, sigma2){
  let sT = 0, sR = 0;
  beta2.forEach((b, j) => { if (j < p) sT += b; else sR += b; });
  if (p <= n - 2) return (sR + sigma2) * (1 + p / (n - p - 1));
  if (p >= n + 2) return sT * (1 - n / p) + (sR + sigma2) * (1 + n / (p - n - 1));
  return Infinity;
}

function mountGenDd(box){
  const D = 200, n = 40, sigma2 = 0.1;
  const w0 = Array.from({ length: D }, (_, j) => 1 / (j + 1)), z = w0.reduce((a, b) => a + b, 0);
  const beta2 = w0.map((v) => v / z);
  const left = [], right = [];
  for (let p = 1; p <= D; p++){
    if (p <= n - 2) left.push([p, genDdRisk(p, n, beta2, sigma2)]);
    if (p >= n + 2) right.push([p, genDdRisk(p, n, beta2, sigma2)]);
  }
  const argmin = (arr) => arr.reduce((a, b) => (b[1] < a[1] ? b : a));
  const bl = argmin(left), br = argmin(right);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span>${genKey("gen-c-total")}ожидаемый риск на новых данных</span>
      <span>${genKey("gen-c-noise", true)}шум \\(\\sigma^2\\)</span>
      <span>${genKey("gen-c-thr", true)}порог интерполяции \\(p=n\\)</span>
    </div>`, (_, w) => genPlot({
    id: "gen-dd", w, h: 250, aria: "Риск линейной регрессии в зависимости от числа признаков: double descent",
    x: { min: 0, max: D, label: "число признаков модели p", ticks: [0, 40, 100, 150, 200].map((v) => [v, String(v)]) },
    y: { min: 0, max: 2, ticks: [0, 0.5, 1, 1.5, 2] },
    body: (sx, sy) => `
      <line class="gen-c-noise" x1="${f1(sx(0))}" x2="${f1(sx(D))}" y1="${f1(sy(sigma2))}" y2="${f1(sy(sigma2))}" stroke-dasharray="4 3"/>
      <line class="gen-c-thr" x1="${f1(sx(n))}" x2="${f1(sx(n))}" y1="${f1(sy(0))}" y2="${f1(sy(2))}" stroke-dasharray="4 3"/>
      <polyline class="gen-c-total" points="${genPts(left, sx, sy)}"/>
      <polyline class="gen-c-total" points="${genPts(right, sx, sy)}"/>`,
    over: (sx, sy) => `
      <circle class="gen-c-best" cx="${f1(sx(bl[0]))}" cy="${f1(sy(bl[1]))}" r="4.5"/>
      <text class="gen-note" x="${f1(sx(bl[0]) + 6)}" y="${f1(sy(bl[1]) + 18)}">p = ${bl[0]}</text>
      <circle class="gen-c-best" cx="${f1(sx(br[0]))}" cy="${f1(sy(br[1]))}" r="4.5"/>
      <text class="gen-note" x="${f1(sx(br[0]))}" y="${f1(sy(br[1]) - 10)}" text-anchor="middle">второй спуск, p = ${br[0]}</text>
      <text class="gen-note" x="${f1(sx(n) + 7)}" y="${f1(sy(0.28))}">p = n = ${n}</text>`
  }));
}

Object.assign(FIGURES, {
  "gen-knn": mountGenKnn,
  "gen-targets": mountGenTargets,
  "gen-bv-curve": mountGenBvCurve,
  "gen-learning": mountGenLearning,
  "gen-dist": mountGenDist,
  "gen-dd": mountGenDd
});
