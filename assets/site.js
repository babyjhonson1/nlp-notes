/* Движок сайта: загрузка оглавления и разделов, навигация, формулы, панели.
   Меняется только по прямой просьбе. Порядок загрузки скриптов задан в index.html. */

let NOTEBOOK = { title: "Конспекты по NLP", chapters: [] };

// Оглавление и тексты разделов лежат отдельными файлами: outline.json и sections/<глава>/<раздел>.html
async function loadOutline() {
  const r = await fetch("outline.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`outline.json: ${r.status}`);
  NOTEBOOK = await r.json();
}
const sectionCache = new Map();
async function loadSection(chapterId, sectionId) {
  const key = `${chapterId}/${sectionId}`;
  if (!sectionCache.has(key)) {
    sectionCache.set(key, fetch(`sections/${key}.html`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => ""));
  }
  return sectionCache.get(key);
}
function showLoadError(err) {
  console.error(err);
  $("section-title").textContent = "Не удалось загрузить конспекты";
  $("section-body").innerHTML = `<div class="empty"><strong>Оглавление не загрузилось</strong>` +
    `Если сайт открыт как файл с диска, запустите в папке репозитория <code>python3 -m http.server 8000</code> ` +
    `и откройте http://localhost:8000.</div>`;
  document.documentElement.classList.remove("mj-wait");
}

let figureCleanups = [];
function mountFigures(root){
  figureCleanups.forEach(fn => fn()); figureCleanups = [];
  root.querySelectorAll("[data-figure]").forEach(fig => {
    const make = FIGURES[fig.dataset.figure], host = fig.querySelector("[data-mount]");
    if (!make || !host) return;
    try { const cleanup = make(host); if (typeof cleanup === "function") figureCleanups.push(cleanup); }
    catch (err) { host.innerHTML = `<p class="fig-hint">Иллюстрация не загрузилась: ${escapeHtml(err.message)}</p>`; }
  });
}


function route() {
  const [cId, sId, anchor] = location.hash.replace(/^#\/?/, "").split("/");
  const chapter = NOTEBOOK.chapters.find((c) => c.id === cId) || NOTEBOOK.chapters[0];
  const section = chapter.sections.find((s) => s.id === sId) || chapter.sections[0] || null;
  return { chapter, section, anchor };
}

/* ---------- Формулы: MathJax ---------- */
let mjReady = false, mjQueue = Promise.resolve();
function typesetMath(els) {
  if (!mjReady) return Promise.resolve();
  els.forEach((el) => el.classList.add("mj-busy"));
  mjQueue = mjQueue
    .then(() => MathJax.typesetPromise(els))
    .catch((e) => console.warn("MathJax:", e))
    .then(() => els.forEach((el) => el.classList.remove("mj-busy")));
  return mjQueue;
}
function clearMath(el) {
  if (mjReady && MathJax.typesetClear) { try { MathJax.typesetClear([el]); } catch (e) {} }
}
const hasTeX = (el) => /\\\(|\\\[/.test(el.textContent);
// тексты шагов в иллюстрациях меняются на лету: формулы в них рисуем заново
const sayObserver = new MutationObserver((muts) => {
  const els = [...new Set(muts.map((m) => (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest(".fig-say")))]
    .filter((el) => el && !el.classList.contains("mj-busy") && hasTeX(el));
  if (els.length) typesetMath(els);
});
function watchSay(root) {
  root.querySelectorAll(".fig-say").forEach((el) => sayObserver.observe(el, { childList: true, characterData: true, subtree: true }));
}
window.onMathJaxReady = () => {
  mjReady = true;
  const targets = [$("section-body")];
  const glossary = document.querySelector(".glossary-popover:not([hidden])");
  if (glossary) targets.push(glossary);
  typesetMath(targets).then(() => document.documentElement.classList.remove("mj-wait"));
};
if (window.__mjReady) window.onMathJaxReady();

// Просматриваемая в панели глава независима от открытого текста и URL.
function renderNavigation(chapter) {
  const reading = route();
  [$("chapters"), $("sections")].forEach(el => el.style.setProperty("--chapter", chapter.color));
  // Главы
  $("chapter-list").innerHTML = NOTEBOOK.chapters.map((c) => `
    <li>
      <button type="button" class="chapter-link" data-chapter="${c.id}" style="--c:${c.color}" title="${escapeHtml(c.title)}" aria-controls="section-list"
         ${c.id === chapter.id ? 'aria-current="true"' : ""}>
        <span class="swatch" aria-hidden="true"></span><span class="label">${escapeHtml(c.title)}</span>
      </button>
    </li>`).join("");

  // Разделы
  const n = chapter.sections.length;
  $("chapter-title").textContent = chapter.title;
  $("sections-rail").textContent = chapter.title;
  $("chapter-count").textContent = n ? `${n} ${plural(n, "раздел", "раздела", "разделов")}` : "Разделов пока нет";
  $("section-list").innerHTML = chapter.sections.map((s) => `
    <li>
      <a class="section-link" href="#/${chapter.id}/${s.id}"
         ${reading.chapter.id === chapter.id && reading.section?.id === s.id ? 'aria-current="page"' : ""}>${escapeHtml(s.title)}</a>
    </li>`).join("");
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const { chapter, section, anchor } = route();
  if (typeof closeGlossary === "function") closeGlossary();
  document.documentElement.style.setProperty("--chapter", chapter.color);
  renderNavigation(chapter);

  // Страница
  $("crumb").innerHTML = `<button type="button" data-chapter="${chapter.id}">${escapeHtml(chapter.title)}</button>`;
  if (!section) {
    $("section-title").textContent = chapter.title;
    $("section-body").innerHTML = `<div class="empty"><strong>В главе пока нет разделов</strong>Добавленные разделы появятся в панели слева.</div>`;
    $("pager").hidden = true;
    document.title = `${chapter.title} · ${NOTEBOOK.title}`;
    return;
  }
  $("section-title").textContent = section.title;
  const html = await loadSection(chapter.id, section.id);
  if (seq !== renderSeq) return; // пока грузили, пользователь ушёл в другой раздел
  const body = $("section-body");
  clearMath(body);
  body.innerHTML = html.trim()
    ? `<div class="content">${html}</div>`
    : `<div class="empty"><strong>Конспект ещё не написан</strong>Материал этого раздела появится здесь.</div>`;
  mountFigures(body);
  if (typeof mountGlossaryTerms === "function") mountGlossaryTerms(body);
  watchSay(body);
  typesetMath([body]).then(() => {
    if (seq !== renderSeq || !anchor) return;
    const target = document.getElementById(anchor);
    if (target) target.scrollIntoView({ block: "start" });
  });

  // Предыдущий / следующий раздел
  const i = chapter.sections.indexOf(section);
  const prev = chapter.sections[i - 1], next = chapter.sections[i + 1];
  $("pager").innerHTML =
    (prev ? `<a class="prev" href="#/${chapter.id}/${prev.id}"><span>Предыдущий раздел</span><strong>${escapeHtml(prev.title)}</strong></a>` : "") +
    (next ? `<a class="next" href="#/${chapter.id}/${next.id}"><span>Следующий раздел</span><strong>${escapeHtml(next.title)}</strong></a>` : "");
  $("pager").hidden = !prev && !next;

  document.title = `${section.title} — ${chapter.title} · ${NOTEBOOK.title}`;
  $("page").scrollTop = 0;
  if (window.matchMedia("(max-width: 820px)").matches) window.scrollTo(0, 0);
}

/* ---------- Сворачивание панелей ---------- */
const app = document.querySelector(".app");
const UI_KEY = "nlp-notes-ui";
let ui = { ch: false, sec: false, chWidth: 210, secWidth: 270 };
try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY) || "{}") }; } catch (e) {}
const panelSettings = {
  ch: { min: 160, max: 420, initial: 210, collapsed: 56, id: "chapters" },
  sec: { min: 190, max: 560, initial: 270, collapsed: 44, id: "sections" }
};
for (const [key, settings] of Object.entries(panelSettings)) {
  const value = ui[`${key}Width`];
  ui[`${key}Width`] = Number.isFinite(value)
    ? Math.max(settings.min, Math.min(settings.max, value)) : settings.initial;
}
function saveUI() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) {}
}

