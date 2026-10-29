/* Иллюстрации раздела ml/trees (префикс: tree).
   Используют qMark из figures/common.js, vlControls и vlPlayer из figures/vl.js,
   genPlot, genStatic, genKey и genPts из figures/gen.js. */

/* ---------- Данные: условные заказы, признаки — задержка доставки и цена, цель — негативный отзыв ---------- */

function treeOrders(seed, n){
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++){
    const delay = Math.round(r() * 100) / 10, price = Math.round(r() * 400) / 10;   /* 0–10 дней, 0–40 тыс. ₽ */
    const p = delay > 6 ? 0.85 : (delay > 3 && price > 25 ? 0.8 : 0.1);
    pts.push({ x: [delay, price], y: r() < p ? 1 : 0 });
  }
  return pts;
}
const treeGini = (pos, n) => (n ? 2 * (pos / n) * (1 - pos / n) : 0);
const treePos = (pts) => pts.reduce((a, q) => a + q.y, 0);

/* Все пороги одного признака: сортировка и проход с накоплением счётчиков. */
function treeScan(pts, f){
  const s = pts.slice().sort((a, b) => a.x[f] - b.x[f]), n = s.length, P = treePos(s), out = [];
  let lp = 0;
  for (let i = 0; i < n - 1; i++){
    lp += s[i].y;
    if (s[i].x[f] === s[i + 1].x[f]) continue;
    const nl = i + 1, nr = n - nl;
    out.push([(s[i].x[f] + s[i + 1].x[f]) / 2, treeGini(P, n) - nl / n * treeGini(lp, nl) - nr / n * treeGini(P - lp, nr)]);
  }
  return out;
}
function treeBest(pts){
  const scans = [0, 1].map((f) => treeScan(pts, f));
  let best = null;
  scans.forEach((sc, f) => sc.forEach(([thr, dec]) => { if (!best || dec > best.dec + 1e-12) best = { f, thr, dec }; }));
  return best && Object.assign(best, { scans });
}

/* Рост «лучший лист первым»: на каждом шаге делим лист с наибольшим взвешенным уменьшением Gini. */
function treeGrow(train){
  const root = { pts: train, box: [[0, 10], [0, 40]] }, leaves = [root], order = [];
  for (;;){
    let pick = null;
    for (const L of leaves){
      if (L.pts.length < 2) continue;
      if (L.best === undefined) L.best = treeBest(L.pts);
      if (!L.best || L.best.dec <= 1e-12) continue;
      const w = L.best.dec * L.pts.length / train.length;
      if (!pick || w > pick.w + 1e-12) pick = { L, w };
    }
    if (!pick) break;
    const L = pick.L, { f, thr } = L.best;
    const lb = L.box.map((r) => r.slice()), rb = L.box.map((r) => r.slice());
    lb[f][1] = thr; rb[f][0] = thr;
    L.split = { f, thr, k: order.length };
    L.left = { pts: L.pts.filter((q) => q.x[f] <= thr), box: lb };
    L.right = { pts: L.pts.filter((q) => q.x[f] > thr), box: rb };
    leaves.splice(leaves.indexOf(L), 1, L.left, L.right);
    order.push(L);
  }
  return { root, order };
}
/* Состояние после k разбиений: применены только разбиения с номером меньше k. */
function treeLeafOf(root, x, k){
  let nd = root;
  while (nd.split && nd.split.k < k) nd = x[nd.split.f] <= nd.split.thr ? nd.left : nd.right;
  return nd;
}
function treeLeaves(root, k){
  const out = [], walk = (nd) => { if (nd.split && nd.split.k < k){ walk(nd.left); walk(nd.right); } else out.push(nd); };
  walk(root);
  return out;
}
const treeLabel = (nd) => (2 * treePos(nd.pts) > nd.pts.length ? 1 : 0);
const treeError = (root, pts, k) => pts.reduce((a, q) => a + (treeLabel(treeLeafOf(root, q.x, k)) !== q.y ? 1 : 0), 0) / pts.length;

/* ---------- Устройство дерева: путь заказа от корня до листа ---------- */

