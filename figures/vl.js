/* Иллюстрации раздела multimodal/images. */

/* ---------- Мультимодальные LLM: общие помощники ---------- */
/* Строка управления пошаговой иллюстрацией: назад, пуск, вперёд, номер шага. */
function vlControls(extra = ""){
  return `
    <div class="fig-row">
      <button class="fig-btn icon" type="button" data-act="back" aria-label="Шаг назад" title="Шаг назад (←)">${ICON.prev}</button>
      <button class="fig-btn primary" type="button" data-act="play"></button>
      <button class="fig-btn icon" type="button" data-act="fwd" aria-label="Шаг вперёд" title="Шаг вперёд (→)">${ICON.next}</button>
      <span class="fig-status" aria-live="off"></span>
      <span class="spacer"></span>${extra}
    </div>`;
}
/* Проигрыватель шагов: кнопки, ползунок .fig-scrub (если есть), клавиши ← и →. */
function vlPlayer(box, opt){
  const st = { i: 0, timer: null };
  const back = box.querySelector('[data-act="back"]'), fwd = box.querySelector('[data-act="fwd"]');
  const play = box.querySelector('[data-act="play"]'), status = box.querySelector(".fig-status"), scrub = box.querySelector(".fig-scrub");
  const n = () => opt.count();
  function paint(){
    const N = n();
    st.i = Math.max(0, Math.min(N - 1, st.i));
    back.disabled = st.i === 0; fwd.disabled = st.i === N - 1;
    play.innerHTML = st.timer ? `${ICON.pause}Пауза` : `${ICON.play}${st.i === N - 1 ? "Сначала" : "Пуск"}`;
    if (status) status.textContent = opt.label ? opt.label(st.i, N) : `шаг ${st.i + 1} из ${N}`;
    if (scrub){ scrub.max = N - 1; scrub.value = st.i; }
    opt.draw(st.i);
  }
  function stop(){ if (st.timer){ clearInterval(st.timer); st.timer = null; } }
  function go(i){ st.i = i; paint(); }
  function toggle(){
    if (st.timer){ stop(); paint(); return; }
    if (st.i >= n() - 1) st.i = 0;
    st.timer = setInterval(() => { if (st.i >= n() - 1){ stop(); paint(); return; } st.i++; paint(); }, opt.interval || 1600);
    paint();
  }
  back.addEventListener("click", () => { stop(); go(st.i - 1); });
  fwd.addEventListener("click", () => { stop(); go(st.i + 1); });
  play.addEventListener("click", toggle);
  if (scrub) scrub.addEventListener("input", () => { stop(); go(+scrub.value); });
  box.addEventListener("keydown", (e) => {
    if (e.target.matches("input")) return;
    if (e.key === "ArrowRight"){ e.preventDefault(); stop(); go(st.i + 1); }
    if (e.key === "ArrowLeft"){ e.preventDefault(); stop(); go(st.i - 1); }
  });
  return { go, stop, paint, get i(){ return st.i; } };
}
const vlRgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
/* значение в [-1, 1] → заливка ячейки: тёплый цвет для плюса, синий для минуса */
const vlVal = (v) => {
  const a = Math.min(1, Math.abs(v));
  return `fill:${v >= 0 ? "var(--vl-pos)" : "var(--vl-neg)"};fill-opacity:${f1(0.12 + 0.88 * a)}`;
};
const vlArrow = (x1, y1, x2, y2, cls = "vl-arr") => {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
  const p1 = [x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45)], p2 = [x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45)];
  return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2 - 2 * Math.cos(a))}" y2="${f1(y2 - 2 * Math.sin(a))}" class="${cls}"/><path d="M${f1(x2)} ${f1(y2)} L${f1(p1[0])} ${f1(p1[1])} L${f1(p2[0])} ${f1(p2[1])}Z" class="${cls} vl-head"/>`;
};

/* Картинка 24 × 24 для иллюстраций: небо, солнце, холм, домик, дерево. */
const VL_IMG = (() => {
  const S = 24, px = [];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
    let c = mix([96, 150, 210], [176, 206, 236], y / 15);
    if (Math.hypot(x - 18.5, y - 5) < 3.3) c = [246, 196, 70];
    const hill = 16.5 + 1.6 * Math.sin(x / 4.2 + 0.8);
    if (y >= hill) c = mix([118, 168, 86], [66, 116, 58], (y - hill) / 7);
    if (Math.hypot(x - 17.5, y - 13.2) < 2.8) c = [50, 110, 62];
    if (x >= 17 && x <= 18 && y >= 16 && y <= 20) c = [112, 78, 52];
    if (x >= 4 && x <= 10 && y >= 14 && y <= 20) c = [204, 98, 72];
    if (y >= 9 && y <= 13 && Math.abs(x - 7) <= (y - 9) * 1.1 + 0.6) c = [128, 64, 56];
    if (x >= 6 && x <= 7 && y >= 15 && y <= 16) c = [250, 226, 140];
    if (x === 9 && y >= 17 && y <= 20) c = [96, 58, 44];
    px.push(c);
  }
  return { S, px };
})();
/* нарисовать картинку VL_IMG (или её фрагмент) в прямоугольник */
function vlPixels(x, y, size, x0 = 0, y0 = 0, n = VL_IMG.S){
  const c = size / n; let s = "";
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){
    s += `<rect x="${f1(x + i * c)}" y="${f1(y + j * c)}" width="${f1(c + 0.35)}" height="${f1(c + 0.35)}" fill="${vlRgb(VL_IMG.px[(y0 + j) * VL_IMG.S + x0 + i])}"/>`;
  }
  return s;
}