// При сужении окна сохраняем место для текста, не теряя предпочтения пользователя.
function panelWidths() {
  const widths = Object.fromEntries(Object.entries(panelSettings).map(([key, s]) =>
    [key, ui[key] ? s.collapsed : ui[`${key}Width`]]));
  const excess = Math.max(0, widths.ch + widths.sec - Math.max(350, window.innerWidth - 360));
  const room = Object.fromEntries(Object.entries(panelSettings).map(([key, s]) =>
    [key, ui[key] ? 0 : Math.max(0, widths[key] - s.min)]));
  const total = room.ch + room.sec;
  if (total) for (const key of ["ch", "sec"]) widths[key] -= Math.min(excess, total) * room[key] / total;
  return widths;
}

function applyUI() {
  app.classList.toggle("ch-collapsed", ui.ch);
  app.classList.toggle("sec-collapsed", ui.sec);
  const widths = panelWidths();
  for (const [key, settings] of Object.entries(panelSettings)) {
    app.style.setProperty(`--${key}-expanded`, `${widths[key]}px`);
    const handle = $(`resize-${settings.id}`);
    handle.setAttribute("aria-valuenow", Math.round(widths[key]));
    handle.setAttribute("aria-valuemin", settings.min);
    handle.setAttribute("aria-valuemax", settings.max);
    handle.setAttribute("aria-valuetext", `${Math.round(widths[key])} пикселей`);
  }
  const setBtn = (btn, collapsed, what) => {
    const label = `${collapsed ? "Развернуть" : "Свернуть"} ${what} (${what === "главы" ? "[" : "]"})`;
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.setAttribute("aria-label", label);
    btn.title = label;
  };
  setBtn($("toggle-chapters"), ui.ch, "главы");
  setBtn($("toggle-sections"), ui.sec, "разделы");
}
function togglePanel(key) {
  ui[key] = !ui[key];
  saveUI();
  applyUI();
}

