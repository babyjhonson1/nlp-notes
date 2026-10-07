/* BGE: небольшие схемы для отдельных этапов. Помощники — mdl.js, common.js, vl.js.
   Прямой проход — числа model card; RetroMAE и самодистилляция — условные примеры. */

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
  let doc = "p1";
  const steps = ["вход", "кодировщик", "плотный выход", "лексический выход", "многовекторный выход", "сумма оценок"];
  const mix = (d) => (WMIX[0] * d.dense + WMIX[1] * d.lex + WMIX[2] * d.mul) / (WMIX[0] + WMIX[1] + WMIX[2]);
  const n2 = (x) => x < 0.01 ? mdlNum(x, 4) : mdlNum(x, 3);

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Три выхода BGE-M3: только прямой проход"></svg></div>
    <div class="fig-row">
      <span class="fig-seg bge-seg">документ<span class="fig-tabs" role="tablist" aria-label="Документ">
        <button type="button" role="tab" data-doc="p1" aria-selected="true">о BGE-M3</button>
        <button type="button" role="tab" data-doc="p2" aria-selected="false">о BM25</button>
      </span></span>
    </div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [mdlLegendArrow("vl-arr on"), "прямой проход"],
      ['<i class="mdl-key bge-shared"></i>', "токен есть в документе"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
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

  function draw(step){
    const W = cbFit(stage, 340, 680);
    const s = drawOut(step, W);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    say.innerHTML = explain(step);
  }

  function explain(step){
      const D = DOCS[doc], one = doc === "p1";
      return [
        `<b>Вход.</b> Запрос из model card BGE-M3 токенизатор SentencePiece делит на 9 токенов: <code>&lt;s&gt;</code>, What, is, B, GE, M, 3, ?, <code>&lt;/s&gt;</code>. Инструкции у запроса нет. Документ кодируется той же сетью; ${one ? "в описании BGE-M3 есть токены is, B, GE, M и 3 из запроса" : "в описании BM25 из токенов запроса есть только is: BM25 делится на BM и 25"}.`,
        "<b>XLM-R.</b> Кодировщик — XLM-RoBERTa-large, расширенный до 8192 позиций и предобученный RetroMAE. Все три выхода считаются из одной матрицы \\(H\\) выходов последнего слоя, поэтому достаточно одного прохода. Цвета ячеек условные.",
        `<b>Плотный вектор.</b> Берётся выход первого токена <code>&lt;s&gt;</code> (у XLM-R он играет роль <code>[CLS]</code>) и нормируется: \\(e=\\operatorname{norm}(H[0])\\). Оценка — косинус с вектором документа: \\(${n2(D.dense)}\\). Числа этого режима — из примера в model card.`,
        `<b>Лексические веса.</b> Каждый токен получает вес через линейную проекцию со смещением и ReLU; у <code>&lt;s&gt;</code> и <code>&lt;/s&gt;</code> вес обнулён. Веса запроса в model card: у GE и 3 около \\(0.25\\)–\\(0.27\\), у What и is — около \\(0.08\\). Оценка складывает произведения весов только по токенам, которые есть в обоих текстах: ${one ? "is, B, GE, M и 3 дают \\(0.196\\)" : "совпадает только is, и оценка всего \\(0.0088\\)"}.`,
        `<b>Векторы токенов.</b> Выходы всех токенов, кроме <code>&lt;s&gt;</code>, проецируются линейным слоем с матрицей \\(W_{\\text{mul}}\\) размером \\(1024\\times1024\\) и смещением, затем нормируются. Для каждого из 8 векторов запроса берётся лучший косинус с векторами документа, и максимумы усредняются: \\(${n2(D.mul)}\\). Это MaxSim ColBERT, делённый на длину запроса.`,
        `<b>Итоговая оценка.</b> Оценки складываются с весами из примера model card, \\((0.4,\\,0.2,\\,0.4)\\), и делятся на сумму весов: \\(${mdlNum(mix(D), 3)}\\). У разных оценок разная шкала: лексическая здесь ${one ? "втрое ниже плотной, хотя совпали почти все токены" : "почти нулевая"}. Поэтому веса подбирают на своих данных.`
      ][step];
  }

  const player = vlPlayer(box, { count: () => steps.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${steps[i]}`, interval: 2600 });
  box.querySelectorAll("[data-doc]").forEach((b) => b.addEventListener("click", () => {
    doc = b.dataset.doc;
    box.querySelectorAll("[data-doc]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.paint();
  }));
  player.paint();
  const unobserve = cbResize(stage, () => draw(player.i));
  return () => { player.stop(); unobserve(); };
}

/* Оболочка коротких проигрывателей: рисунок → управление → пояснение. */
function bgePlayer(box, label, steps, draw, explain, extra = ""){
  box.innerHTML = '<div class="fig-stage"><svg tabindex="0" role="img" aria-label="' + escapeHtml(label) + '"></svg></div>' +
    vlControls(extra) + '<p class="fig-say" aria-live="polite"></p><div class="fig-legend">' +
    legend([[mdlLegendArrow("vl-arr on"), "прямой проход"], [mdlLegendArrow("mdl-grad"), "градиент"],
      ['<i class="mdl-key teacher"></i>', "цель обучения"]]) + '</div>';
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const paint = i => {
    const frame = draw(i, cbFit(stage, 340, 680));
    svg.setAttribute("viewBox", "0 0 " + frame.width + " " + frame.height);
    svg.innerHTML = frame.svg;
    say.innerHTML = explain(i);
  };
  const player = vlPlayer(box, { count: () => steps.length, draw: paint,
    label: (i, n) => "шаг " + (i + 1) + " из " + n + ": " + steps[i], interval: 3000 });
  player.paint();
  const unobserve = cbResize(stage, () => paint(player.i));
  return { player, cleanup: () => { player.stop(); unobserve(); } };
}

function mountBgeRetroMae(box){
  const words = ["Без", "почты", "доступ", "восстанавливают", "через", "поддержку"];
  const encMasked = [2, 4], decMasked = [1, 3, 5];
  const visible = { 1: [0, 4, 5], 5: [0, 2, 3] };
  let target = 1;
  const row = (x, y, width, mask) => mdlTokChips(x, y,
    words.map((t, i) => ({ t: mask.includes(i) ? "[MASK]" : t, k: mask.includes(i) ? "hide" : "tok" })),
    width, { px: 11, h: 20 }).svg;
  const draw = (step, W) => {
    const c = W / 2;
    let s = "";
    if (step < 2){
      s += mdlLines(c, 20, ["Условный текст: слова показаны как токены"], "mdl-cap sm");
      s += row(c, 30, W - 40, []);
      const a = W / 4, b = W * 3 / 4, col = W / 2 - 24;
      s += mdlLines(a, 339, ["Вход кодировщика"], "mdl-cap sm");
      s += row(a, 349, col, encMasked);
      s += mdlTower(a, 242, col, 74, { label: "Кодировщик", layers: 2, layerNames: ["…", "…"], cls: "on" });
      s += mdlFwd(a, 335, a, 319, true);
      s += mdlBox(a, 211, col, 32, ["Вектор [CLS]", "из испорченного текста"], "on");
      s += mdlFwd(a, 240, a, 230, true);
      s += "<g" + mdlFade(step === 1) + ">";
      s += mdlLines(b, 339, ["Вход декодера"], "mdl-cap sm");
      s += row(b, 349, col, decMasked);
      s += mdlBox(b, 273, col, 56, ["Декодер", "один слой"], step === 1 ? "on" : "");
      s += mdlFwd(b, 335, b, 304, step === 1);
      s += mdlFwd(a + col / 2, 211, b, 241, step === 1);
      s += mdlBox(b, 143, col, 48, ["Восстановить", "позиции 2, 4, 6"], "teacher");
      s += mdlFwd(b, 243, b, 172, step === 1);
      s += "</g>";
      if (step === 1) s += mdlGrad(b - col / 2 + 5, 170, a + 20, 192);
      s += mdlLines(c, 465, [step ? "Скрытые позиции предсказываются параллельно" : "Маски двух входов выбираются независимо"], "mdl-cap sm");
      return { svg: s, width: W, height: 482 };
    }
    s += mdlBox(c, 36, W - 48, 40, ["Улучшенное декодирование", "Маска внимания, не строка [MASK]"], "on");
    s += mdlBox(c, 96, W - 80, 36, ["Вектор [CLS] + позиция " + (target + 1)], "on");
    s += mdlFwd(c, 117, c, 143, true);
    const toks = words.map((t, i) => ({ t, k: i === target ? "hide" : visible[target].includes(i) ? "on" : "sp" }));
    s += mdlTokChips(c, 151, toks, W - 40, { px: 11, h: 22 }).svg;
    s += mdlLines(c, 223, ["Выделены доступные токены; целевой закрыт"], "mdl-cap sm");
    s += mdlBox(c, 271, W - 80, 40, ["Распределение по словарю", "в позиции " + (target + 1)], "on");
    s += mdlFwd(c, 230, c, 247, true);
    s += mdlBox(c, 335, W - 80, 38, ["Правильный токен: «" + words[target] + "»"], "teacher");
    s += mdlGrad(c - (W - 80) / 2 - 8, 320, c - (W - 80) / 2 - 8, 114);
    s += mdlLines(c, 388, ["Все позиции параллельно; показана одна"], "mdl-cap sm");
    return { svg: s, width: W, height: 482 };
  };
  const explain = step => [
    "<b>Кодировщик.</b> Часть слов скрыта, но общий смысл ещё доступен. Берём только выход <code>[CLS]</code>. Из кодировщика к декодеру не передаются все токенные состояния.",
    "<b>Базовый декодер.</b> Другая маска скрыла «почты», «восстанавливают», «поддержку». Декодер предсказывает исходный токен в каждой из этих позиций за один проход. Видит разрешённый контекст с обеих сторон; уже предсказанные слова во вход не подставляются. Ошибка проходит через вектор в кодировщик.",
    "<b>Своя маска для каждой позиции.</b> Сейчас цель — «" + words[target] + "» в позиции \\(" + (target + 1) +
      "\\). Доступны <code>[CLS]</code>, позиция и токены «" + visible[target].map(i => words[i]).join("», «") +
      "». Сам целевой токен в прямом контексте закрыт. Переключатель показывает другую строку внимания того же прохода, а не следующий шаг авторегрессии."
  ][step];
  const ctl = bgePlayer(box, "RetroMAE: восстановление токенов без авторегрессии",
    ["вектор текста", "базовое восстановление", "маска для каждой позиции"], draw, explain,
    '<span class="fig-seg">Позиция на шаге 3 <button type="button" class="fig-btn" data-target="1" aria-pressed="true">2</button><button type="button" class="fig-btn" data-target="5" aria-pressed="false">6</button></span>');
  box.querySelectorAll("[data-target]").forEach(b => b.addEventListener("click", () => {
    target = Number(b.dataset.target);
    box.querySelectorAll("[data-target]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    ctl.player.stop(); ctl.player.go(2);
  }));
  return ctl.cleanup;
}

// Логиты условного примера из текста: температура уже учтена.
const BGE_KD_LOGITS = { dense: [2, 1, 0], lex: [1, 1.5, 0], mul: [2, 0.5, 0] };
function bgeSoftmax(z){
  const mx = Math.max(...z), e = z.map(x => Math.exp(x - mx)), total = e.reduce((a, b) => a + b, 0);
  return e.map(x => x / total);
}
function bgeDistillExample(){
  const z = BGE_KD_LOGITS;
  const ensemble = z.dense.map((v, i) => v + 0.3 * z.lex[i] + z.mul[i]);
  const teacher = bgeSoftmax(ensemble);
  const probs = Object.fromEntries(Object.entries(z).map(([k, v]) => [k, bgeSoftmax(v)]));
  return { ensemble, teacher, probs, gradient: probs.lex.map((p, i) => p - teacher[i]) };
}
function mountBgeDistill(box){
  const st = bgeDistillExample();
  const row = (W, y, title, values, cls = "") => {
    const width = W - 44, cell = width / 3;
    let s = mdlLines(W / 2, y, [title], "mdl-cap sm");
    values.forEach((v, i) => {
      const x = 22 + cell * (i + 0.5);
      s += mdlBox(x, y + 32, cell - 8, 35, [mdlNum(v, 3)], cls);
    });
    return s;
  };
  const draw = (step, W) => {
    let s = mdlLines(W / 2, 22, ["Один запрос, одни кандидаты для всех выходов"], "mdl-cap sm");
    const cell = (W - 44) / 3;
    ["1: поддержка (+)", "2: письмо (−)", "3: тарифы (−)"].forEach((label, i) => {
      s += mdlLines(22 + cell * (i + 0.5), 53, [label], "mdl-cap sm");
    });
    if (step === 0) {
      s += row(W, 90, "Плотный выход", st.probs.dense);
      s += row(W, 169, "Лексический выход — ошибается", st.probs.lex, "on");
      s += row(W, 248, "Многовекторный выход", st.probs.mul);
      return { svg: s, width: W, height: 402 };
    }
    s += row(W, 90, "Цель: softmax смеси, копия без градиента", st.teacher, "teacher");
    if (step === 1){
      s += mdlBox(W / 2, 214, W - 60, 54, ["Не отдельная сеть", "Цель вычислена из этого же прохода"], "teacher");
      s += mdlFwd(W / 2, 148, W / 2, 182, true);
    } else {
      s += row(W, 171, "Ученик: лексический выход", st.probs.lex, "on");
      s += row(W, 252, "Градиент: ученик минус цель", st.gradient, "grad");
      if (step === 3) {
        s += mdlBox(W / 2, 357, W - 52, 50, ["Обновить головы и кодировщик", "На следующем шаге пересчитать цель"], "grad");
        s += mdlGrad(W / 2, 303, W / 2, 329);
      }
    }
    return { svg: s, width: W, height: 402 };
  };
  const explain = step => [
    "<b>Разметка уже обучает выходы.</b> Кандидат 1 — позитив. Плотный и многовекторный выходы предпочитают его, а лексический — кандидата 2. Здесь показаны softmax по кандидатам, не сырые оценки и не распределения по словарю.",
    "<b>Собрать учителя.</b> Складываем логиты с весами \\((1,0.3,1)\\), получаем \\((4.3,1.95,0)\\). Их softmax копируем с <code>detach</code>. Цель на этом обратном проходе — константа, но её источник — текущая модель.",
    "<b>Ошибка ученика.</b> Для позитива \\(0.331-0.902\\approx-0.570\\): градиентный спуск повышает его логит. Для документа о письме \\(0.547-0.086\\approx0.461\\): логит нужно понизить. Это градиент одной KD-составляющей, до весов общей функции потерь.",
    "<b>Обновление.</b> Градиент проходит через оценку ученика к его голове и общему кодировщику. Добавляются потери остальных выходов и разметки. Цель этого шага не меняется при дифференцировании; на следующем прямом проходе все оценки и цель будут вычислены заново. Отдельной навсегда замороженной модели нет."
  ][step];
  return bgePlayer(box, "Один шаг самодистилляции BGE-M3",
    ["сравнить выходы", "зафиксировать цель", "ошибка ученика", "обновить параметры"], draw, explain).cleanup;
}

Object.assign(FIGURES, {
  "bge-flow": mountBgeFlow,
  "bge-retromae": mountBgeRetroMae,
  "bge-distill": mountBgeDistill
});