/* ---------- ViT: от пикселей к визуальным токенам ---------- */
function mountVlPatch(box){
  const { S, px } = VL_IMG, P = 6, G = S / P, N = G * G, D = 8, LEN = P * P * 3;
  const R = rng(5);
  const E = Array.from({ length: LEN }, () => Array.from({ length: D }, () => gauss(R)));
  const POS = Array.from({ length: N + 1 }, () => Array.from({ length: D }, () => 0.45 * gauss(R)));
  const CLS = Array.from({ length: D }, () => 0.6 * gauss(R));
  const patchPx = (k) => { const r = Math.floor(k / G), c = k % G, out = []; for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) out.push(px[(r * P + y) * S + c * P + x]); return out; };
  const flat = (k) => patchPx(k).flatMap((c) => c.map((v) => v / 255 - 0.5));
  const EMB = Array.from({ length: N }, (_, k) => { const x = flat(k); return Array.from({ length: D }, (_, d) => Math.tanh(x.reduce((a, v, i) => a + v * E[i][d], 0) / Math.sqrt(LEN) * 3)); });
  const MEAN = Array.from({ length: N }, (_, k) => { const p = patchPx(k); return [0, 1, 2].map((ch) => p.reduce((a, c) => a + c[ch], 0) / p.length); });
  const gd = (a, b) => Math.hypot(Math.floor(a / G) - Math.floor(b / G), a % G - b % G);
  // Условные веса внимания: по сходству среднего цвета и близости патчей (у настоящей модели они выучены).
  const ATT = MEAN.map((m, k) => {
    const w = MEAN.map((m2, j) => Math.exp(-(Math.hypot(m[0] - m2[0], m[1] - m2[1], m[2] - m2[2]) ** 2) / 1800 - 0.35 * gd(k, j)));
    const z = w.reduce((a, b) => a + b, 0); return w.map((v) => v / z);
  });
  const Z0 = [CLS.map((v, d) => v + POS[0][d]), ...EMB.map((e, k) => e.map((v, d) => v + POS[k + 1][d]))];
  const OUT = EMB.map((e, k) => e.map((_, d) => Math.tanh(0.6 * Z0[k + 1][d] + 1.2 * ATT[k].reduce((a, w, j) => a + w * Z0[j + 1][d], 0))));
  const NAMES = ["Картинка", "Патчи", "Патч → вектор", "Проекция", "Последовательность", "Позиции", "Self-attention", "Выход энкодера"];
  let sel = 3;

  box.innerHTML = `
    <div class="fig-stage"><svg tabindex="0" role="img" aria-label="Как ViT превращает картинку в последовательность токенов"></svg></div>
    ${vlControls()}
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Номер шага"></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [`<svg viewBox="0 0 22 14"><rect x="3" y="1.5" width="16" height="11" rx="2" class="vl-sel"/></svg>`, "выбранный патч — нажмите на другой"],
      [cbSwatch("", "fill:var(--vl-pos)"), "положительная координата"],
      [cbSwatch("", "fill:var(--vl-neg)"), "отрицательная"]
    ])}</div>`;
  const svg = box.querySelector(".fig-stage svg"), say = box.querySelector(".fig-say");

  function exploded(x, y, size, gap){
    const ps = (size - gap * (G - 1)) / G; let s = "";
    for (let k = 0; k < N; k++){
      const r = Math.floor(k / G), c = k % G, X = x + c * (ps + gap), Y = y + r * (ps + gap);
      s += `<g data-k="${k}" class="clickable">${vlPixels(X, Y, ps, c * P, r * P, P)}</g>`;
      s += `<text x="${f1(X + 3)}" y="${f1(Y + 9)}" class="vl-num-on">${k + 1}</text>`;
      if (k === sel) s += `<rect x="${f1(X - 1.5)}" y="${f1(Y - 1.5)}" width="${f1(ps + 3)}" height="${f1(ps + 3)}" rx="2" class="vl-sel"/>`;
    }
    return s;
  }
  function vecCells(v, x, y, w, h, vertical = false, labels = false){
    let s = "";
    v.forEach((val, d) => {
      const X = vertical ? x : x + d * w, Y = vertical ? y + d * h : y;
      s += `<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(w - 1.5)}" height="${f1(h - 1.5)}" rx="2" style="${vlVal(val)}" class="vl-cellb"/>`;
      if (labels) s += `<text x="${f1(X + (w - 1.5) / 2)}" y="${f1(Y + (h - 1.5) / 2)}" class="vl-cellt">${fmtN(val, 1)}</text>`;
    });
    return s;
  }
  function matrix(M, x, y, cw, ch, title, dimRow = -1){
    let s = `<text x="${f1(x)}" y="${f1(y - 7)}" class="vl-cap">${title}</text>`;
    M.forEach((row, r) => row.forEach((v, d) => {
      s += `<rect x="${f1(x + d * cw)}" y="${f1(y + r * ch)}" width="${f1(cw - 1)}" height="${f1(ch - 1)}" style="${vlVal(v)}"${r === dimRow ? ' opacity="0.25"' : ""}/>`;
    }));
    return s;
  }

  function draw(step){
    const VW = cbFit(svg, 340, 640), wide = VW >= 520;
    const IS = wide ? 216 : 132, IY = 20, cell = IS / S;
    const PX = IS + (wide ? 32 : 16), PW = VW - PX, PH = IS;
    const k = sel, kr = Math.floor(k / G), kc = k % G;
    let s = `<text x="0" y="8" class="vl-cap">картинка 24 × 24 × 3</text>`;
    // картинка
    s += `<g class="${step >= 1 ? "clickable" : ""}">`;
    for (let q = 0; q < N; q++){ const r = Math.floor(q / G), c = q % G; s += `<g data-k="${q}">${vlPixels(c * P * cell, IY + r * P * cell, P * cell, c * P, r * P, P)}</g>`; }
    s += `</g>`;
    if (step === 6){
      const mx = Math.max(...ATT[k]);
      for (let q = 0; q < N; q++){ const r = Math.floor(q / G), c = q % G; s += `<rect x="${f1(c * P * cell)}" y="${f1(IY + r * P * cell)}" width="${f1(P * cell)}" height="${f1(P * cell)}" class="vl-dim" style="fill-opacity:${f1(0.72 * (1 - Math.sqrt(ATT[k][q] / mx)))}" pointer-events="none"/>`; }
    }
    if (step >= 1){
      for (let i = 1; i < G; i++){
        s += `<line x1="${f1(i * P * cell)}" y1="${IY}" x2="${f1(i * P * cell)}" y2="${IY + IS}" class="vl-grid"/>`;
        s += `<line x1="0" y1="${f1(IY + i * P * cell)}" x2="${IS}" y2="${f1(IY + i * P * cell)}" class="vl-grid"/>`;
      }
      if (step === 1) for (let q = 0; q < N; q++){ const r = Math.floor(q / G), c = q % G; s += `<text x="${f1(c * P * cell + 4)}" y="${f1(IY + r * P * cell + 11)}" class="vl-num-on" pointer-events="none">${q + 1}</text>`; }
      if (step >= 2) s += `<rect x="${f1(kc * P * cell)}" y="${f1(IY + kr * P * cell)}" width="${f1(P * cell)}" height="${f1(P * cell)}" class="vl-sel" pointer-events="none"/>`;
    }
    s += `<rect x="0" y="${IY}" width="${IS}" height="${IS}" class="frame" pointer-events="none"/>`;

    // панель справа
    if (step === 0){
      const cs = Math.min(PW - 40, IS - 40), off = 18;
      ["R", "G", "B"].forEach((ch, ci) => {
        const X = PX + (2 - ci) * off, Y = IY + (2 - ci) * off;
        let g = ""; const c = cs / S;
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const v = px[j * S + i][ci]; g += `<rect x="${f1(X + i * c)}" y="${f1(Y + j * c)}" width="${f1(c + 0.35)}" height="${f1(c + 0.35)}" fill="rgb(${ci === 0 ? v : 0},${ci === 1 ? v : 0},${ci === 2 ? v : 0})"/>`; }
        s += `<g>${g}<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(cs)}" height="${f1(cs)}" class="frame"/></g>`;
        s += `<text x="${f1(X + cs + 6)}" y="${f1(Y + 10)}" class="vl-cap">${ch}</text>`;
      });
      s += `<text x="${PX}" y="8" class="vl-cap">три канала: <tspan class="vl-cap-b">C = 3</tspan></text>`;
    } else if (step === 1){
      s += `<text x="${PX}" y="8" class="vl-cap">16 патчей по 6 × 6 пикселей</text>`;
      s += exploded(PX, IY, Math.min(PW, IS), wide ? 8 : 5);
    } else if (step === 2){
      const big = Math.min(wide ? 96 : 78, PW * 0.5), bc = big / P;
      s += `<text x="${PX}" y="8" class="vl-cap">патч ${k + 1}: 6 × 6 × 3</text>`;
      s += vlPixels(PX, IY, big, kc * P, kr * P, P);
      for (let i = 1; i < P; i++){ s += `<line x1="${f1(PX + i * bc)}" y1="${IY}" x2="${f1(PX + i * bc)}" y2="${f1(IY + big)}" class="vl-pxgrid"/><line x1="${PX}" y1="${f1(IY + i * bc)}" x2="${f1(PX + big)}" y2="${f1(IY + i * bc)}" class="vl-pxgrid"/>`; }
      s += `<rect x="${PX}" y="${IY}" width="${f1(big)}" height="${f1(big)}" class="vl-sel"/>`;
      // вытянутый вектор: 36 пикселей × 3 канала, строками по 6 пикселей
      const per = 12, cw = Math.min(16, (PW - 4) / per), Y0 = IY + big + 34, rows = Math.ceil(36 / per);
      s += vlArrow(PX + big / 2, IY + big + 6, PX + big / 2, Y0 - 6);
      s += `<text x="${f1(PX + big / 2 + 10)}" y="${f1(IY + big + 18)}" class="vl-cap">вытянуть построчно</text>`;
      const pp = patchPx(k);
      pp.forEach((c, i) => {
        const r = Math.floor(i / per), X = PX + (i % per) * cw, Y = Y0 + r * (cw * 1.15 + 3), w = cw - 1.5, h = cw * 1.15;
        [0, 1, 2].forEach((ch) => { s += `<rect x="${f1(X + ch * w / 3)}" y="${f1(Y + h * (1 - c[ch] / 255))}" width="${f1(w / 3)}" height="${f1(h * c[ch] / 255)}" fill="${["#D0453A", "#3E9A4A", "#3A6FD0"][ch]}"/>`; });
        s += `<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(w)}" height="${f1(h)}" class="vl-pxbox"/>`;
      });
      s += `<text x="${PX}" y="${f1(Y0 + rows * (cw * 1.15 + 3) + 12)}" class="vl-cap">x<tspan class="vl-sub" dy="3">${k + 1}</tspan><tspan dy="-3"> — 108 чисел: R, G, B каждого пикселя</tspan></text>`;
    } else if (step === 3){
      const OUTW = 40, mw = PW - OUTW - 14, colw = mw / LEN, rh = Math.min(13, (PH - 64) / D);
      const x = flat(k), Y0 = IY + 8, YE = Y0 + 26;
      s += `<text x="${PX}" y="8" class="vl-cap">x<tspan class="vl-sub" dy="3">${k + 1}</tspan><tspan dy="-3"> (108 чисел)</tspan></text>`;
      x.forEach((v, i) => { const ch = i % 3; s += `<rect x="${f1(PX + i * colw)}" y="${Y0}" width="${f1(colw + 0.3)}" height="14" fill="${["#D0453A", "#3E9A4A", "#3A6FD0"][ch]}" fill-opacity="${f1(v + 0.5)}"/>`; });
      s += `<rect x="${PX}" y="${Y0}" width="${f1(mw)}" height="14" class="vl-pxbox"/>`;
      s += `<text x="${PX}" y="${f1(YE - 3)}" class="vl-cap">Eᵀ: каждая строка — одна координата результата</text>`;
      for (let d = 0; d < D; d++){
        for (let i = 0; i < LEN; i++) s += `<rect x="${f1(PX + i * colw)}" y="${f1(YE + 4 + d * rh)}" width="${f1(colw + 0.3)}" height="${f1(rh - 1.5)}" style="${vlVal(E[i][d] / 2.2)}"/>`;
        s += `<text x="${f1(PX + mw + 4)}" y="${f1(YE + 4 + d * rh + rh / 2)}" class="vl-cap" dominant-baseline="central" style="font-size:10px">·</text>`;
      }
      s += vecCells(EMB[k], PX + mw + 12, YE + 4, OUTW, rh, true, rh >= 12);
      s += `<text x="${f1(PX + mw + 12)}" y="${f1(YE + 4 + D * rh + 13)}" class="vl-cap">e<tspan class="vl-sub" dy="3">${k + 1}</tspan></text>`;
    } else if (step === 4 || step === 5){
      const rows = N + 1, ch = Math.min(12, (PH - 8) / rows);
      const mats = step === 4 ? [[[CLS, ...EMB], "z₀ = [x_cls; e₁ … e₁₆]"]] : [[[CLS, ...EMB], "e"], [POS, "+ E<tspan class=\"vl-sub\" dy=\"3\">pos</tspan>"], [Z0, "= z₀"]];
      const gap = 14, mw = Math.min(step === 4 ? 150 : 72, (PW - gap * (mats.length - 1)) / mats.length), cw = mw / D;
      mats.forEach(([M, t], i) => {
        const X = PX + i * (mw + gap);
        s += matrix(M, X, IY + 8, cw, ch, t);
        s += `<rect x="${f1(X - 1)}" y="${f1(IY + 8 + (k + 1) * ch - 1)}" width="${f1(mw + 1)}" height="${f1(ch + 1)}" class="vl-sel" style="stroke-width:1.4"/>`;
      });
      if (step === 4) s += `<text x="${f1(PX + mw + 8)}" y="${f1(IY + 8 + ch / 2)}" class="vl-cap" dominant-baseline="central">← CLS</text><text x="${f1(PX + mw + 8)}" y="${f1(IY + 8 + (k + 1.5) * ch)}" class="vl-cap" dominant-baseline="central">← e${subN(k + 1)}</text>`;
    } else if (step === 6){
      const gs = Math.min(PW - 10, IS - 20) , c = gs / G;
      s += `<text x="${PX}" y="8" class="vl-cap">веса внимания патча ${k + 1}, %</text>`;
      const mx = Math.max(...ATT[k]);
      for (let q = 0; q < N; q++){
        const r = Math.floor(q / G), cc = q % G, X = PX + cc * c, Y = IY + r * c;
        s += `<rect x="${f1(X)}" y="${f1(Y)}" width="${f1(c - 2)}" height="${f1(c - 2)}" rx="3" class="vl-att" style="fill-opacity:${f1(0.08 + 0.92 * ATT[k][q] / mx)}" data-k="${q}"/>`;
        s += `<text x="${f1(X + c / 2 - 1)}" y="${f1(Y + c / 2 - 1)}" class="vl-cellt${ATT[k][q] / mx > 0.55 ? " on" : ""}" pointer-events="none">${Math.round(ATT[k][q] * 100)}</text>`;
        if (q === k) s += `<rect x="${f1(X - 1)}" y="${f1(Y - 1)}" width="${f1(c)}" height="${f1(c)}" rx="3" class="vl-sel" pointer-events="none"/>`;
      }
    } else if (step === 7){
      const ch = Math.min(12, (PH - 8) / (N + 1)), cw = Math.min(150, PW - 60) / D;
      s += matrix([CLS.map((v) => Math.tanh(v)), ...OUT], PX, IY + 8, cw, ch, "z<tspan class=\"vl-sub\" dy=\"3\">L</tspan><tspan dy=\"-3\">: выход последнего слоя</tspan>", 0);
      s += `<text x="${f1(PX + cw * D + 8)}" y="${f1(IY + 8 + ch / 2)}" class="vl-cap" dominant-baseline="central">CLS: в VLM не нужен</text>`;
      s += `<path d="M${f1(PX + cw * D + 6)} ${f1(IY + 8 + ch + 1)} h6 V${f1(IY + 8 + (N + 1) * ch - 2)} h-6" class="cb-brace"/>`;
      s += `<text x="${f1(PX + cw * D + 18)}" y="${f1(IY + 8 + ch * (N + 2) / 2)}" class="vl-cap" dominant-baseline="central">16 визуальных</text><text x="${f1(PX + cw * D + 18)}" y="${f1(IY + 8 + ch * (N + 2) / 2 + 14)}" class="vl-cap" dominant-baseline="central">токенов</text>`;
    }

    // последовательность внизу
    const SY = IY + IS + 30, ARC = 44, n = N + 1, gap = 3, tw = Math.min(30, (VW - 4 - gap * (n - 1)) / n), TY = SY + 4, AY = TY + tw + 17;
    const TX = (i) => i * (tw + gap);
    s += `<text x="0" y="${SY - 4}" class="vl-cap">${step < 4 ? "последовательность токенов появится на шаге 5" : step === 7 ? "выход энкодера: вектор на каждый токен" : step === 6 ? "self-attention: патч " + (k + 1) + " смотрит на все токены" : "вход трансформера: CLS + 16 патчей"}</text>`;
    for (let i = 0; i < n; i++){
      const X = TX(i), q = i - 1;
      if (step < 4){ s += `<rect x="${f1(X)}" y="${TY}" width="${f1(tw)}" height="${f1(tw)}" rx="3" class="ghost"/>`; continue; }
      if (step === 6 && q !== k){
        const w = q < 0 ? 0.02 : ATT[k][q], x1 = TX(k + 1) + tw / 2, x2 = X + tw / 2, h = Math.min(ARC - 6, 8 + Math.abs(x2 - x1) * 0.16);
        s += `<path d="M${f1(x1)} ${f1(AY)} Q${f1((x1 + x2) / 2)} ${f1(AY + 2 * h)} ${f1(x2)} ${f1(AY)}" class="vl-arc" style="stroke-width:${f1(0.4 + 9 * w)};stroke-opacity:${f1(0.25 + 0.75 * Math.min(1, w * 4))}"/>`;
      }
      if (step === 7){
        const v = i === 0 ? CLS.map((x) => Math.tanh(x)) : OUT[q], ch = tw / D;
        v.forEach((val, d) => { s += `<rect x="${f1(X)}" y="${f1(TY + d * ch)}" width="${f1(tw)}" height="${f1(ch + 0.3)}" style="${vlVal(val)}"${i === 0 ? ' opacity="0.25"' : ""}/>`; });
        s += `<rect x="${f1(X)}" y="${TY}" width="${f1(tw)}" height="${f1(tw)}" class="vl-pxbox" data-k="${q}"/>`;
      } else if (i === 0){
        s += `<rect x="${f1(X)}" y="${TY}" width="${f1(tw)}" height="${f1(tw)}" rx="3" class="vl-cls"/><text x="${f1(X + tw / 2)}" y="${f1(TY + tw / 2)}" class="vl-cellt" style="font-size:${tw < 24 ? 7.5 : 9}px">CLS</text>`;
      } else {
        const r = Math.floor(q / G), c = q % G;
        s += `<g data-k="${q}" class="clickable">${vlPixels(X, TY, tw, c * P, r * P, P)}</g>`;
      }
      if (step >= 4 && q === k) s += `<rect x="${f1(X - 1.5)}" y="${f1(TY - 1.5)}" width="${f1(tw + 3)}" height="${f1(tw + 3)}" rx="3" class="vl-sel" pointer-events="none"/>`;
      if (step >= 4) s += `<text x="${f1(X + tw / 2)}" y="${f1(TY + tw + 11)}" class="cb-num">${step === 5 ? "p" + subN(i) : i}</text>`;
    }
    svg.setAttribute("viewBox", `0 0 ${VW} ${f1(AY + ARC - 6)}`);
    svg.innerHTML = s;

    const top = ATT[k].map((w, j) => [w, j]).filter(([, j]) => j !== k).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, j]) => j + 1);
    const T = [
      `<b>Картинка — тензор \\(H \\times W \\times C\\).</b> Здесь 24 × 24 пикселя и 3 канала: 1728 чисел. У настоящих энкодеров вход 224 × 224 × 3 или 336 × 336 × 3, то есть 150–340 тысяч чисел. Для трансформера это сплошной массив, а не последовательность, — сначала его нужно разрезать на «слова».`,
      `<b>Режем на патчи \\(P \\times P\\).</b> При \\(P = 6\\) получается сетка 4 × 4: \\(N = (24/6) \\cdot (24/6) = 16\\) патчей. Нумеруем построчно — это и будет порядок токенов. У ViT-L/14 на 336 px патч 14 × 14 и \\(N = 24 \\cdot 24 = 576\\). Нажмите на любой патч, чтобы следить за ним дальше.`,
      `<b>Патч ${k + 1} вытягивается в вектор.</b> 6 · 6 пикселей · 3 канала = 108 чисел: \\(x_{${k + 1}} \\in \\mathbb{R}^{108}\\). Порядок фиксирован: строка за строкой, в каждом пикселе R, G, B. У ViT-L/14 такой вектор имеет длину 14 · 14 · 3 = 588.`,
      `<b>Линейная проекция.</b> \\(e_{${k + 1}} = x_{${k + 1}} E\\), где \\(E \\in \\mathbb{R}^{108 \\times D}\\) — одна обучаемая матрица на все патчи. Каждая координата \\(e_{${k + 1}}\\) — скалярное произведение \\(x_{${k + 1}}\\) со своей строкой \\(E^{\\mathsf{T}}\\). Здесь \\(D = 8\\), у ViT-L — 1024. В коде это <code>Conv2d(3, D, kernel_size=P, stride=P)</code>: свёртка с шагом, равным ядру, умножает каждый патч на одну и ту же матрицу.`,
      `<b>Патчи становятся последовательностью.</b> К 16 векторам добавляется обучаемый токен CLS: \\(z_0 \\in \\mathbb{R}^{17 \\times 8}\\). Это вход трансформера — точно так же, как эмбеддинги слов. Словаря нет: эмбеддинг вычисляется из пикселей, и токенов столько, сколько патчей, что бы ни было на картинке.`,
      `<b>Позиционные эмбеддинги.</b> К каждой строке прибавляется своя строка обучаемой таблицы \\(E_{\\text{pos}} \\in \\mathbb{R}^{17 \\times 8}\\). Без неё self-attention не различает порядок: картинка была бы «мешком патчей», и перестановка патчей не меняла бы результат. Таблица привязана к сетке 4 × 4; для другого разрешения её приходится интерполировать.`,
      `<b>Self-attention: каждый патч смотрит на все.</b> Маска в энкодере не каузальная, и патч ${k + 1} собирает информацию со всей картинки с весами \\(\\alpha = \\operatorname{softmax}\\bigl(q k^{\\mathsf{T}} / \\sqrt{D}\\bigr)\\). Больше всего он берёт у патчей ${joinRu(top.map(String))}. Здесь веса для наглядности посчитаны по сходству цвета и расстоянию; настоящая модель их выучивает, и разные головы смотрят на разное. У ViT-L таких слоёв 24.`,
      `<b>Выход энкодера — визуальные токены.</b> После всех слоёв у каждого патча вектор \\(z_L\\), описывающий свой участок с учётом всей картинки. Классификатор взял бы только CLS, а VLM берёт все 16 векторов патчей (у ViT-L/14 на 336 px это матрица 576 × 1024) и передаёт их проектору.`
    ];
    say.innerHTML = T[step];
  }
  const player = vlPlayer(box, { count: () => NAMES.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${NAMES[i]}` });
  svg.addEventListener("click", (e) => {
    const g = e.target.closest("[data-k]");
    if (!g || player.i < 1) return;
    const q = +g.dataset.k; if (q < 0 || q >= N) return;
    sel = q; if (player.i === 1) player.go(2); else player.paint();
  });
  player.paint();
  const off = cbResize(svg, () => player.paint());
  return () => { player.stop(); off(); };
}

/* ---------- CLIP и SigLIP: контрастивное обучение на игрушечном батче ---------- */
function mountVlClip(box){
  const B = 4, T = 40, TAU = 0.25, ST = 10, SB = -5;
  const PAIRS = [
    { img: "🐱", txt: "кошка на диване", w: "кошка", g: "var(--g1)" },
    { img: "🚗", txt: "машина у дома", w: "машина", g: "var(--g2)" },
    { img: "🍕", txt: "пицца с грибами", w: "пицца", g: "var(--g3)" },
    { img: "🌲", txt: "ёлка в снегу", w: "ёлка", g: "var(--g4)" }
  ];
  const SEEDS = [17, 52, 129, 34, 175, 74, 156, 78];
  let mode = "clip", seedIdx = 0, traj = null;
  const sg = (x) => 1 / (1 + Math.exp(-x));
  function evalAt(th, ph){
    const s = th.map((a) => ph.map((b) => Math.cos(a - b)));
    const G = s.map((r) => r.map(() => 0));
    let L = 0, P;
    if (mode === "clip"){
      const soft = (v) => { const m = Math.max(...v), e = v.map((x) => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
      P = s.map((r) => soft(r.map((v) => v / TAU)));
      const Q = [0, 1, 2, 3].map((j) => soft(s.map((r) => r[j] / TAU))); // Q[j][i]: подпись j выбирает картинку i
      for (let i = 0; i < B; i++) L += -Math.log(P[i][i]) - Math.log(Q[i][i]);
      L /= 2 * B;
      for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) G[i][j] = ((P[i][j] - (i === j)) + (Q[j][i] - (i === j))) / (2 * B) / TAU;
    } else {
      P = s.map((r) => r.map((v) => sg(ST * v + SB)));
      for (let i = 0; i < B; i++) for (let j = 0; j < B; j++){
        const z = i === j ? 1 : -1;
        L += -Math.log(sg(z * (ST * s[i][j] + SB)));
        G[i][j] = -z * ST * sg(-z * (ST * s[i][j] + SB)) / B;
      }
      L /= B;
    }
    const gth = th.map((a, i) => ph.reduce((acc, b, j) => acc - G[i][j] * Math.sin(a - b), 0));
    const gph = ph.map((b, j) => th.reduce((acc, a, i) => acc + G[i][j] * Math.sin(a - b), 0));
    return { s, P, L, G, gth, gph };
  }
  function simulate(){
    const R = rng(SEEDS[seedIdx]), lr = mode === "clip" ? 0.06 : 0.02;
    let th = [0, 1, 2, 3].map(() => R() * 2 * Math.PI), ph = [0, 1, 2, 3].map(() => R() * 2 * Math.PI);
    traj = [];
    for (let t = 0; t <= T; t++){
      const ev = evalAt(th, ph);
      traj.push({ th: th.slice(), ph: ph.slice(), ...ev });
      th = th.map((a, i) => a - lr * ev.gth[i]); ph = ph.map((b, j) => b - lr * ev.gph[j]);
    }
  }

  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Функция потерь">
        <button type="button" role="tab" data-mode="clip" aria-selected="true">CLIP: softmax</button>
        <button type="button" role="tab" data-mode="siglip" aria-selected="false">SigLIP: sigmoid</button>
      </div>
      <span class="spacer"></span>
      <button class="fig-btn" type="button" data-act="seed">${ICON.dice} Другая инициализация</button>
    </div>
    <div class="fig-stage" style="margin-top:12px"><svg tabindex="0" role="img" aria-label="Эмбеддинги картинок и подписей и матрица сходства"></svg></div>
    ${vlControls()}
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Шаг обучения"></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [`<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="5.5" class="vl-ci" style="--gc:var(--g1)"/></svg>`, "эмбеддинг картинки"],
      [`<svg viewBox="0 0 22 14"><path d="M11 1.5 16.5 7 11 12.5 5.5 7z" style="fill:var(--g1)"/></svg>`, "эмбеддинг подписи"],
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="16" y2="7" class="vl-grad"/><path d="M15 3.5 21 7 15 10.5z" class="vl-grad vl-head"/></svg>`, "куда сдвинет следующий шаг"],
      [`<svg viewBox="0 0 22 14"><rect x="4" y="1.5" width="14" height="11" rx="2" class="vl-diag"/></svg>`, "правильная пара"]
    ])}</div>`;
  const svg = box.querySelector(".fig-stage svg"), say = box.querySelector(".fig-say");

  function draw(t){
    const st = traj[t], VW = cbFit(svg, 340, 640), wide = VW >= 540;
    const CR = wide ? 98 : Math.min(100, VW / 2 - 84), CX = wide ? CR + 62 : VW / 2, CY = CR + 34;
    const MX = wide ? CX + CR + 96 : 46, MY = wide ? 44 : CY + CR + 64;
    const cell = wide ? Math.min(56, (VW - MX - 4) / B) : Math.min(62, (VW - MX - 4) / B);
    const pt = (a, r = CR) => [CX + r * Math.cos(a), CY - r * Math.sin(a)];
    let s = `<circle cx="${f1(CX)}" cy="${f1(CY)}" r="${CR}" class="vl-circle"/>`;
    s += `<text x="${f1(CX)}" y="12" class="vl-cap" text-anchor="middle">общее пространство (единичная окружность)</text>`;
    // линии правильных пар
    PAIRS.forEach((p, i) => { const a = pt(st.th[i]), b = pt(st.ph[i]); s += `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" class="vl-pairline" style="stroke:${p.g}"/>`; });
    // стрелки градиента: касательная к окружности
    const arrow = (a, g, col) => {
      const v = Math.max(-1, Math.min(1, -g * (mode === "clip" ? 0.06 : 0.02) * 5)), len = Math.abs(v) * 44;
      if (len < 3) return "";
      const p0 = pt(a, CR + 0.01), dir = Math.sign(v), tx = -Math.sin(a) * dir, ty = -Math.cos(a) * dir;
      return vlArrow(p0[0], p0[1], p0[0] + tx * (len + 14), p0[1] + ty * (len + 14), "vl-grad");
    };
    if (t < T){ PAIRS.forEach((p, i) => { s += arrow(st.th[i], st.gth[i]) + arrow(st.ph[i], st.gph[i]); }); }
    PAIRS.forEach((p, j) => {
      const a = pt(st.ph[j]), L = pt(st.ph[j], CR + 22), c = Math.cos(st.ph[j]);
      s += `<path d="M${f1(a[0])} ${f1(a[1] - 7)} L${f1(a[0] + 7)} ${f1(a[1])} L${f1(a[0])} ${f1(a[1] + 7)} L${f1(a[0] - 7)} ${f1(a[1])}Z" style="fill:${p.g}"/>`;
      s += `<text x="${f1(L[0])}" y="${f1(L[1])}" class="vl-word" style="fill:${p.g};text-anchor:${c > 0.35 ? "start" : c < -0.35 ? "end" : "middle"}">${p.w}</text>`;
    });
    PAIRS.forEach((p, i) => {
      const a = pt(st.th[i]);
      s += `<circle cx="${f1(a[0])}" cy="${f1(a[1])}" r="13" class="vl-ci" style="--gc:${p.g}"/><text x="${f1(a[0])}" y="${f1(a[1] + 1)}" class="vl-emoji">${p.img}</text>`;
    });
    // матрица
    s += `<text x="${f1(MX)}" y="${f1(MY - 30)}" class="vl-cap">${mode === "clip" ? "p(подпись | картинка): softmax по строке" : "σ(t·s + b): каждая клетка отдельно"}</text>`;
    PAIRS.forEach((p, j) => { s += `<text x="${f1(MX + j * cell + cell / 2)}" y="${f1(MY - 10)}" class="vl-word" style="fill:${p.g};text-anchor:middle;font-size:${cell < 52 ? 11 : 12}px">${p.w}</text>`; });
    PAIRS.forEach((p, i) => {
      s += `<text x="${f1(MX - 10)}" y="${f1(MY + i * cell + cell / 2 + 1)}" class="vl-emoji" style="text-anchor:end">${p.img}</text>`;
      PAIRS.forEach((q, j) => {
        const v = st.P[i][j], X = MX + j * cell, Y = MY + i * cell;
        s += `<rect x="${f1(X + 1)}" y="${f1(Y + 1)}" width="${f1(cell - 2)}" height="${f1(cell - 2)}" rx="4" class="vl-mcell" style="fill-opacity:${f1(0.06 + 0.94 * v)}"/>`;
        s += `<text x="${f1(X + cell / 2)}" y="${f1(Y + cell / 2 - (cell >= 50 ? 6 : 0))}" class="vl-mval${v > 0.55 ? " on" : ""}">${fmtN(v, 2)}</text>`;
        if (cell >= 50) s += `<text x="${f1(X + cell / 2)}" y="${f1(Y + cell / 2 + 9)}" class="vl-msim${v > 0.55 ? " on" : ""}">s = ${fmtN(st.s[i][j], 2)}</text>`;
        if (i === j) s += `<rect x="${f1(X + 1)}" y="${f1(Y + 1)}" width="${f1(cell - 2)}" height="${f1(cell - 2)}" rx="4" class="vl-diag"/>`;
      });
    });
    // кривая потерь
    const LY = MY + B * cell + 22, LW = B * cell, LH = 46, Lmax = Math.max(...traj.map((x) => x.L));
    s += `<text x="${f1(MX)}" y="${f1(LY - 4)}" class="vl-cap">loss по шагам: ${fmtN(st.L, 3)}</text>`;
    const lx = (k) => MX + k / T * LW, ly = (L) => LY + 6 + LH - L / Lmax * LH;
    s += `<line x1="${f1(MX)}" y1="${f1(LY + 6 + LH)}" x2="${f1(MX + LW)}" y2="${f1(LY + 6 + LH)}" class="cb-axis"/>`;
    s += `<polyline points="${traj.map((x, k) => f1(lx(k)) + "," + f1(ly(x.L))).join(" ")}" class="cb-curve other"/>`;
    s += `<polyline points="${traj.slice(0, t + 1).map((x, k) => f1(lx(k)) + "," + f1(ly(x.L))).join(" ")}" class="cb-curve"/>`;
    s += `<circle cx="${f1(lx(t))}" cy="${f1(ly(st.L))}" r="4" class="cb-mark"/>`;
    const VH = Math.max(CY + CR + 36, LY + 6 + LH + 8);
    svg.setAttribute("viewBox", `0 0 ${VW} ${f1(VH)}`);
    svg.innerHTML = s;

    // рассказ
    const rowsOk = st.P.filter((r, i) => r.indexOf(Math.max(...r)) === i).length;
    const parts = [`<b>Шаг ${t}.</b> loss = ${fmtN(st.L, 3)}.`];
    if (mode === "clip"){
      const colsOk = [0, 1, 2, 3].filter((j) => { let best = 0; for (let i = 1; i < B; i++) if (st.P[i][j] > st.P[best][j]) best = i; return best === j; }).length;
      parts.push(`Свою подпись выше остальных ставят ${rowsOk} из 4 картинок.`);
      if (rowsOk < 4 || st.P.some((r, i) => r[i] < 0.6)){
        let w = 0; for (let i = 1; i < B; i++) if (st.P[i][i] < st.P[w][w]) w = i;
        let o = w === 0 ? 1 : 0; for (let j = 0; j < B; j++) if (j !== w && st.P[w][j] > st.P[w][o]) o = j;
        parts.push(`Хуже всех ${PAIRS[w].img}: своей подписи «${PAIRS[w].w}» достаётся p = ${fmtN(st.P[w][w], 2)}, а «${PAIRS[o].w}» — ${fmtN(st.P[w][o], 2)}. Градиент по логиту равен \\((p_{ij} - \\delta_{ij})/\\tau\\): он тянет ${PAIRS[w].img} к «${PAIRS[w].w}» и сильнее всего отталкивает от «${PAIRS[o].w}».`);
      } else parts.push(`Все пары найдены${colsOk === 4 ? " в обе стороны: и по строкам, и по столбцам" : ""}. Дальше обучение только увеличивает отрыв диагонали; на настоящих данных в батче тысячи пар, и задача никогда не решается полностью.`);
      if (t === 0) parts.push("Эмбеддинги случайны. Каждая строка матрицы — softmax по 4 подписям, сумма в строке равна 1; вторая половина потерь — такой же softmax по столбцам.");
    } else {
      let fp = null, fn = null;
      for (let i = 0; i < B; i++) for (let j = 0; j < B; j++){
        if (i === j){ if (!fn || st.P[i][i] < st.P[fn[0]][fn[0]]) fn = [i, i]; }
        else if (!fp || st.P[i][j] > st.P[fp[0]][fp[1]]) fp = [i, j];
      }
      if (t === 0) parts.push(`Эмбеддинги случайны. Каждая клетка — отдельная бинарная задача «пара или не пара» с вероятностью \\(\\sigma(t \\cdot s + b)\\), здесь \\(t = 10\\), \\(b = -5\\); строки не нормируются.`);
      parts.push(`Слабее всего правильная пара ${PAIRS[fn[0]].img} — «${PAIRS[fn[0]].w}»: σ = ${fmtN(st.P[fn[0]][fn[0]], 2)}. Самая уверенная ошибка: ${PAIRS[fp[0]].img} — «${PAIRS[fp[1]].w}», σ = ${fmtN(st.P[fp[0]][fp[1]], 2)}.`);
      if (st.P[fn[0]][fn[0]] > 0.8 && st.P[fp[0]][fp[1]] < 0.2) parts.push("Все 4 пары узнаются, все 12 чужих отвергнуты. Каждой клетке нужна только своя пара векторов — поэтому SigLIP не собирает всю матрицу батча на одном устройстве.");
    }
    say.innerHTML = parts.join(" ");
  }
  const player = vlPlayer(box, { count: () => T + 1, draw, interval: 450, label: (i) => `шаг обучения ${i} из ${T}` });
  function reset(){ player.stop(); simulate(); player.go(0); }
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.mode === mode) return;
    mode = b.dataset.mode; box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); reset();
  }));
  box.querySelector('[data-act="seed"]').addEventListener("click", () => { seedIdx = (seedIdx + 1) % SEEDS.length; reset(); });
  simulate();
  player.paint();
  const off = cbResize(svg, () => player.paint());
  return () => { player.stop(); off(); };
}

