/* Иллюстрация раздела models/xlm-r: как параметр α выборки языков делит обучение между языками.
   Объёмы — число токенов (млн) из таблицы CC-100 в приложении статьи XLM-R. У украинского (6.5)
   и шведского (77.8) числа в таблице не сходятся с объёмом в ГиБ, они оценены по соседним языкам
   (по отношению токенов к ГиБ у русского и датского). Проходы — оценка: 6 трлн токенов обучения
   XLM-R large и 167 млрд токенов корпуса из статьи о XL и XXL. В статье выборка идёт по числу
   предложений, поэтому все доли приблизительные. */

function mountXlmrSampling(box){
  // все 100 языков CC-100, млн токенов
  const CC100 = [55608, 24757, 23408, 22704, 13259, 10354, 10297, 9780, 9374, 8494, 8405, 7823, 7807, 7123, 6730, 6490, 5644, 5487, 5025, 4983,
    4285, 3525, 3399, 3297, 2869, 2736, 2498, 2076, 1835, 1834, 1752, 1715, 1669, 1318, 1198, 918, 843, 843, 783, 730,
    595, 556, 530, 525, 505, 495, 476, 469, 449, 421, 390, 362, 313, 275, 270, 259, 249, 248, 243, 242,
    237, 176, 175, 169, 157, 141, 140, 96, 94, 91, 88, 86, 85, 77, 68, 68, 66, 62, 56, 56,
    50, 39, 36, 36, 36, 34, 29, 27, 25, 24, 21, 17, 17, 16, 15, 14, 13, 10, 8, 5];
  const LANGS = [
    { key: "en", name: "английский", n: 55608 },
    { key: "ru", name: "русский", n: 23408, on: true },
    { key: "de", name: "немецкий", n: 10297 },
    { key: "ur", name: "урду", n: 730 },
    { key: "kk", name: "казахский", n: 476 },
    { key: "sw", name: "суахили", n: 275 },
    { key: "as", name: "ассамский", n: 5 }
  ];
  const TOTAL = CC100.reduce((a, b) => a + b, 0);
  const PASSES = 6000 / 167;                 // средних проходов по корпусу у XLM-R large
  const LO = 1e-3, HI = 30;                  // шкала долей, %
  const TICKS = [[1e-3, "0,001%"], [1e-2, "0,01%"], [0.1, "0,1%"], [1, "1%"], [10, "10%"]];
  let step = 6;                              // alpha = step / 20
  let alpha = step / 20;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Доли языков в корпусе CC-100 и в обучении XLM-R при разных значениях параметра выборки"></svg></div>
    <div class="fig-row">
      <label class="fig-range"><span>\\(\\alpha\\)</span><input type="range" min="0" max="20" step="1" value="6" data-range="alpha" aria-label="Параметр выборки языков"><output>0,3</output></label>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      ['<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" class="xlmr-p"/></svg>', "доля языка в корпусе"],
      ['<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" class="xlmr-q"/></svg>', "доля в обучении при выбранном \\(\\alpha\\)"],
      ['<svg viewBox="0 0 22 14"><text x="11" y="7" class="xlmr-n warn" style="text-anchor:middle">100</text></svg>', "100 и больше проходов по данным языка"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const input = box.querySelector('[data-range="alpha"]');

  const fmtAlpha = () => fmtN(alpha, step % 2 ? 2 : 1);
  const fmtPct = (x) => x.toLocaleString("ru-RU", { maximumSignificantDigits: 2 });
  function fmtPasses(n){
    if (n < 10) return fmtN(n, 1);
    if (n < 100) return fmtN(n, 0);
    const k = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return fmtN(Math.round(n / k) * k, 0);
  }
  function shares(a){
    const z = CC100.reduce((s, n) => s + Math.pow(n / TOTAL, a), 0);
    return LANGS.map((l) => {
      const p = l.n / TOTAL, q = Math.pow(p, a) / z;
      return { ...l, p: 100 * p, q: 100 * q, passes: PASSES * q / p };
    });
  }

  function draw(){
    const W = cbFit(stage, 340, 680), narrow = W < 480;
    const LW = narrow ? 70 : 92, RW = narrow ? 50 : 76, RH = 34, top = 46;
    const x0 = LW + 10, x1 = W - RW - 14, H = top + LANGS.length * RH + 26;
    const xs = (pct) => x0 + (Math.log10(pct) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO)) * (x1 - x0);
    const rows = shares(alpha);
    let s = "";
    rows.forEach((r, i) => { if (r.on) s += `<rect x="2" y="${top + i * RH}" width="${W - 4}" height="${RH}" rx="6" class="xlmr-row"/>`; });
    for (const [v, t] of TICKS){
      const x = xs(v);
      s += `<line x1="${f1(x)}" y1="${top - 8}" x2="${f1(x)}" y2="${top + LANGS.length * RH}" class="xlmr-grid"/>`;
      s += `<text x="${f1(x)}" y="${top - 16}" class="xlmr-tick">${t}</text>`;
    }
    s += `<text x="${f1(W - 6)}" y="${top - 30}" class="xlmr-head" text-anchor="end">проходов</text>`;
    s += `<text x="${f1(W - 6)}" y="${top - 16}" class="xlmr-head" text-anchor="end">(оценка)</text>`;
    rows.forEach((r, i) => {
      const y = top + i * RH + RH / 2, xp = xs(r.p), xq = xs(r.q);
      s += `<text x="${LW}" y="${y}" class="xlmr-lang${r.on ? " on" : ""}">${r.name}</text>`;
      if (Math.abs(xq - xp) > 16){
        const d = Math.sign(xq - xp);
        s += vlArrow(xp + d * 6, y, xq - d * 7, y, "xlmr-arr");
      }
      s += `<circle cx="${f1(xp)}" cy="${y}" r="5" class="xlmr-p"/>`;
      s += `<circle cx="${f1(xq)}" cy="${y}" r="5.5" class="xlmr-q"/>`;
      s += `<text x="${f1(W - 6)}" y="${y}" class="xlmr-n${r.passes >= 100 ? " warn" : ""}">${fmtPasses(r.passes)}</text>`;
    });
    s += `<text x="${f1((x0 + x1) / 2)}" y="${H - 8}" class="xlmr-head" text-anchor="middle">доля языка, логарифмическая шкала</text>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    say.textContent = explain(rows);
  }

  function explain(rows){
    const L = Object.fromEntries(rows.map((r) => [r.key, r]));
    const a = fmtAlpha();
    if (step === 20) return `При \\(\\alpha=1\\) языки выбираются пропорционально объёму: доли в обучении равны долям в корпусе, и данные каждого языка модель проходит одинаково, примерно ${fmtN(PASSES, 0)} раз. На английский приходится ${fmtPct(L.en.q)}% обучения, на суахили — ${fmtPct(L.sw.q)}%.`;
    if (step === 0) return `При \\(\\alpha=0\\) все 100 языков выбираются одинаково часто, по 1%. Английский корпус модель пройдёт примерно ${fmtPasses(L.en.passes)} раза, а ассамский — около ${fmtPasses(L.as.passes)} раз: тексты малых языков повторяются тысячи раз, и растёт риск переобучиться на них.`;
    const note = step === 6 ? " Это значение выбрано для XLM-R, а позже для mT5."
      : step === 14 ? " С таким значением XLM выбирал язык батча при обучении."
      : step === 10 ? " С таким значением XLM выбирал предложения для построения словаря BPE." : "";
    return `При \\(\\alpha=${a.replace(",", ".")}\\) английский занимает ${fmtPct(L.en.q)}% обучения вместо ${fmtPct(L.en.p)}% в корпусе, русский — ${fmtPct(L.ru.q)}% вместо ${fmtPct(L.ru.p)}%, суахили — ${fmtPct(L.sw.q)}% вместо ${fmtPct(L.sw.p)}%. Проходов по данным языка за обучение: у английского — ${fmtPasses(L.en.passes)}, у русского — ${fmtPasses(L.ru.passes)}, у суахили — ${fmtPasses(L.sw.passes)}, у ассамского — ${fmtPasses(L.as.passes)}.${note}`;
  }

  input.addEventListener("input", () => {
    step = Number(input.value);
    alpha = step / 20;
    input.nextElementSibling.value = fmtAlpha();
    draw();
  });
  draw();
  return cbResize(stage, draw);
}

Object.assign(FIGURES, {
  "xlmr-sampling": mountXlmrSampling
});