/* ---------- Изменение ширины панелей ---------- */
for (const [key, settings] of Object.entries(panelSettings)) {
  const handle = $(`resize-${settings.id}`);
  let drag = null;
  const setWidth = value => {
    const other = key === "ch" ? "sec" : "ch";
    const max = Math.min(settings.max, window.innerWidth - panelWidths()[other] - 360);
    ui[`${key}Width`] = Math.round(Math.max(settings.min, Math.min(max, value)));
    applyUI();
  };
  handle.addEventListener("pointerdown", e => {
    if (e.button !== 0 || ui[key] || window.innerWidth <= 820) return;
    e.preventDefault();
    handle.focus();
    drag = { x: e.clientX, width: panelWidths()[key], id: e.pointerId };
    handle.setPointerCapture(e.pointerId);
    app.classList.add("resizing");
  });
  handle.addEventListener("pointermove", e => {
    if (drag && drag.id === e.pointerId) setWidth(drag.width + e.clientX - drag.x);
  });
  const finish = e => {
    if (!drag || drag.id !== e.pointerId) return;
    drag = null;
    app.classList.remove("resizing");
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    saveUI();
  };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => handle.addEventListener(type, finish));
  handle.addEventListener("keydown", e => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setWidth(e.key === "Home" ? settings.min : e.key === "End" ? settings.max :
      panelWidths()[key] + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 40 : 10));
    saveUI();
  });
  handle.addEventListener("dblclick", () => {
    ui[`${key}Width`] = settings.initial;
    applyUI();
    saveUI();
  });
}
window.addEventListener("resize", applyUI);

document.addEventListener("click", e => {
  const button = e.target.closest("button[data-chapter]");
  if (!button) return;
  const chapter = NOTEBOOK.chapters.find(c => c.id === button.dataset.chapter);
  if (!chapter) return;
  const fromChapterList = button.classList.contains("chapter-link");
  renderNavigation(chapter);
  if (ui.sec) togglePanel("sec");
  // Перерисовка списка не должна терять фокус клавиатуры.
  if (fromChapterList) document.querySelector(`.chapter-link[data-chapter="${chapter.id}"]`).focus({ preventScroll: true });
});

$("toggle-chapters").addEventListener("click", () => togglePanel("ch"));
$("toggle-sections").addEventListener("click", (e) => { e.stopPropagation(); togglePanel("sec"); });
// в свёрнутом виде клик по полоске разделов разворачивает её
$("sections").addEventListener("click", () => { if (ui.sec) togglePanel("sec"); });

// [ — главы, ] — разделы
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.closest("input, textarea, [contenteditable]")) return;
  if (e.key === "[" || e.code === "BracketLeft") togglePanel("ch");
  if (e.key === "]" || e.code === "BracketRight") togglePanel("sec");
});

// оглавление внутри раздела: прокрутка к заголовку, адрес страницы не меняется
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-jump]");
  if (!a) return;
  e.preventDefault();
  const target = document.getElementById(a.dataset.jump);
  if (!target) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
});

applyUI();
window.addEventListener("hashchange", render);
loadOutline().then(render).catch(showLoadError);