/* 10 условных заказов из ручного примера раздела: [задержка, цена, негатив] */
const TREE_HAND = [[1, 33, 1], [2, 11, 0], [3, 29, 1], [4, 14, 0], [5, 36, 1], [5.5, 9, 0], [7, 10, 1], [8, 12, 1], [9, 8, 1], [10, 13, 1]];

function mountTreeAnatomy(box){
  const NEW = [
    { name: "А", x: [4, 30] }, { name: "Б", x: [2, 12] }, { name: "В", x: [8, 15] }
  ];
  /* узлы схемы: координаты центров, текст, для листьев — ответ и состав */
  const N = {
    root: { x: 150, y: 30, q: ["задержка ≤ 6,25 дня?"] },
    price: { x: 82, y: 112, q: ["цена ≤ 21,5 тыс. ₽?"] },
    neg4: { x: 240, y: 112, leaf: 1, q: ["негатив", "негативных 4 из 4"] },
    pos3: { x: 52, y: 196, leaf: 0, q: ["без негатива", "негативных 0 из 3"] },
    neg3: { x: 154, y: 196, leaf: 1, q: ["негатив", "негативных 3 из 3"] }
  };
  const EDGES = [["root", "price", "да"], ["root", "neg4", "нет"], ["price", "pos3", "да"], ["price", "neg3", "нет"]];
  const pathOf = ([d, p]) => (d <= 6.25 ? ["root", "price", p <= 21.5 ? "pos3" : "neg3"] : ["root", "neg4"]);
  let sel = 0;

  box.innerHTML = `
    <div class="fig-stage tree-anat">
      <svg class="tree-diagram" viewBox="0 0 300 228" role="img" aria-label="Схема дерева решений из трёх листьев"></svg>
      <svg class="tree-anat-plane" viewBox="0 0 300 250" role="img" aria-label="Те же листья как прямоугольники на плоскости признаков"></svg>
    </div>
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Новый заказ">
        ${NEW.map((o, i) => `<button type="button" role="tab" data-o="${i}" aria-selected="${i === 0}">Заказ ${o.name}</button>`).join("")}
      </div>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt neg"/></svg>обучающий заказ с негативным отзывом</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt pos"/></svg>без негатива</span>
      <span><svg viewBox="0 0 22 14"><path d="M11 1.5 16.5 7 11 12.5 5.5 7z" class="tree-new"/></svg>новый заказ и его путь</span>
    </div>`;
  const diag = box.querySelector(".tree-diagram"), plane = box.querySelector(".tree-anat-plane"), say = box.querySelector(".fig-say");
  const L = 36, R = 8, T = 8, B = 34, W = 300, H = 250;
  const px = (v) => L + v / 11 * (W - L - R), py = (v) => H - B - v / 40 * (H - T - B);

  function draw(){
    const o = NEW[sel], path = pathOf(o.x), on = new Set(path);
    let s = "";
    for (const [a, b, lab] of EDGES){
      const hot = on.has(a) && on.has(b);
      s += `<line class="tree-edge${hot ? " hot" : ""}" x1="${N[a].x}" y1="${N[a].y + 14}" x2="${N[b].x}" y2="${N[b].y - 16}"/>`;
      s += `<text class="tree-edge-lab${hot ? " hot" : ""}" x="${f1((N[a].x + N[b].x) / 2 + (N[b].x < N[a].x ? -8 : 8))}" y="${f1((N[a].y + N[b].y) / 2 + 2)}" text-anchor="middle">${lab}</text>`;
    }
    for (const [id, nd] of Object.entries(N)){
      const w = nd.leaf === undefined ? 132 : 96, h = nd.leaf === undefined ? 28 : 34, hot = on.has(id);
      const cls = nd.leaf === undefined ? "tree-q" : `tree-lf ${nd.leaf ? "neg" : "pos"}`;
      s += `<rect class="${cls}${hot ? " hot" : ""}" x="${nd.x - w / 2}" y="${nd.y - h / 2}" width="${w}" height="${h}" rx="6"/>`;
      if (nd.q.length === 1) s += `<text class="tree-node-t" x="${nd.x}" y="${nd.y + 4}" text-anchor="middle">${nd.q[0]}</text>`;
      else s += `<text class="tree-node-t" x="${nd.x}" y="${nd.y - 2}" text-anchor="middle">${nd.q[0]}</text><text class="tree-node-s" x="${nd.x}" y="${nd.y + 11}" text-anchor="middle">${nd.q[1]}</text>`;
    }
    s += `<text class="gen-tick" x="4" y="${N.root.y + 4}">корень</text><text class="gen-tick" x="4" y="226">листья</text>`;
    diag.innerHTML = s;

    let p = "";
    const rect = (x0, x1, y0, y1, cls) => `<rect class="${cls}" x="${f1(px(x0))}" y="${f1(py(y1))}" width="${f1(px(x1) - px(x0))}" height="${f1(py(y0) - py(y1))}"/>`;
    const leafOn = path[path.length - 1];
    p += rect(0, 6.25, 0, 21.5, `tree-leaf pos${leafOn === "pos3" ? " hot" : ""}`);
    p += rect(0, 6.25, 21.5, 40, `tree-leaf neg${leafOn === "neg3" ? " hot" : ""}`);
    p += rect(6.25, 11, 0, 40, `tree-leaf neg${leafOn === "neg4" ? " hot" : ""}`);
    [0, 2, 4, 6, 8, 10].forEach((v) => { p += `<text class="gen-tick" x="${f1(px(v))}" y="${H - B + 14}" text-anchor="middle">${v}</text>`; });
    [0, 10, 20, 30, 40].forEach((v) => { p += `<text class="gen-tick" x="${L - 5}" y="${f1(py(v) + 3.5)}" text-anchor="end">${v}</text>`; });
    p += `<text class="gen-tick" x="${f1((L + W - R) / 2)}" y="${H - 4}" text-anchor="middle">задержка доставки, дни</text>`;
    p += `<text class="gen-tick" transform="translate(10 ${f1((T + H - B) / 2)}) rotate(-90)" text-anchor="middle">цена, тыс. ₽</text>`;
    TREE_HAND.forEach(([d, pr, y]) => { p += `<circle class="tree-pt ${y ? "neg" : "pos"}" cx="${f1(px(d))}" cy="${f1(py(pr))}" r="4.2"/>`; });
    p += qMark(px(o.x[0]), py(o.x[1]), 8, "tree-new");
    p += `<rect class="gen-frame" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/>`;
    plane.innerHTML = p;

    const [d, pr] = o.x;
    const steps = d <= 6.25
      ? `задержка ${fmtN(d, 0)} дня — не больше 6,25, идём по ветви «да»; цена ${fmtN(pr, 0)} тыс. ₽ — ${pr <= 21.5 ? "не больше 21,5, снова «да»" : "больше 21,5, ветвь «нет»"}`
      : `задержка ${fmtN(d, 0)} дней — больше 6,25, ветвь «нет»`;
    const leaf = N[leafOn];
    say.innerHTML = `<b>Заказ ${o.name}:</b> ${steps}. Попадаем в лист «${leaf.q[0]}»: ${leaf.leaf
      ? `все обучающие заказы этого листа получили негативный отзыв, поэтому прогноз — негатив с вероятностью 100 %`
      : `ни один из трёх обучающих заказов этого листа не получил негативного отзыва, поэтому прогноз — без негатива`}. На плоскости справа тот же лист — подсвеченный прямоугольник, в который попала точка заказа.`;
  }
  box.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => {
    sel = +b.dataset.o;
    box.querySelectorAll("[data-o]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    draw();
  }));
  draw();
}