/* ---------- LLaVA: путь картинки и текста до ответа ---------- */
function mountVlPipeline(box){
  const PROMPT = [["USER:", "t"], ["<image>", "img"], ["\\n", "t"], ["Что", "t"], [" на", "t"], [" картинке", "t"], ["?", "t"], [" ASSISTANT:", "t"]];
  const ANSWER = ["Домик", " с", " красной", " крышей", ",", " дерево", " и", " солнце", ".", "</s>"];
  const NAMES = ["Промпт", "Патчи", "ViT", "Проектор", "Эмбеддинги текста", "Склейка", "Prefill", "Первый токен", "Decode", "Обучение"];
  const LAST = NAMES.length - 1;
  box.innerHTML = `
    <div class="fig-stage vl-scroll"><svg tabindex="0" role="img" aria-label="Схема LLaVA по шагам"></svg></div>
    ${vlControls()}
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Номер шага"></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("", "fill:var(--vl-img)"), "визуальные токены"],
      [cbSwatch("", "fill:var(--vl-txt)"), "токены промпта"],
      [cbSwatch("", "fill:var(--vl-ans)"), "токены ответа"],
      [cbSwatch("vl-box on"), "что работает на этом шаге"]
    ])}</div>`;
  const svg = box.querySelector(".fig-stage svg"), say = box.querySelector(".fig-say");
  const W = 640, tw = (t) => Math.max(18, t.replace("\\n", "nn").length * 6.6 + 10);

  function draw(step){
    const on = (cond) => cond ? " on" : "", fade = (cond) => cond ? "" : ' opacity="0.28"';
    let s = "";
    // --- Полоса картинки (y 22..112)
    const IY = 26, IS = 78;
    s += `<text x="0" y="12" class="vl-cap">картинка</text>`;
    s += `<g${fade(step >= 1)}>${vlPixels(0, IY, IS)}`;
    if (step >= 1){ for (let i = 1; i < 24; i++){ const c = i * IS / 24; s += `<line x1="${f1(c)}" y1="${IY}" x2="${f1(c)}" y2="${IY + IS}" class="vl-grid thin"/><line x1="0" y1="${f1(IY + c)}" x2="${IS}" y2="${f1(IY + c)}" class="vl-grid thin"/>`; } }
    s += `<rect x="0" y="${IY}" width="${IS}" height="${IS}" class="frame"/></g>`;
    s += `<text x="0" y="${IY + IS + 14}" class="vl-cap">336 × 336</text>`;
    const box1 = (x, y, w, h, t1, t2, active, shown = true) => `<g${fade(shown)}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" class="vl-box${on(active)}"/><text x="${x + w / 2}" y="${y + h / 2 - (t2 ? 7 : 0)}" class="vl-boxt">${t1}</text>${t2 ? `<text x="${x + w / 2}" y="${y + h / 2 + 9}" class="vl-boxs">${t2}</text>` : ""}</g>`;
    const mat = (x, y, w, h, t1, t2, shown) => {
      let g = `<g${fade(shown)}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="vl-mat"/>`;
      for (let i = 1; i < 9; i++) g += `<line x1="${x}" y1="${f1(y + i * h / 9)}" x2="${x + w}" y2="${f1(y + i * h / 9)}" class="vl-matl"/>`;
      return g + `<text x="${x + w / 2}" y="${y - 6}" class="vl-boxt" style="font-size:12.5px">${t1}</text><text x="${x + w / 2}" y="${y + h + 13}" class="vl-boxs">${t2}</text></g>`;
    };
    s += vlArrow(IS + 6, IY + IS / 2, 112, IY + IS / 2, "vl-arr" + on(step === 1 || step === 2));
    s += box1(114, IY + 12, 92, 54, "ViT-L/14", "CLIP, 24 слоя", step === 1 || step === 2, step >= 1);
    s += vlArrow(208, IY + IS / 2, 238, IY + IS / 2, "vl-arr" + on(step === 2));
    s += mat(240, IY + 6, 56, 66, "Z<tspan class=\"vl-sub\" dy=\"3\">v</tspan>", "576 × 1024", step >= 2);
    s += vlArrow(300, IY + IS / 2, 330, IY + IS / 2, "vl-arr" + on(step === 3));
    s += box1(332, IY + 12, 86, 54, "MLP", "1024 → 4096", step === 3, step >= 3);
    s += vlArrow(420, IY + IS / 2, 450, IY + IS / 2, "vl-arr" + on(step === 3));
    s += mat(452, IY + 6, 70, 66, "H<tspan class=\"vl-sub\" dy=\"3\">v</tspan>", "576 × 4096", step >= 3);
    // --- Полоса промпта (y 140..170)
    const PY = 150;
    s += `<text x="0" y="${PY - 10}" class="vl-cap">промпт после токенизатора</text>`;
    let x = 0; const chipX = [];
    PROMPT.forEach(([t, k]) => {
      const w = tw(t); chipX.push([x, w]);
      s += `<rect x="${f1(x)}" y="${PY}" width="${f1(w)}" height="22" rx="4" class="vl-chip ${k}${on(step === 0 && k === "img")}"/><text x="${f1(x + w / 2)}" y="${PY + 11}" class="vl-chipt ${k}">${t.replace("<", "&lt;").replace(">", "&gt;")}</text>`;
      x += w + 4;
    });
    const PX2 = x + 8;
    s += vlArrow(PX2, PY + 11, PX2 + 30, PY + 11, "vl-arr" + on(step === 4));
    s += box1(PX2 + 32, PY - 8, 82, 38, "E<tspan class=\"vl-sub\" dy=\"3\">text</tspan>", "", step === 4, step >= 4);
    s += `<text x="${PX2 + 122}" y="${PY + 11}" class="vl-boxs" style="text-anchor:start"${fade(step >= 4)}>8 × 4096</text>`;

    // --- Входная последовательность (y 214..240)
    const SY = 222, segs = [];
    let sx = 0;
    PROMPT.forEach(([t, k]) => {
      const w = k === "img" ? 168 : tw(t);
      segs.push({ t, k, x: sx, w }); sx += w + 3;
    });
    const nAns = step < 7 ? 0 : step === 7 ? 1 : ANSWER.length;
    for (let i = 0; i < nAns; i++){ const w = tw(ANSWER[i]); segs.push({ t: ANSWER[i], k: "ans", x: sx, w }); sx += w + 3; }
    const scale = Math.min(1, (W - 4) / sx);
    s += `<text x="0" y="${SY - 10}" class="vl-cap"${fade(step >= 5)}>вход LLM: ${8 - 1 + 576 + nAns} ${plural(7 + 576 + nAns, "позиция", "позиции", "позиций")}</text>`;
    s += `<g${fade(step >= 5)}>`;
    segs.forEach((g, i) => {
      const X = g.x * scale, w = g.w * scale;
      if (g.k === "img"){
        for (let c = 0; c < 12; c++) s += `<rect x="${f1(X + c * w / 12)}" y="${SY}" width="${f1(w / 12 - 1.5)}" height="24" rx="2" class="vl-tok img"/>`;
        s += `<rect x="${f1(X + w / 2 - 34)}" y="${SY + 5}" width="68" height="14" rx="3" class="vl-badge"/><text x="${f1(X + w / 2)}" y="${SY + 12}" class="vl-badget">576 токенов</text>`;
        if (step >= 5){
          const xm = X + w / 2;
          s += `<path d="M524 ${IY + 39} H604 Q612 ${IY + 39} 612 ${IY + 47} V${SY - 34} Q612 ${SY - 26} 604 ${SY - 26} H${f1(xm + 8)} Q${f1(xm)} ${SY - 26} ${f1(xm)} ${SY - 18} V${SY - 4}" class="vl-flow${on(step === 5)}"/>`;
        }
      } else {
        s += `<rect x="${f1(X)}" y="${SY}" width="${f1(w)}" height="24" rx="3" class="vl-tok ${g.k}${step === 8 && i === segs.length - 1 ? " new" : ""}"/>`;
        s += `<text x="${f1(X + w / 2)}" y="${SY + 12}" class="vl-chipt ${g.k} on-tok" style="font-size:${scale < 0.8 ? 9 : 10.5}px">${g.t.replace("<", "&lt;").replace(">", "&gt;")}</text>`;
      }
    });
    s += `</g>`;
    // метки обучения
    if (step === LAST){
      const firstAns = segs.findIndex((g) => g.k === "ans"), Y = SY + 32;
      const xa = 1, xb = (segs[firstAns - 1].x + segs[firstAns - 1].w) * scale - 1, xc = segs[firstAns].x * scale + 1, xd = (sx - 3) * scale - 1;
      s += `<path d="M${f1(xa)} ${Y} v5 H${f1(xb)} v-5" class="cb-brace"/><text x="${f1((xa + xb) / 2)}" y="${Y + 18}" class="vl-lbl">метка −100: в loss не входят</text>`;
      s += `<path d="M${f1(xc)} ${Y} v5 H${f1(xd)} v-5" class="cb-brace" style="stroke:var(--vl-ans);stroke-width:1.6"/><text x="${f1((xc + xd) / 2)}" y="${Y + 18}" class="vl-lbl ans">метки = токены ответа</text>`;
    }

    // --- LLM и маска внимания
    const LY = step === LAST ? 292 : 280;
    s += `<g${fade(step >= 6)}><rect x="0" y="${LY}" width="330" height="64" rx="8" class="vl-box${on(step >= 6 && step <= 8)}"/>`;
    for (let l = 0; l < 5; l++) s += `<rect x="${12 + l * 62}" y="${LY + 28}" width="52" height="24" rx="4" class="vl-layer"/>`;
    s += `<text x="165" y="${LY + 14}" class="vl-boxt">LLM: Vicuna-7B, 32 слоя, d = 4096</text>`;
    s += `<text x="${12 + 4 * 62 + 26}" y="${LY + 40}" class="vl-boxs">…</text>`;
    s += `</g>`;
    if (step >= 6 && step <= 8){
      s += vlArrow(165, SY + 30, 165, LY - 4, "vl-arr on");
      // выход: логиты последней позиции
      if (step >= 7){
        const tok = step === 7 ? ANSWER[0] : ANSWER[ANSWER.length - 1], w = tw(tok);
        s += vlArrow(332, LY + 32, 360, LY + 32, "vl-arr on");
        s += `<rect x="364" y="${LY + 20}" width="${f1(w)}" height="24" rx="3" class="vl-tok ans new"/><text x="${f1(364 + w / 2)}" y="${LY + 32}" class="vl-chipt ans on-tok">${tok.replace("<", "&lt;").replace(">", "&gt;")}</text>`;
        s += `<text x="364" y="${LY + 60}" class="vl-cap">${step === 7 ? "логиты последней позиции" : "до конца ответа"}</text>`;
      }
    }
    // маска: 2 текст + 6 картинка + 6 текст + ответ (условно)
    if (step === 6 || step === 8){
      const segK = ["t", "img", "img", "img", "img", "img", "img", "t", "t", "t", "t", "t", "t"], na = step === 8 ? 3 : 0;
      const keys = [...segK, ...Array(na).fill("ans")], n = keys.length, c = Math.min(9, 136 / n), MX = 640 - n * c - 2, MYY = LY - 4;
      s += `<text x="640" y="${f1(MYY - 8)}" class="vl-cap" text-anchor="end">маска внимания, условно</text>`;
      for (let r = 0; r < n; r++) for (let q = 0; q < n; q++){
        if (q > r) continue;
        s += `<rect x="${f1(MX + q * c)}" y="${f1(MYY + r * c)}" width="${f1(c - 1)}" height="${f1(c - 1)}" class="vl-m ${keys[q]}${step === 8 && r < n - 1 ? " old" : ""}"/>`;
      }
      s += `<rect x="${f1(MX - 1)}" y="${f1(MYY - 1)}" width="${f1(n * c + 1)}" height="${f1(n * c + 1)}" class="vl-mframe"/>`;
    }
    svg.setAttribute("viewBox", `0 0 ${W} 418`);
    svg.innerHTML = s;

    const T = [
      `<b>Промпт с местом для картинки.</b> Шаблон диалога превращается в токены, и вместо картинки в нём стоит служебный токен <code>&lt;image&gt;</code>. Своего эмбеддинга у него нет: позже его место займут визуальные токены.`,
      `<b>Картинка режется на патчи.</b> Изображение приводится к 336 × 336 (в LLaVA-1.5 — дополнением до квадрата и масштабированием) и делится на 24 × 24 = 576 патчей по 14 × 14 пикселей.`,
      `<b>Визуальный энкодер.</b> CLIP ViT-L/14 прогоняет 576 патчей через 24 слоя. LLaVA-1.5 берёт выход <i>предпоследнего</i> слоя и отбрасывает CLS: \\(Z_{\\text{v}} \\in \\mathbb{R}^{576 \\times 1024}\\). Последний слой слишком заточен под контрастивную задачу, а в предпоследнем больше локальных деталей.`,
      `<b>Проектор.</b> Двухслойный MLP переводит каждый визуальный вектор в размерность эмбеддингов LLM: \\(H_{\\text{v}} = W_2 \\cdot \\operatorname{GELU}(W_1 Z_{\\text{v}}) \\in \\mathbb{R}^{576 \\times 4096}\\). Это около 21 млн параметров — вся «склейка» двух предобученных моделей.`,
      `<b>Эмбеддинги текста.</b> Обычные токены промпта берут свои векторы из таблицы \\(E_{\\text{text}}\\) языковой модели, тоже размерности 4096.`,
      `<b>Склейка.</b> Место токена <code>&lt;image&gt;</code> занимают 576 строк \\(H_{\\text{v}}\\). Для LLM это просто последовательность из 583 векторов; позиции у визуальных токенов обычные, подряд, как у 576 слов.`,
      `<b>Prefill.</b> LLM за один проход обрабатывает все 583 позиции с обычной каузальной маской: визуальный токен видит только предыдущие визуальные токены, а вопрос — всю картинку. Ключи и значения всех позиций, включая 576 визуальных, ложатся в KV-cache — у 7B-модели это около 290 МБ на одну картинку.`,
      `<b>Первый токен ответа.</b> Из логитов последней позиции сэмплируется первый токен. Картинка больше не нужна в виде пикселей: всё, что модель о ней «знает», лежит в KV-cache.`,
      `<b>Decode.</b> Дальше обычная генерация: по токену за шаг, каждый новый токен смотрит на весь кеш — и на текст, и на визуальные токены (нижняя строка маски). Энкодер и проектор больше не запускаются.`,
      `<b>Как это учат.</b> На обучающем примере ответ известен, и loss — обычная кросс-энтропия следующего токена, но только по позициям ответа: \\(L = -\\sum_{t \\,\\in\\, \\text{ответ}} \\log p\\left(y_t \\mid H_{\\text{v}}, \\text{промпт}, y_{&lt;t}\\right)\\). Визуальным токенам и вопросу ставят метку −100, и они в loss не участвуют.`
    ];
    say.innerHTML = T[step];
  }
  const player = vlPlayer(box, { count: () => NAMES.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${NAMES[i]}` });
  player.paint();
  return () => player.stop();
}

/* ---------- Три способа подать картинку в LLM ---------- */
function mountVlFusion(box){
  let tab = "input";
  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Схема">
        <button type="button" role="tab" data-tab="input" aria-selected="true">Через вход</button>
        <button type="button" role="tab" data-tab="xattn" aria-selected="false">Cross-attention</button>
        <button type="button" role="tab" data-tab="early" aria-selected="false">Ранний синтез</button>
      </div>
    </div>
    <div class="fig-stage vl-scroll" style="margin-top:12px"><svg role="img" aria-label="Схема архитектуры и маска внимания"></svg></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("", "fill:var(--vl-img)"), "картинка"],
      [cbSwatch("", "fill:var(--vl-txt)"), "текст"],
      [cbSwatch("vl-box new"), "новые обучаемые слои"],
      [cbSwatch("vl-m none"), "внимание запрещено маской"]
    ])}</div>`;
  const svg = box.querySelector(".fig-stage svg"), say = box.querySelector(".fig-say");
  const W = 640;
  const tok = (x, y, k, label = "", w = 22) => `<rect x="${f1(x)}" y="${f1(y)}" width="${w}" height="22" rx="3" class="vl-tok ${k}"/>${label ? `<text x="${f1(x + w / 2)}" y="${f1(y + 11)}" class="vl-chipt on-tok" style="font-size:9.5px">${label}</text>` : ""}`;
  const layer = (x, y, w, t, cls = "") => `<rect x="${x}" y="${y}" width="${w}" height="26" rx="5" class="vl-box ${cls}"/><text x="${x + w / 2}" y="${y + 13}" class="vl-boxs" style="font-size:11.5px">${t}</text>`;
  function maskM(x, y, rows, cols, allow, title, c = 15){
    let s = `<text x="${x}" y="${y - 22}" class="vl-cap">${title}</text>`;
    cols.forEach((k, q) => { s += `<rect x="${f1(x + q * c)}" y="${y - 12}" width="${c - 2}" height="6" rx="1" class="vl-m ${k}"/>`; });
    rows.forEach((k, r) => {
      s += `<rect x="${x - 12}" y="${f1(y + r * c)}" width="6" height="${c - 2}" rx="1" class="vl-m ${k}"/>`;
      cols.forEach((kc, q) => { s += `<rect x="${f1(x + q * c)}" y="${f1(y + r * c)}" width="${c - 2}" height="${c - 2}" rx="2" class="vl-m ${allow(r, q) ? kc : "none"}"/>`; });
    });
    return s;
  }
  function draw(){
    let s = "", VH = 300;
    const sx = 20, BW = 250;
    if (tab === "input"){
      const seq = ["img", "img", "img", "img", "t", "t", "t", "t"];
      s += `<text x="${sx}" y="14" class="vl-cap">LLM без изменений</text>`;
      ["слой L", "…", "слой 2", "слой 1"].forEach((t, i) => { s += layer(sx, 26 + i * 38, BW, t === "…" ? "…" : `${t}: self-attention + MLP`); });
      for (let i = 0; i < 3; i++) s += vlArrow(sx + BW / 2, 26 + (i + 1) * 38 - 1, sx + BW / 2, 26 + i * 38 + 27);
      s += vlArrow(sx + BW / 2, 184, sx + BW / 2, 26 + 3 * 38 + 27);
      seq.forEach((k, i) => { s += tok(sx + 6 + i * 30 + (i >= 4 ? 8 : 0), 186, k, k === "img" ? "v" + subN(i + 1) : ["Что", "на", "фото", "?"][i - 4], k === "img" ? 22 : 26); });
      s += `<text x="${sx}" y="226" class="vl-cap">ViT → проектор → 4 визуальных токена</text>`;
      s += maskM(380, 64, seq, seq, (r, q) => q <= r, "self-attention: маска каузальная");
    } else if (tab === "xattn"){
      s += `<text x="${sx + 70}" y="14" class="vl-cap">LLM заморожена, вставлены новые слои</text>`;
      const L = [["self-attention + MLP (заморожен)", ""], ["gated cross-attention (новый)", "new"], ["self-attention + MLP (заморожен)", ""], ["gated cross-attention (новый)", "new"], ["self-attention + MLP (заморожен)", ""]];
      L.reverse().forEach(([t, c], i) => { s += layer(sx + 70, 22 + i * 34, BW - 30, t, c); });
      for (let i = 0; i < 4; i++) s += vlArrow(sx + 70 + (BW - 30) / 2, 22 + (i + 1) * 34 - 1, sx + 70 + (BW - 30) / 2, 22 + i * 34 + 27);
      // визуальные токены сбоку
      for (let i = 0; i < 4; i++) s += tok(sx, 40 + i * 30, "img", "v" + subN(i + 1));
      s += `<text x="${sx}" y="174" class="vl-cap">K, V</text>`;
      [1, 3].forEach((i) => { s += vlArrow(sx + 24, 66 + (i - 1) * 30, sx + 68, 22 + i * 34 + 13, "vl-arr acc"); });
      ["Что", "на", "фото", "?"].forEach((t, i) => { s += tok(sx + 70 + i * 32, 200, "t", t, 28); });
      s += vlArrow(sx + 70 + 60, 198, sx + 70 + 60, 22 + 4 * 34 + 28);
      s += `<text x="${sx + 70}" y="238" class="vl-cap">в последовательности только текст</text>`;
      const tq = ["t", "t", "t", "t"], iv = ["img", "img", "img", "img"];
      s += maskM(380, 64, tq, tq, (r, q) => q <= r, "self-attention", 14);
      s += maskM(380 + 4 * 14 + 50, 64, tq, iv, () => true, "cross-attention", 14);
      s += `<text x="368" y="146" class="vl-cap">строки — запросы, столбцы — ключи</text>`;
      s += `<text x="368" y="174" class="vl-formula">x ← x + tanh(α) · XAttn(x, v)</text>`;
      s += `<text x="368" y="194" class="vl-cap">α = 0 в начале: блок выключен</text>`;
    } else {
      s += `<text x="${sx}" y="14" class="vl-cap">картинка → дискретные токены</text>`;
      s += `<g>${vlPixels(sx, 26, 64)}<rect x="${sx}" y="26" width="64" height="64" class="frame"/></g>`;
      s += vlArrow(sx + 68, 58, sx + 96, 58);
      s += layer(sx + 98, 45, 110, "VQ-токенизатор", "");
      s += vlArrow(sx + 210, 58, sx + 236, 58);
      ["i417", "i5203", "i88", "i1290"].forEach((t, i) => { s += tok(sx + 240 + (i % 2) * 52, 34 + Math.floor(i / 2) * 26, "img", t, 48); });
      s += `<text x="${sx + 98}" y="108" class="vl-cap">номера кодов — такие же токены, как слова</text>`;
      const seq = [["img", "i417"], ["img", "i5203"], ["img", "i88"], ["img", "i1290"], ["t", "Что"], ["t", "это"], ["t", "?"]];
      s += `<text x="${sx}" y="140" class="vl-cap">один словарь, одна модель, обучение с нуля</text>`;
      seq.forEach(([k, t], i) => { s += tok(sx + i * 46, 150, k, t, 42); });
      s += layer(sx, 186, 320, "трансформер: следующий токен — текст или картинка");
      s += vlArrow(sx + 160, 174, sx + 160, 184);
      s += vlArrow(sx + 160, 214, sx + 160, 228);
      s += tok(sx + 110, 232, "t", "Это", 40) + tok(sx + 154, 232, "img", "i731", 48);
      s += `<text x="${sx + 210}" y="248" class="vl-cap">может выдать и картинку</text>`;
      const sq = seq.map(([k]) => k);
      s += maskM(420, 64, sq, sq, (r, q) => q <= r, "маска каузальная", 15);
      VH = 270;
    }
    svg.setAttribute("viewBox", `0 0 ${W} ${VH}`);
    svg.innerHTML = s;
    const T = {
      input: `<b>Через вход (LLaVA, Qwen-VL, InternVL).</b> Визуальные токены стоят в последовательности наравне с текстом и проходят через все слои LLM. Архитектура LLM не меняется, новые обучаемые веса — только проектор. Цена — длина последовательности: каждая картинка добавляет сотни или тысячи позиций в prefill и в KV-cache.`,
      xattn: `<b>Cross-attention (Flamingo, Llama 3.2 Vision).</b> Картинки в последовательности нет. Между слоями замороженной LLM вставлены новые блоки, где запросы — скрытые состояния текста, а ключи и значения — визуальные токены. Гейт tanh(α) с α = 0 в начале обучения выключает новые блоки, и модель стартует ровно с исходной LLM — текстовые способности не ломаются.`,
      early: `<b>Ранний синтез (Chameleon).</b> Картинка кодируется дискретными токенами из общего словаря (у Chameleon 1024 кода на картинку 512 × 512 из словаря размером 8192), и один трансформер с нуля учится на смешанных последовательностях. Модель может не только читать, но и генерировать картинки тем же next-token prediction. Цена — потеря мелких деталей в квантизации и дорогое обучение с нуля.`
    };
    say.innerHTML = T[tab];
  }
  box.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab; box.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw();
  }));
  draw();
}

