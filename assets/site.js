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

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const { chapter, section, anchor } = route();
  if (typeof closeGlossary === "function") closeGlossary();
  document.documentElement.style.setProperty("--chapter", chapter.color);

  // Главы
  $("chapter-list").innerHTML = NOTEBOOK.chapters.map((c) => `
    <li>
      <a class="chapter-link" href="#/${c.id}" style="--c:${c.color}" title="${escapeHtml(c.title)}"
         ${c.id === chapter.id ? 'aria-current="true"' : ""}>
        <span class="swatch" aria-hidden="true"></span><span class="label">${escapeHtml(c.title)}</span>
      </a>
    </li>`).join("");

  // Разделы
  const n = chapter.sections.length;
  $("chapter-title").textContent = chapter.title;
  $("sections-rail").textContent = chapter.title;
  $("chapter-count").textContent = n ? `${n} ${plural(n, "раздел", "раздела", "разделов")}` : "Разделов пока нет";
  $("section-list").innerHTML = chapter.sections.map((s) => `
    <li>
      <a class="section-link" href="#/${chapter.id}/${s.id}"
         ${section && s.id === section.id ? 'aria-current="page"' : ""}>${escapeHtml(s.title)}</a>
    </li>`).join("");

  // Страница
  $("crumb").innerHTML = `<a href="#/${chapter.id}">${escapeHtml(chapter.title)}</a>`;
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
let ui = { ch: false, sec: false };
try { ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY) || "{}") }; } catch (e) {}

function applyUI() {
  app.classList.toggle("ch-collapsed", ui.ch);
  app.classList.toggle("sec-collapsed", ui.sec);
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
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) {}
  applyUI();
}

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