/* ---------- XOR: первый разрез не уменьшает неопределённость ---------- */

function mountTreeXor(box){
  const r = rng(8), pts = [];
  for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]])
    for (let i = 0; i < 10; i++) pts.push([0.08 + 0.36 * r() + qx * 0.5, 0.08 + 0.36 * r() + qy * 0.5, qx ^ qy]);
  const panels = [
    { title: "Первый разрез: в каждой половине по 10 точек каждого класса", lines: [[0.5, 0, 0.5, 1]], shade: false },
    { title: "Второй уровень: четыре чистых листа", lines: [[0.5, 0, 0.5, 1], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 1, 0.5]], shade: true }
  ];
  return genStatic(box, `
    <div class="fig-stage gen-pair">
      ${panels.map((pn) => `<div><p class="gen-panel-title">${pn.title}</p><div data-plot></div></div>`).join("")}
    </div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt neg"/></svg>класс 1</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt pos"/></svg>класс 0</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="tree-cand"/></svg>разбиение</span>
    </div>`, (i, w) => {
    const pn = panels[i], size = Math.min(w, 300), pad = 22;
    const sx = (v) => pad + v * (size - pad - 6), sy = (v) => size - pad - v * (size - pad - 6);
    let s = "";
    if (pn.shade) [[0, 0, 0], [0.5, 0, 1], [0, 0.5, 1], [0.5, 0.5, 0]].forEach(([x0, y0, c]) => {
      s += `<rect class="tree-leaf ${c ? "neg" : "pos"}" x="${f1(sx(x0))}" y="${f1(sy(y0 + 0.5))}" width="${f1(sx(0.5) - sx(0))}" height="${f1(sy(0) - sy(0.5))}"/>`;
    });
    pn.lines.forEach(([x0, y0, x1, y1]) => { s += `<line class="tree-cand" x1="${f1(sx(x0))}" y1="${f1(sy(y0))}" x2="${f1(sx(x1))}" y2="${f1(sy(y1))}"/>`; });
    pts.forEach(([x, y, c]) => { s += `<circle class="tree-pt ${c ? "neg" : "pos"}" cx="${f1(sx(x))}" cy="${f1(sy(y))}" r="3.6"/>`; });
    s += `<rect class="gen-frame" x="${sx(0)}" y="${f1(sy(1))}" width="${f1(sx(1) - sx(0))}" height="${f1(sy(0) - sy(1))}"/>`;
    s += `<text class="gen-tick" x="${f1(sx(1))}" y="${size - 6}" text-anchor="end">x1</text><text class="gen-tick" x="4" y="${f1(sy(1) + 10)}">x2</text>`;
    return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${pn.title}">${s}</svg>`;
  });
}