/* ---------- Высокое разрешение: сжатие, тайлы AnyRes, нативное разрешение ---------- */
function vlQwenResize(W, H, minP = 256 * 784, maxP = 1280 * 784){
  let h = Math.max(28, Math.round(H / 28) * 28), w = Math.max(28, Math.round(W / 28) * 28);
  if (h * w > maxP){ const b = Math.sqrt(H * W / maxP); h = Math.floor(H / b / 28) * 28; w = Math.floor(W / b / 28) * 28; }
  else if (h * w < minP){ const b = Math.sqrt(minP / (H * W)); h = Math.ceil(H * b / 28) * 28; w = Math.ceil(W * b / 28) * 28; }
  return { w, h };
}
function vlAnyRes(W, H){
  const C = [[1, 2], [2, 1], [2, 2], [1, 3], [3, 1], [1, 4], [4, 1]].map(([c, r]) => {
    const Wc = c * 336, Hc = r * 336, s = Math.min(Wc / W, Hc / H), dw = Math.floor(W * s), dh = Math.floor(H * s);
    const eff = Math.min(dw * dh, W * H);
    return { c, r, Wc, Hc, s, dw, dh, eff, waste: Wc * Hc - eff };
  });
  let best = C[0];
  C.forEach((x) => { if (x.eff > best.eff || (x.eff === best.eff && x.waste < best.waste)) best = x; });
  return { C, best };
}
/* Синтетические «картинки»: фото, скриншот, чек. Координаты — в пикселях оригинала. */
const VL_SCENES = {
  photo: { W: 1600, H: 1200, name: "Фото", text: null },
  screen: { W: 1920, H: 1080, name: "Скриншот", text: 14 },
  receipt: { W: 600, H: 1600, name: "Чек", text: 20 }
};
function vlScene(kind, x, y, k){
  const sc = VL_SCENES[kind], W = sc.W, H = sc.H, R = rng(kind.length * 7 + 3);
  const X = (u) => f1(x + u * k), Y = (v) => f1(y + v * k), L = (d) => f1(Math.max(0.4, d * k));
  let s = "";
  if (kind === "photo"){
    s += `<rect x="${X(0)}" y="${Y(0)}" width="${L(W)}" height="${L(H)}" fill="#8FB8E2"/>`;
    s += `<rect x="${X(0)}" y="${Y(H * 0.35)}" width="${L(W)}" height="${L(H * 0.3)}" fill="#AFCDEB"/>`;
    s += `<circle cx="${X(1250)}" cy="${Y(230)}" r="${L(120)}" fill="#F5C44A"/>`;
    s += `<path d="M${X(0)} ${Y(800)} C${X(400)} ${Y(690)}, ${X(900)} ${Y(880)}, ${X(1600)} ${Y(740)} L${X(1600)} ${Y(1200)} L${X(0)} ${Y(1200)}Z" fill="#6FA455"/>`;
    s += `<rect x="${X(260)}" y="${Y(620)}" width="${L(330)}" height="${L(260)}" fill="#CC6248"/>`;
    s += `<path d="M${X(220)} ${Y(625)} L${X(425)} ${Y(440)} L${X(630)} ${Y(625)}Z" fill="#80403A"/>`;
    s += `<rect x="${X(330)}" y="${Y(680)}" width="${L(70)}" height="${L(60)}" fill="#F7E08A"/>`;
    s += `<rect x="${X(1090)}" y="${Y(640)}" width="${L(40)}" height="${L(180)}" fill="#6E4E34"/><circle cx="${X(1110)}" cy="${Y(590)}" r="${L(120)}" fill="#3B7A49"/>`;
    // табличка с надписью
    s += `<rect x="${X(720)}" y="${Y(760)}" width="${L(200)}" height="${L(70)}" fill="#F3EEDC"/><rect x="${X(740)}" y="${Y(785)}" width="${L(150)}" height="${L(18)}" fill="#4A4A4A"/>`;
  } else if (kind === "screen"){
    s += `<rect x="${X(0)}" y="${Y(0)}" width="${L(W)}" height="${L(H)}" fill="#F4F5F7"/>`;
    s += `<rect x="${X(0)}" y="${Y(0)}" width="${L(W)}" height="${L(44)}" fill="#3B4252"/>`;
    s += `<rect x="${X(0)}" y="${Y(44)}" width="${L(300)}" height="${L(H - 44)}" fill="#E3E6EB"/>`;
    for (let i = 0; i < 18; i++) s += `<rect x="${X(30)}" y="${Y(80 + i * 34)}" width="${L(120 + R() * 120)}" height="${L(12)}" fill="#8A93A3"/>`;
    for (let i = 0; i < 38; i++){
      const yy = 80 + i * 25; if (yy > H - 30) break;
      const indent = i % 9 === 0 ? 0 : 30;
      s += `<rect x="${X(340 + indent)}" y="${Y(yy)}" width="${L(500 + R() * 900)}" height="${L(11)}" fill="${i % 9 === 0 ? "#2E3440" : "#5C6575"}"/>`;
    }
  } else {
    s += `<rect x="${X(0)}" y="${Y(0)}" width="${L(W)}" height="${L(H)}" fill="#FBFAF6"/>`;
    s += `<rect x="${X(150)}" y="${Y(60)}" width="${L(300)}" height="${L(28)}" fill="#3A3A3A"/>`;
    for (let i = 0; i < 40; i++){
      const yy = 150 + i * 34; if (yy > H - 60) break;
      if (i === 30){ s += `<rect x="${X(40)}" y="${Y(yy + 8)}" width="${L(520)}" height="${L(3)}" fill="#9A9A9A"/>`; continue; }
      s += `<rect x="${X(40)}" y="${Y(yy)}" width="${L(140 + R() * 220)}" height="${L(15)}" fill="#555"/>`;
      s += `<rect x="${X(470)}" y="${Y(yy)}" width="${L(90)}" height="${L(15)}" fill="#555"/>`;
    }
  }
  return s;
}

