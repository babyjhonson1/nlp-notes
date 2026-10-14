/* Иллюстрация раздела ml/generalization (префикс: gen): ёмкость kNN и кривая валидации. */

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

Object.assign(FIGURES, {
  "gen-knn": mountGenKnn
});