/* ---------- Пошаговый рост дерева ---------- */

function mountTreeGrow(box){
  const train = treeOrders(3, 50), val = treeOrders(1003, 1000);
  const { root, order } = treeGrow(train), K = order.length;
  const err = Array.from({ length: K + 1 }, (_, k) => ({ tr: treeError(root, train, k), va: treeError(root, val, k) }));
  const bestVal = err.reduce((b, e, k) => (e.va < err[b].va ? k : b), 0);
  const pct = (v) => fmtN(100 * v, 0) + " %";
  const UNITS = [(v) => `${fmtN(v, 2)} дня`, (v) => `${fmtN(v, 2)} тыс. ₽`], NAMES = ["задержке", "цене"];

  box.innerHTML = `
    <div class="fig-stage tree-stage">
      <svg class="tree-plane" viewBox="0 0 330 290" tabindex="0" role="img" aria-label="Заказы на плоскости признаков и листья дерева"></svg>
      <div class="tree-charts"><div data-chart></div><div data-chart></div></div>
    </div>
    ${vlControls()}
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Число разбиений"></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt neg"/></svg>негативный отзыв</span>
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="tree-pt pos"/></svg>без негатива</span>
      <span><svg viewBox="0 0 22 14"><rect x="2" y="2" width="18" height="10" class="tree-cur"/></svg>лист, который делим следующим</span>
      <span><svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="tree-cand"/></svg>выбранный порог</span>
    </div>`;
  const svg = box.querySelector(".tree-plane"), charts = [...box.querySelectorAll("[data-chart]")], say = box.querySelector(".fig-say");
  const L = 40, R = 8, T = 8, B = 36, W = 330, H = 290;
  const px = (v) => L + v / 10 * (W - L - R), py = (v) => H - B - v / 40 * (H - T - B);

  function draw(k){
    const leaves = treeLeaves(root, k), next = k < K ? order[k] : null;
    let s = "";
    for (const lf of leaves){
      const lab = treeLabel(lf), [[x0, x1], [y0, y1]] = lf.box;
      s += `<rect class="tree-leaf ${lab ? "neg" : "pos"}" x="${f1(px(x0))}" y="${f1(py(y1))}" width="${f1(px(x1) - px(x0))}" height="${f1(py(y0) - py(y1))}"/>`;
    }
    [0, 2, 4, 6, 8, 10].forEach((v) => { s += `<text class="gen-tick" x="${f1(px(v))}" y="${H - B + 14}" text-anchor="middle">${v}</text>`; });
    [0, 10, 20, 30, 40].forEach((v) => { s += `<text class="gen-tick" x="${L - 5}" y="${f1(py(v) + 3.5)}" text-anchor="end">${v}</text>`; });
    s += `<text class="gen-tick" x="${f1((L + W - R) / 2)}" y="${H - 4}" text-anchor="middle">задержка доставки, дни</text>`;
    s += `<text class="gen-tick" transform="translate(11 ${f1((T + H - B) / 2)}) rotate(-90)" text-anchor="middle">цена, тыс. ₽</text>`;
    if (next){
      const [[x0, x1], [y0, y1]] = next.box, { f, thr } = next.split;
      s += `<rect class="tree-cur" x="${f1(px(x0))}" y="${f1(py(y1))}" width="${f1(px(x1) - px(x0))}" height="${f1(py(y0) - py(y1))}"/>`;
      s += f === 0
        ? `<line class="tree-cand" x1="${f1(px(thr))}" x2="${f1(px(thr))}" y1="${f1(py(y0))}" y2="${f1(py(y1))}"/>`
        : `<line class="tree-cand" x1="${f1(px(x0))}" x2="${f1(px(x1))}" y1="${f1(py(thr))}" y2="${f1(py(thr))}"/>`;
    }
    for (const q of train) s += `<circle class="tree-pt ${q.y ? "neg" : "pos"}" cx="${f1(px(q.x[0]))}" cy="${f1(py(q.x[1]))}" r="3.6"/>`;
    s += `<rect class="gen-frame" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/>`;
    svg.innerHTML = s;

    const best = next ? next.best : null;
    const ymax = best ? Math.max(0.05, ...best.scans.flat().map((p) => p[1])) * 1.15 : 0.3;
    charts.forEach((el, f) => {
      const sc = best ? best.scans[f] : [];
      const top = sc.reduce((a, p) => (!a || p[1] > a[1] ? p : a), null);
      const win = best && best.f === f;
      el.innerHTML = genPlot({
        id: `tree-scan${f}`, w: genWidth(el), h: 128, m: { l: 40, r: 10, t: 18, b: 30 },
        aria: `Уменьшение Gini в зависимости от порога по ${NAMES[f]}`,
        x: { min: 0, max: f ? 40 : 10, label: f ? "порог по цене, тыс. ₽" : "порог по задержке, дни",
          ticks: (f ? [0, 10, 20, 30, 40] : [0, 2, 4, 6, 8, 10]).map((v) => [v, String(v)]) },
        y: { min: 0, max: ymax, ticks: [0, Math.round(ymax / 2 * 100) / 100] },
        body: (sx, sy) => sc.length
          ? `<polyline class="tree-scan${win ? " win" : ""}" points="${genPts(sc, sx, sy)}"/>`
          : "",
        over: (sx, sy, a) => (top
          ? `<line class="tree-cand" x1="${f1(sx(top[0]))}" x2="${f1(sx(top[0]))}" y1="${a.Y0}" y2="${f1(sy(top[1]))}"/>` +
            `<circle class="tree-top${win ? " win" : ""}" cx="${f1(sx(top[0]))}" cy="${f1(sy(top[1]))}" r="4"/>`
          : "") + `<text class="gen-note${win ? " tree-win" : ""}" x="${a.X0}" y="11">${win ? "лучшее разбиение — по " + NAMES[f] : "по " + NAMES[f]}</text>`
      });
    });

    const e = err[k];
    let t = `<b>Разбиений: ${k}, листьев: ${k + 1}.</b> Ошибка на обучении ${pct(e.tr)}, на validation ${pct(e.va)}. `;
    if (k > 0 && e.tr === err[k - 1].tr) t += "Доля ошибок после последнего разбиения не изменилась: оба новых листа отвечают тем же классом, хотя Gini уменьшился. Критерий по доле ошибок такое разбиение не увидел бы. ";
    if (k === bestVal) t += "Здесь ошибка на validation минимальна: дерево почти повторяет правило, по которому сгенерированы данные (задержка больше 6 дней или больше 3 дней при цене выше 25 тыс. ₽). ";
    if (next){
      const n = next.pts.length, pos = treePos(next.pts);
      const tops = best.scans.map((sc) => sc.reduce((a, p) => (!a || p[1] > a[1] ? p : a), null));
      const part = (f) => (tops[f] ? `по ${NAMES[f]} — ${UNITS[f](tops[f][0])} (Gini уменьшается на ${fmtN(tops[f][1], 3)})` : `по ${NAMES[f]} порогов нет`);
      t += `Следующим делим лист из ${n} заказов, негативных ${pos}, Gini ${fmtN(treeGini(pos, n), 3)}. Лучший порог ${part(0)}, ${part(1)}.`;
    } else {
      t += `Все листья чистые, расти больше некуда. После ${bestVal}-го разбиения новые листья отделяют одиночные зашумлённые заказы: на обучении ошибка падает до нуля, на validation растёт — переобучение.`;
    }
    say.innerHTML = t;
  }
  const player = vlPlayer(box, { count: () => K + 1, draw, interval: 1800, label: (i, n) => `разбиений ${i} из ${n - 1}` });
  player.paint();
  const off = cbResize(box, () => player.paint());
  return () => { player.stop(); off(); };
}