function mountVlTiles(box){
  let mode = "anyres", kind = "screen", sel = [3, 5];
  const MODES = {
    squash: { name: "Сжатие до 336", steps: ["Исходная картинка", "Дополнение до квадрата", "Сжатие и патчи"] },
    anyres: { name: "Тайлы (AnyRes)", steps: ["Выбор сетки", "Ресайз в сетку", "Нарезка на тайлы", "Общий план"] },
    native: { name: "Нативное (Qwen2-VL)", steps: ["Исходная картинка", "Подгонка размера", "Патчи 14 × 14", "Слияние 2 × 2"] }
  };
  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Способ">
        ${Object.entries(MODES).map(([k, m]) => `<button type="button" role="tab" data-mode="${k}" aria-selected="${k === mode}">${m.name}</button>`).join("")}
      </div>
    </div>
    <div class="fig-row">
      <span class="fig-seg">картинка
        <span class="fig-tabs" role="tablist" aria-label="Картинка">${Object.entries(VL_SCENES).map(([k, sc]) => `<button type="button" data-kind="${k}" aria-selected="${k === kind}">${sc.name}</button>`).join("")}</span>
      </span>
    </div>
    <div class="fig-stage" style="margin-top:12px"><svg tabindex="0" role="img" aria-label="Как картинка делится на токены"></svg></div>
    <div class="fig-row cb-stats" style="margin-top:10px"></div>
    <div class="fig-row vl-cands"><div class="table-wrap" style="width:100%"><table class="cb-metrics"></table></div></div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [`<svg viewBox="0 0 22 14"><defs>${cbHatchDef("vlt-hatch-lg")}</defs><rect x="3" y="1.5" width="16" height="11" rx="2" style="fill:url(#vlt-hatch-lg)" class="vl-pad"/></svg>`, "паддинг"],
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="vl-tile"/></svg>`, "граница тайла"],
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="vl-pgrid"/></svg>`, "граница токена"]
    ])}</div>`;
  const svg = box.querySelector(".fig-stage svg"), say = box.querySelector(".fig-say"), stats = box.querySelector(".cb-stats");
  const candRow = box.querySelector(".vl-cands"), candTable = candRow.querySelector("table");
  let geom = null;

  function draw(step){
    const sc = VL_SCENES[kind], W = sc.W, H = sc.H, VW = cbFit(svg, 340, 640), wide = VW >= 520;
    const BH = wide ? 270 : 230, TOP = 20;
    let s = `<defs>${cbHatchDef("vlt-hatch")}</defs>`, tokens = 0, scale = 1, narr = "";
    const fit = (w, h, bw, bh) => Math.min(bw / w, bh / h);
    const grid = (x, y, w, h, nx, ny, cls) => { let g = ""; for (let i = 1; i < nx; i++) g += `<line x1="${f1(x + i * w / nx)}" y1="${f1(y)}" x2="${f1(x + i * w / nx)}" y2="${f1(y + h)}" class="${cls}"/>`; for (let j = 1; j < ny; j++) g += `<line x1="${f1(x)}" y1="${f1(y + j * h / ny)}" x2="${f1(x + w)}" y2="${f1(y + j * h / ny)}" class="${cls}"/>`; return g; };
    const padded = (x, y, k, CW, CH, dx, dy) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(CW * k)}" height="${f1(CH * k)}" class="vl-pad" style="fill:url(#vlt-hatch)"/>` + vlScene(kind, x + dx * k, y + dy * k, k);
    const dimLabel = (x, y, t) => `<text x="${f1(x)}" y="${f1(y)}" class="vl-cap">${t}</text>`;
    geom = null;
    if (mode === "squash"){
      const M = Math.max(W, H); scale = 336 / M; tokens = 576;
      if (step === 0){
        const k = fit(W, H, VW, BH); s += vlScene(kind, 0, TOP, k) + `<rect x="0" y="${TOP}" width="${f1(W * k)}" height="${f1(H * k)}" class="frame"/>` + dimLabel(0, 12, `${W} × ${H}`);
      } else {
        const k = fit(M, M, VW, BH), dx = (M - W) / 2, dy = (M - H) / 2;
        s += padded(0, TOP, k, M, M, dx, dy);
        s += `<rect x="0" y="${TOP}" width="${f1(M * k)}" height="${f1(M * k)}" class="frame"/>`;
        if (step === 2) s += grid(0, TOP, M * k, M * k, 24, 24, "vl-pgrid");
        s += dimLabel(0, 12, step === 1 ? `${M} × ${M}` : `336 × 336: 24 × 24 патча`);
      }
      narr = [
        `<b>Исходная картинка ${W} × ${H}.</b> Энкодер CLIP ViT-L/14 обучен на 336 × 336, и его позиционные эмбеддинги рассчитаны на сетку 24 × 24. Самый простой способ — привести любую картинку к этому размеру.`,
        `<b>Дополнение до квадрата.</b> LLaVA-1.5 сначала дополняет картинку до квадрата ${M} × ${M} средним цветом, чтобы не исказить пропорции. ${W !== H ? `Паддинг занимает ${Math.round((1 - W * H / (M * M)) * 100)}% площади — эти пиксели тоже станут токенами.` : ""}`,
        `<b>Сжатие до 336 × 336 и 576 патчей.</b> Масштаб ×${fmtN(scale, 2)}: ${sc.text ? `строка текста высотой ${sc.text} px становится ${fmtN(sc.text * scale, 1)} px при патче 14 px, и буквы сливаются. ` : "Для общего описания сцены этого хватает, а мелкие детали вроде надписи на табличке пропадают. "}Зато всегда ровно 576 токенов.`
      ][step];
    } else if (mode === "anyres"){
      const { C, best } = vlAnyRes(W, H), n = best.c * best.r;
      scale = best.s; tokens = (n + 1) * 576;
      const thumbW = step === 3 ? (wide ? 150 : 110) : 0, MW = VW - (thumbW ? thumbW + 24 : 0);
      if (step === 0){
        const k = fit(W, H, MW, BH); s += vlScene(kind, 0, TOP, k) + `<rect x="0" y="${TOP}" width="${f1(W * k)}" height="${f1(H * k)}" class="frame"/>` + dimLabel(0, 12, `${W} × ${H}`);
      } else {
        const k = fit(best.Wc, best.Hc, MW, BH), dx = (best.Wc - best.dw) / 2, dy = (best.Hc - best.dh) / 2;
        s += `<rect x="0" y="${TOP}" width="${f1(best.Wc * k)}" height="${f1(best.Hc * k)}" class="vl-pad" style="fill:url(#vlt-hatch)"/>`;
        s += vlScene(kind, dx * k, TOP + dy * k, k * best.s);
        if (step >= 2){
          s += grid(0, TOP, best.Wc * k, best.Hc * k, best.c * 24, best.r * 24, "vl-pgrid faint");
          s += grid(0, TOP, best.Wc * k, best.Hc * k, best.c, best.r, "vl-tile");
          for (let i = 0; i < n; i++){ const c = i % best.c, r = Math.floor(i / best.c); s += `<text x="${f1(c * 336 * k + 6)}" y="${f1(TOP + r * 336 * k + 16)}" class="vl-tilet">${i + 1}</text>`; }
        }
        s += `<rect x="0" y="${TOP}" width="${f1(best.Wc * k)}" height="${f1(best.Hc * k)}" class="frame"/>`;
        s += dimLabel(0, 12, `сетка ${best.c} × ${best.r} тайла: ${best.Wc} × ${best.Hc}`);
        if (step === 3){
          const M = Math.max(W, H), tk = thumbW / M, tx = VW - thumbW, ty = TOP + 18;
          s += dimLabel(tx, 12, "общий план 336 × 336");
          s += `<rect x="${f1(tx)}" y="${f1(ty)}" width="${f1(thumbW)}" height="${f1(thumbW)}" class="vl-pad" style="fill:url(#vlt-hatch)"/>`;
          s += vlScene(kind, tx + (M - W) / 2 * tk, ty + (M - H) / 2 * tk, tk);
          s += grid(tx, ty, thumbW, thumbW, 24, 24, "vl-pgrid faint") + `<rect x="${f1(tx)}" y="${f1(ty)}" width="${f1(thumbW)}" height="${f1(thumbW)}" class="frame"/>`;
          s += `<text x="${f1(tx)}" y="${f1(ty + thumbW + 16)}" class="vl-cap">+ 576 токенов</text>`;
        }
      }
      candTable.innerHTML = `<thead><tr><th>Сетка</th><th>Холст</th><th>Масштаб</th><th>Пикселей картинки, Мп</th><th>Пустых, Мп</th></tr></thead><tbody>` +
        C.map((x) => `<tr${x === best ? ' class="on"' : ""}><td>${x.c} × ${x.r}</td><td>${x.Wc} × ${x.Hc}</td><td>×${fmtN(x.s, 2)}</td><td>${fmtN(x.eff / 1e6, 2)}</td><td>${fmtN(x.waste / 1e6, 2)}</td></tr>`).join("") + `</tbody>`;
      narr = [
        `<b>Выбор сетки.</b> Кандидаты — сетки из тайлов 336 × 336: 2 × 2, 1 × {2, 3, 4} и {2, 3, 4} × 1. Для каждой картинка вписывается в холст с сохранением пропорций; выбирается сетка, где от картинки сохраняется больше всего пикселей (без увеличения сверх исходного размера), а при равенстве — где меньше пустого места. Для ${W} × ${H} побеждает ${best.c} × ${best.r}.`,
        `<b>Ресайз в сетку.</b> Картинка масштабируется в ×${fmtN(best.s, 2)} до ${best.dw} × ${best.dh} и центрируется на холсте ${best.Wc} × ${best.Hc}; остаток — паддинг.`,
        `<b>Нарезка на тайлы.</b> Каждый тайл 336 × 336 идёт через энкодер отдельно, как самостоятельная картинка, и даёт свои 576 токенов: ${n} × 576 = ${n * 576}. ${sc.text ? `Строка текста теперь ${fmtN(sc.text * best.s, 1)} px вместо ${fmtN(sc.text * 336 / Math.max(W, H), 1)} px при простом сжатии.` : "Детали, вроде надписи на табличке, теперь различимы."}`,
        `<b>Общий план.</b> Тайлы не видят друг друга, и объект на стыке режется пополам. Поэтому добавляют всю картинку, сжатую до 336 × 336, — ещё 576 токенов. Итого (${n} + 1) × 576 = ${tokens} токенов: в ${n + 1} ${plural(n + 1, "раз", "раза", "раз")} больше, чем при сжатии.`
      ][step];
    } else {
      const r = vlQwenResize(W, H), gh = r.h / 14, gw = r.w / 14, th = r.h / 28, twn = r.w / 28;
      scale = r.w / W; tokens = th * twn;
      if (step === 0){
        const k = fit(W, H, VW, BH); s += vlScene(kind, 0, TOP, k) + `<rect x="0" y="${TOP}" width="${f1(W * k)}" height="${f1(H * k)}" class="frame"/>` + dimLabel(0, 12, `${W} × ${H}`);
      } else {
        const k = fit(r.w, r.h, VW, BH);
        s += vlScene(kind, 0, TOP, k * r.w / W);
        if (step === 2) s += grid(0, TOP, r.w * k, r.h * k, gw, gh, "vl-pgrid faint");
        if (step === 3){
          s += grid(0, TOP, r.w * k, r.h * k, twn, th, "vl-pgrid");
          sel = [Math.min(sel[0], th - 1), Math.min(sel[1], twn - 1)];
          const cw = r.w * k / twn, ch = r.h * k / th;
          s += `<rect x="${f1(sel[1] * cw)}" y="${f1(TOP + sel[0] * ch)}" width="${f1(cw)}" height="${f1(ch)}" class="vl-sel"/>`;
          geom = { x: 0, y: TOP, cw, ch, rows: th, cols: twn };
        }
        s += `<rect x="0" y="${TOP}" width="${f1(r.w * k)}" height="${f1(r.h * k)}" class="frame"/>`;
        s += dimLabel(0, 12, step === 1 ? `${r.w} × ${r.h}` : step === 2 ? `${gw} × ${gh} патчей 14 × 14` : `${twn} × ${th} токенов по 28 × 28 px`);
      }
      const T0 = 12, pos = [T0, T0 + sel[0], T0 + sel[1]];
      narr = [
        `<b>Исходная картинка ${W} × ${H}.</b> В Qwen2-VL энкодер обучен на картинках разного размера и с 2D RoPE вместо таблицы позиций, поэтому картинку не нужно приводить к одному квадрату.`,
        `<b>Подгонка размера.</b> Стороны округляются до кратных 28, а площадь загоняется в границы [min_pixels, max_pixels] с сохранением пропорций. Здесь max_pixels = 1280 · 28², поэтому получается ${r.w} × ${r.h}, масштаб ×${fmtN(scale, 2)}. ${sc.text ? `Строка текста: ${fmtN(sc.text * scale, 1)} px.` : ""}`,
        `<b>Патчи 14 × 14.</b> Энкодер режет картинку на ${gw} × ${gh} = ${gw * gh} патчей и обрабатывает их все вместе — без стыков между тайлами.`,
        `<b>Слияние 2 × 2.</b> Соседние 4 патча склеиваются в вектор и сжимаются MLP в один токен — по токену на 28 × 28 пикселей: (${r.h}/28)·(${r.w}/28) = ${th} · ${twn} = ${tokens}. Выделенный токен (строка ${sel[0] + 1}, столбец ${sel[1] + 1}) получает в M-RoPE позицию \\((t, h, w) = (${pos.join(", ")})\\), если перед картинкой ${T0} текстовых токенов. Нажмите на другой токен.`
      ][step];
    }
    if (mode !== "anyres") candRow.hidden = true; else candRow.hidden = false;
    const VH = TOP + BH + 24;
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;
    stats.innerHTML = `<span>визуальных токенов: <b>${tokens.toLocaleString("ru-RU")}</b></span><span>масштаб: <b>×${fmtN(scale, 2)}</b></span>` +
      (sc.text ? `<span>строка текста: <b class="${sc.text * scale < 6 ? "bad" : ""}">${sc.text} → ${fmtN(sc.text * scale, 1)} px</b></span>` : "");
    say.innerHTML = narr;
  }
  const player = vlPlayer(box, { count: () => MODES[mode].steps.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${MODES[mode].steps[i]}` });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.mode === mode) return;
    mode = b.dataset.mode; box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop(); player.go(0);
  }));
  box.querySelectorAll("[data-kind]").forEach((b) => b.addEventListener("click", () => {
    kind = b.dataset.kind; box.querySelectorAll("[data-kind]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    player.stop(); player.paint();
  }));
  svg.addEventListener("click", (e) => {
    if (!geom) return;
    const p = svgPoint(svg, e), r = Math.floor((p.y - geom.y) / geom.ch), c = Math.floor((p.x - geom.x) / geom.cw);
    if (r < 0 || c < 0 || r >= geom.rows || c >= geom.cols) return;
    sel = [r, c]; player.paint();
  });
  player.paint();
  const off = cbResize(svg, () => player.paint());
  return () => { player.stop(); off(); };
}

// Регистрация иллюстраций: имя из data-figure → функция монтирования
Object.assign(FIGURES, {
  "vl-patch": mountVlPatch,
  "vl-clip": mountVlClip,
  "vl-pipeline": mountVlPipeline,
  "vl-fusion": mountVlFusion,
  "vl-tiles": mountVlTiles
});
