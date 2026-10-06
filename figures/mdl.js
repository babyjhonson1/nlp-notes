/* Общие помощники схем главы «Модели» (префикс mdl), стили — figures/mdl.css.
   Схемы кодировщиков строятся снизу вверх, как в статьях: входные тексты → кодировщик →
   векторы токенов → вектор текста → голова и функция потерь. Стрелки — vlArrow,
   проигрыватель шагов — vlControls и vlPlayer (figures/vl.js), ширина — cbFit и cbResize (figures/common.js). */

const mdlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/* число с точкой и без «-0.00» */
const mdlNum = (x, d = 2) => (Math.round(x * Math.pow(10, d)) === 0 ? 0 : x).toFixed(d).replace("-", "−");
/* текст под ширину w: перенос по словам, не больше maxLines строк, лишнее — многоточие */
function mdlWrap(text, w, px = 11, maxLines = 2){
  const cw = px * 0.56, fit = Math.max(4, Math.floor(w / cw)), lines = [];
  let cur = "";
  for (const word of String(text).split(" ")){
    const t = cur ? cur + " " + word : word;
    if (t.length <= fit || !cur) cur = t; else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, maxLines);
  const last = out.length - 1;
  if (lines.length > maxLines || out[last].length > fit) out[last] = out[last].slice(0, fit - 1).replace(/\s+$/, "") + "…";
  return out;
}
/* нижний индекс в SVG-подписи; rest — текст после индекса на исходной базовой линии */
const mdlSub = (base, s, rest = "") => `${base}<tspan class="mdl-sub" dy="3">${s}</tspan>${rest ? `<tspan dy="-3">${rest}</tspan>` : ""}`;
/* строки текста; y — базовая линия первой строки */
const mdlLines = (x, y, lines, cls, lh = 13, anchor = "middle") =>
  lines.map((t, i) => `<text x="${f1(x)}" y="${f1(y + i * lh)}" class="${cls}" text-anchor="${anchor}">${mdlEsc(t)}</text>`).join("");

/* Башня кодировщика: x — центр, top — верх. o.label — подпись (можно с <tspan>), o.cls — состояние:
   "on" (прямой проход), "grad" (обратный), "frozen" (веса не меняются), "q"/"p" — роль в DPR. */
function mdlTower(x, top, w, h, o = {}){
  const L = o.layers || 4, x0 = x - w / 2, lh = (h - 32) / L;
  const names = o.layerNames || ["слой 12", "…", "…", "слой 1"];
  let s = `<g class="mdl-tw ${o.cls || ""}"${o.fade ? ' opacity="0.25"' : ""}>`;
  s += `<rect x="${f1(x0)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}" rx="9" class="mdl-twbox"/>`;
  s += `<text x="${f1(x)}" y="${f1(top + 15)}" class="mdl-twt">${o.label}</text>`;
  for (let i = 0; i < L; i++){
    const y = top + 26 + i * lh;
    s += `<rect x="${f1(x0 + 8)}" y="${f1(y)}" width="${f1(w - 16)}" height="${f1(lh - 4)}" rx="3" class="mdl-layer"/>`;
    s += `<text x="${f1(x)}" y="${f1(y + (lh - 4) / 2)}" class="mdl-layert">${names[i]}</text>`;
  }
  return s + "</g>";
}

/* Ряд токенов: квадраты по центру x; kinds — "cls" | "tok" | "sep" | "pad". Возвращает центры квадратов. */
function mdlTokens(x, y, w, kinds, maxSize = 11){
  const n = kinds.length, gap = 2, sz = Math.min(maxSize, (w - gap * (n - 1)) / n);
  const x0 = x - (n * sz + (n - 1) * gap) / 2, xs = [];
  let svg = "";
  kinds.forEach((k, i) => {
    const xi = x0 + i * (sz + gap);
    xs.push(xi + sz / 2);
    svg += `<rect x="${f1(xi)}" y="${f1(y)}" width="${f1(sz)}" height="${f1(sz)}" rx="2" class="mdl-tok ${k}"/>`;
  });
  return { svg, xs, sz };
}
/* Векторы токенов на выходе кодировщика: столбики из трёх ячеек над каждым токеном.
   pick — индексы столбиков, которые идут дальше (остальные бледнее). */
