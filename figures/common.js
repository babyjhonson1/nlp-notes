/* Общие помощники для всех иллюстраций (геометрия, значки, легенды, форматирование). */

/* ---------- Иллюстрации к конспектам ----------
   В HTML раздела фигура — это <figure data-figure="имя"> с блоком [data-mount] внутри.
   После отрисовки страницы mountFigures() находит такие блоки и запускает FIGURES[имя]. */

function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r){ let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const polyStr = (poly) => poly.map(p => f1(p[0]) + "," + f1(p[1])).join(" ");
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/* полуплоскость n·p ≤ c отсекает выпуклый многоугольник */
function clipPoly(poly, n, c){
  const out = [];
  for (let i = 0; i < poly.length; i++){
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const da = n[0] * A[0] + n[1] * A[1] - c, db = n[0] * B[0] + n[1] * B[1] - c;
    if (da <= 0) out.push(A);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)){ const t = da / (da - db); out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
  }
  return out;
}
/* отрезок прямой n·p = c внутри выпуклого многоугольника */
function lineInPoly(poly, n, c){
  const hits = [];
  for (let i = 0; i < poly.length; i++){
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const da = n[0] * A[0] + n[1] * A[1] - c, db = n[0] * B[0] + n[1] * B[1] - c;
    if ((da <= 0 && db > 0) || (da > 0 && db <= 0)){ const t = da / (da - db); hits.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]); }
  }
  return hits.length >= 2 ? [hits[0], hits[1]] : null;
}
function svgPoint(svg, evt){
  const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
  const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
const ICON = {
  prev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>',
  next: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
  prev2: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3.5 3.5 8 8 12.5M12.5 3.5 8 8l4.5 4.5"/></svg>',
  next2: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 3.5 8 8l-4.5 4.5M8 3.5l4.5 4.5L8 12.5"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 3v10l8.5-5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>',
  dice: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.7" cy="5.7" r=".9" fill="currentColor" stroke="none"/><circle cx="10.3" cy="10.3" r=".9" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/></svg>'
};
/* значки легенды */
const LG = {
  node: (cls) => `<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="5.5" class="n ${cls}"/></svg>`,
  ring: (cls) => `<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="n"/><circle cx="11" cy="7" r="6.2" class="ring ${cls}"/></svg>`,
  line: (cls) => `<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="e ${cls}"/></svg>`,
  arrow: () => `<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="15" y2="7" class="e one"/><path d="M14 3.5 20 7 14 10.5z" class="arrowhead"/></svg>`,
  q: () => `<svg viewBox="0 0 22 14"><path d="M11 1.5 16.5 7 11 12.5 5.5 7z" class="n q"/></svg>`,
  dot: (cls) => `<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="3.6" class="dot ${cls}"/></svg>`,
  cell: (cls) => `<svg viewBox="0 0 22 14"><rect x="2" y="1.5" width="18" height="11" rx="2" class="cell ${cls}"/></svg>`,
  wedge: () => `<svg viewBox="0 0 22 14"><path d="M2 12 20 2 20 12z" class="wedge"/></svg>`,
  cent: (cls) => `<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4" class="cent ${cls}"/></svg>`
};
const legend = (items) => items.map(([icon, text]) => `<span>${icon}${text}</span>`).join("");
const qMark = (x, y, s = 7, cls = "n q") => `<path d="M${f1(x)} ${f1(y - s)} L${f1(x + s)} ${f1(y)} L${f1(x)} ${f1(y + s)} L${f1(x - s)} ${f1(y)} Z" class="${cls}"/>`;

/* ---------- Инференс: общие помощники ---------- */
const CB_G = ["var(--r1)", "var(--r2)", "var(--r3)", "var(--r4)", "var(--r5)", "var(--r6)", "var(--r7)", "var(--r8)"];
const fmtN = (x, d = 1) => x.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtMs = (x) => fmtN(x, x < 0.1 ? 2 : x < 100 ? 1 : 0);
const joinRu = (a) => a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " и " + a[a.length - 1];
const SUBD = "₀₁₂₃₄₅₆₇₈₉";
const subN = (n) => String(n).split("").map((d) => SUBD[+d]).join("");
/* Ширина viewBox подстраивается под реальную ширину блока: от lo до hi единиц,
   чтобы на телефоне подписи не уменьшались до нечитаемых. */
function cbFit(el, lo, hi){
  const w = el.getBoundingClientRect().width || hi;
  return Math.round(Math.max(lo, Math.min(hi, w)));
}
function cbResize(el, redraw){
  let last = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(el.getBoundingClientRect().width);
    if (w && Math.abs(w - last) > 4){ last = w; redraw(); }
  });
  ro.observe(el);
  return () => ro.disconnect();
}
const cbSwatch = (cls, style = "") => `<svg viewBox="0 0 22 14"><rect x="3" y="1.5" width="16" height="11" rx="2" class="${cls}" style="${style}"/></svg>`;
const cbHatchDef = (id) => `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="cb-hatch-l"/></pattern>`;
