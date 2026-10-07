/* Иллюстрация раздела models/bge: три выхода BGE-M3 из одних выходов XLM-R и самодистилляция.
   Помощники — figures/mdl.js. Числа режима «Три выхода» — из model card BGE-M3 (use_fp16=True),
   числа режима «Самодистилляция» условные. */

function mountBgeFlow(box){
  // запрос из model card и его токены SentencePiece (проверено токенизатором BGE-M3)
  const QUERY = "What is BGE M3?";
  const TOK = ["<s>", "What", "is", "B", "GE", "M", "3", "?", "</s>"];
  // лексические веса запроса из model card; у служебных токенов вес обнулён
  const LEX = [0, 0.08356, 0.0814, 0.1296, 0.252, 0.1702, 0.2695, 0.04092, 0];
  const DOCS = {
    p1: { text: "BGE M3 is an embedding model supporting dense retrieval, lexical matching and multi-vector interaction.",
          shared: ["is", "B", "GE", "M", "3"], dense: 0.6259765625, lex: 0.195556640625, mul: 0.7796499729156494 },
    p2: { text: "BM25 is a bag-of-words retrieval function that ranks a set of documents based on the query terms appearing in each document",
          shared: ["is"], dense: 0.347412109375, lex: 0.00879669189453125, mul: 0.4621465802192688 }
  };
  const WMIX = [0.4, 0.2, 0.4];   // веса из примера compute_score в model card
  // самодистилляция: условные оценки (уже делённые на температуру) для четырёх кандидатов
  const DQ = "забыл пароль, почта не открывается";
  const CAND = [
    { t: "доступ", role: "pos" }, { t: "смена пароля", role: "hard" }, { t: "соцсети", role: "" }, { t: "тарифы", role: "" }
  ];
  const SC = { dense: [5.1, 4.8, 3.2, 1.0], lex: [2.6, 2.7, 0.6, 0.2], mul: [5.4, 4.9, 3.0, 1.2] };
  const MODES = {
    out: { tab: "Три выхода", steps: ["вход", "XLM-R", "плотный вектор", "лексические веса", "векторы токенов", "итоговая оценка"] },
    skd: { tab: "Самодистилляция", steps: ["три оценки", "учитель", "функция потерь", "обратный проход"] }
  };
  let mode = "out", doc = "p1";

  const softmax = (r) => { const mx = Math.max(...r), e = r.map((x) => Math.exp(x - mx)), t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); };
  const ce = (target, p) => -target.reduce((a, t, i) => a + (t > 0 ? t * Math.log(p[i]) : 0), 0);
  function distill(){
    const inter = SC.dense.map((d, i) => d + 0.3 * SC.lex[i] + SC.mul[i]);
    const P = { dense: softmax(SC.dense), lex: softmax(SC.lex), mul: softmax(SC.mul), inter: softmax(inter) };
    const hard = [1, 0, 0, 0];
    const L = (ce(hard, P.dense) + 0.1 * ce(hard, P.lex) + ce(hard, P.mul) + ce(hard, P.inter)) / 4;
    const Ls = (ce(P.inter, P.dense) + 0.1 * ce(P.inter, P.lex) + ce(P.inter, P.mul)) / 3;
    return { inter, P, L, Ls, final: (L + Ls) / 2 };
  }
  const mix = (d) => (WMIX[0] * d.dense + WMIX[1] * d.lex + WMIX[2] * d.mul) / (WMIX[0] + WMIX[1] + WMIX[2]);
  const n2 = (x) => x < 0.01 ? mdlNum(x, 4) : mdlNum(x, 3);

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема BGE-M3: три выхода одного кодировщика и самодистилляция"></svg></div>
    <div class="fig-row">
      <div class="fig-tabs mdl-tabs" role="tablist" aria-label="Режим">${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${m.tab}</button>`).join("")}</div>
    </div>
    <div class="fig-row" data-row="out">
      <span class="fig-seg bge-seg">документ<span class="fig-tabs" role="tablist" aria-label="Документ">
        <button type="button" role="tab" data-doc="p1" aria-selected="true">о BGE-M3</button>
        <button type="button" role="tab" data-doc="p2" aria-selected="false">о BM25</button>
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key bge-shared"></i>', "токен есть в документе"],
      ['<i class="mdl-key pos"></i>', "позитив"],
      ['<i class="mdl-key hard"></i>', "трудный негатив"],
      ['<i class="mdl-key teacher"></i>', "учитель"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const rows = [...box.querySelectorAll("[data-row]")];
  const H = 470;

  /* ---------- три выхода ---------- */
  function drawOut(step, W){
    const D = DOCS[doc], sp = Math.min(62, (W - 36) / 9), x0 = W / 2 - 4 * sp;
    const xs = TOK.map((_, i) => x0 + i * sp), sz = Math.min(22, sp - 8);
    const yTok = H - 64, twH = 92, twT = yTok - 30 - twH, yBar = twT - 28, bh = 70;
    const pw = (W - 24) / 3, px = [12 + pw / 2, W / 2, W - 12 - pw / 2], yP = 74, pH = 66;
    const shared = (t) => D.shared.includes(t);
    let s = "";
    // запрос: токены и подписи
    s += `<g class="${step === 0 ? "mdl-in-on" : ""}">`;
    TOK.forEach((t, i) => {
      const special = i === 0 || i === TOK.length - 1, hit = step === 3 && shared(t);
      s += `<rect x="${f1(xs[i] - sz / 2)}" y="${f1(yTok)}" width="${f1(sz)}" height="${f1(sz)}" rx="3" class="mdl-tok ${special ? "cls" : "tok"}${hit ? " bge-hit" : ""}"/>`;
      s += `<text x="${f1(xs[i])}" y="${f1(yTok + sz + 13)}" class="bge-tt${special ? " sp" : ""}" text-anchor="middle">${mdlEsc(t)}</text>`;
    });
    s += "</g>";
    s += `<text x="${f1(W / 2)}" y="${f1(H - 8)}" class="mdl-cap sm${step === 0 ? " on" : ""}" text-anchor="middle">запрос «${QUERY}»: 9 токенов SentencePiece</text>`;
    // кодировщик
    s += mdlWires(xs, yTok - 2, twT + twH + 2, step === 1);
    s += mdlTower(W / 2, twT, Math.min(W - 24, 9 * sp + 20), twH, { label: "XLM-RoBERTa-large, 24 слоя", layers: 3, layerNames: ["слой 24", "…", "слой 1"], cls: step === 1 ? "on" : "" });
    // выходы токенов: скрытые состояния или лексические веса
    s += `<g${mdlFade(step >= 1)}>`;
    if (step === 3){
      TOK.forEach((t, i) => {
        const h = Math.max(1.5, bh * LEX[i] / 0.28), hit = shared(t);
        s += `<rect x="${f1(xs[i] - sz / 2)}" y="${f1(yBar - h)}" width="${f1(sz)}" height="${f1(h)}" rx="2" class="bge-w${hit ? " hit" : ""}"/>`;
        s += `<text x="${f1(xs[i])}" y="${f1(yBar - h - 7)}" class="bge-wv${hit ? " hit" : ""}" text-anchor="middle">${LEX[i] ? mdlNum(LEX[i], 2) : "0"}</text>`;
      });
      s += `<line x1="${f1(x0 - sp / 2)}" y1="${f1(yBar)}" x2="${f1(x0 + 8.5 * sp)}" y2="${f1(yBar)}" class="bge-base"/>`;
    } else {
      const r = rng(31);
      TOK.forEach((_, i) => {
        const dim = (step === 2 && i !== 0) || (step === 4 && i === 0);
        s += `<g${dim ? ' opacity="0.25"' : ""}>`;
        for (let c = 0; c < 4; c++) s += `<rect x="${f1(xs[i] - sz / 2)}" y="${f1(yBar - (c + 1) * bh / 4)}" width="${f1(sz)}" height="${f1(bh / 4 - 1)}" style="${vlVal(2 * r() - 1)}"/>`;
        s += `<rect x="${f1(xs[i] - sz / 2)}" y="${f1(yBar - bh)}" width="${f1(sz)}" height="${f1(bh - 1)}" class="mdl-barf${(step === 2 && i === 0) ? " bge-pick" : ""}"/></g>`;
      });
    }
    s += mdlFwd(W / 2, twT - 2, W / 2, yBar + 4, step === 1);
    s += "</g>";
    // три панели
    const panel = (k, i, title, sub, val, on, show) => {
      let t = `<g${mdlFade(show)}>`;
      t += `<rect x="${f1(px[i] - pw / 2 + 3)}" y="${f1(yP - pH / 2)}" width="${f1(pw - 6)}" height="${pH}" rx="8" class="mdl-box${on ? " on" : ""}"/>`;
      t += `<text x="${f1(px[i])}" y="${f1(yP - 18)}" class="mdl-boxt">${title}</text>`;
      t += mdlLines(px[i], yP, mdlWrap(sub, pw - 16, 10.5, 1), "mdl-boxs", 12);
      t += `<text x="${f1(px[i])}" y="${f1(yP + 19)}" class="bge-score${on ? " on" : ""}" text-anchor="middle">${val}</text>`;
      return t + "</g>";
    };
    s += panel("dense", 0, "плотный", W < 480 ? "cos <s>" : "cos нормированных <s>", show(step, 2) ? n2(D.dense) : "", step === 2, step >= 2);
    s += panel("lex", 1, "лексический", W < 480 ? "Σ wq·wp" : "Σ wq·wp по общим токенам", show(step, 3) ? n2(D.lex) : "", step === 3, step >= 3);
    s += panel("mul", 2, W < 480 ? "векторы" : "векторы токенов", W < 480 ? "max cos" : "среднее по 8 строкам max cos", show(step, 4) ? n2(D.mul) : "", step === 4, step >= 4);
    // стрелки к панелям
    if (step === 2) s += mdlFwd(xs[0], yBar - bh - 4, px[0], yP + pH / 2 + 4, true);
    if (step === 3) s += mdlFwd(W / 2, yBar - bh - 18, px[1], yP + pH / 2 + 4, true);
    if (step === 4) s += mdlFwd(xs[5], yBar - bh - 4, px[2], yP + pH / 2 + 4, true);
    // итоговая оценка
    if (step === 5){
      s += mdlFwd(px[0], yP - pH / 2 - 2, W / 2 - 40, 30, true) + mdlFwd(px[1], yP - pH / 2 - 2, W / 2, 30, true) + mdlFwd(px[2], yP - pH / 2 - 2, W / 2 + 40, 30, true);
      s += mdlBox(W / 2, 16, Math.min(W - 16, 420), 26, [`0.4 · ${n2(D.dense)} + 0.2 · ${n2(D.lex)} + 0.4 · ${n2(D.mul)} = ${mdlNum(mix(D), 3)}`], "on");
    }
    if (step < 5) s += `<text x="${f1(W / 2)}" y="${f1(18)}" class="mdl-cap sm" text-anchor="middle">${mdlEsc(mdlWrap("документ: " + D.text, W - 30, 10, 1)[0])}</text>`;
    return s;
  }
  const show = (step, k) => step >= k;

  /* ---------- самодистилляция ---------- */
  function drawSkd(step, W){
    const st = distill(), isBack = step === 3, narrow = W < 480;
    const cw = (W - 24) / 3, cx = [12 + cw / 2, W / 2, W - 12 - cw / 2], base = H - 66, bh = 118;
    const top = base - bh - 40, ly = 22, tC = Math.round((ly + 17 + top) / 2);
    let s = "";
    const chart = (x, ps, title, on) => {
      const w = Math.min(cw - 18, 150), g = 5, bw = (w - 3 * g) / 4, xl = x - w / 2;
      let t = `<rect x="${f1(x - cw / 2 + 3)}" y="${f1(top)}" width="${f1(cw - 6)}" height="${bh + 62}" rx="8" class="mdl-box${on ? " on" : ""}${isBack ? " grad" : ""}"/>`;
      t += `<text x="${f1(x)}" y="${f1(top + 16)}" class="mdl-boxt">${title}</text>`;
      ps.forEach((p, i) => {
        const h = Math.max(1.5, bh * p), xb = xl + i * (bw + g);
        t += `<rect x="${f1(xb)}" y="${f1(base - h)}" width="${f1(bw)}" height="${f1(h)}" rx="2" class="bge-bar ${CAND[i].role}"/>`;
        t += `<text x="${f1(xb + bw / 2)}" y="${f1(base - h - 6)}" class="bge-wv" text-anchor="middle">${mdlNum(p, 2)}</text>`;
        t += `<text x="${f1(xb + bw / 2)}" y="${f1(base + 11)}" class="bge-wv" text-anchor="middle">${"d" + (i + 1)}</text>`;
      });
      return t;
    };
    s += chart(cx[0], st.P.dense, "плотный", step === 0);
    s += chart(cx[1], st.P.lex, "лексический", step === 0);
    s += chart(cx[2], st.P.mul, narrow ? "векторы" : "векторы токенов", step === 0);
    s += `<text x="${f1(W / 2)}" y="${f1(H - 26)}" class="mdl-cap sm" text-anchor="middle">${mdlEsc(CAND.map((c, i) => `d${i + 1} — ${c.t}`).join(", "))}</text>`;
    s += `<text x="${f1(W / 2)}" y="${f1(H - 10)}" class="mdl-cap sm" text-anchor="middle">запрос «${DQ}»; оценки условные</text>`;
    // функция потерь
    s += `<g${mdlFade(step >= 2)}>`;
    const lw = Math.min(cw - 6, 150);
    s += mdlBox(cx[0], ly, lw, 34, [`L = ${mdlNum(st.L, 2)}`, "по разметке"], step === 2 ? "on" : "");
    s += mdlBox(cx[1], ly, lw, 34, [`L′ = ${mdlNum(st.Ls, 2)}`, "по учителю"], step === 2 ? "on" : "");
    s += mdlBox(cx[2], ly, lw, 34, [`итог = ${mdlNum(st.final, 2)}`, "(L + L′) / 2"], "loss" + (step === 2 ? " on" : ""));
    s += "</g>";
    // обратный проход: градиент от функции потерь к трём выходам, мимо учителя
    if (isBack) cx.forEach((x) => { s += mdlGrad(x, ly + 19, x, top - 3); });
    // учитель: на шаге градиента сдвинут между стрелками
    s += `<g${mdlFade(step >= 1)}>`;
    if (isBack){
      s += mdlBox((cx[0] + cx[1]) / 2, tC, cw - 16, 34, ["учитель", "без градиента"], "teacher");
    } else {
      const tw = Math.min(W - 24, 300);
      s += mdlBox(W / 2, tC, tw, 34, [mdlSub("учитель: softmax(s", "inter", ")"), CAND.map((_, i) => mdlNum(st.P.inter[i], 2)).join("   ")], "teacher" + (step === 1 ? " on" : ""));
      if (step === 1) cx.forEach((x) => { s += mdlFwd(x, top - 3, W / 2 + (x - W / 2) * 0.4, tC + 19, true); });
      if (step === 2) s += mdlFwd(W / 2, tC - 19, cx[1], ly + 19, true);
    }
    s += "</g>";
    return s;
  }

  function draw(step){
    const W = cbFit(stage, 340, 680);
    const s = mode === "out" ? drawOut(step, W) : drawSkd(step, W);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    rows.forEach((r) => { r.hidden = r.dataset.row !== mode; });
    say.innerHTML = explain(step);
  }

  function explain(step){
    if (mode === "out"){
      const D = DOCS[doc], one = doc === "p1";
      return [
        `<b>Вход.</b> Запрос из model card BGE-M3 токенизатор SentencePiece делит на 9 токенов: <code>&lt;s&gt;</code>, What, is, B, GE, M, 3, ?, <code>&lt;/s&gt;</code>. Инструкции у запроса нет. Документ кодируется той же сетью; ${one ? "в описании BGE-M3 есть токены is, B, GE, M и 3 из запроса" : "в описании BM25 из токенов запроса есть только is: BM25 делится на BM и 25"}.`,
        "<b>XLM-R.</b> Кодировщик — XLM-RoBERTa-large, расширенный до 8192 позиций и предобученный RetroMAE. Все три выхода считаются из одной матрицы \\(H\\) выходов последнего слоя, поэтому достаточно одного прохода. Цвета ячеек условные.",
        `<b>Плотный вектор.</b> Берётся выход первого токена <code>&lt;s&gt;</code> (у XLM-R он играет роль <code>[CLS]</code>) и нормируется: \\(e=\\operatorname{norm}(H[0])\\). Оценка — косинус с вектором документа: \\(${n2(D.dense)}\\). Числа этого режима — из примера в model card.`,
        `<b>Лексические веса.</b> Каждый токен получает вес \\(\\operatorname{ReLU}(W_{\\text{lex}}^{\\top}H[i])\\); у <code>&lt;s&gt;</code> и <code>&lt;/s&gt;</code> вес обнулён. Веса запроса в model card: у GE и 3 около \\(0.25\\)–\\(0.27\\), у What и is — около \\(0.08\\). Оценка складывает произведения весов только по токенам, которые есть в обоих текстах: ${one ? "is, B, GE, M и 3 дают \\(0.196\\)" : "совпадает только is, и оценка всего \\(0.0088\\)"}.`,
        `<b>Векторы токенов.</b> Выходы всех токенов, кроме <code>&lt;s&gt;</code>, проецируются матрицей \\(W_{\\text{mul}}\\) размером \\(1024\\times1024\\) и нормируются. Для каждого из 8 векторов запроса берётся лучший косинус с векторами документа, и максимумы усредняются: \\(${n2(D.mul)}\\). Это MaxSim ColBERT, делённый на длину запроса.`,
        `<b>Итоговая оценка.</b> Оценки складываются с весами из примера model card, \\((0.4,\\,0.2,\\,0.4)\\), и делятся на сумму весов: \\(${mdlNum(mix(D), 3)}\\). У разных оценок разная шкала: лексическая здесь ${one ? "втрое ниже плотной, хотя совпали почти все токены" : "почти нулевая"}. Поэтому веса подбирают на своих данных.`
      ][step];
    }
    const st = distill(), pi = st.P.inter.map((x) => mdlNum(x, 2));
    return [
      `<b>Три оценки.</b> Для запроса и четырёх кандидатов каждый выход даёт свою оценку, а softmax превращает её в распределение по кандидатам; d1 — размеченный позитив. Плотный выход и векторы токенов ставят позитив первым, а лексический почти не различает d1 и d2: в обоих есть «пароль», а «почта» и «почту» для него разные токены. К тому же в начале обучения его голова инициализирована случайно. Оценки условные.`,
      `<b>Учитель.</b> Интегральная оценка \\(s_{\\text{inter}}=s_{\\text{dense}}+0.3\\,s_{\\text{lex}}+s_{\\text{mul}}\\) объединяет три выхода, и её softmax — мягкая цель для каждого: \\(${pi.join("\\), \\(")}\\). Учитель — та же модель, никакой внешней сети здесь нет.`,
      `<b>Функция потерь.</b> \\(\\mathcal{L}\\) — InfoNCE по разметке для трёх выходов и их суммы с весами \\(1,\\,0.1,\\,1,\\,1\\), делённая на 4: \\(${mdlNum(st.L, 2)}\\). \\(\\mathcal{L}'\\) — перекрёстная энтропия каждого выхода с распределением учителя, с весами \\(1,\\,0.1,\\,1\\), делённая на 3: \\(${mdlNum(st.Ls, 2)}\\). Итог — их среднее, \\(${mdlNum(st.final, 2)}\\). Учитель отдаёт «смене пароля» \\(${pi[1]}\\), поэтому по \\(\\mathcal{L}'\\) её не нужно отталкивать до нуля, как требует разметка.`,
      "<b>Обратный проход.</b> Градиент идёт в три головы и в общий кодировщик. Цель учителя берётся с отключённым градиентом: учитель не подстраивается под учеников, а слабый в начале лексический выход тянется к согласованному мнению всех трёх."
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
  "bge-flow": mountBgeFlow
});