function mdlBars(xs, sz, yBottom, h, kinds, seed, pick = null){
  const r = rng(seed);
  let s = "";
  xs.forEach((xc, i) => {
    const pad = kinds[i] === "pad", dim = pad || (pick && !pick.includes(i));
    s += `<g class="mdl-bar${pad ? " pad" : ""}"${dim ? ' opacity="0.3"' : ""}>`;
    for (let c = 0; c < 3; c++){
      const v = 2 * r() - 1;
      s += `<rect x="${f1(xc - sz / 2)}" y="${f1(yBottom - (c + 1) * h / 3)}" width="${f1(sz)}" height="${f1(h / 3 - 1)}" style="${vlVal(v)}"/>`;
    }
    s += `<rect x="${f1(xc - sz / 2)}" y="${f1(yBottom - h)}" width="${f1(sz)}" height="${f1(h - 1)}" class="mdl-barf"/></g>`;
  });
  return s;
}
/* Вектор как полоска ячеек; x — центр. o.label — подпись слева, o.cls — класс рамки. */
function mdlVec(x, y, w, seed, o = {}){
  const n = o.n || 8, h = o.h || 11, cw = w / n, r = rng(seed), x0 = x - w / 2;
  let s = `<g class="mdl-vec ${o.cls || ""}">`;
  for (let i = 0; i < n; i++) s += `<rect x="${f1(x0 + i * cw)}" y="${f1(y)}" width="${f1(cw - 1)}" height="${f1(h)}" style="${vlVal(2 * r() - 1)}"/>`;
  s += `<rect x="${f1(x0)}" y="${f1(y)}" width="${f1(w - 1)}" height="${f1(h)}" rx="1.5" class="mdl-vecf"/>`;
  if (o.label) s += `<text x="${f1(x0 - 5)}" y="${f1(y + h / 2)}" class="mdl-lbl" text-anchor="end">${o.label}</text>`;
  return s + "</g>";
}
/* Прямоугольник с подписью; x, y — центр. lines — [основная, вторая]. */
function mdlBox(x, y, w, h, lines, cls = ""){
  const [a, b] = lines;
  let s = `<rect x="${f1(x - w / 2)}" y="${f1(y - h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="7" class="mdl-box ${cls}"/>`;
  s += `<text x="${f1(x)}" y="${f1(y - (b ? 7 : 0))}" class="mdl-boxt">${a}</text>`;
  if (b) s += `<text x="${f1(x)}" y="${f1(y + 8)}" class="mdl-boxs">${b}</text>`;
  return s;
}
/* Плашка входного текста; x — центр, y — верх. */
function mdlChip(x, y, w, text, cls = "", h = 15){
  const t = mdlWrap(text, w - 10, 10.5, 1)[0];
  return `<rect x="${f1(x - w / 2)}" y="${f1(y)}" width="${f1(w)}" height="${h}" rx="4" class="mdl-chip ${cls}"/>` +
    `<text x="${f1(x - w / 2 + 5)}" y="${f1(y + h / 2)}" class="mdl-chipt">${mdlEsc(t)}</text>`;
}
/* Стрелки: прямой проход (on — активен) и градиент. Обе анимируются, пока шаг активен. */
const mdlFwd = (x1, y1, x2, y2, on) => vlArrow(x1, y1, x2, y2, on ? "vl-arr on mdl-flow" : "vl-arr");
const mdlGrad = (x1, y1, x2, y2) => vlArrow(x1, y1, x2, y2, "mdl-grad mdl-flow");
/* Провода от токенов к башне и от башни к векторам токенов */
const mdlWires = (xs, y1, y2, on) => xs.map((x) => `<line x1="${f1(x)}" y1="${f1(y1)}" x2="${f1(x)}" y2="${f1(y2)}" class="mdl-wire${on ? " on" : ""}"/>`).join("");
/* Воронка пулинга: от отрезка [a0, a1] на высоте yb к отрезку [b0, b1] на высоте yt */
const mdlFunnel = (a0, a1, yb, b0, b1, yt, on) =>
  `<path d="M${f1(a0)} ${f1(yb)} L${f1(a1)} ${f1(yb)} L${f1(b1)} ${f1(yt)} L${f1(b0)} ${f1(yt)} Z" class="mdl-pool${on ? " on" : ""}"/>`;
/* Бледность для элементов будущих шагов */
const mdlFade = (show) => show ? "" : ' opacity="0.22"';
/* Значок легенды для стрелок */
const mdlLegendArrow = (cls) => `<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="${cls}"/></svg>`;
