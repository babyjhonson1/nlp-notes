/* Иллюстрация раздела models/colbert: обучение ColBERT (вход с [Q] и [MASK], общий BERT, проекция,
   матрица MaxSim, функция потерь, градиент через максимумы) и индекс ColBERTv2 (центроиды, сжатые
   остатки, поиск по инвертированным спискам). Помощники — figures/mdl.js. Все числа условные. */

function mountColbertFlow(box){
  const QUERY = "how much protein should a female eat";
  // показанные строки матрицы: 7 токенов запроса и 3 из 22 позиций [MASK]
  const ROWS = ["how", "much", "protein", "should", "a", "female", "eat", "[MASK]", "[MASK]", "[MASK]"];
  const QKINDS = ["cls", "colbert-mk", ...Array(7).fill("tok"), "sep", ...Array(22).fill("colbert-msk")];
  // документы: токены после [D]; точка отбрасывается фильтром пунктуации. Косинусы условные.
  const DOCS = {
    pos: {
      text: "Women need about 46 grams of protein a day.",
      toks: ["[CLS]", "[D]", "women", "need", "about", "46", "grams", "of", "protein", "a", "day", ".", "[SEP]"],
      sim: [
        [0.23, 0.2, 0.21, 0.06, 0.46, 0.14, 0.31, 0.17, 0.05, 0.15, 0.06, 0.19],
        [0.24, 0.3, 0.07, 0.1, 0.44, 0.29, 0.58, 0.14, 0.29, 0.05, 0.26, 0.22],
        [0.2, 0.2, 0.12, 0.25, 0.09, 0.19, 0.41, 0.14, 0.93, 0.06, 0.06, 0.21],
        [0.28, 0.24, 0.12, 0.71, 0.16, 0.12, 0.25, 0.22, 0.1, 0.19, 0.18, 0.31],
        [0.29, 0.22, 0.29, 0.07, 0.15, 0.24, 0.08, 0.17, 0.05, 0.62, 0.24, 0.27],
        [0.31, 0.23, 0.81, 0.19, 0.19, 0.16, 0.26, 0.29, 0.16, 0.21, 0.06, 0.29],
        [0.28, 0.33, 0.25, 0.42, 0.14, 0.21, 0.05, 0.16, 0.47, 0.07, 0.06, 0.3],
        [0.2, 0.22, 0.14, 0.27, 0.06, 0.16, 0.4, 0.27, 0.25, 0.26, 0.66, 0.24],
        [0.23, 0.31, 0.29, 0.08, 0.09, 0.48, 0.61, 0.17, 0.19, 0.11, 0.04, 0.24],
        [0.24, 0.26, 0.55, 0.22, 0.17, 0.2, 0.22, 0.05, 0.27, 0.24, 0.35, 0.3]
      ]
    },
    neg: {
      text: "Men need about 56 grams of protein per day.",
      toks: ["[CLS]", "[D]", "men", "need", "about", "56", "grams", "of", "protein", "per", "day", ".", "[SEP]"],
      sim: [
        [0.24, 0.24, 0.07, 0.2, 0.45, 0.06, 0.3, 0.08, 0.13, 0.05, 0.04, 0.2],
        [0.2, 0.23, 0.05, 0.27, 0.43, 0.08, 0.57, 0.13, 0.13, 0.07, 0.26, 0.33],
        [0.25, 0.25, 0.06, 0.07, 0.13, 0.11, 0.4, 0.08, 0.92, 0.29, 0.18, 0.2],
        [0.26, 0.18, 0.18, 0.7, 0.26, 0.22, 0.11, 0.14, 0.08, 0.24, 0.18, 0.3],
        [0.23, 0.21, 0.25, 0.3, 0.26, 0.25, 0.25, 0.23, 0.1, 0.48, 0.13, 0.18],
        [0.18, 0.22, 0.49, 0.22, 0.29, 0.16, 0.28, 0.3, 0.29, 0.13, 0.1, 0.21],
        [0.21, 0.21, 0.2, 0.41, 0.26, 0.16, 0.21, 0.25, 0.46, 0.21, 0.28, 0.3],
        [0.29, 0.25, 0.09, 0.25, 0.13, 0.25, 0.29, 0.14, 0.14, 0.44, 0.65, 0.21],
        [0.2, 0.2, 0.28, 0.25, 0.08, 0.47, 0.62, 0.21, 0.13, 0.18, 0.07, 0.18],
        [0.33, 0.28, 0.36, 0.28, 0.15, 0.27, 0.25, 0.09, 0.11, 0.12, 0.1, 0.27]
      ]
    }
  };
  // индекс: условные кластеры векторов токенов на плоскости и кандидаты поиска
  const CL = [
    { t: "protein", c: [0.2, 0.3] }, { t: "grams", c: [0.47, 0.17] }, { t: "day", c: [0.77, 0.27] },
    { t: "women", c: [0.27, 0.74] }, { t: "men", c: [0.55, 0.8] }, { t: "need", c: [0.82, 0.68] }
  ];
  const CAND = [
    { t: "Women need about 46 grams…", lo: 5.9, ex: 6.4, role: "pos" },
    { t: "Men need about 56 grams…", lo: 5.3, ex: 5.7, role: "hard" },
    { t: "Most men lift weights twice a week.", lo: 3.2, ex: 3.9, role: "" }
  ];
  const MODES = {
    train: { tab: "Обучение v1", steps: ["вход", "общий BERT", "проекция и нормировка", "MaxSim", "функция потерь", "обратный проход"] },
    index: { tab: "Индекс v2", steps: ["векторы и центроиды", "остаток в 2 битах", "поиск по центроидам", "точный MaxSim"] }
  };
  let mode = "train", doc = "pos";

  const maxsim = (k) => {
    const S = DOCS[k].sim, arg = S.map((r) => r.indexOf(Math.max(...r))), mx = S.map((r) => Math.max(...r));
    return { arg, mx, sum: mx.reduce((a, b) => a + b, 0) };
  };
  const cols = (k) => DOCS[k].toks.filter((t) => t !== ".");
  const loss = () => {
    const d = maxsim("pos").sum - maxsim("neg").sum, p = 1 / (1 + Math.exp(-d));
    return { d, p, L: -Math.log(p) };
  };
  // точки кластеров: фиксированное зерно, разброс условный
  const PTS = (() => {
    const r = rng(17), out = [];
    CL.forEach((c, k) => { for (let i = 0; i < 9; i++) out.push({ k, x: c.c[0] + 0.045 * gauss(r), y: c.c[1] + 0.04 * gauss(r) }); });
    return out;
  })();
  const QV = [0.43, 0.84];          // вектор токена запроса «female»
  const PROBE = [3, 4];             // два ближайших центроида: women и men

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема ColBERT: векторы токенов, MaxSim, функция потерь и сжатый индекс"></svg></div>
    <div class="fig-row">
      <div class="fig-tabs mdl-tabs" role="tablist" aria-label="Режим">${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${m.tab}</button>`).join("")}</div>
    </div>
    <div class="fig-row" data-row="train">
      <span class="fig-seg colbert-seg">документ<span class="fig-tabs" role="tablist" aria-label="Документ">
        <button type="button" role="tab" data-doc="pos" aria-selected="true">позитив</button>
        <button type="button" role="tab" data-doc="neg" aria-selected="false">негатив</button>
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key colbert-msk"></i>', "позиция [MASK]"],
      ['<i class="mdl-key colbert-max"></i>', "максимум строки"],
      ['<i class="mdl-key colbert-cent"></i>', "центроид"],
      ['<i class="mdl-key vec"></i>', "значения условные"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const rows = [...box.querySelectorAll("[data-row]")];
  const H = 440;

  /* ---------- обучение, шаги 0–2: вход, общий BERT, проекция ---------- */
  function drawEncode(step, W){
    const D = DOCS[doc], xa = W * 0.27, xb = W * 0.73, half = Math.min(250, W * 0.44);
    const yText = H - 40, yTok = H - 74, twH = 150, twT = yTok - 40 - twH, yBar = twT - 46, bh = 34;
    let s = "";
    // тексты
    s += mdlLines(xa, yText, mdlWrap(QUERY, half, 10.5, 2), "mdl-cap", 12);
    s += mdlLines(xb, yText, mdlWrap(D.text, half, 10.5, 2), "mdl-cap", 12);
    s += `<text x="${f1(xa)}" y="${f1(H - 8)}" class="mdl-cap sm${step === 0 ? " on" : ""}" text-anchor="middle">запрос: 32 позиции</text>`;
    s += `<text x="${f1(xb)}" y="${f1(H - 8)}" class="mdl-cap sm${step === 0 ? " on" : ""}" text-anchor="middle">${doc === "pos" ? "позитив" : "негатив"}: 13 токенов</text>`;
    // токены
    const tq = colbertRow(xa, yTok, half, QKINDS, 7);
    const dk = D.toks.map((t, i) => i === 0 ? "cls" : i === 1 ? "colbert-mk" : t === "[SEP]" ? "sep" : t === "." ? "colbert-pun" : "tok");
    const td = colbertRow(xb, yTok, Math.min(half, 13 * 13), dk, 11);
    s += `<g class="${step === 0 ? "mdl-in-on" : ""}">${tq.svg}${td.svg}</g>`;
    s += `<text x="${f1(xa)}" y="${f1(yTok - 8)}" class="mdl-cap sm" text-anchor="middle">[CLS] [Q] … [SEP] + 22 × [MASK]</text>`;
    s += `<text x="${f1(xb)}" y="${f1(yTok - 8)}" class="mdl-cap sm" text-anchor="middle">[CLS] [D] … [SEP]</text>`;
    // общий BERT
    const tw = Math.min(330, W - 40);
    s += mdlFwd(xa, yTok - 18, W / 2 - tw / 4, twT + twH + 2, step === 1) + mdlFwd(xb, yTok - 18, W / 2 + tw / 4, twT + twH + 2, step === 1);
    s += mdlTower(W / 2, twT, tw, twH, { label: "BERT-base, общий для запроса и документа", cls: step === 1 ? "on" : "" });
    // векторы токенов после проекции
    s += `<g${mdlFade(step >= 2)}>`;
    s += mdlFwd(W / 2 - tw / 4, twT - 2, xa, yBar + 4, step === 2) + mdlFwd(W / 2 + tw / 4, twT - 2, xb, yBar + 4, step === 2);
    s += colbertBars(tq.xs, tq.sz, yBar, bh, QKINDS, 5, []);
    s += colbertBars(td.xs, td.sz, yBar, bh, dk, 9, [D.toks.indexOf(".")]);
    const ip = D.toks.indexOf("."), xp = td.xs[ip];
    s += `<line x1="${f1(xp - 6)}" y1="${f1(yBar - bh - 4)}" x2="${f1(xp + 6)}" y2="${f1(yBar + 2)}" class="colbert-x"/>`;
    s += `<line x1="${f1(xp + 6)}" y1="${f1(yBar - bh - 4)}" x2="${f1(xp - 6)}" y2="${f1(yBar + 2)}" class="colbert-x"/>`;
    s += mdlLines(W / 2, yBar - bh - (W < 480 ? 44 : 28), W < 480 ? ["линейный слой 768 → 128,", "нормировка каждого вектора"] : ["линейный слой 768 → 128, нормировка каждого вектора"], "mdl-cap" + (step === 2 ? " on" : ""), 13);
    s += `<text x="${f1(xa)}" y="${f1(yBar - bh - 8)}" class="mdl-cap sm" text-anchor="middle">32 вектора запроса</text>`;
    s += `<text x="${f1(xb)}" y="${f1(yBar - bh - 8)}" class="mdl-cap sm" text-anchor="middle">12 векторов документа</text>`;
    s += "</g>";
    return s;
  }
  // ряд токенов с промежутком 1, если места мало
  function colbertRow(x, y, w, kinds, maxSize){
    const n = kinds.length, gap = n > 20 ? 1 : 2, sz = Math.min(maxSize, (w - gap * (n - 1)) / n);
    const x0 = x - (n * sz + (n - 1) * gap) / 2, xs = [];
    let svg = "";
    kinds.forEach((k, i) => {
      const xi = x0 + i * (sz + gap);
      xs.push(xi + sz / 2);
      svg += `<rect x="${f1(xi)}" y="${f1(y)}" width="${f1(sz)}" height="${f1(Math.max(sz, 7))}" rx="1.5" class="mdl-tok ${k}"/>`;
    });
    return { svg, xs, sz };
  }
  // векторы токенов: столбики из трёх ячеек; drop — отброшенные позиции
  function colbertBars(xs, sz, yBottom, h, kinds, seed, drop){
    const r = rng(seed);
    let s = "";
    xs.forEach((xc, i) => {
      const off = drop.includes(i);
      s += `<g${off ? ' opacity="0.25"' : ""}>`;
      for (let c = 0; c < 3; c++) s += `<rect x="${f1(xc - sz / 2)}" y="${f1(yBottom - (c + 1) * h / 3)}" width="${f1(sz)}" height="${f1(h / 3 - 1)}" style="${vlVal(2 * r() - 1)}"/>`;
      s += `<rect x="${f1(xc - sz / 2)}" y="${f1(yBottom - h)}" width="${f1(sz)}" height="${f1(h - 1)}" class="mdl-barf${kinds[i] === "colbert-msk" ? " colbert-mskf" : ""}"/></g>`;
    });
    return s;
  }

  /* ---------- обучение, шаги 3–5: матрица MaxSim, потери, градиент ---------- */
  function drawMatrix(step, W){
    const D = DOCS[doc], C = cols(doc), ms = maxsim(doc), isBack = step === 5;
    const lw = W < 480 ? 50 : 60, rw = 44, c = Math.max(17, Math.min(26, Math.floor((W - lw - rw - 16) / 12)));
    const mW = 12 * c, x0 = Math.round((W - (lw + mW + rw)) / 2 + lw), y0 = 112;
    const grad = new Set(ms.arg);
    let s = "";
    // заголовки столбцов: токены документа
    C.forEach((t, j) => {
      const x = x0 + (j + 0.5) * c, on = isBack && grad.has(j);
      s += `<text x="${f1(x)}" y="${f1(y0 - 6)}" transform="rotate(-55 ${f1(x)} ${f1(y0 - 6)})" class="colbert-hd${on ? " on" : ""}${isBack && !on ? " off" : ""}">${mdlEsc(t)}</text>`;
    });
    // строки: токены запроса
    ROWS.forEach((t, i) => {
      const y = y0 + i * c;
      s += `<text x="${f1(x0 - 6)}" y="${f1(y + c / 2)}" class="mdl-lbl colbert-rl${t === "[MASK]" ? " msk" : ""}" text-anchor="end">${mdlEsc(t)}</text>`;
      C.forEach((_, j) => {
        const v = D.sim[i][j], best = ms.arg[i] === j;
        s += `<rect x="${f1(x0 + j * c)}" y="${f1(y)}" width="${c}" height="${c}" class="colbert-cell" style="${vlVal(v)}"${isBack && !best ? ' opacity="0.3"' : ""}/>`;
        if (best) s += `<rect x="${f1(x0 + j * c + 1)}" y="${f1(y + 1)}" width="${c - 2}" height="${c - 2}" rx="2" class="colbert-max"/>`;
        if (best && c >= 22) s += `<text x="${f1(x0 + (j + 0.5) * c)}" y="${f1(y + c / 2)}" class="colbert-cv">${mdlNum(v, 2).replace(/^0/, "")}</text>`;
      });
      s += `<text x="${f1(x0 + mW + 8)}" y="${f1(y + c / 2)}" class="mdl-lbl${step === 3 ? " colbert-mxv" : ""}">${mdlNum(ms.mx[i], 2)}</text>`;
    });
    s += `<text x="${f1(x0 + mW + 8)}" y="${f1(y0 - 8)}" class="mdl-cap sm">max</text>`;
    const yS = y0 + 10 * c + 18;
    s += `<text x="${f1(W / 2)}" y="${f1(yS)}" class="mdl-lbl${step === 3 ? " colbert-mxv" : ""}" text-anchor="middle">S(q, ${doc === "pos" ? "d+" : "d−"}) = ${mdlNum(ms.sum, 2)} — сумма по 10 строкам из 32</text>`;
    // функция потерь
    if (step >= 4){
      const l = loss();
      s += mdlBox(W / 2, 30, Math.min(W - 16, 330), 34, [`L = −log σ(S+ − S−) = ${mdlNum(l.L, 2)}`, `S+ = ${mdlNum(maxsim("pos").sum, 2)},  S− = ${mdlNum(maxsim("neg").sum, 2)},  p+ = ${mdlNum(l.p, 2)}`], "loss" + (step === 4 ? " on" : ""));
    }
    if (isBack){
      const yG = yS + 8;
      C.forEach((_, j) => {
        const x = x0 + (j + 0.5) * c;
        if (grad.has(j)) s += mdlGrad(x, yG, x, yG + 24);
      });
      s += `<text x="${f1(W / 2)}" y="${f1(yG + 38)}" class="mdl-cap sm" text-anchor="middle">градиент получают векторы ${grad.size} из 12 токенов документа</text>`;
    }
    return s;
  }

  /* ---------- индекс v2: центроиды, остаток, поиск ---------- */
  function drawIndex(step, W){
    const px = (x) => 26 + x * (W - 52), py = (y) => 28 + y * 260;
    const cs = CL[3].c;
    let s = "";
    // точки и центроиды
    PTS.forEach((p, i) => {
      const hit = step >= 2 && PROBE.includes(p.k);
      const dim = step === 1 || (step >= 2 && !hit);
      s += `<circle cx="${f1(px(p.x))}" cy="${f1(py(p.y))}" r="3" class="colbert-pt${hit ? " on" : ""}"${dim ? ' opacity="0.35"' : ""}/>`;
    });
    CL.forEach((c, k) => {
      const x = px(c.c[0]), y = py(c.c[1]), on = (step === 1 && k === 3) || (step >= 2 && PROBE.includes(k));
      s += `<path d="M${f1(x - 6)} ${f1(y - 6)} L${f1(x + 6)} ${f1(y + 6)} M${f1(x + 6)} ${f1(y - 6)} L${f1(x - 6)} ${f1(y + 6)}" class="colbert-cent${on ? " on" : ""}"/>`;
      s += `<text x="${f1(x)}" y="${f1(y - (step === 1 && k === 3 ? 48 : 18))}" class="colbert-cl${on ? " on" : ""}" text-anchor="middle">${c.t}</text>`;
    });
    if (step === 0) s += `<text x="${f1(W / 2)}" y="${f1(py(1) + 24)}" class="mdl-cap" text-anchor="middle">векторы токенов корпуса и центроиды k-means</text>`;
    // остаток: сетка уровней квантования вокруг центроида (в пикселях) и восстановленный вектор
    if (step === 1){
      const g = 22, lv = [-1.5, -0.5, 0.5, 1.5], cx = px(cs[0]), cy = py(cs[1]);
      const vx = cx + 40, vy = cy - 15;
      const snap = (d) => g * lv.reduce((b, a) => Math.abs(a - d / g) < Math.abs(b - d / g) ? a : b);
      lv.forEach((a) => lv.forEach((b) => { s += `<circle cx="${f1(cx + a * g)}" cy="${f1(cy + b * g)}" r="1.8" class="colbert-grid"/>`; }));
      s += vlArrow(cx, cy, vx, vy, "colbert-res");
      s += `<circle cx="${f1(vx)}" cy="${f1(vy)}" r="4" class="colbert-pt on"/>`;
      s += `<circle cx="${f1(cx + snap(vx - cx))}" cy="${f1(cy + snap(vy - cy))}" r="5.5" class="colbert-rec"/>`;
      s += `<text x="${f1(vx + 9)}" y="${f1(vy - 4)}" class="mdl-lbl">v</text>`;
      const yb = py(1) + 20;
      s += mdlBox(W / 2, yb + 14, Math.min(W - 16, 380), 34, ["4 байта (номер центроида) + 128 × 2 бита = 36 байт", "вместо 128 × 2 байта = 256 байт"], "on");
    }
    // поиск: вектор запроса, ближайшие центроиды, кандидаты
    if (step >= 2){
      const qx = px(QV[0]), qy = py(QV[1]);
      PROBE.forEach((k) => { s += `<line x1="${f1(qx)}" y1="${f1(qy)}" x2="${f1(px(CL[k].c[0]))}" y2="${f1(py(CL[k].c[1]))}" class="colbert-probe"/>`; });
      s += `<path d="M${f1(qx)} ${f1(qy - 7)} L${f1(qx + 7)} ${f1(qy)} L${f1(qx)} ${f1(qy + 7)} L${f1(qx - 7)} ${f1(qy)} Z" class="colbert-q"/>`;
      s += `<text x="${f1(qx)}" y="${f1(qy + 20)}" class="mdl-lbl" text-anchor="middle">female</text>`;
      const yt = py(1) + 18, lh = 17, xl = W < 480 ? 12 : W / 2 - 220;
      const xa = W < 480 ? W - 96 : W / 2 + 120, xe = W < 480 ? W - 40 : W / 2 + 190;
      s += `<text x="${f1(xl)}" y="${f1(yt)}" class="mdl-cap sm">кандидаты</text>`;
      s += `<text x="${f1(xa)}" y="${f1(yt)}" class="mdl-cap sm" text-anchor="middle">по кластерам</text>`;
      s += `<g${mdlFade(step >= 3)}><text x="${f1(xe)}" y="${f1(yt)}" class="mdl-cap sm${step === 3 ? " on" : ""}" text-anchor="middle">точно</text></g>`;
      CAND.forEach((cd, r) => {
        const y = yt + lh * (r + 1);
        s += `<text x="${f1(xl)}" y="${f1(y)}" class="mdl-lbl${cd.role ? " " + cd.role : ""}">${mdlEsc(mdlWrap(cd.t, xa - xl - 40, 11, 1)[0])}</text>`;
        s += `<text x="${f1(xa)}" y="${f1(y)}" class="mdl-lbl" text-anchor="middle">${mdlNum(cd.lo, 1)}</text>`;
        if (step >= 3) s += `<text x="${f1(xe)}" y="${f1(y)}" class="mdl-lbl colbert-mxv" text-anchor="middle">${mdlNum(cd.ex, 1)}</text>`;
      });
    }
    return s;
  }

  function draw(step){
    const W = cbFit(stage, 340, 680);
    const s = mode === "index" ? drawIndex(step, W) : step <= 2 ? drawEncode(step, W) : drawMatrix(step, W);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    rows.forEach((r) => { r.hidden = r.dataset.row !== mode; });
    say.innerHTML = explain(step);
  }

  function explain(step){
    if (mode === "train"){
      const ms = maxsim(doc), l = loss(), C = cols(doc), pos = doc === "pos";
      const fem = ms.mx[5], femTok = C[ms.arg[5]];
      const got = [...new Set(ms.arg)].map((j) => C[j]), none = C.filter((_, j) => !ms.arg.includes(j));
      return [
        "<b>Вход.</b> Запрос — <code>[CLS]</code>, маркер <code>[Q]</code> (в словаре это <code>[unused0]</code>), 7 токенов WordPiece, <code>[SEP]</code> и 22 токена <code>[MASK]</code>: всего \\(N_q=32\\) позиции. Документ получает маркер <code>[D]</code> (<code>[unused1]</code>) и не дополняется; точка в конце — знак пунктуации. Тексты и все числа на схеме условные.",
        "<b>Общий BERT.</b> Запрос и документ проходят через одну и ту же сеть, но по отдельности: внимание не связывает их токены, поэтому векторы документа можно посчитать заранее. Настоящие токены запроса не видят позиций <code>[MASK]</code>, а сами эти позиции видят запрос, так что их выходы — функции запроса.",
        "<b>Проекция и нормировка.</b> Выход каждого токена проходит линейный слой \\(W\\in\\mathbb{R}^{128\\times768}\\) без активации и нормируется до единичной длины. Пулинга нет: запрос остаётся матрицей из 32 векторов, документ — из 12, потому что вектор точки отбрасывается. Он не попадёт и в индекс.",
        `<b>MaxSim.</b> Клетка — косинус вектора запроса и вектора документа; показаны 10 из 32 строк. В каждой строке берётся максимум (обведён), и оценка \\(S(q,d)\\) — сумма максимумов: здесь \\(${mdlNum(ms.sum, 2)}\\). ` +
          (pos ? `Токен female находит в позитиве women (\\(${mdlNum(fem, 2)}\\)), а позиции <code>[MASK]</code> — day, grams и women: это и есть выученное расширение запроса.`
               : `В негативе лучший токен для female — men, всего \\(${mdlNum(fem, 2)}\\), и последняя позиция <code>[MASK]</code> тоже совпадает слабее. Остальные строки почти такие же, как у позитива.`),
        `<b>Функция потерь.</b> Softmax по двум оценкам без температуры: \\(p^{+}=\\sigma(S^{+}-S^{-})=\\sigma(${mdlNum(l.d, 2)})=${mdlNum(l.p, 2)}\\), \\(\\mathcal{L}=-\\log p^{+}=${mdlNum(l.L, 2)}\\). Разница сумм складывается из разниц по строкам, и сильнее всего её дают female и последняя позиция <code>[MASK]</code>. В настоящей модели слагаемых 32, и разница в несколько единиц уже даёт уверенную вероятность.`,
        `<b>Обратный проход.</b> Через максимум градиент проходит только к выбранной клетке строки: в ${pos ? "позитиве" : "негативе"} его получают векторы ${got.join(", ")}, а ${none.join(", ")} ни разу не стали максимумом и от этой пары ничего не получают. Векторы запроса тянутся к выбранным токенам позитива и отталкиваются от выбранных токенов негатива с одним весом \\(1-p^{+}=${mdlNum(1 - l.p, 2)}\\); дальше градиент идёт в общий BERT и проекцию.`
      ][step];
    }
    return [
      "<b>Векторы и центроиды.</b> Точки — векторы токенов корпуса, крестики — центроиды k-means. Векторы одного токена в близких контекстах ложатся рядом, поэтому центроид хорошо описывает свой кластер. На плоскости это условная картинка: векторы 128-мерные, а в MS MARCO около \\(6\\cdot10^{8}\\) векторов и \\(2^{18}\\) центроидов.",
      "<b>Остаток в 2 битах.</b> Вектор \\(v\\) хранится как номер ближайшего центроида \\(C_t\\) и остаток \\(r=v-C_t\\) (стрелка), каждая координата которого заменена одним из четырёх уровней. Узлы сетки — все возможные \\(\\tilde v=C_t+\\tilde r\\); кружок — восстановленный вектор. 4 байта на номер и 32 байта на остаток вместо 256 байт 16-битного вектора.",
      `<b>Поиск по центроидам.</b> Вектор запроса female находит \\(n_{\\text{probe}}=2\\) ближайших центроида — women и men. Их инвертированные списки дают векторы токенов и пассажи, которым они принадлежат. Векторы распаковываются, сравниваются с запросом, и для каждого пассажа берётся максимум. Так поступает каждый из 32 векторов запроса, а сумма максимумов — нижняя оценка MaxSim по просмотренным кластерам. Оценки условные.`,
      "<b>Точный MaxSim.</b> Для лучших по нижней оценке кандидатов загружаются все векторы, и MaxSim считается полностью. Точная оценка не меньше приближённой: в ней участвуют и токены из непросмотренных кластеров. По умолчанию кандидатов \\(n_{\\text{probe}}\\cdot2^{12}\\); PLAID отсеивает часть из них заранее, сравнивая запрос с центроидами без распаковки остатков."
    ][step];
  }

  const player = vlPlayer(box, { count: () => MODES[mode].steps.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[i]}`, interval: 2600 });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop();
    player.go(Math.min(player.i, MODES[mode].steps.length - 1));
  }));
  box.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () => {
    doc = b.dataset.doc;
    box.querySelectorAll("[data-doc]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  player.paint();
  const unobserve = cbResize(stage, () => draw(player.i));
  return () => { player.stop(); unobserve(); };
}

Object.assign(FIGURES, {
  "colbert-flow": mountColbertFlow
});
