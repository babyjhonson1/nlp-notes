/* Иллюстрация раздела models/t5: восстановление спанов на кодировщике-декодере и формат «текст в текст».
   Помощники — figures/mdl.js (mdlTokChips, mdlCross и др.). Токены примеров получены токенизатором T5;
   вероятности и тексты ответов условные. */

function mountT5Flow(box, mode = "pre", first = 2, count = 4){
  // «The Irish Sea separates Great Britain from Ireland.»; скрываются Irish Sea и from
  const ORIG = ["The", "Irish", "Sea", "separate", "s", "Great", "Britain", "from", "Ireland", ".", "</s>"];
  const HIDE = [1, 2, 7];
  const ENC = ["The", "<0>", "separate", "s", "Great", "Britain", "<1>", "Ireland", ".", "</s>"];
  const TGT = ["<0>", "Irish", "Sea", "<1>", "from", "<2>", "</s>"];
  const DEC = ["<pad>", "<0>", "Irish", "Sea", "<1>", "from", "<2>"];
  const PROB = [0.97, 0.41, 0.88, 0.93, 0.62, 0.95, 0.99];   // условные вероятности правильных токенов цели
  const TASKS = {
    tr: { tab: "перевод", inp: "translate English to German: That is good.", out: "Das ist gut." },
    nli: { tab: "NLI", inp: "mnli premise: The Irish Sea separates Great Britain from Ireland. hypothesis: A sea separates the two islands.", out: "entailment" },
    sts: { tab: "STS-B", inp: "stsb sentence1: The sea is calm. sentence2: The water is still.", out: "4.2" },
    sum: { tab: "суммаризация", inp: "summarize: The Irish Sea separates Great Britain from Ireland and links to the Atlantic in the north and south.", out: "The Irish Sea lies between Britain and Ireland." }
  };
  const MODES = {
    pre: { tab: "Предобучение", steps: ["текст", "вход и цель", "кодировщик", "декодер", "функция потерь", "обратный проход"] },
    t2t: { tab: "Текст в текст", steps: ["вход с префиксом", "кодировщик", "декодер пишет ответ", "ответ — строка"] }
  };
  let task = "tr";

  const kind = (t) => /^<\d>$/.test(t) ? "sent" : (t === "</s>" || t === "<pad>") ? "sp" : "tok";
  const chips = (arr, extra = () => "") => arr.map((t, i) => ({ t, k: extra(i) || kind(t) }));
  const lossVal = () => -PROB.reduce((a, p) => a + Math.log(p), 0) / PROB.length;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Схема T5: кодировщик-декодер, восстановление спанов и формат текст в текст"></svg></div>
    <div class="fig-row" data-row="t2t" hidden>
      <span class="fig-seg t5-seg">задача<span class="fig-tabs mdl-tabs" role="tablist" aria-label="Задача">
        ${Object.entries(TASKS).map(([k, t]) => `<button type="button" role="tab" data-task="${k}" aria-selected="${k === task}">${t.tab}</button>`).join("")}
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      [mdlLegendArrow("mdl-grad"), "градиент"],
      [mdlLegendArrow("mdl-cross"), "cross-attention"],
      ['<i class="mdl-key sent"></i>', "сентинел"],
      ['<i class="mdl-key vec"></i>', "значения условные"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const rows = [...box.querySelectorAll("[data-row]")];
  const H = 480;

  // общая геометрия двух башен
  function geo(W, chipsH = 38){
    const xe = W * 0.27, xd = W * 0.73, colW = W / 2 - 16, tw = Math.min(210, colW - 8);
    const yIn = H - 26 - chipsH, twH = 120, twT = yIn - 34 - twH, yBar = twT - 14;
    return { xe, xd, colW, tw, yIn, twH, twT, yBar };
  }
  const chipsH = (arr, w) => mdlTokChips(0, 0, chips(arr), w).height;
  function towers(g, encOn, decOn, back, fade = false){
    let s = mdlTower(g.xe, g.twT, g.tw, g.twH, { label: "кодировщик", layers: 3, layerNames: ["блок 12", "…", "блок 1"], cls: (encOn ? "on" : "") + (back ? " grad" : ""), fade });
    s += mdlTower(g.xd, g.twT, g.tw, g.twH, { label: "декодер", layers: 3, layerNames: ["блок 12", "…", "блок 1"], cls: (decOn ? "on" : "") + (back ? " grad" : ""), fade });
    return s;
  }
  function encBars(g, n, show){
    if (!show) return "";
    const r = rng(9), w = Math.min(g.tw - 10, n * 14), bw = w / n;
    let s = "";
    for (let i = 0; i < n; i++){
      for (let c = 0; c < 3; c++) s += `<rect x="${f1(g.xe - w / 2 + i * bw)}" y="${f1(g.yBar - (c + 1) * 8)}" width="${f1(bw - 1.5)}" height="7" style="${vlVal(2 * r() - 1)}"/>`;
    }
    return s + `<rect x="${f1(g.xe - w / 2)}" y="${f1(g.yBar - 24)}" width="${f1(w - 1.5)}" height="24" class="mdl-barf"/>`;
  }
  function cross(g, on){
    let s = "";
    [0.2, 0.45, 0.7].forEach((t) => { s += mdlCross(g.xe + g.tw / 2 - 30, g.yBar - 18, g.xd - g.tw / 2 + 2, g.twT + g.twH * t, on); });
    return s;
  }

  /* ---------- предобучение: восстановление спанов ---------- */
  function drawPre(step, W){
    const cw = W / 2 - 16, hh = step === 0 ? chipsH(ORIG, W - 30) : Math.max(chipsH(ENC, cw), chipsH(step === 1 ? TGT : DEC, cw));
    const g = geo(W, hh), back = step === 5;
    let s = "";
    if (step === 0){
      const c = mdlTokChips(W / 2, g.yIn, chips(ORIG, (i) => HIDE.includes(i) ? "hide" : ""), W - 30);
      s += c.svg;
      s += `<text x="${f1(W / 2)}" y="${f1(H - 10)}" class="mdl-cap sm on" text-anchor="middle">исходный текст: пунктиром — скрываемые отрезки</text>`;
      s += towers(g, false, false, false, true);
      return s;
    }
    // вход кодировщика и вход декодера
    const ce = mdlTokChips(g.xe, g.yIn, chips(ENC), g.colW);
    s += `<g class="${step === 1 ? "mdl-in-on" : ""}">${ce.svg}</g>`;
    s += `<text x="${f1(g.xe)}" y="${f1(H - 10)}" class="mdl-cap sm${step === 1 ? " on" : ""}" text-anchor="middle">вход кодировщика</text>`;
    if (step === 1){
      const ct = mdlTokChips(g.xd, g.yIn, chips(TGT), g.colW);
      s += ct.svg + `<text x="${f1(g.xd)}" y="${f1(H - 10)}" class="mdl-cap sm on" text-anchor="middle">цель</text>`;
    } else {
      const cd = mdlTokChips(g.xd, g.yIn, chips(DEC), g.colW);
      s += `<g${mdlFade(step >= 3)}>${cd.svg}</g>`;
      s += `<text x="${f1(g.xd)}" y="${f1(H - 10)}" class="mdl-cap sm${step === 3 ? " on" : ""}" text-anchor="middle">вход декодера: цель со сдвигом</text>`;
    }
    s += mdlFwd(g.xe, g.yIn - 4, g.xe, g.twT + g.twH + 2, step === 2);
    s += mdlFwd(g.xd, g.yIn - 4, g.xd, g.twT + g.twH + 2, step === 3);
    s += towers(g, step === 2, step === 3, back);
    s += encBars(g, ENC.length, step >= 2);
    if (step >= 3) s += cross(g, step === 3);
    // предсказания декодера и функция потерь
    if (step >= 3){
      const ph = chipsH(TGT, g.colW), yP = g.twT - 22 - ph, cp = mdlTokChips(g.xd, yP, chips(TGT), g.colW);
      s += mdlFwd(g.xd, g.twT - 2, g.xd, yP + ph + 3, step === 3);
      s += cp.svg;
      s += `<text x="${f1(g.xd)}" y="${f1(yP - 24)}" class="mdl-cap sm${step === 3 ? " on" : ""}" text-anchor="middle">правильные токены цели</text>`;
      if (step >= 4){
        if (ph < 20) cp.cs.forEach(([x, y], i) => { s += `<text x="${f1(x)}" y="${f1(y - 7)}" class="t5-p" text-anchor="middle">${mdlNum(PROB[i], 2).replace(/^0/, "")}</text>`; });
        else s += `<text x="${f1(g.xd)}" y="${f1(yP - 7)}" class="t5-p" text-anchor="middle">p: ${PROB.map((p) => mdlNum(p, 2).replace(/^0/, "")).join("  ")}</text>`;
        s += mdlBox(g.xd, 34, Math.min(g.colW, 230), 34, [`L = −среднее log p = ${mdlNum(lossVal(), 2)}`, "по 7 токенам цели"], "loss" + (step === 4 ? " on" : ""));
        if (step === 4) s += mdlFwd(g.xd, yP - 36, g.xd, 52, true);
      }
    }
    if (back){
      const ph = chipsH(TGT, g.colW), yP = g.twT - 22 - ph;
      s += mdlGrad(g.xd + 16, 52, g.xd + 16, yP - 40) + mdlGrad(g.xd + 16, yP + ph + 3, g.xd + 16, g.twT - 2);
      s += mdlGrad(g.xd - g.tw / 2 + 4, g.twT + g.twH * 0.55, g.xe + g.tw / 2 - 30, g.yBar - 2);
      s += mdlGrad(g.xe - 20, g.yBar + 2, g.xe - 20, g.twT + 30);
    }
    return s;
  }

  /* ---------- текст в текст ---------- */
  function drawT2t(step, W){
    const g = geo(W), T = TASKS[task];
    let s = "";
    const textBox = (x, y, w, text, cls, on) => {
      const lines = mdlWrap(text, w - 16, 10.5, 4), h = lines.length * 13 + 12;
      return `<rect x="${f1(x - w / 2)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="6" class="mdl-chip ${cls}${on ? " on" : ""}"/>` +
        mdlLines(x, y + 12, lines, "mdl-chipt t5-txt", 13);
    };
    const inH = mdlWrap(T.inp, g.colW - 16, 10.5, 4).length * 13 + 12;
    s += textBox(g.xe, g.yIn + 40 - inH, g.colW, T.inp, "", step === 0);
    s += `<text x="${f1(g.xe)}" y="${f1(H - 10)}" class="mdl-cap sm${step === 0 ? " on" : ""}" text-anchor="middle">вход: префикс задачи и текст</text>`;
    s += mdlFwd(g.xe, g.yIn + 36 - inH, g.xe, g.twT + g.twH + 2, step === 1);
    s += towers(g, step === 1, step === 2, false);
    s += encBars(g, 10, step >= 1);
    s += `<g${mdlFade(step >= 2)}>`;
    s += cross(g, step === 2);
    const out = [{ t: "<pad>", k: "sp" }];
    s += mdlTokChips(g.xd, g.yIn + 10, out, g.colW).svg;
    s += `<text x="${f1(g.xd)}" y="${f1(H - 10)}" class="mdl-cap sm${step === 2 ? " on" : ""}" text-anchor="middle">декодер начинает с &lt;pad&gt;</text>`;
    s += mdlFwd(g.xd, g.yIn + 6, g.xd, g.twT + g.twH + 2, step === 2);
    const yO = g.twT - 74;
    s += textBox(g.xd, yO, g.colW, T.out + " </s>", "pos", step >= 2);
    s += mdlFwd(g.xd, g.twT - 2, g.xd, yO + 30, step === 2);
    s += `<text x="${f1(g.xd)}" y="${f1(yO - 10)}" class="mdl-cap sm${step >= 2 ? " on" : ""}" text-anchor="middle">ответ — тоже текст</text>`;
    s += "</g>";
    return s;
  }

  function draw(step){
    const W = cbFit(stage, 340, 680);
    const s = mode === "pre" ? drawPre(step, W) : drawT2t(step, W);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    rows.forEach((r) => { r.hidden = r.dataset.row !== mode; });
    say.innerHTML = explain(step);
  }

  function explain(step){
    if (mode === "pre"){
      return [
        "<b>Текст.</b> Предложение из C4-подобного текста, разбитое токенизатором T5: 11 токенов вместе с <code>&lt;/s&gt;</code>. Скрываются два отрезка: «Irish Sea» и «from». В T5 скрывают \\(15\\%\\) токенов отрезками средней длины \\(3\\); здесь доля выше, чтобы на коротком примере отрезков было два. Пример условный.",
        "<b>Вход и цель.</b> Каждый скрытый отрезок во входе заменён одним сентинелом — на схеме <code>&lt;0&gt;</code>, <code>&lt;1&gt;</code>, в словаре <code>&lt;extra_id_0&gt;</code>, <code>&lt;extra_id_1&gt;</code>. Цель — только скрытые токены, разделённые теми же сентинелами, и завершающий <code>&lt;2&gt;</code>. Цель в 7 токенов вместо 11: декодеру не нужно переписывать видимый текст.",
        "<b>Кодировщик.</b> Двунаправленное внимание по входу с сентинелами: каждый токен видит весь вход. Позиции учитываются только через относительное смещение, добавляемое к логитам внимания. На выходе — по вектору на токен входа; цвета условные.",
        "<b>Декодер.</b> На вход подаётся цель, сдвинутая на один токен вправо, с <code>&lt;pad&gt;</code> в начале (teacher forcing). Каузальное внимание видит только предыдущие токены цели, а cross-attention в каждом блоке смотрит на выходы кодировщика. В каждой позиции декодер предсказывает следующий токен цели.",
        `<b>Функция потерь.</b> Перекрёстная энтропия по всем токенам цели, включая сентинелы и <code>&lt;/s&gt;</code>: \\(\\mathcal{L}=-\\frac{1}{|y|}\\sum_t\\log p(y_t\\mid y_{&lt;t},\\tilde x)=${mdlNum(lossVal(), 2)}\\) при условных вероятностях на схеме. Самая низкая условная вероятность у «Irish» (\\(0.41\\)). При его предсказании «Sea» ещё недоступно; контекст дают видимые «Great Britain» и «Ireland».`,
        "<b>Обратный проход.</b> Градиент идёт в декодер, через cross-attention — в кодировщик, а в T5 1.0 ещё и в общую матрицу эмбеддингов входа и выхода. Та же функция потерь и тот же проход используются при дообучении — меняются только пары «вход — цель»."
      ][step];
    }
    const T = TASKS[task];
    const note = {
      tr: "Перевод — естественная задача для кодировщика-декодера: ответ генерируется токен за токеном. Пример префикса и перевода — из статьи T5.",
      nli: "Класс — это слово. Модель генерирует «entailment», «neutral» или «contradiction»; любой другой ответ считается ошибкой, хотя авторы такого не наблюдали. Само слово токенизатор режет на части: ▁ en tail ment.",
      sts: "Регрессию T5 тоже сводит к тексту: оценка сходства округляется до шага \\(0.2\\) и пишется строкой. Ошибка обучает токенам записи числа, а не расстоянию между числовыми оценками; строку затем разбирает код оценки. Здесь «4.2» — один токен.",
      sum: "Суммаризация — генерация длинного ответа; для неё и перевода авторы использовали лучевой поиск с шириной \\(4\\), для остальных задач — жадное декодирование."
    }[task];
    return [
      `<b>Вход с префиксом.</b> Задачу называет текстовый префикс в начале входа: <code>${mdlEsc(T.inp.split(":")[0])}:</code>. Формат префиксов — из статьи T5, тексты примеров, кроме перевода, условные.`,
      "<b>Кодировщик.</b> Тот же кодировщик, что при предобучении, читает вход целиком. Отдельной головы под задачу нет.",
      "<b>Декодер пишет ответ.</b> Декодер начинает с <code>&lt;pad&gt;</code> и генерирует ответ, пока не выдаст <code>&lt;/s&gt;</code>. При обучении это та же перекрёстная энтропия по токенам ответа, что и при восстановлении спанов.",
      `<b>Ответ — строка.</b> ${note}`
    ][step];
  }

  const player = vlPlayer(box, { count: () => count, draw: i => draw(first + i), label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[first + i]}`, interval: 2600 });
  box.querySelectorAll("[data-task]").forEach((b) => b.addEventListener("click", () => {
    task = b.dataset.task;
    box.querySelectorAll("[data-task]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  player.paint();
  const unobserve = cbResize(stage, () => draw(first + player.i));
  return () => { player.stop(); unobserve(); };
}

Object.assign(FIGURES, {
  "t5-flow": mountT5Flow,
  "t5-tasks": box => mountT5Flow(box, "t2t", 0, 4)
});
