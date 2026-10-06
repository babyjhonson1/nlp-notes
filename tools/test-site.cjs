// Лёгкие проверки логики навигации и панелей без браузера и зависимостей.
// Запуск из корня: node tools/test-site.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  const classes = new Set(), attrs = {}, events = {}, styles = {};
  return {
    innerHTML: '', textContent: '', scrollTop: 0, dataset: {}, attrs, events, styles,
    style: { setProperty: (key, value) => { styles[key] = value; } },
    classList: {
      add: key => classes.add(key), remove: key => classes.delete(key),
      contains: key => classes.has(key),
      toggle: (key, value) => value ? classes.add(key) : classes.delete(key)
    },
    setAttribute: (key, value) => { attrs[key] = String(value); },
    addEventListener: (type, fn) => { (events[type] ||= []).push(fn); },
    querySelectorAll: () => [], focus() {},
    setPointerCapture() {}, hasPointerCapture: () => false,
    closest: () => null
  };
}
const els = new Map(), app = element(), document = element();
document.documentElement = element();
document.getElementById = id => {
  if (!els.has(id)) els.set(id, element());
  return els.get(id);
};
document.querySelector = selector => selector === '.app' ? app : element();
const stored = new Map(), location = { hash: '#/models/dpr' };
const window = { ...element(), innerWidth: 1400, matchMedia: () => ({ matches: false }) };
let requests = 0;
const context = vm.createContext({
  console, document, window, location,
  localStorage: { getItem: k => stored.get(k), setItem: (k, v) => stored.set(k, v) },
  MutationObserver: class { observe() {} },
  fetch: async url => {
    requests++;
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(url, 'utf8')),
      text: async () => '<p>Тестовый текст раздела</p>' };
  }
});
const run = code => vm.runInContext(code, context);
const fire = (target, type, detail = {}) => (target.events[type] || []).forEach(fn =>
  fn({ preventDefault() {}, ...detail }));
run(fs.readFileSync('assets/core.js', 'utf8'));
run(fs.readFileSync('assets/site.js', 'utf8'));

setImmediate(async () => {
  try {
    const get = document.getElementById;
    assert.match(get('section-title').textContent, /DPR/);
    get('page').scrollTop = 700;
    const originalBody = get('section-body').innerHTML;
    const originalTitle = document.title;
    const beforeRequests = requests;
    const chapter = element();
    chapter.dataset.chapter = 'rag';
    chapter.classList.add('chapter-link');
    chapter.closest = selector => selector === 'button[data-chapter]' ? chapter : null;
    fire(document, 'click', { target: chapter });
    assert.equal(location.hash, '#/models/dpr');
    assert.equal(get('page').scrollTop, 700);
    assert.equal(get('section-body').innerHTML, originalBody);
    assert.equal(document.title, originalTitle);
    assert.equal(requests, beforeRequests);
    assert.equal(get('chapter-title').textContent, 'RAG');
    assert.doesNotMatch(get('section-list').innerHTML, /aria-current="page"/);
    assert.equal(document.documentElement.styles['--chapter'], '#A63D5A');
    assert.equal(get('sections').styles['--chapter'], '#2E6E73');

    location.hash = '#/rag/ann';
    await run('render()');
    assert.match(get('section-title').textContent, /ANN/);
    assert.equal(get('page').scrollTop, 0);
    assert.match(get('section-list').innerHTML, /aria-current="page"/);

    const handle = get('resize-chapters');
    fire(handle, 'pointerdown', { button: 0, clientX: 210, pointerId: 1 });
    fire(handle, 'pointermove', { clientX: 310, pointerId: 1 });
    fire(handle, 'pointerup', { pointerId: 1 });
    assert.equal(run('ui.chWidth'), 310);
    assert.equal(JSON.parse(stored.get('nlp-notes-ui')).chWidth, 310);
    assert.equal(app.classList.contains('resizing'), false);
    fire(handle, 'keydown', { key: 'ArrowLeft' });
    assert.equal(run('ui.chWidth'), 300);
    run('togglePanel("ch")');
    assert.equal(run('panelWidths().ch'), 56);
    run('togglePanel("ch")');
    assert.equal(run('panelWidths().ch'), 300);
    fire(handle, 'dblclick');
    assert.equal(run('ui.chWidth'), 210);

    run('ui.chWidth = 420; ui.secWidth = 560');
    window.innerWidth = 821;
    run('applyUI()');
    assert.ok(run('panelWidths().ch + panelWidths().sec') <= 461.001);
    assert.equal(run('ui.chWidth'), 420); // предпочтение не теряется при сужении окна
    window.innerWidth = 1600;
    assert.equal(run('panelWidths().ch'), 420);
    assert.equal(run('panelWidths().sec'), 560);
    window.innerWidth = 700;
    fire(handle, 'pointerdown', { button: 0, clientX: 210, pointerId: 2 });
    fire(handle, 'pointermove', { clientX: 310, pointerId: 2 });
    assert.equal(run('ui.chWidth'), 420); // мобильная раскладка не растягивается
    console.log('Навигация, сохранение позиции, перетаскивание, клавиатура и границы ширины: OK');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
});