/* ---------- Почему не доля ошибок: вогнутость критериев ---------- */

function mountTreeImpurity(box){
  const ps = Array.from({ length: 201 }, (_, i) => i / 200);
  const H2 = (p) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));
  const curves = [
    { cls: "tree-c-gini", f: (p) => 2 * p * (1 - p) },
    { cls: "tree-c-ent", f: (p) => H2(p) / 2 },
    { cls: "tree-c-err", f: (p) => Math.min(p, 1 - p) }
  ];
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span>${genKey("tree-c-gini")}Gini \\(2p(1-p)\\)</span>
      <span>${genKey("tree-c-ent")}энтропия в битах, делённая на 2</span>
      <span>${genKey("tree-c-err")}доля ошибок \\(\\min(p,\\,1-p)\\)</span>
      <span>${genKey("tree-chord", true)}взвешенная неопределённость детей</span>
    </div>`, (_, w) => genPlot({
    id: "tree-imp", w, h: 240, aria: "Критерии неопределённости узла и хорда разбиения",
    x: { min: 0, max: 1, label: "доля негативных в узле p", ticks: [0, 0.25, 0.5, 0.7, 1].map((v) => [v, genNum(v)]) },
    y: { min: 0, max: 0.55, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
    body: (sx, sy) => curves.map((c) => `<polyline class="${c.cls}" points="${genPts(ps.map((p) => [p, c.f(p)]), sx, sy)}"/>`).join("") +
      `<line class="tree-chord" x1="${f1(sx(0.5))}" y1="${f1(sy(0.5))}" x2="${f1(sx(1))}" y2="${f1(sy(0))}" stroke-dasharray="5 4"/>`,
    over: (sx, sy) => {
      const x = sx(0.7);
      let s = `<line class="gen-grid" x1="${f1(x)}" x2="${f1(x)}" y1="${f1(sy(0))}" y2="${f1(sy(0.55))}"/>`;
      s += curves.map((c) => `<circle class="tree-dot ${c.cls}" cx="${f1(x)}" cy="${f1(sy(c.f(0.7)))}" r="3.6"/>`).join("");
      s += `<circle class="tree-chord-dot" cx="${f1(x)}" cy="${f1(sy(0.3))}" r="3.6"/>`;
      s += [0.5, 1].map((p) => `<circle class="tree-chord-dot" cx="${f1(sx(p))}" cy="${f1(sy(curves[0].f(p)))}" r="3"/>`).join("");
      s += `<text class="gen-note" x="${f1(x + 7)}" y="${f1(sy(0.3) + 14)}">дети: 0,3</text>`;
      s += `<text class="gen-note" x="${f1(sx(0.5) - 6)}" y="${f1(sy(0.5) - 7)}" text-anchor="end">лист 3/6</text>`;
      s += `<text class="gen-note" x="${f1(sx(1) - 9)}" y="${f1(sy(0.07))}" text-anchor="end">лист 4/4</text>`;
      return s;
    }
  }));
}

/* ---------- Нет экстраполяции: тренд и дерево глубины 3 ---------- */

function treeRegress(xs, ys, depth){
  /* одномерное регрессионное дерево: разбиение по минимуму суммы квадратов, листья — средние */
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const build = (idx, d) => {
    const m = mean(idx.map((i) => ys[i]));
    if (d === 0 || idx.length < 2) return { m };
    const s = idx.slice().sort((a, b) => xs[a] - xs[b]);
    let best = null;
    for (let k = 1; k < s.length; k++){
      if (xs[s[k - 1]] === xs[s[k]]) continue;
      const l = s.slice(0, k), r = s.slice(k), ml = mean(l.map((i) => ys[i])), mr = mean(r.map((i) => ys[i]));
      const gain = l.length * r.length / s.length * (ml - mr) ** 2;   /* уменьшение суммы квадратов */
      if (!best || gain > best.gain) best = { gain, thr: (xs[s[k - 1]] + xs[s[k]]) / 2, l, r };
    }
    return best ? { thr: best.thr, left: build(best.l, d - 1), right: build(best.r, d - 1) } : { m };
  };
  const tree = build(xs.map((_, i) => i), depth);
  return (x) => { let nd = tree; while (nd.thr !== undefined) nd = x <= nd.thr ? nd.left : nd.right; return nd.m; };
}

function mountTreeExtrap(box){
  const r = rng(21), xs = Array.from({ length: 24 }, (_, i) => i + 1);
  const ys = xs.map((t) => 30 + 2.5 * t + 4 * gauss(r));               /* отзывов в месяц: линейный рост и шум */
  const tree = treeRegress(xs, ys, 3);
  const mx = xs.reduce((a, v) => a + v, 0) / 24, my = ys.reduce((a, v) => a + v, 0) / 24;
  const slope = xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / xs.reduce((a, v) => a + (v - mx) ** 2, 0);
  const lin = (t) => my + slope * (t - mx);
  const grid = Array.from({ length: 701 }, (_, i) => 1 + i * 35 / 700);
  return genStatic(box, `
    <div class="fig-stage" data-plot></div>
    <div class="fig-legend">
      <span><svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.4" class="tree-obs"/></svg>месяцы обучения</span>
      <span>${genKey("tree-c-tree")}дерево глубины 3</span>
      <span>${genKey("tree-c-lin")}линейная регрессия</span>
    </div>`, (_, w) => genPlot({
    id: "tree-extrap", w, h: 230, aria: "Прогноз дерева и линейной регрессии за пределами обучающего диапазона",
    x: { min: 1, max: 36, label: "месяц", ticks: [1, 6, 12, 18, 24, 30, 36].map((v) => [v, String(v)]) },
    y: { min: 20, max: 130, ticks: [20, 40, 60, 80, 100, 120] },
    body: (sx, sy) => `
      <rect class="tree-future" x="${f1(sx(24.5))}" y="${f1(sy(130))}" width="${f1(sx(36) - sx(24.5))}" height="${f1(sy(20) - sy(130))}"/>
      <polyline class="tree-c-lin" points="${genPts([[1, lin(1)], [36, lin(36)]], sx, sy)}"/>
      <polyline class="tree-c-tree" points="${genPts(grid.map((t) => [t, tree(t)]), sx, sy)}"/>
      ${xs.map((t, i) => `<circle class="tree-obs" cx="${f1(sx(t))}" cy="${f1(sy(ys[i]))}" r="3.2"/>`).join("")}`,
    over: (sx, sy) => `<text class="gen-note" x="${f1(sx(30.25))}" y="${f1(sy(30))}" text-anchor="middle">за пределами обучения</text>`
  }));
}

Object.assign(FIGURES, {
  "tree-anatomy": mountTreeAnatomy,
  "tree-xor": mountTreeXor,
  "tree-grow": mountTreeGrow,
  "tree-impurity": mountTreeImpurity,
  "tree-extrap": mountTreeExtrap
});
