/* Иллюстрация раздела models/e5: контрастивное предобучение одной сети на слабых парах,
   дообучение с учителем (KL и InfoNCE) и поиск с префиксами. Помощники — figures/mdl.js. */

function mountE5Flow(box){
  // Этап 1: три слабые пары (тексты написаны для примера). Косинусы bert-base-uncased (среднее по токенам,
  // те же префиксы) и e5-base-unsupervised — E5 после первого этапа.
  const PAIRS = [
    ["How do I recover my account if I lost access to my email?", "Use the account recovery form: support will verify your identity and restore access."],
    ["Changed my password and now the app won't let me log in", "Sign out of the app completely and sign in again with the new password."],
    ["Password Reset", "A password reset lets a user who forgot a password set a new one, usually through a link sent by email."]
  ];
  const S1 = {
    init: [[0.73089, 0.75478, 0.75654], [0.7349, 0.81795, 0.77665], [0.71113, 0.75249, 0.72677]],
    pt: [[0.55106, 0.44006, 0.44904], [0.45842, 0.54575, 0.45144], [0.43221, 0.47924, 0.61075]]
  };
  // Этап 2: запрос MS MARCO и четыре кандидата (тексты написаны для примера). Учитель — ре-ранкер SimLM
  // (логиты), ученик — e5-base-unsupervised до дообучения и e5-base после.
  const Q2 = "how much protein should a female eat";
  const C2 = [
    { t: "As a general guideline, the average requirement of protein for women ages 19 to 70 is 46 grams per day.", role: "pos" },
    { t: "Most adult women need about 46 grams of protein a day, more if they are pregnant or training hard.", role: "fn" },
    { t: "Men need about 56 grams of protein per day according to the dietary guidelines.", role: "hard" },
    { t: "Protein is made of amino acids, the building blocks of muscle.", role: "neg" }
  ];
  const TEACH = [-0.0169, -0.3372, -1.0459, -2.918];
  const STU = { pt: [0.54516, 0.56985, 0.54076, 0.44894], ft: [0.9074, 0.89328, 0.82038, 0.80912] };
  // Применение: multilingual-e5-base, те же фрагменты, что в практике раздела.
  const QU = "забыл пароль, почта не открывается";
  const DOCS = [
    { t: "Восстановление доступа. Если вы не помните пароль, а привязанный электронный ящик недоступен, подтвердите личность через форму поддержки.", name: "доступ", role: "pos" },
    { t: "Смена пароля. Чтобы сменить пароль, откройте настройки профиля и перейдите по ссылке из письма, которое придёт на вашу почту.", name: "смена пароля", role: "hard" },
    { t: "Тарифы и оплата. Годовая подписка дешевле помесячной оплаты.", name: "тарифы", role: "neg" }
  ];
  const USE = {
    ok: { q: "query: ", d: "passage: ", cos: [0.8517, 0.8397, 0.8014] },
    none: { q: "", d: "", cos: [0.8588, 0.8419, 0.8402] },
    pp: { q: "passage: ", d: "passage: ", cos: [0.84, 0.8276, 0.8499] }
  };
  const TAU = 0.01, ALPHA = 0.2;
  const MODES = {
    pt: { tab: "Предобучение", steps: ["батч слабых пар", "одна сеть", "среднее и нормировка", "матрица косинусов", "softmax и потери", "обратный проход"] },
    ft: { tab: "Дообучение", steps: ["запрос и кандидаты", "учитель", "ученик", "функция потерь", "обратный проход"] },
    use: { tab: "Применение", steps: ["индексация", "запрос", "сравнение", "абсолютные значения"] }
  };
  let mode = "pt", s1 = "init", s2 = "pt", pref = "ok";

  const softmax = (r) => { const mx = Math.max(...r), e = r.map((x) => Math.exp(x - mx)), t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); };
  const lse = (r) => { const mx = Math.max(...r); return mx + Math.log(r.reduce((a, x) => a + Math.exp(x - mx), 0)); };
  function stage1(){
    const S = S1[s1], Z = S.map((r) => r.map((x) => x / TAU));
    const L = Z.map((r, i) => lse(r) - r[i]);
    return { S, P: Z.map(softmax), L, mean: (L[0] + L[1] + L[2]) / 3 };
  }
  function stage2(){
    const pce = softmax(TEACH), z = STU[s2].map((x) => x / TAU), lz = lse(z);
    const ps = z.map((x) => Math.exp(x - lz));
    const kl = pce.reduce((a, p, i) => a + p * (Math.log(p) - (z[i] - lz)), 0), ce = lz - z[0];
    return { pce, ps, cos: STU[s2], kl, ce, loss: kl + ALPHA * ce };
  }
  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const small = (x) => { if (x >= 5e-3) return mdlNum(x, 2); const [m, e] = x.toExponential(0).split("e"); return m + "·10" + String(+e).split("").map((ch) => SUP[ch]).join(""); };
  const texSmall = (x) => { if (x >= 5e-3) return mdlNum(x, 2); const [m, e] = x.toExponential(0).split("e"); return `${m}\\cdot10^{${+e}}`; };
  const sub = mdlSub;
  const tex = (x, d = 2) => mdlNum(x, d).replace("−", "-");   // в LaTeX — обычный минус
  const chipCls = (role) => role === "fn" ? "e5-fn" : role === "neg" ? "" : role;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема E5: предобучение одной сети на слабых парах, дообучение с учителем и поиск с префиксами"></svg></div>
    <div class="fig-row">
      <div class="fig-tabs mdl-tabs" role="tablist" aria-label="Этап">${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${m.tab}</button>`).join("")}</div>
    </div>
    <div class="fig-row" data-row="pt">
      <span class="fig-seg e5-seg">веса<span class="fig-tabs" role="tablist" aria-label="Веса сети">
        <button type="button" role="tab" data-s1="init" aria-selected="true">до обучения</button>
        <button type="button" role="tab" data-s1="pt" aria-selected="false">после этапа 1</button>
      </span></span>
    </div>
    <div class="fig-row" data-row="ft" hidden>
      <span class="fig-seg e5-seg">ученик<span class="fig-tabs" role="tablist" aria-label="Веса ученика">
        <button type="button" role="tab" data-s2="pt" aria-selected="true">до дообучения</button>
        <button type="button" role="tab" data-s2="ft" aria-selected="false">после</button>
      </span></span>
    </div>
    <div class="fig-row" data-row="use" hidden>
      <span class="fig-seg e5-seg">префиксы<span class="fig-tabs mdl-tabs" role="tablist" aria-label="Префиксы">
        <button type="button" role="tab" data-pref="ok" aria-selected="true">query: и passage:</button>
        <button type="button" role="tab" data-pref="none" aria-selected="false">без префиксов</button>
        <button type="button" role="tab" data-pref="pp" aria-selected="false">passage: у запроса</button>
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key pos"></i>', "позитив"],
      ['<i class="mdl-key e5-fn"></i>', "неразмеченный ответ"],
      ['<i class="mdl-key hard"></i>', "трудный негатив"],
      ['<i class="mdl-key teacher"></i>', "учитель"],
      ['<i class="mdl-key vec"></i>', "вектор (значения условные)"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const rows = [...box.querySelectorAll("[data-row]")];
  const H = 500;

  /* ---------- предобучение: одна сеть, матрица косинусов батча ---------- */
  function drawPt(step, W){
    const st = stage1(), isBack = step === 5, init = s1 === "init";
    const xa = W * 0.25, xb = W * 0.75, cw = Math.min(210, W * 0.44);
    const chipY = H - 64, tw = Math.min(250, W * 0.5), twB = chipY - 34, twH = 112, twT = twB - twH;
    const vw = Math.min(110, W * 0.24), vTop = twT - 72;
    const c = 44, mX = W / 2 - 1.5 * c, mY = 58;
    let s = "";
    PAIRS.forEach(([q, p], i) => {
      s += mdlChip(xa, chipY + 19 * i, cw, "query: " + q, step === 0 ? "on" : "");
      s += mdlChip(xb, chipY + 19 * i, cw, "passage: " + p, step === 0 ? "on" : "");
    });
    s += mdlFwd(xa, chipY - 3, W / 2 - tw / 4, twB + 2, step === 1) + mdlFwd(xb, chipY - 3, W / 2 + tw / 4, twB + 2, step === 1);
    s += mdlTower(W / 2, twT, tw, twH, { label: init ? "bert-base-uncased" : "E5 после этапа 1", cls: (step === 1 ? "on" : "") + (isBack ? " grad" : "") });
    // векторы текстов
    s += `<g${mdlFade(step >= 2)}>`;
    s += mdlFwd(W / 2 - tw / 4, twT - 3, xa + vw / 4, vTop + 46, step === 2) + mdlFwd(W / 2 + tw / 4, twT - 3, xb - vw / 4, vTop + 46, step === 2);
    s += mdlLines(W / 2, twT - (W < 480 ? 26 : 18), W < 480 ? ["среднее,", "нормировка"] : ["среднее, нормировка"], "mdl-cap" + (step === 2 ? " on" : ""), 12);
    for (let i = 0; i < 3; i++){
      s += mdlVec(xa, vTop + 16 * i, vw, 11 + i, { label: sub("q", i + 1), h: 10, cls: step === 2 ? "on" : "" });
      s += mdlVec(xb, vTop + 16 * i, vw, 21 + i, { label: sub("p", i + 1), h: 10, cls: step === 2 ? "on" : "" });
    }
    s += "</g>";
    // матрица косинусов, вероятности и потери строк
    s += `<g${mdlFade(step >= 3)}>`;
    s += mdlFwd(xa, vTop - 4, mX - 30, mY + 2.4 * c, step === 3) + mdlFwd(xb, vTop - 4, mX + 3 * c + 48, mY + 2.4 * c, step === 3);
    for (let i = 0; i < 3; i++){
      s += `<text x="${f1(mX - 8)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-lbl" text-anchor="end">${sub("q", i + 1)}</text>`;
      s += `<text x="${f1(mX + (i + 0.5) * c)}" y="${f1(mY - 10)}" class="mdl-lbl" text-anchor="middle">${sub("p", i + 1)}</text>`;
      for (let j = 0; j < 3; j++){
        const closer = i !== j && st.S[i][j] > st.S[i][i];
        const val = step >= 4 ? mdlNum(st.P[i][j], 2) : mdlNum(st.S[i][j], 2);
        s += `<rect x="${f1(mX + j * c + 1)}" y="${f1(mY + i * c + 1)}" width="${c - 2}" height="${c - 2}" rx="3" class="mdl-cell${i === j ? " pos" : closer ? " hard" : ""}"/>`;
        s += `<text x="${f1(mX + (j + 0.5) * c)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-cellt${i === j ? " on" : ""}">${val}</text>`;
      }
      if (step >= 4) s += `<text x="${f1(mX + 3 * c + 8)}" y="${f1(mY + (i + 0.5) * c)}" class="mdl-lbl">${small(st.L[i])}</text>`;
    }
    if (step >= 4) s += `<text x="${f1(mX + 3 * c + 8)}" y="${f1(mY - 10)}" class="mdl-cap sm">потери</text>`;
    s += "</g>";
    const lossText = step >= 4 ? `L = среднее потерь строк = ${small(st.mean)}` : "L — после softmax по строкам";
    s += `<g${mdlFade(step >= 4)}>` + mdlBox(W / 2, 20, Math.min(W - 20, 300), 26, [lossText], "loss" + (step === 4 ? " on" : "")) + "</g>";
    if (isBack){
      s += mdlGrad(mX + 3 * c - 4, 34, mX + 3 * c - 4, mY + 6);
      s += mdlGrad(mX + 6, mY + 3 * c + 4, xa + 8, vTop - 5) + mdlGrad(mX + 3 * c - 6, mY + 3 * c + 4, xb - 8, vTop - 5);
      s += mdlGrad(xa - vw / 4, vTop + 46, W / 2 - tw / 4 - 12, twT - 2) + mdlGrad(xb + vw / 4, vTop + 46, W / 2 + tw / 4 + 12, twT - 2);
    }
    return s;
  }

  /* ---------- дообучение: учитель и ученик на одних кандидатах ---------- */
  function drawFt(step, W){
    const st = stage2(), isBack = step === 4, before = s2 === "pt";
    const xa = W * 0.25, xb = W * 0.75, cw = Math.min(210, W * 0.46), tw = Math.min(200, W * 0.42);
    const chipY = H - 92, twB = chipY - 28, twH = 96, twT = twB - twH;
    const base = twT - 36, bh = 66;
    let s = "";
    // входы: учителю — пары «запрос [SEP] кандидат», ученику — тексты по отдельности
    s += `<text x="${f1(xa)}" y="${f1(chipY + 7)}" class="mdl-cap sm" text-anchor="middle">пары запрос + кандидат</text>`;
    C2.forEach((c, i) => { s += mdlChip(xa, chipY + 18 * (i + 1), cw, "q [SEP] " + c.t, chipCls(c.role)); });
    s += mdlChip(xb, chipY, cw, "query: " + Q2, "q");
    C2.forEach((c, i) => { s += mdlChip(xb, chipY + 18 * (i + 1), cw, "passage: " + c.t, chipCls(c.role)); });
    s += mdlFwd(xa, chipY - 2, xa, twB + 2, step === 1) + mdlFwd(xb, chipY - 3, xb, twB + 2, step === 2);
    s += mdlTower(xa, twT, tw, twH, { label: "учитель: SimLM", cls: "teacher frozen" + (step === 1 ? " on" : "") });
    s += mdlTower(xb, twT, tw, twH, { label: before ? "ученик: E5-PT" : "ученик: E5", cls: (step === 2 ? "on" : "") + (isBack ? " grad" : "") });
    // распределения по кандидатам
    const chart = (cx, ps, show, on, title) => {
      const w = tw - 24, g = 6, bw = (w - 3 * g) / 4, x0 = cx - w / 2;
      let t = `<g${mdlFade(show)}>`;
      t += `<line x1="${f1(x0 - 4)}" y1="${f1(base)}" x2="${f1(x0 + w + 4)}" y2="${f1(base)}" class="e5-base"/>`;
      ps.forEach((p, i) => {
        const h = Math.max(1, bh * p), x = x0 + i * (bw + g);
        t += `<rect x="${f1(x)}" y="${f1(base - h)}" width="${f1(bw)}" height="${f1(h)}" rx="2" class="e5-bar ${C2[i].role}"/>`;
        t += `<text x="${f1(x + bw / 2)}" y="${f1(base - h - 8)}" class="mdl-cellt${on ? " on" : ""}">${mdlNum(p, 2)}</text>`;
        t += `<text x="${f1(x + bw / 2)}" y="${f1(base + 11)}" class="mdl-lbl" text-anchor="middle">${sub("p", i + 1)}</text>`;
      });
      t += `<text x="${f1(cx)}" y="${f1(base - bh - 24)}" class="mdl-lbl" text-anchor="middle">${title}</text>`;
      return t + "</g>";
    };
    s += chart(xa, st.pce, step >= 1, step === 1, sub("p", "ce"));
    s += chart(xb, st.ps, step >= 2, step === 2, sub("p", "stu"));
    // функция потерь
    const bw2 = Math.min(200, (W - 24) / 2 - 4), xK = W / 2 - bw2 / 2 - 4, xC = W / 2 + bw2 / 2 + 4, yB = 104, top = base - bh - 36;
    s += `<g${mdlFade(step >= 3)}>`;
    s += mdlFwd(xa, top, xK, yB + 18, step === 3) + mdlFwd(xb - 16, top, xK + bw2 / 4, yB + 18, step === 3) + mdlFwd(xb + 12, top, xC, yB + 18, step === 3);
    s += mdlBox(xK, yB, bw2, 34, [`KL = ${mdlNum(st.kl, 2)}`, "учитель и ученик"], step === 3 ? "on" : "");
    s += mdlBox(xC, yB, bw2, 34, [`InfoNCE = ${mdlNum(st.ce, 2)}`, "вес α = 0.2"], step === 3 ? "on" : "");
    s += mdlFwd(xK, yB - 18, W / 2 - 30, 50, step === 3) + mdlFwd(xC, yB - 18, W / 2 + 30, 50, step === 3);
    s += mdlBox(W / 2, 36, Math.min(W - 20, 300), 26, [`L = ${mdlNum(st.kl, 2)} + 0.2 · ${mdlNum(st.ce, 2)} = ${mdlNum(st.loss, 2)}`], "loss" + (step === 3 ? " on" : ""));
    s += "</g>";
    if (isBack){
      s += mdlGrad(W / 2 - 50, 50, xK - 10, yB - 18) + mdlGrad(W / 2 + 50, 50, xC + 10, yB - 18);
      s += mdlGrad(xK + 20, yB + 18, xb - tw / 4, top) + mdlGrad(xC + 20, yB + 18, xb + tw / 4, top);
      s += mdlGrad(xb + tw / 2 - 6, base + 4, xb + tw / 2 - 6, twT - 2);
      s += mdlLines(xa, twT - 12, ["веса не меняются"], "mdl-cap sm", 12);
    }
    return s;
  }

  /* ---------- применение: индекс, запрос и косинусы при разных префиксах ---------- */
  function drawUse(step, W){
    const u = USE[pref];
    const xa = W * 0.25, xb = W * 0.75, cw = Math.min(210, W * 0.44);
    const chipY = H - 64, tw = Math.min(230, W * 0.46), twB = chipY - 34, twH = 104, twT = twB - twH;
    const vw = Math.min(100, W * 0.24), vTop = twT - 70;
    const order = [0, 1, 2].sort((a, b) => u.cos[b] - u.cos[a]);
    let s = "";
    s += mdlChip(xa, chipY + 19, cw, u.q + QU, pref === "ok" ? (step === 1 ? "on" : "q") : "bad");
    DOCS.forEach((d, i) => { s += mdlChip(xb, chipY + 19 * i, cw, u.d + d.t, pref === "none" ? "bad" : step === 0 ? "on" : ""); });
    s += mdlFwd(xb, chipY - 3, W / 2 + tw / 4, twB + 2, step === 0) + mdlFwd(xa, chipY + 16, W / 2 - tw / 4, twB + 2, step === 1);
    s += mdlTower(W / 2, twT, tw, twH, { label: "multilingual-e5-base", cls: step <= 1 ? "on" : "" });
    // индекс документов
    s += mdlFwd(W / 2 + tw / 4, twT - 3, xb - vw / 4, vTop + 46, step === 0);
    s += `<text x="${f1(xb)}" y="${f1(vTop - 12)}" class="mdl-cap${step === 0 ? " on" : ""}" text-anchor="middle">индекс</text>`;
    DOCS.forEach((d, i) => { s += mdlVec(xb, vTop + 16 * i, vw, 41 + i, { label: d.name, h: 10, cls: d.role }); });
    // вектор запроса
    s += `<g${mdlFade(step >= 1)}>` + mdlFwd(W / 2 - tw / 4, twT - 3, xa + vw / 4, vTop + 30, step === 1);
    s += mdlVec(xa, vTop + 16, vw, 51, { label: "q", h: 10, cls: step === 1 ? "on" : "" }) + "</g>";
    // сравнение
    if (step === 2){
      s += mdlFwd(xa + vw / 4, vTop + 13, W / 2 - 34, 134, true);
      s += mdlBox(W / 2, 120, 104, 28, ["cos(q, p)"], "on");
      s += mdlFwd(W / 2 + 34, 134, xb - vw / 4, vTop - 22, true);
    }
    if (step >= 2){
      order.forEach((k, r) => {
        const y = vTop + 16 * k;
        s += `<text x="${f1(xb + vw / 2 + 5)}" y="${f1(y + 5)}" class="mdl-lbl${r === 0 ? " e5-top" : ""}">${mdlNum(u.cos[k], 3)}</text>`;
        if (r === 0) s += `<rect x="${f1(xb - vw / 2 - 2)}" y="${f1(y - 2)}" width="${f1(vw + 2)}" height="14" rx="2" class="e5-topf"/>`;
      });
    }
    // абсолютные значения: полоски на шкале от 0 до 1 и порог 0.8
    if (step === 3){
      const x0 = W < 480 ? 96 : 130, len = W - x0 - 52, y0 = 52;
      s += `<line x1="${f1(x0)}" y1="${f1(y0 + 64)}" x2="${f1(x0 + len)}" y2="${f1(y0 + 64)}" class="e5-axis"/>`;
      [0, 0.5, 1].forEach((t) => {
        s += `<line x1="${f1(x0 + len * t)}" y1="${f1(y0 + 64)}" x2="${f1(x0 + len * t)}" y2="${f1(y0 + 68)}" class="e5-axis"/>`;
        s += `<text x="${f1(x0 + len * t)}" y="${f1(y0 + 79)}" class="mdl-cap sm" text-anchor="middle">${t === 0.5 ? "0.5" : t}</text>`;
      });
      DOCS.forEach((d, i) => {
        const y = y0 + i * 20, w = len * u.cos[i];
        s += `<text x="${f1(x0 - 6)}" y="${f1(y + 6)}" class="mdl-lbl" text-anchor="end">${mdlEsc(d.name)}</text>`;
        s += `<rect x="${f1(x0)}" y="${f1(y)}" width="${f1(w)}" height="12" rx="2" class="e5-bar ${d.role}"/>`;
        s += `<text x="${f1(x0 + w + 4)}" y="${f1(y + 6)}" class="mdl-lbl">${mdlNum(u.cos[i], 3)}</text>`;
      });
      const xt = x0 + 0.8 * len;
      s += `<line x1="${f1(xt)}" y1="${f1(y0 - 8)}" x2="${f1(xt)}" y2="${f1(y0 + 64)}" class="e5-thr"/>`;
      s += `<text x="${f1(xt)}" y="${f1(y0 - 16)}" class="mdl-cap sm e5-thrt" text-anchor="middle">порог 0.8</text>`;
    }
    return s;
  }

  function draw(step){
    const W = cbFit(stage, 340, 680);
    const s = mode === "pt" ? drawPt(step, W) : mode === "ft" ? drawFt(step, W) : drawUse(step, W);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    rows.forEach((r) => { r.hidden = r.dataset.row !== mode; });
    say.innerHTML = explain(step);
  }

  function explain(step){
    if (mode === "pt"){
      const st = stage1(), init = s1 === "init";
      return [
        "<b>Батч слабых пар.</b> Три пары того же вида, что в CCPairs: вопрос со Stack Exchange и ответ, пост на Reddit и комментарий, название статьи Википедии и текст раздела (тексты написаны для примера). К первому тексту пары приписан <code>query: </code>, ко второму — <code>passage: </code>. Настоящий батч — \\(32\\,768\\) пар, и у каждого запроса \\(32\\,767\\) негативов.",
        "<b>Одна сеть.</b> Все шесть текстов проходят через один BERT с общими весами; второй сети для документов, как в DPR, нет. Роль текста задаёт префикс — обычные токены в начале входа." +
          (init ? " До обучения это bert-base-uncased." : ""),
        "<b>Среднее и нормировка.</b> Вектор текста — среднее по всем токенам последнего слоя, включая токены префикса, затем нормировка до единичной длины, так что скалярное произведение равно косинусу.",
        "<b>Матрица косинусов.</b> \\(S_{ij}=\\cos(E_{q_i},E_{p_j})\\): позитивы на диагонали, остальные клетки — негативы из батча. " +
          (init ? "До обучения все косинусы между \\(0.71\\) и \\(0.82\\), а у первого и третьего запросов чужие документы ближе своего (выделены): средний вектор BERT почти не зависит от смысла."
                : "После первого этапа свой документ ближе чужих на \\(0.09\\)–\\(0.13\\); при \\(1/\\tau=100\\) это \\(9\\)–\\(13\\) единиц логита."),
        "<b>Softmax и потери.</b> Строки умножаются на \\(1/\\tau=100\\), в клетках — вероятности документов для каждого запроса, справа — потери строк \\(-\\log P_{ii}\\). " +
          (init ? `Первый запрос отдаёт своему документу лишь \\(${mdlNum(st.P[0][0], 2)}\\), потери строки \\(${mdlNum(st.L[0], 2)}\\); среднее по батчу \\(\\mathcal{L}=${mdlNum(st.mean, 2)}\\).`
                : `Позитивы забирают почти всю вероятность, \\(\\mathcal{L}\\approx${texSmall(st.mean)}\\). На таких парах модель уже не учится: сигнал дают близкие негативы, а их много только в большом батче.`),
        "<b>Обратный проход.</b> Градиент идёт из каждой клетки к векторам запросов и документов, а от них — в одну и ту же сеть: вклады обеих сторон пары складываются в общих весах. Эмбеддинги позиций при этом заморожены."
      ][step];
    }
    if (mode === "ft"){
      const st = stage2(), before = s2 === "pt", c = st.cos.map((x) => mdlNum(x, 3)), p = st.ps.map((x) => mdlNum(x, 2));
      return [
        "<b>Запрос и кандидаты.</b> Запрос из MS MARCO и четыре кандидата: размеченный позитив \\(p_1\\), второй правильный ответ \\(p_2\\), который в разметку не попал, трудный негатив о норме для мужчин \\(p_3\\) и посторонний текст \\(p_4\\). Тексты кандидатов написаны для примера; в E5 у запроса 7 трудных негативов, найденных поиском.",
        `<b>Учитель.</b> Cross-encoder читает запрос и кандидата вместе, парой «запрос [SEP] кандидат». Здесь это ре-ранкер SimLM, оценки которого E5 взял готовыми: \\(${TEACH.map((x) => tex(x)).join("\\), \\(")}\\). Softmax без температуры даёт \\(p_{\\text{ce}}\\): \\(${st.pce.map((x) => mdlNum(x, 2)).join("\\), \\(")}\\). Неразмеченный ответ \\(p_2\\) учитель считает почти таким же хорошим, как позитив.`,
        `<b>Ученик.</b> E5 кодирует запрос и кандидатов по отдельности, с префиксами; \\(p_{\\text{stu}}\\) — softmax косинусов, делённых на \\(\\tau=0.01\\), по тем же кандидатам. ` +
          (before ? `До дообучения косинусы \\(${c.join("\\), \\(")}\\): ученик отдаёт \\(${p[1]}\\) неразмеченному ответу и только \\(${p[0]}\\) позитиву.`
                  : `После дообучения косинусы \\(${c.join("\\), \\(")}\\): позитиву \\(${p[0]}\\), неразмеченному ответу \\(${p[1]}\\).`),
        `<b>Функция потерь.</b> \\(\\mathcal{L}=D_{\\mathrm{KL}}(p_{\\text{ce}}\\,\\|\\,p_{\\text{stu}})+0.2\\,\\mathcal{L}_{\\text{cont}}\\); InfoNCE здесь посчитана только по четырём кандидатам, при обучении к ним добавляются документы батча. ` +
          (before ? `До дообучения \\(D_{\\mathrm{KL}}=${mdlNum(st.kl, 2)}\\) и \\(\\mathcal{L}_{\\text{cont}}=${mdlNum(st.ce, 2)}\\): ученик выбирает не тот ответ. Итог \\(${mdlNum(st.loss, 2)}\\).`
                  : `После дообучения InfoNCE упала до \\(${mdlNum(st.ce, 2)}\\), а KL даже вырос до \\(${mdlNum(st.kl, 2)}\\): при \\(\\tau=0.01\\) ученик резче учителя и отдаёт \\(p_3\\) почти ноль вместо \\(0.17\\). Итог \\(${mdlNum(st.loss, 2)}\\): дообучение уменьшило сумму, а не каждое слагаемое.`),
        "<b>Обратный проход.</b> Градиент получает только ученик: оценки учителя посчитаны заранее, его веса не меняются. KL тянет \\(p_{\\text{stu}}\\) к распределению учителя, InfoNCE — к размеченному позитиву, и неразмеченный ответ \\(p_2\\) не отталкивается до нуля."
      ][step];
    }
    const u = USE[pref], lo = Math.min(...u.cos), hi = Math.max(...u.cos);
    const q = { ok: "с префиксом <code>query: </code>: роль задаёт текст, а не отдельная модель.", none: "без префикса — на таком входе модель не обучалась.", pp: "с тем же префиксом <code>passage: </code>, что и документы. Так бывает, когда одна функция эмбеддингов вызывается и при индексации, и при поиске." }[pref];
    const cmp = {
      ok: "Первым идёт ответ о восстановлении доступа (\\(0.852\\)), за ним трудный негатив о смене пароля (\\(0.840\\)), последними — тарифы (\\(0.801\\)).",
      none: "Порядок тот же, но тарифы (\\(0.840\\)) почти догнали смену пароля (\\(0.842\\)), а до ответа (\\(0.859\\)) им меньше двух сотых.",
      pp: "Первыми стали тарифы (\\(0.850\\)), ответ о восстановлении доступа — вторым (\\(0.840\\)). Исключения нет: просто другой порядок."
    }[pref];
    return [
      `<b>Индексация.</b> Фрагменты базы поддержки кодируются один раз ${pref === "none" ? "без префикса" : "с префиксом <code>passage: </code>"}, и их векторы складываются в индекс. Модель — multilingual-e5-base.`,
      `<b>Запрос.</b> Та же сеть кодирует запрос ${q}`,
      `<b>Сравнение.</b> Косинусы вектора запроса с векторами индекса. ${cmp}`,
      `<b>Абсолютные значения.</b> Все три косинуса лежат между \\(${mdlNum(lo, 2)}\\) и \\(${mdlNum(hi, 2)}\\), включая посторонний фрагмент: при \\(\\tau=0.01\\) функция потерь не требует, чтобы несвязанные тексты были далеко. Порог \\(0.8\\) пропустил бы всё. У E5 сравнивают порядок, а порог, если он нужен, подбирают на размеченных запросах.`
    ][step];
  }

  const player = vlPlayer(box, { count: () => MODES[mode].steps.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[i]}`, interval: 2400 });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop();
    player.go(Math.min(player.i, MODES[mode].steps.length - 1));
  }));
  const bind = (attr, set) => box.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener("click", () => {
    set(b.dataset[attr]);
    box.querySelectorAll(`[data-${attr}]`).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  bind("s1", (v) => { s1 = v; });
  bind("s2", (v) => { s2 = v; });
  bind("pref", (v) => { pref = v; });
  player.paint();
  const unobserve = cbResize(stage, () => draw(player.i));
  return () => { player.stop(); unobserve(); };
}

Object.assign(FIGURES, {
  "e5-flow": mountE5Flow
});
