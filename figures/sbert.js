/* Иллюстрация раздела models/sbert: устройство сети, прямой и обратный проход
   и место функции потерь для каждого рецепта обучения. Помощники — figures/mdl.js. */

function mountSbertFlow(box, modes = ["nli", "sts"], first = 2, count = 4){
  const PREM = "A man is playing a guitar on stage.", HYP = "A person is performing music.";
  const KA = ["cls", "tok", "tok", "tok", "tok", "tok", "tok", "tok", "tok", "tok", "sep"];
  const KB = ["cls", "tok", "tok", "tok", "tok", "tok", "tok", "sep", "pad", "pad", "pad"];
  // Косинусы обученной all-MiniLM-L6-v2 (sentence-transformers 6.1); softmax и потери считаются ниже.
  const BATCH = {
    mixed: {
      a: ["How do I reset my password?", "A man is playing a guitar on stage.", "Stocks fell sharply today."],
      b: ["Click “Forgot password” to get a reset link.", "A person is performing music.", "Markets dropped as investors sold shares."],
      S: [[0.75215, 0.00332, -0.03046], [-0.01551, 0.57642, -0.08103], [0.0145, -0.07908, 0.62581]]
    },
    same: {
      a: ["How do I reset my password?", "How do I change my password?", "I forgot my login email, what now?"],
      b: ["Click “Forgot password” to get a reset link.", "Go to Settings → Security and enter a new password.", "Contact support to recover the email linked to your account."],
      S: [[0.75215, 0.62172, 0.40891], [0.54107, 0.66724, 0.29114], [0.61093, 0.41099, 0.64522]]
    }
  };
  const USE = [["A person is performing music.", 0.576], ["A man is playing a guitar at home.", 0.549], ["The stock market fell sharply today.", -0.083]];
  const MODES = {
    nli: { tab: "NLI", steps: ["пара предложений", "прямой проход", "пулинг", "голова", "функция потерь", "обратный проход"] },
    sts: { tab: "STS", steps: ["пара предложений", "прямой проход", "пулинг", "косинус", "функция потерь", "обратный проход"] },
    all: { tab: "all-*", steps: ["батч пар", "прямой проход", "пулинг и нормировка", "матрица сходств", "softmax по строкам", "softmax по столбцам", "обратный проход"] },
    distill: { tab: "Дистилляция", steps: ["предложение и перевод", "прямой проход", "пулинг", "функция потерь", "обратный проход"] },
    use: { tab: "Применение", steps: ["текст", "прямой проход", "пулинг и нормировка", "сравнение"] }
  };
  let mode = modes[0], batch = "same";

  const T = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const softRows = (M, k) => M.map((r) => { const z = r.map((x) => k * x), mx = Math.max(...z), e = z.map((x) => Math.exp(x - mx)), t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); });
  function batchStats(){
    const S = BATCH[batch].S, P = softRows(S, 20), C = T(softRows(T(S), 20));
    const lr = -P.reduce((a, r, i) => a + Math.log(r[i]), 0) / 3, lc = -C.reduce((a, r, i) => a + Math.log(C[i][i]), 0) / 3;
    return { S, P, C, lr, lc };
  }
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const small = (x) => { if (x >= 1e-3) return mdlNum(x, 3); const [mm, e] = x.toExponential(0).split("e"); return mm + "·10" + String(+e).split("").map((ch) => SUP[ch]).join(""); };
  const texSmall = (x) => { if (x >= 1e-3) return mdlNum(x, 3); const [m, e] = x.toExponential(0).split("e"); return `${m}\\cdot10^{${+e}}`; };
  const sub = mdlSub;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема обучения SBERT: прямой проход, функция потерь и обратный проход"></svg></div>
    <div class="fig-row"${modes.length === 1 ? " hidden" : ""}>
      <div class="fig-tabs mdl-tabs" role="tablist" aria-label="Рецепт обучения">${modes.map(k => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${MODES[k].tab}</button>`).join("")}</div>
    </div>
    <div class="fig-row" data-batchrow hidden>
      <span class="fig-seg">батч<span class="fig-tabs" role="tablist" aria-label="Состав батча">
        <button type="button" role="tab" data-batch="mixed" aria-selected="false">разные темы</button>
        <button type="button" role="tab" data-batch="same" aria-selected="true">одна тема</button>
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key tok"></i>', "токен"],
      ['<i class="mdl-key pad"></i>', "заполнитель [PAD]"],
      ['<i class="mdl-key vec"></i>', "вектор (значения условные)"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const batchRow = box.querySelector("[data-batchrow]");
  const H = 500;

  function draw(step){
    const W = cbFit(stage, 340, 680), m = mode, last = MODES[m].steps.length - 1;
    const tw = Math.min(190, W * 0.34), xa = W * 0.25, xb = W * 0.75, vw = tw * 0.62;
    const twB = H - 84, twH = 112, twT = twB - twH, barB = twT - 8, barH = 22, barT = barB - barH, vecY = barT - 40;
    const POOL = 2, HEAD = 3, LOSS = m === "all" ? 4 : m === "distill" ? 3 : 4, BACK = last;
    const isBack = m !== "use" && step === BACK;
    let s = "";

    // ---------- вход и башни ----------
    const towers = m === "use" ? [xa] : [xa, xb];
    const tokenMode = m === "nli" || m === "sts" || m === "use";
    towers.forEach((x, k) => {
      let cls = step === 1 ? "on" : "";
      if (m === "distill") cls += k === 0 ? " teacher frozen" : "";
      if (isBack && !(m === "distill" && k === 0)) cls += " grad";
      const label = m === "distill" ? (k === 0 ? "учитель" : "ученик") : "BERT";
      s += mdlTower(x, twT, tw, twH, { label, cls });
    });
    const outs = [];   // центры векторов на выходе и их подписи
    if (tokenMode){
      const items = m === "use" ? [[xa, KA, PREM, "u"]] : [[xa, KA, PREM, "u"], [xb, KB, HYP, "v"]];
      items.forEach(([x, kinds, text, name], k) => {
        const t = mdlTokens(x, twB + 16, tw - 10, kinds);
        s += `<g${step === 0 ? ' class="mdl-in-on"' : ""}>${t.svg}</g>`;
        s += mdlLines(x, twB + 16 + t.sz + 15, mdlWrap(text, tw + 10, 11, 2), "mdl-cap");
        s += mdlWires(t.xs, twB + 16, twB, step === 1);
        // векторы токенов над башней
        s += `<g${mdlFade(step >= 1)}>${mdlWires(t.xs, twT, barB, step === 1)}${mdlBars(t.xs, t.sz, barB, barH, kinds, 11 + k)}</g>`;
        const real = kinds.filter((q) => q !== "pad").length;
        s += `<g${mdlFade(step >= POOL)}>`;
        s += mdlFunnel(t.xs[0] - t.sz / 2, t.xs[real - 1] + t.sz / 2, barT - 3, x - vw / 2, x + vw / 2, vecY + 14, step === POOL);
        const poolText = W < 480 ? "среднее" : m === "use" ? "среднее, нормировка" : "среднее по маске";
        s += `<text x="${f1(x)}" y="${f1((barT + vecY + 11) / 2)}" class="mdl-cap${step === POOL ? " on" : ""}" text-anchor="middle">${poolText}</text>`;
        s += mdlVec(x, vecY, vw, 21 + k, { label: name, cls: step === POOL ? "on" : "" }) + "</g>";
        outs.push([x, vecY]);
      });
    } else {
      const sides = m === "all"
        ? [[xa, BATCH[batch].a, "a"], [xb, BATCH[batch].b, "b"]]
        : [[xa, ["s: " + PREM], "s"], [xb, ["s: " + PREM, "t: Мужчина играет на гитаре на сцене."], "st"]];
      sides.forEach(([x, texts, role], k) => {
        texts.forEach((t, i) => { s += mdlChip(x, twB + 14 + i * 19, tw, t, step === 0 ? "on" : ""); });
        s += mdlFwd(x, twB + 13, x, twB + 2, step === 1);
        const n = texts.length, top = vecY - 16 * (n - 1);
        s += `<g${mdlFade(step >= POOL)}>`;
        s += mdlFunnel(x - tw / 2 + 14, x + tw / 2 - 14, twT - 4, x - vw / 2, x + vw / 2, vecY + 14, step === POOL);
        const poolLines = m !== "all" ? ["среднее"] : W < 480 ? ["среднее,", "нормировка"] : ["среднее, нормировка"];
        s += mdlLines(x, (twT + vecY + 10) / 2 - (poolLines.length - 1) * 6, poolLines, "mdl-cap" + (step === POOL ? " on" : ""), 12);
        texts.forEach((_, i) => {
          const label = m === "all" ? sub(role === "a" ? "u" : "v", i + 1) : k === 0 ? "M(s)" : (i === 0 ? "M̂(s)" : "M̂(t)");
          s += mdlVec(x, top + 16 * i, vw, 31 + 7 * k + i, { label, cls: step === POOL ? "on" : "" });
          outs.push([x, top + 16 * i]);
        });
        s += "</g>";
      });
    }

    // ---------- общие веса между башнями ----------
    if (m === "nli" || m === "sts" || m === "all"){
      const cw = Math.max(44, Math.min(110, xb - xa - tw - 10)), cy = twT + twH / 2;
      s += `<line x1="${f1(xa + tw / 2)}" y1="${f1(cy)}" x2="${f1(W / 2 - cw / 2)}" y2="${f1(cy)}" class="mdl-link${step === 1 ? " on" : ""}"/>`;
      s += `<line x1="${f1(W / 2 + cw / 2)}" y1="${f1(cy)}" x2="${f1(xb - tw / 2)}" y2="${f1(cy)}" class="mdl-link${step === 1 ? " on" : ""}"/>`;
      s += `<rect x="${f1(W / 2 - cw / 2)}" y="${f1(cy - 26)}" width="${f1(cw)}" height="52" rx="7" class="mdl-box${isBack ? " grad" : step === 1 ? " on" : ""}"/>`;
      s += `<text x="${f1(W / 2)}" y="${f1(cy - 11)}" class="mdl-boxt" style="font-size:15px">θ</text>`;
      s += mdlLines(W / 2, cy + 6, isBack ? ["сумма", "вкладов"] : ["общие", "веса"], "mdl-boxs", 11);
      if (isBack){
        s += mdlGrad(xa + tw / 2 + 2, cy + 16, W / 2 - cw / 2 - 2, cy + 16);
        s += mdlGrad(xb - tw / 2 - 2, cy + 16, W / 2 + cw / 2 + 2, cy + 16);
      }
    }
    if (m === "distill"){
      s += mdlLines(W / 2, twT + twH / 2 - 6, isBack ? ["учитель", "не учится"] : ["разные", "сети"], "mdl-cap sm", 12);
    }

    // ---------- голова и функция потерь ----------
    if (m === "nli"){
      const cwB = Math.min(260, W - 40), cyC = vecY - 52, cyW = vecY - 106, cyO = vecY - 154, cyL = vecY - 204;
      s += `<g${mdlFade(step >= HEAD)}>`;
      s += mdlFwd(xa, vecY - 2, W / 2 - cwB / 4, cyC + 18, step === HEAD) + mdlFwd(xb, vecY - 2, W / 2 + cwB / 4, cyC + 18, step === HEAD);
      s += `<rect x="${f1(W / 2 - cwB / 2)}" y="${f1(cyC - 16)}" width="${f1(cwB)}" height="32" rx="7" class="mdl-box${step === HEAD ? " on" : ""}"/>`;
      const sw = (cwB - 24) / 3;
      ["u", "v", "|u − v|"].forEach((t, i) => {
        const cx = W / 2 - cwB / 2 + 12 + sw * (i + 0.5);
        s += `<text x="${f1(cx)}" y="${f1(cyC - 6)}" class="mdl-lbl" text-anchor="middle">${t}</text>`;
        s += mdlVec(cx, cyC + 2, sw - 8, 51 + i, { n: 4, h: 8 });
      });
      s += `<text x="${f1(W / 2 + cwB / 2 + 4)}" y="${f1(cyC)}" class="mdl-cap">2304</text>`;
      s += mdlFwd(W / 2, cyC - 17, W / 2, cyW + 15, step === HEAD);
      s += mdlBox(W / 2, cyW, 116, 28, [sub("W", "t", ", softmax")], step === HEAD ? "on" : "");
      s += `<text x="${f1(W / 2 + 62)}" y="${f1(cyW)}" class="mdl-cap">2304 → 3</text>`;
      const cwc = Math.min(96, (W - 30) / 3), labels = ["следование", "нейтрально", "противоречие"];
      s += mdlFwd(W / 2, cyW - 15, W / 2, cyO + 13, step === HEAD);
      labels.forEach((t, i) => {
        const cx = W / 2 + (i - 1) * (cwc + 4);
        s += `<rect x="${f1(cx - cwc / 2)}" y="${f1(cyO - 12)}" width="${f1(cwc)}" height="24" rx="5" class="mdl-cell${i === 0 && step >= LOSS ? " pos" : ""}"/>`;
        s += `<text x="${f1(cx)}" y="${f1(cyO)}" class="mdl-cellt${i === 0 && step >= LOSS ? " on" : ""}">${i === 0 && step >= LOSS ? "y: " + t : t}</text>`;
      });
      s += "</g>";
      const tx = W / 2 - cwc - 4;
      s += `<g${mdlFade(step >= LOSS)}>`;
      s += mdlFwd(tx, cyO - 13, W / 2 - 40, cyL + 14, step === LOSS);
      s += mdlBox(W / 2, cyL, 150, 26, [`L = −log ${sub("o", "y")}`], "loss" + (step === LOSS ? " on" : ""));
      s += "</g>";
      if (isBack){
        s += mdlGrad(W / 2 + 6, cyL + 14, W / 2 + 6, cyO - 13);
        s += mdlGrad(W / 2 + 8, cyO + 13, W / 2 + 8, cyW - 15);
        s += mdlGrad(W / 2 + 8, cyW + 15, W / 2 + 8, cyC - 17);
        s += mdlGrad(W / 2 - cwB / 4 + 10, cyC + 17, xa + 10, vecY - 3) + mdlGrad(W / 2 + cwB / 4 - 10, cyC + 17, xb - 10, vecY - 3);
      }
    }
    if (m === "sts"){
      const cyC = vecY - 52, cyL = vecY - 128, cyY = vecY - 186;
      s += `<g${mdlFade(step >= HEAD)}>`;
      s += mdlFwd(xa, vecY - 2, W / 2 - 26, cyC + 15, step === HEAD) + mdlFwd(xb, vecY - 2, W / 2 + 26, cyC + 15, step === HEAD);
      s += mdlBox(W / 2, cyC, 104, 28, ["cos(u, v)"], step === HEAD ? "on" : "");
      s += "</g>";
      s += `<g${mdlFade(step >= LOSS)}>`;
      s += mdlFwd(W / 2, cyC - 15, W / 2, cyL + 15, step === LOSS);
      s += mdlBox(W / 2, cyL, 170, 28, ["L = (cos(u, v) − y)²"], "loss" + (step === LOSS ? " on" : ""));
      s += mdlBox(W / 2 + 40, cyY, 150, 26, ["y — оценка людей"], "");
      s += mdlFwd(W / 2 + 40, cyY + 14, W / 2 + 40, cyL - 15, step === LOSS);
      s += "</g>";
      if (isBack){
        s += mdlGrad(W / 2 - 10, cyL + 15, W / 2 - 10, cyC - 15);
        s += mdlGrad(W / 2 - 40, cyC + 15, xa + 10, vecY - 3) + mdlGrad(W / 2 + 40, cyC + 15, xb - 10, vecY - 3);
      }
    }
    if (m === "all"){
      const st = batchStats(), c = Math.min(44, (W - 140) / 3), mX = W / 2 - 1.5 * c, mY = 52;
      const topStack = vecY - 32;
      s += `<g${mdlFade(step >= HEAD)}>`;
      s += mdlFwd(xa, topStack - 2, mX - 22, mY + 2.2 * c, step === HEAD) + mdlFwd(xb, topStack - 2, mX + 3 * c + 22, mY + 2.2 * c, step === HEAD);
      for (let i = 0; i < 3; i++){
        s += `<text x="${f1(mX - 8)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-lbl" text-anchor="end">${sub("a", i + 1)}</text>`;
        s += `<text x="${f1(mX + (i + 0.5) * c)}" y="${f1(mY - 9)}" class="mdl-lbl" text-anchor="middle">${sub("b", i + 1)}</text>`;
        for (let j = 0; j < 3; j++){
          let val = mdlNum(st.S[i][j], 2), cls = "mdl-cell" + (i === j ? " pos" : "");
          if (step === 4){ val = mdlNum(st.P[i][j], 3); }
          if (step === 5){ val = mdlNum(st.C[i][j], 3); }
          if ((step === 4 && i === 2) || (step === 5 && j === 1)) cls += " row";
          s += `<rect x="${f1(mX + j * c + 1)}" y="${f1(mY + i * c + 1)}" width="${f1(c - 2)}" height="${f1(c - 2)}" rx="3" class="${cls}"/>`;
          s += `<text x="${f1(mX + (j + 0.5) * c)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-cellt${i === j ? " on" : ""}">${val}</text>`;
        }
      }
      s += "</g>";
      const lossText = step === 4 ? `L(a→b) = ${small(st.lr)}` : step >= 5 ? `L = ½(${small(st.lr)} + ${small(st.lc)}) = ${small((st.lr + st.lc) / 2)}` : "L — после softmax";
      s += `<g${mdlFade(step >= LOSS)}>`;
      s += mdlBox(W / 2, 17, Math.min(W - 20, 290), 26, [lossText], "loss" + (step === 4 || step === 5 ? " on" : ""));
      s += "</g>";
      if (isBack){
        s += mdlGrad(mX + 3 * c + 12, 31, mX + 3 * c + 12, mY + c);
        s += mdlGrad(mX - 6, mY + 2.6 * c, xa + 12, topStack - 3) + mdlGrad(mX + 3 * c + 6, mY + 2.6 * c, xb - 12, topStack - 3);
      }
    }
    if (m === "distill"){
      const bw = Math.min(150, (W - 30) / 2), d1 = W / 2 - bw / 2 - 5, d2 = W / 2 + bw / 2 + 5, cyD = vecY - 84, cyL = vecY - 170;
      const [ms, mhs, mht] = outs;
      s += `<g${mdlFade(step >= LOSS)}>`;
      s += mdlFwd(ms[0], ms[1] - 2, d1 - 22, cyD + 15, step === LOSS) + mdlFwd(ms[0] + 12, ms[1] - 2, d2 - 22, cyD + 15, step === LOSS);
      s += mdlFwd(mhs[0] - vw / 2 + 4, mhs[1] - 2, d1 + 22, cyD + 15, step === LOSS) + mdlFwd(mht[0] + vw / 2 + 8, mht[1] + 5, d2 + bw / 2 - 12, cyD + 15, step === LOSS);
      s += mdlBox(d1, cyD, bw, 28, ["‖M(s) − M̂(s)‖²"], step === LOSS ? "on" : "");
      s += mdlBox(d2, cyD, bw, 28, ["‖M(s) − M̂(t)‖²"], step === LOSS ? "on" : "");
      s += mdlFwd(d1, cyD - 15, W / 2 - 20, cyL + 15, step === LOSS) + mdlFwd(d2, cyD - 15, W / 2 + 20, cyL + 15, step === LOSS);
      s += mdlBox(W / 2, cyL, 170, 28, ["L — сумма расстояний"], "loss" + (step === LOSS ? " on" : ""));
      s += "</g>";
      if (isBack){
        s += mdlGrad(W / 2 + 30, cyL + 15, d2 + 8, cyD - 15) + mdlGrad(W / 2 - 30, cyL + 15, d1 + 8, cyD - 15);
        s += mdlGrad(d1 + 34, cyD + 15, mhs[0] - vw / 2 + 16, mhs[1] - 3) + mdlGrad(d2 + bw / 2 - 2, cyD + 15, mht[0] + vw / 2 + 16, mht[1] + 4);
      }
    }
    if (m === "use"){
      const px = W * 0.52, pw = W - px - 10, rows = USE.map((r, i) => ({ text: r[0], cos: r[1], y: 96 + i * 66 }));
      s += `<g${mdlFade(step >= 3)}>`;
      s += `<text x="${f1(px)}" y="${f1(rows[0].y - 22)}" class="mdl-cap">векторы других текстов в индексе</text>`;
      rows.forEach((r, i) => {
        s += mdlLines(px, r.y, mdlWrap(r.text, pw, 11, 2), "mdl-lbl muted", 13, "start");
        const sw = Math.min(110, pw * 0.55);
        s += mdlVec(px + sw / 2, r.y + 22, sw, 61 + i, { h: 9 });
        s += mdlFwd(xa + vw / 2 + 4, vecY + 5, px - 6, r.y + 26, step === 3);
        if (step >= 3) s += `<text x="${f1(px + sw + 6)}" y="${f1(r.y + 27)}" class="mdl-lbl">cos = ${mdlNum(r.cos, 3)}</text>`;
      });
      s += "</g>";
      s += `<text x="${f1(xa)}" y="${f1(vecY - 40)}" class="mdl-cap" text-anchor="middle">голова не нужна</text>`;
    }
    // градиент от векторов вниз к башням
    if (isBack){
      outs.forEach(([x, y], i) => {
        if (m === "distill" && i === 0) return;
        if (m === "all" || m === "distill"){ if ((m === "all" && i % 3) || (m === "distill" && i === 2)) return; }
        s += mdlGrad(x + vw / 2 + 8, y + 5, x + tw / 2 - 3, twT + 2);
      });
    }

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    batchRow.hidden = m !== "all";
    say.innerHTML = explain(step);
  }

  function explain(step){
    const shared = [
      "<b>Прямой проход.</b> Обе последовательности проходят через <i>одну и ту же</i> сеть BERT: это два прохода с общими весами \\(\\theta\\), а не две модели. Внимание не выходит за пределы предложения, поэтому вектор посылки не зависит от гипотезы. На выходе у каждого токена, включая заполнители, свой вектор \\(h_i\\in\\mathbb{R}^{768}\\).",
      "<b>Пулинг.</b> Среднее по настоящим токенам: \\(u=\\sum_i m_i h_i\\big/\\sum_i m_i\\), заполнители в него не входят. Из матриц \\(11\\times768\\) получаются векторы предложений \\(u,v\\in\\mathbb{R}^{768}\\)."
    ];
    const st = batchStats(), same = batch === "same";
    const T_ = {
      nli: [
        "<b>Пара предложений.</b> Посылка и гипотеза из NLI токенизируются по отдельности: \\(11\\) и \\(8\\) токенов. В батче последовательности выравнивают по длине, и гипотезу дополняют тремя заполнителями <code>[PAD]</code> с маской \\(m_i=0\\).",
        shared[0], shared[1],
        "<b>Голова.</b> Склейка \\([u;\\,v;\\,\\lvert u-v\\rvert]\\in\\mathbb{R}^{2304}\\), линейный слой \\(W_t\\in\\mathbb{R}^{3\\times2304}\\) и softmax дают вероятности трёх меток \\(o\\). Дополнительный признак взаимодействия — \\(\\lvert u-v\\rvert\\). Голова нужна только при обучении.",
        "<b>Функция потерь.</b> Перекрёстная энтропия с правильной меткой: \\(\\mathcal{L}=-\\log o_{y}\\), здесь \\(y\\) — «следование». Потери велики, если правильной метке досталась малая вероятность.",
        "<b>Обратный проход.</b> Градиент идёт от \\(\\mathcal{L}\\) через \\(W_t\\) к \\(u\\) и \\(v\\), через пулинг — к векторам настоящих токенов и дальше по обоим проходам. Веса общие, поэтому вклады складываются: \\(\\frac{\\partial\\mathcal{L}}{\\partial\\theta}=\\frac{\\partial\\mathcal{L}}{\\partial u}\\frac{\\partial u}{\\partial\\theta}+\\frac{\\partial\\mathcal{L}}{\\partial v}\\frac{\\partial v}{\\partial\\theta}\\). Заполнители градиента не получают."
      ],
      sts: [
        "<b>Пара предложений.</b> В STS benchmark пара приходит с оценкой сходства, которую выставили люди. Для иллюстрации взята та же пара, что в режиме NLI; токенизация и заполнители те же.",
        shared[0], shared[1],
        "<b>Косинус.</b> Голова без параметров: \\(\\cos(u,v)\\) — та самая величина, которой модель будет сравнивать предложения после обучения.",
        "<b>Функция потерь.</b> \\(\\mathcal{L}=\\bigl(\\cos(u,v)-y\\bigr)^2\\), где \\(y\\) — оценка людей, приведённая к \\([0,1]\\). Здесь функция потерь обучает сам косинус, а не классификатор поверх векторов.",
        "<b>Обратный проход.</b> Градиент \\(2\\bigl(\\cos(u,v)-y\\bigr)\\) проходит через косинус к \\(u\\) и \\(v\\), а дальше, как в режиме NLI, по обоим проходам в общие веса \\(\\theta\\)."
      ],
      all: [
        "<b>Батч пар.</b> Три пары \\((a_i,b_i)\\); правильный ответ к \\(a_i\\) — \\(b_i\\). Переключатель выше меняет состав батча: пары на разные темы или тематически близкие пары про вход в аккаунт. Настоящий батч all-* — \\(1024\\) пары из двух наборов.",
        "<b>Прямой проход.</b> Все шесть текстов проходят через одну сеть. Левая и правая колонки — роли в паре, а не разные модели.",
        "<b>Пулинг и нормировка.</b> Среднее по токенам, затем модуль Normalize: все векторы единичной длины, и скалярное произведение совпадает с косинусом.",
        "<b>Матрица сходств.</b> \\(S_{ij}=\\cos(u_i,v_j)\\): правильные пары на диагонали, остальные клетки — негативы из батча. Числа — косинусы обученной all-MiniLM-L6-v2. " +
          (same ? "Вне диагонали — до \\(0.62\\): все тексты о паролях и входе." : "Вне диагонали — около нуля: тексты на разные темы модель уже разделяет."),
        "<b>Softmax по строкам.</b> Оценки умножаются на \\(1/\\tau=20\\), и каждый \\(a_i\\) выбирает среди \\(b_j\\); в клетках — вероятности. " +
          (same ? `Вопрос «I forgot my login email» отдаёт \\(${mdlNum(st.P[2][0], 2)}\\) ответу про сброс пароля, и потери по строкам \\(\\mathcal{L}_{a\\to b}=${texSmall(st.lr)}\\).`
                : `Позитивы забирают почти всю вероятность, потери по строкам \\(\\mathcal{L}_{a\\to b}\\approx${texSmall(st.lr)}\\): такой батч почти ничему не учит.`),
        "<b>Softmax по столбцам.</b> Теперь каждый ответ \\(b_j\\) выбирает свой вопрос среди \\(a_i\\), и итог \\(\\mathcal{L}=\\tfrac12(\\mathcal{L}_{a\\to b}+\\mathcal{L}_{b\\to a})\\) " +
          (same ? `\\(=\\tfrac12(${texSmall(st.lr)}+${texSmall(st.lc)})=${texSmall((st.lr + st.lc) / 2)}\\). Ответ про смену пароля в Settings → Security отдаёт \\(${mdlNum(st.C[0][1], 2)}\\) вопросу о сбросе пароля; по строкам эта путаница почти не видна (\\(${mdlNum(st.P[0][1], 2)}\\)).`
                : `\\(\\approx${texSmall((st.lr + st.lc) / 2)}\\). На этом примере близкие по теме негативы дают больший обучающий сигнал. Сборка батча из небольшого числа источников может помочь, но сама по себе не гарантирует трудных негативов.`),
        "<b>Обратный проход.</b> Градиент приходит в каждую клетку \\(S\\): позитивы тянутся вверх, негативы — вниз пропорционально своей вероятности (<a href=\"#/reference/training-objectives/obj-infonce\">справочник</a>). Каждый вектор получает сигнал от всех пар батча, и вклады складываются в общие веса."
      ],
      distill: [
        "<b>Предложение и перевод.</b> Пара из параллельного корпуса: английское предложение \\(s\\) и его перевод \\(t\\). Меток нет: цель задаёт модель-учитель.",
        "<b>Прямой проход.</b> Учитель — готовая английская модель — кодирует только \\(s\\) и не обучается. Ученик — многоязычная сеть — кодирует и \\(s\\), и \\(t\\): два прохода одной сети.",
        "<b>Пулинг.</b> Средние по токенам: \\(M(s)\\) у учителя, \\(\\hat M(s)\\) и \\(\\hat M(t)\\) у ученика. Размерности одинаковые.",
        "<b>Функция потерь.</b> \\(\\mathcal{L}=\\lVert M(s)-\\hat M(s)\\rVert^2+\\lVert M(s)-\\hat M(t)\\rVert^2\\): оба вектора ученика тянутся к одной точке учителя, поэтому перевод оказывается там же, где оригинал.",
        "<b>Обратный проход.</b> Градиент получает только ученик. Веса учителя не меняются, его вектор — неподвижная цель, и векторы учителя для всего корпуса можно вычислить заранее."
      ],
      use: [
        "<b>Текст.</b> После обучения голов нет: от модели остаются кодировщик и пулинг, и каждый текст кодируется отдельно.",
        "<b>Прямой проход</b> такой же, как при обучении: токены проходят все слои, на выходе — вектор на каждый токен.",
        "<b>Пулинг и нормировка.</b> Среднее по настоящим токенам, у all-* затем Normalize. Вектор \\(u\\) можно вычислить и сохранить в индекс заранее.",
        "<b>Сравнение.</b> Косинус с сохранёнными векторами (all-MiniLM-L6-v2, как в примере раздела): \\(0.576\\) у следующей гипотезы, \\(0.549\\) у фразы о другом месте, \\(-0.083\\) у несвязанной. Косинус измеряет близость содержания, а не логическое следование."
      ]
    };
    return T_[mode][step];
  }

  const player = vlPlayer(box, {
    count: () => count,
    draw: i => draw(first + i),
    label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[first + i]}`,
    interval: 2200
  });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop();
    player.go(Math.min(player.i, count - 1));
  }));
  box.querySelectorAll("[data-batch]").forEach((b) => b.addEventListener("click", () => {
    batch = b.dataset.batch;
    box.querySelectorAll("[data-batch]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  player.paint();
  const unobserve = cbResize(stage, () => draw(first + player.i));
  return () => { player.stop(); unobserve(); };
}

Object.assign(FIGURES, {
  "sbert-flow": mountSbertFlow,
  "sbert-contrastive": box => mountSbertFlow(box, ["all"], 3, 4),
  "sbert-distill": box => mountSbertFlow(box, ["distill"], 1, 4),
  "sbert-use": box => mountSbertFlow(box, ["use"], 2, 2)
});
