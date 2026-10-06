/* Иллюстрации раздела models/dpr: два кодировщика при обучении и поиске; сведение скалярного
   произведения к L2 добавлением координаты. Помощники — figures/mdl.js. */

/* ---------- DPR: прямой и обратный проход, индексация и поиск ---------- */
function mountDprFlow(box){
  const Q = ["What is the body of water between England and Ireland?", "Who wrote the novel War and Peace?"];
  const P = [
    { t: "Irish Sea", role: "pos", lab: ["p", "1", "+"] },
    { t: "War and Peace", role: "pos", lab: ["p", "2", "+"] },
    { t: "British Cycling", role: "hard", lab: ["p", "1", "−"] },
    { t: "War novel", role: "hard", lab: ["p", "2", "−"] },
    { t: "English Channel", role: "", lab: ["p", "5", ""] }
  ];
  // Скалярные произведения векторов [CLS]: до обучения (оба кодировщика — bert-base-uncased),
  // после обучения (dpr-*-single-nq-base) и с вопросом, закодированным кодировщиком пассажей.
  const SC = {
    init: [[174.378, 142.811, 152.863, 175.861, 160.207], [170.449, 149.712, 152.131, 182.687, 158.414]],
    trained: [[79.321, 55.511, 60.56, 50.227, 79.006], [48.209, 79.994, 42.659, 70.149, 50.042]],
    wrong: [[102.543, 70.194, 78.011, 68.065, 103.344]]
  };
  const MODES = {
    train: { tab: "Обучение", steps: ["батч", "кодирование", "матрица S", "softmax и потери", "обратный проход"] },
    use: { tab: "Применение", steps: ["индексация", "кодирование вопроса", "поиск", "не тот кодировщик"] }
  };
  let mode = "train", state = "init";
  const softmax = (r) => { const mx = Math.max(...r), e = r.map((x) => Math.exp(x - mx)), t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); };
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const small = (x) => { if (x >= 1e-3) return mdlNum(x, 2); const [mm, e] = x.toExponential(0).split("e"); return mm + "·10" + String(+e).split("").map((ch) => SUP[ch]).join(""); };
  const texSmall = (x) => { if (x >= 1e-3) return mdlNum(x, 2); const [mm, e] = x.toExponential(0).split("e"); return `${mm}\\cdot10^{${+e}}`; };
  function trainStats(){
    const S = SC[state].map((r) => r.slice(0, 4)), Pr = S.map(softmax);
    // log-sum-exp напрямую: у второго вопроса до обучения вероятность позитива порядка e^-33
    const L = S.map((r, i) => { const mx = Math.max(...r); return mx + Math.log(r.reduce((a, x) => a + Math.exp(x - mx), 0)) - r[i]; });
    return { S, Pr, L, mean: (L[0] + L[1]) / 2 };
  }
  const plab = (l) => `${l[0]}<tspan class="mdl-sub" dy="3">${l[1]}</tspan>${l[2] ? `<tspan class="mdl-sub" dy="-8">${l[2]}</tspan>` : ""}`;
  const sub = mdlSub;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема DPR: два кодировщика, матрица оценок батча, функция потерь и поиск"></svg></div>
    <div class="fig-row">
      <div class="fig-tabs mdl-tabs" role="tablist" aria-label="Режим">${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${m.tab}</button>`).join("")}</div>
      <div class="fig-tabs" role="tablist" aria-label="Веса кодировщиков" data-staterow>
        <button type="button" role="tab" data-state="init" aria-selected="true">до обучения</button>
        <button type="button" role="tab" data-state="trained" aria-selected="false">после обучения</button>
      </div>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key q"></i>', "вопрос"],
      ['<i class="mdl-key pos"></i>', "позитив"],
      ['<i class="mdl-key hard"></i>', "негатив из BM25"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const stateRow = box.querySelector("[data-staterow]");
  const H = 500;

  function draw(step){
    const W = cbFit(stage, 340, 680), use = mode === "use", last = MODES[mode].steps.length - 1;
    const tw = Math.min(190, W * 0.34), xa = W * 0.25, xb = W * 0.75, vw = tw * 0.62;
    const twB = H - 106, twH = 112, twT = twB - twH, barB = twT - 8, barH = 22, barT = barB - barH, vecY = barT - 30;
    const isBack = !use && step === last, wrong = use && step === 3;
    const nP = use ? 5 : 4, qList = use ? [Q[0]] : Q;
    let s = "";

    // ---------- вход ----------
    qList.forEach((t, i) => { s += mdlChip(xa, twB + 12 + i * 18, tw, t, wrong ? "bad" : "q"); });
    const role = (i) => use ? (i === 0 ? "pos" : "") : P[i].role;
    P.slice(0, nP).forEach((p, i) => { s += mdlChip(xb, twB + 12 + i * 18, tw, `${p.t} [SEP] …`, role(i)); });

    // ---------- башни ----------
    const qOn = (!use && step === 1) || (use && step === 1), pOn = (!use && step === 1) || (use && (step === 0 || step === 3));
    const qLabel = state === "init" && !use ? sub("E", "Q", "\u00a0= BERT") : sub("E", "Q");
    const pLabel = state === "init" && !use ? sub("E", "P", "\u00a0= BERT") : sub("E", "P");
    s += mdlTower(xa, twT, tw, twH, { label: qLabel, cls: "q" + (qOn ? " on" : "") + (isBack ? " grad" : ""), fade: wrong });
    s += mdlTower(xb, twT, tw, twH, { label: pLabel, cls: "p" + (pOn ? " on" : "") + (isBack ? " grad" : "") });
    if (wrong){
      s += `<path d="M${f1(xa + tw / 2 - 6)} ${f1(twB + 18)} C ${f1(W / 2)} ${f1(twB + 18)} ${f1(W / 2)} ${f1(twB - 30)} ${f1(xb - tw / 2 - 2)} ${f1(twB - 30)}" class="dpr-wrong"/>`;
      s += vlArrow(xb - tw / 2 - 14, twB - 30, xb - tw / 2 - 1, twB - 30, "dpr-wrong");
    } else {
      s += mdlFwd(xa, twB + 11, xa, twB + 2, qOn);
    }
    s += mdlFwd(xb, twB + 11, xb, twB + 2, pOn);
    s += mdlLines(W / 2, twT + twH / 2 - 6, isBack ? ["два набора", "градиентов"] : ["веса", "разные"], "mdl-cap sm", 12);

    // ---------- [CLS] и векторы ----------
    const kinds = ["cls", "tok", "tok", "tok", "tok", "tok", "tok", "tok", "tok", "sep"];
    const stackTop = (n) => vecY - 15 * (n - 1);
    [[xa, qList.length, "q", qOn, 1], [xb, nP, "p", pOn, 2]].forEach(([x, n, side, on, seed]) => {
      const shown = use ? (side === "p" ? true : step >= 1) : step >= 1;
      const t = mdlTokens(x, 0, tw - 16, kinds);
      s += `<g${mdlFade(shown)}>`;
      s += `<g${wrong && side === "q" ? ' opacity="0.25"' : ""}>`;
      s += mdlWires(t.xs, twT, barB, on) + mdlBars(t.xs, t.sz, barB, barH, kinds, 70 + seed, [0]);
      s += `<line x1="${f1(t.xs[0])}" y1="${f1(barT)}" x2="${f1(x - vw / 2 + 6)}" y2="${f1(vecY + 12)}" class="mdl-wire${on ? " on" : ""}"/>`;
      s += `<text x="${f1(t.xs[0] - 2)}" y="${f1(barT - 7)}" class="mdl-cap${on ? " on" : ""}" text-anchor="end">[CLS]</text></g>`;
      if (wrong && side === "q") s += vlArrow(xb - tw / 2 + 4, twT + 6, x + vw / 2 + 6, vecY + 8, "dpr-wrong");
      for (let i = 0; i < n; i++){
        const y = stackTop(n) + 15 * i;
        const label = side === "q" ? (wrong ? "" : sub("q", i + 1)) : (use ? P[i].t : plab(P[i].lab));
        const cls = side === "q" ? "" : role(i);
        s += mdlVec(x, y, vw, 80 + seed * 10 + i, { label: use && side === "p" ? "" : label, cls, h: 10 });
        if (wrong && side === "q") s += `<text x="${f1(x)}" y="${f1(y - 9)}" class="mdl-lbl dpr-badt" text-anchor="middle">q через ${sub("E", "P")}</text>`;
        if (use && side === "p") s += `<text x="${f1(x - vw / 2 - 5)}" y="${f1(y + 5)}" class="mdl-lbl muted" text-anchor="end" style="font-size:10px">${mdlEsc(P[i].t)}</text>`;
      }
      s += "</g>";
    });
    if (use) s += `<text x="${f1(xb)}" y="${f1(stackTop(nP) - 9)}" class="mdl-cap${step === 0 ? " on" : ""}" text-anchor="middle">индекс</text>`;

    // ---------- обучение: матрица S, softmax, потери ----------
    if (!use){
      const st = trainStats(), c = Math.min(46, (W - 90) / 4), mX = W / 2 - 2 * c, mY = 60;
      s += `<g${mdlFade(step >= 2)}>`;
      s += mdlFwd(xa, stackTop(2) - 3, mX - 22, mY + 1.6 * c, step === 2) + mdlFwd(xb, stackTop(4) - 3, mX + 4 * c + 16, mY + 1.6 * c, step === 2);
      for (let j = 0; j < 4; j++) s += `<text x="${f1(mX + (j + 0.5) * c)}" y="${f1(mY - 10)}" class="mdl-lbl ${P[j].role}" text-anchor="middle">${plab(P[j].lab)}</text>`;
      for (let i = 0; i < 2; i++){
        s += `<text x="${f1(mX - 8)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-lbl" text-anchor="end">${sub("q", i + 1)}</text>`;
        for (let j = 0; j < 4; j++){
          const own = (i === 0 && j === 2) || (i === 1 && j === 3);
          let cls = "mdl-cell" + (i === j ? " pos" : own ? " hard" : "") + (step === 2 && i === 0 ? " row" : "");
          const val = step >= 3 ? mdlNum(st.Pr[i][j], 3) : mdlNum(st.S[i][j], 1);
          s += `<rect x="${f1(mX + j * c + 1)}" y="${f1(mY + i * c + 1)}" width="${f1(c - 2)}" height="${f1(c - 2)}" rx="3" class="${cls}"/>`;
          s += `<text x="${f1(mX + (j + 0.5) * c)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-cellt${i === j ? " on" : ""}">${val}</text>`;
        }
      }
      s += "</g>";
      const lossText = step >= 3 ? `L = ½(${small(st.L[0])} + ${small(st.L[1])}) = ${small(st.mean)}` : "L — после softmax по строкам";
      s += `<g${mdlFade(step >= 3)}>` + mdlBox(W / 2, 20, Math.min(W - 20, 300), 26, [lossText], "loss" + (step === 3 ? " on" : "")) + "</g>";
      if (isBack){
        s += mdlGrad(mX + 4 * c + 12, 34, mX + 4 * c + 12, mY + c);
        s += mdlGrad(mX - 6, mY + 1.9 * c, xa + 14, stackTop(2) - 3) + mdlGrad(mX + 4 * c + 6, mY + 1.9 * c, xb + 14, stackTop(4) - 3);
        s += mdlGrad(xa + vw / 2 + 8, vecY + 5, xa + tw / 2 - 3, twT + 2) + mdlGrad(xb + vw / 2 + 8, vecY + 5, xb + tw / 2 - 3, twT + 2);
      }
    }

    // ---------- применение: поиск по индексу ----------
    if (use){
      const scores = wrong ? SC.wrong[0] : SC.trained[0];
      const order = [0, 1, 2, 3, 4].sort((a, b) => scores[b] - scores[a]);
      const nx = W / 2, ny = 100;
      s += `<g${mdlFade(step >= 2)}>`;
      s += mdlFwd(xa, stackTop(1) - 3, nx - 30, ny + 14, step >= 2);
      s += mdlBox(nx, ny, 118, 28, ["q·p для всех p"], step >= 2 ? "on" : "");
      s += mdlFwd(nx + 30, ny + 14, xb - 10, stackTop(5) - 20, step >= 2);
      s += "</g>";
      if (step >= 2){
        order.forEach((k, r) => {
          const y = stackTop(5) + 15 * k;
          s += `<text x="${f1(xb + vw / 2 + 5)}" y="${f1(y + 5)}" class="mdl-lbl${r === 0 ? " dpr-top" : ""}">${mdlNum(scores[k], 2)}</text>`;
          if (r === 0) s += `<rect x="${f1(xb - vw / 2 - 2)}" y="${f1(y - 2)}" width="${f1(vw + 2)}" height="14" rx="2" class="dpr-topf"/>`;
        });
      }
    }

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    stateRow.hidden = use;
    say.innerHTML = explain(step);
  }

  function explain(step){
    if (mode === "use") return [
      "<b>Индексация.</b> Офлайн и один раз: \\(E_P\\) кодирует все пассажи корпуса, их векторы <code>[CLS]</code> без нормировки складываются в индекс. В статье это \\(21\\) млн пассажей Википедии.",
      "<b>Кодирование вопроса.</b> Онлайн, на каждый запрос: работает только \\(E_Q\\) и только на одном коротком тексте.",
      "<b>Поиск.</b> Скалярное произведение \\(q^{\\top}p\\) с каждым вектором индекса; в большом корпусе его заменяет ANN-индекс по скалярному произведению. Первым идёт Irish Sea (\\(79.32\\)), вплотную за ним English Channel (\\(79.01\\)). Числа — у опубликованной модели single-nq.",
      "<b>Не тот кодировщик.</b> Вопрос закодирован через \\(E_P\\), например одной общей функцией эмбеддингов для запросов и документов. Оценки другие, и порядок меняется: English Channel \\(103.34\\) против \\(102.54\\) у Irish Sea. Исключения при этом нет."
    ][step];
    const st = trainStats(), init = state === "init";
    return [
      "<b>Батч.</b> Два вопроса, у каждого позитив и один негатив из BM25 — пассаж, в котором больше всего слов вопроса, но нет ответа. Пассаж подаётся как «заголовок [SEP] текст». В статье батч — \\(128\\) вопросов и \\(256\\) пассажей.",
      "<b>Кодирование.</b> Вопросы проходят через \\(E_Q\\), пассажи — через \\(E_P\\): две сети со своими весами. Дальше идёт только выход токена <code>[CLS]</code>, векторы остальных токенов не используются." +
        (init ? " До обучения обе сети — копии одного bert-base-uncased." : ""),
      "<b>Матрица \\(\\mathbf{S}=\\mathbf{Q}\\mathbf{P}^{\\top}\\).</b> Скалярные произведения всех вопросов со всеми пассажами батча. Для \\(q_1\\) позитив — Irish Sea, а три другие клетки строки — негативы: позитив чужого вопроса и оба негатива из BM25. " +
        (init ? "До обучения оценки огромные и от смысла не зависят: у обоих вопросов первым стоит War novel." : `После обучения позитивы впереди: \\(${mdlNum(st.S[0][0], 1)}\\) против \\(${mdlNum(st.S[0][2], 1)}\\) у негатива из BM25.`),
      "<b>Softmax по строке и потери.</b> \\(\\mathcal{L}_i=-\\log\\bigl(e^{S_{ii}}\\big/\\sum_j e^{S_{ij}}\\bigr)\\), без температуры. " +
        (init ? `До обучения \\(\\mathcal{L}_1=${mdlNum(st.L[0], 2)}\\) и \\(\\mathcal{L}_2=${mdlNum(st.L[1], 2)}\\): у второго вопроса War novel забирает почти всю вероятность.`
              : `После обучения вероятности позитивов практически равны \\(1\\), \\(\\mathcal{L}\\approx${texSmall(st.mean)}\\): такие пары модель уже различает. Самый трудный для неё пассаж из примера, English Channel, в батч не попал — BM25 его не выбирает.`),
      "<b>Обратный проход.</b> Градиент из каждой клетки \\(\\mathbf{S}\\) уходит к своему вектору вопроса и своему вектору пассажа, а дальше — в разные сети: \\(E_Q\\) обновляется только через вопросы, \\(E_P\\) — только через пассажи. Поэтому после обучения веса двух кодировщиков различаются."
    ][step];
  }

  const player = vlPlayer(box, { count: () => MODES[mode].steps.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[i]}`, interval: 2200 });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop();
    player.go(Math.min(player.i, MODES[mode].steps.length - 1));
  }));
  box.querySelectorAll("[data-state]").forEach((b) => b.addEventListener("click", () => {
    state = b.dataset.state;
    box.querySelectorAll("[data-state]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  player.paint();
  const unobserve = cbResize(stage, () => draw(player.i));
  return () => { player.stop(); unobserve(); };
}

/* ---------- Скалярное произведение в индексе по L2: добавленная координата ---------- */
function mountDprMips(box){
  // Демонстрационные одномерные векторы пассажей: добавленная координата становится второй осью.
  const BASE = [{ n: "A", p: -2.3 }, { n: "B", p: 0.7 }, { n: "C", p: 1.5 }, { n: "D", p: 2.1 }];
  const NEW = { n: "E", p: 2.9 };
  let q = 1.0, st = 0;   // 0 — исходный индекс, 1 — E добавлен без перестройки, 2 — индекс перестроен
  const BTN = ["Добавить пассаж E", "Перестроить индекс", "Убрать E"];
  box.innerHTML = `
    <div class="fig-stage">
      <svg role="img" aria-label="Пассажи, поднятые на окружность радиуса φ, и запрос на оси"></svg>
      <div class="table-wrap dpr-mips-tab"><table>
        <thead><tr><th>пассаж</th><th>\\(p\\)</th><th>\\(q^{\\top}p\\)</th><th>\\(\\lvert q-p\\rvert\\)</th><th>\\(\\lVert\\tilde q-\\tilde p\\rVert\\)</th></tr></thead>
        <tbody></tbody>
      </table></div>
    </div>
    <div class="fig-row">
      <label class="fig-range"><span>запрос \\(q\\)</span><input type="range" min="-2.5" max="2.5" step="0.1" value="1" data-range="q"><output></output></label>
      <span class="spacer"></span>
      <button class="fig-btn" type="button" data-act="index"></button>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [`<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.6" class="dpr-orig"/></svg>`, "исходный вектор \\(p\\) на оси"],
      [`<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.2" class="dpr-lift"/></svg>`, "поднятый вектор \\(\\tilde p\\)"],
      [LG.q(), "запрос \\(\\tilde q=[q;\\,0]\\)"],
      [mdlLegendArrow("dpr-near"), "ближайший к \\(\\tilde q\\) по L2"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), tbody = stage.querySelector("tbody");
  const input = box.querySelector('[data-range="q"]'), out = input.nextElementSibling, btn = box.querySelector('[data-act="index"]');
  const say = box.querySelector(".fig-say");

  function compute(){
    const items = st === 0 ? BASE.slice() : BASE.concat([NEW]);
    const phi = st === 2 ? NEW.p : Math.max(...BASE.map((x) => Math.abs(x.p)));
    const rows = items.map((x) => {
      const z2 = phi * phi - x.p * x.p, lift = z2 >= -1e-12;
      return { ...x, dot: q * x.p, orig: Math.abs(q - x.p), lift, z: lift ? Math.sqrt(Math.max(0, z2)) : null, aug: lift ? Math.sqrt(q * q + phi * phi - 2 * q * x.p) : null };
    });
    const rank = (key, asc) => {
      const v = rows.filter((r) => r[key] !== null).sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key]);
      v.forEach((r, i) => { r[key + "R"] = i + 1; });
    };
    rank("dot", false); rank("orig", true); rank("aug", true);
    return { rows, phi };
  }

  function draw(){
    const { rows, phi } = compute();
    const W = cbFit(stage, 320, 640), H = 250, x0 = W / 2, yA = H - 36;
    const k = Math.min((W - 40) / 6.4, (H - 56) / 3.2);
    const X = (p) => x0 + k * p, Y = (z) => yA - k * z;
    let s = "";
    s += `<line x1="${f1(X(-3.2))}" y1="${f1(yA)}" x2="${f1(X(3.2))}" y2="${f1(yA)}" class="dpr-axis"/>`;
    for (let t = -3; t <= 3; t++){
      s += `<line x1="${f1(X(t))}" y1="${f1(yA)}" x2="${f1(X(t))}" y2="${f1(yA + 4)}" class="dpr-axis"/>`;
      s += `<text x="${f1(X(t))}" y="${f1(yA + 15)}" class="mdl-cap" text-anchor="middle">${t < 0 ? "−" + -t : t}</text>`;
    }
    s += `<text x="${f1(X(3.2))}" y="${f1(yA + 29)}" class="mdl-cap" text-anchor="end">исходная координата p</text>`;
    s += `<text x="8" y="14" class="mdl-cap">добавленная координата √(φ² − p²)</text>`;
    s += `<path d="M${f1(X(-phi))} ${f1(yA)} A ${f1(k * phi)} ${f1(k * phi)} 0 0 1 ${f1(X(phi))} ${f1(yA)}" class="dpr-arc"/>`;
    s += `<text x="${f1(X(0) - 6)}" y="${f1(Y(phi) - 6)}" class="mdl-cap" text-anchor="end">радиус φ = ${mdlNum(phi, 1)}</text>`;
    const best = rows.filter((r) => r.lift).sort((a, b) => a.aug - b.aug)[0];
    rows.forEach((r) => {
      s += `<circle cx="${f1(X(r.p))}" cy="${f1(yA)}" r="3.6" class="dpr-orig${r.lift ? "" : " bad"}"/>`;
      if (r.lift){
        s += `<line x1="${f1(X(r.p))}" y1="${f1(yA)}" x2="${f1(X(r.p))}" y2="${f1(Y(r.z))}" class="dpr-up"/>`;
        s += `<line x1="${f1(X(q))}" y1="${f1(yA)}" x2="${f1(X(r.p))}" y2="${f1(Y(r.z))}" class="${r === best ? "dpr-near" : "dpr-dist"}"/>`;
        s += `<circle cx="${f1(X(r.p))}" cy="${f1(Y(r.z))}" r="4.6" class="dpr-lift${r === best ? " best" : ""}"/>`;
        s += `<text x="${f1(X(r.p) + (r.p < 0 ? -8 : 8))}" y="${f1(Y(r.z) - 7)}" class="mdl-lbl" text-anchor="${r.p < 0 ? "end" : "start"}">${r.n}</text>`;
      } else {
        s += `<circle cx="${f1(X(r.p))}" cy="${f1(yA)}" r="8" class="dpr-badring"/>`;
        s += `<line x1="${f1(X(r.p))}" y1="${f1(yA - 9)}" x2="${f1(W - 40)}" y2="${f1(Y(phi) + 16)}" class="dpr-lead"/>`;
        s += `<text x="${f1(W - 8)}" y="${f1(Y(phi) + 6)}" class="mdl-lbl dpr-badt" text-anchor="end">${r.n}: φ² − p² &lt; 0</text>`;
      }
    });
    s += qMark(X(q), yA, 7);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;

    const cell = (r, key, d) => r[key] === null ? "—" : `${mdlNum(r[key], d)} <small>(${r[key + "R"]})</small>`;
    tbody.innerHTML = rows.map((r) => `<tr>
      <td>${r.n}</td><td>${mdlNum(r.p, 1)}</td>
      <td class="${r.dotR === 1 ? "dpr-win" : ""}">${cell(r, "dot", 2)}</td>
      <td class="${r.origR === 1 ? "dpr-win" : ""}">${cell(r, "orig", 2)}</td>
      <td class="${r.augR === 1 ? "dpr-win" : ""}">${cell(r, "aug", 2)}</td></tr>`).join("");
    out.value = mdlNum(q, 1);
    btn.textContent = BTN[st];

    const byDot = rows.slice().sort((a, b) => b.dot - a.dot)[0], byOrig = rows.slice().sort((a, b) => a.orig - b.orig)[0];
    let text;
    if (Math.abs(q) < 0.05) text = "При \\(q=0\\) все скалярные произведения равны нулю, и все поднятые точки равноудалены от \\(\\tilde q\\): \\(\\lVert\\tilde q-\\tilde p\\rVert^2=\\varphi^2\\). Сдвиньте запрос.";
    else if (st === 1) text = `Пассаж E с \\(p=2.9\\) добавлен в готовый индекс, где \\(\\varphi=${mdlNum(phi, 1)}\\). Для него \\(\\varphi^2-p^2&lt;0\\): поднять его на окружность нельзя. ` +
      (q > 0 ? "По \\(q^{\\top}p\\) он первый, но в индексе по L2 его не найти." : "Сейчас он не лидирует по \\(q^{\\top}p\\), но при положительном \\(q\\) был бы первым — и не нашёлся бы.") + " Нужна перестройка индекса с новым \\(\\varphi\\).";
    else text = `Пассажи подняты на окружность радиуса \\(\\varphi=${mdlNum(phi, 1)}\\) — максимальной нормы в индексе: \\(\\tilde p=\\bigl[p;\\sqrt{\\varphi^2-p^2}\\bigr]\\), запрос остаётся на оси: \\(\\tilde q=[q;\\,0]\\). ` +
      `Ближайшая к \\(\\tilde q\\) точка — ${best.n}, это и лидер по \\(q^{\\top}p\\), потому что \\(\\lVert\\tilde q-\\tilde p\\rVert^2=q^2+\\varphi^2-2qp\\). ` +
      (byOrig.n !== byDot.n ? `А в исходном пространстве к \\(q\\) ближе всего ${byOrig.n}: евклидово расстояние без добавленной координаты искало бы не то.` : "") +
      (st === 2 ? " Индекс перестроен, и E на окружности." : "");
    say.innerHTML = text;
  }
  input.addEventListener("input", () => { q = Number(input.value); draw(); });
  btn.addEventListener("click", () => { st = (st + 1) % 3; draw(); });
  draw();
  return cbResize(stage, draw);
}

Object.assign(FIGURES, {
  "dpr-flow": mountDprFlow,
  "dpr-mips": mountDprMips
});
