/* Выборка языков на условном корпусе: 100, 10 и 1 тысяча предложений.
   Это арифметическая иллюстрация q ∝ n^alpha, не измерения CC-100. */

function mountXlmrSampling(box){
  const COUNTS = [100, 10, 1];
  const LANGS = [
    { key: "a", name: "язык A", n: 100 },
    { key: "b", name: "язык B", n: 10 },
    { key: "c", name: "язык C", n: 1, on: true }
  ];
  const TOTAL = COUNTS.reduce((a, b) => a + b, 0);
  const TICKS = [[0, "0%"], [25, "25%"], [50, "50%"], [75, "75%"], [100, "100%"]];
  let step = 6;                              // alpha = step / 20
  let alpha = step / 20;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Условные доли трёх языков в корпусе и при сглаженной выборке"></svg></div>
    <div class="fig-row">
      <label class="fig-range"><span>\\(\\alpha\\)</span><input type="range" min="0" max="20" step="1" value="6" data-range="alpha" aria-label="Параметр выборки языков"><output>0,3</output></label>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      ['<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" class="xlmr-p"/></svg>', "доля языка в корпусе"],
      ['<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" class="xlmr-q"/></svg>', "доля в обучении при выбранном \\(\\alpha\\)"]
    ])}</div>`;
  const stage = box.querySelector(".fig-stage"), svg = stage.querySelector("svg"), say = box.querySelector(".fig-say");
  const input = box.querySelector('[data-range="alpha"]');

  const fmtAlpha = () => fmtN(alpha, step % 2 ? 2 : 1);
  const fmtPct = (x) => x.toLocaleString("ru-RU", { maximumSignificantDigits: 2 });
  const fmtRatio = n => fmtN(n, 1);
  function shares(a){
    const z = COUNTS.reduce((s, n) => s + Math.pow(n / TOTAL, a), 0);
    return LANGS.map((l) => {
      const p = l.n / TOTAL, q = Math.pow(p, a) / z;
      return { ...l, p: 100 * p, q: 100 * q, ratio: q / p };
    });
  }

  function draw(){
    const W = cbFit(stage, 340, 680), narrow = W < 480;
    const LW = narrow ? 70 : 92, RW = narrow ? 50 : 76, RH = 34, top = 46;
    const x0 = LW + 10, x1 = W - RW - 14, H = top + LANGS.length * RH + 26;
    const xs = (pct) => x0 + pct / 100 * (x1 - x0);
    const rows = shares(alpha);
    let s = "";
    rows.forEach((r, i) => { if (r.on) s += `<rect x="2" y="${top + i * RH}" width="${W - 4}" height="${RH}" rx="6" class="xlmr-row"/>`; });
    for (const [v, t] of TICKS){
      const x = xs(v);
      s += `<line x1="${f1(x)}" y1="${top - 8}" x2="${f1(x)}" y2="${top + LANGS.length * RH}" class="xlmr-grid"/>`;
      s += `<text x="${f1(x)}" y="${top - 16}" class="xlmr-tick">${t}</text>`;
    }
    s += `<text x="${f1(W - 6)}" y="${top - 30}" class="xlmr-head" text-anchor="end">частота</text>`;
    s += `<text x="${f1(W - 6)}" y="${top - 16}" class="xlmr-head" text-anchor="end">к базе</text>`;
    rows.forEach((r, i) => {
      const y = top + i * RH + RH / 2, xp = xs(r.p), xq = xs(r.q);
      s += `<text x="${LW}" y="${y}" class="xlmr-lang${r.on ? " on" : ""}">${r.name}</text>`;
      if (Math.abs(xq - xp) > 16){
        const d = Math.sign(xq - xp);
        s += vlArrow(xp + d * 6, y, xq - d * 7, y, "xlmr-arr");
      }
      s += `<circle cx="${f1(xp)}" cy="${y}" r="5" class="xlmr-p"/>`;
      s += `<circle cx="${f1(xq)}" cy="${y}" r="5.5" class="xlmr-q"/>`;
      s += `<text x="${f1(W - 6)}" y="${y}" class="xlmr-n${r.ratio > 1.001 ? " warn" : ""}">${fmtRatio(r.ratio)}</text>`;
    });
    s += `<text x="${f1((x0 + x1) / 2)}" y="${H - 8}" class="xlmr-head" text-anchor="middle">доля языка, %</text>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = s;
    say.textContent = explain(rows);
  }

  function explain(rows){
    const [a, b, c] = rows;
    const label = alpha === 0 ? "Языки равновероятны, хотя объёмы различаются в сто раз."
      : alpha === 1 ? "Вероятности равны долям корпуса: каждое предложение используется с одинаковой частотой."
      : "Малые корпуса получают большую долю обновлений, чем при пропорциональной выборке.";
    return `При \\(\\alpha=${alpha.toFixed(2)}\\) доли A / B / C: ${fmtPct(a.q)}% / ${fmtPct(b.q)}% / ${fmtPct(c.q)}%. ${label} Отдельное предложение C используется в ${fmtRatio(c.ratio)} раза чаще, чем при \\(\\alpha=1\\), при том же числе выборок. Это условные данные, не доли языков CC-100.`;
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
