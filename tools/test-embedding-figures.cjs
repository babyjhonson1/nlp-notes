// Проверка обработчиков и арифметики схем без браузера, моделей и зависимостей.
// Не проверяет визуальную раскладку. Запуск: node tools/test-embedding-figures.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function element(dataset = {}) {
  return {
    dataset, innerHTML: '', textContent: '', attrs: {}, events: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(k, f) { (this.events[k] ||= []).push(f); },
    matches: () => false,
    fire(k, e = {}) { for (const f of this.events[k] || []) f({ target: this, preventDefault() {}, ...e }); }
  };
}
let timerId = 0;
const timers = new Map(), observers = [];
const ctx = vm.createContext({
  console,
  setInterval(f) { timers.set(++timerId, f); return timerId; },
  clearInterval(k) { timers.delete(k); },
  ResizeObserver: class {
    constructor(f) { this.f = f; observers.push(this); }
    observe() {}
    disconnect() { this.closed = true; }
  }
});
const run = code => vm.runInContext(code, ctx);
for (const f of ['assets/core.js', 'figures/common.js', 'figures/vl.js', 'figures/mdl.js', 'figures/colbert.js']) {
  run(fs.readFileSync(path.join(root, f), 'utf8'));
}
const specs = { 'colbert-encode': 3, 'colbert-flow': 3, 'colbert-index': 4 };
let frames = 0;
for (const width of [340, 480, 680]) {
  for (const [id, count] of Object.entries(specs)) {
    const box = element(), stage = element(), svg = element(), say = element(), status = element();
    const back = element(), fwd = element(), play = element();
    const docs = [element({ doc: 'pos' }), element({ doc: 'neg' })], rows = [element({ row: 'train' })];
    stage.getBoundingClientRect = () => ({ width });
    stage.querySelector = () => svg;
    const selectors = {
      '.fig-stage': stage, '.fig-say': say, '.fig-status': status,
      '[data-act="back"]': back, '[data-act="fwd"]': fwd, '[data-act="play"]': play
    };
    box.querySelector = s => selectors[s] || null;
    box.querySelectorAll = s => s === '[data-doc]' ? docs : s === '[data-row]' ? rows : [];
    const cleanup = run('FIGURES[' + JSON.stringify(id) + ']')(box);
    const viewBox = svg.attrs.viewBox;
    assert.equal(Number(viewBox.split(' ')[2]), width);
    const order = ['fig-stage', 'fig-row', 'fig-say', 'fig-legend'].map(s => box.innerHTML.indexOf(s));
    assert.ok(order.every((v, i) => v >= 0 && (!i || v > order[i - 1])));
    const check = () => {
      frames++;
      assert.equal(svg.attrs.viewBox, viewBox);
      assert.doesNotMatch(svg.innerHTML + say.innerHTML, /undefined|NaN|Infinity/);
      assert.match(svg.innerHTML, /<text /);
      assert.equal((say.innerHTML.match(/\\\(/g) || []).length, (say.innerHTML.match(/\\\)/g) || []).length);
    };
    check();
    assert.ok(back.disabled);
    if (id === 'colbert-flow') assert.match(say.innerHTML, /6\.40/);
    for (let i = 1; i < count; i++) {
      fwd.fire('click'); check();
      assert.match(status.textContent, new RegExp('шаг ' + (i + 1) + ' из ' + count));
    }
    assert.ok(fwd.disabled);
    if (id === 'colbert-flow') {
      assert.match(say.innerHTML, /self-attention/);
      back.fire('click');
      assert.match(say.innerHTML, /0\.67/);
      assert.match(say.innerHTML, /0\.40/);
      back.fire('click'); docs[1].fire('click');
      assert.match(say.innerHTML, /5\.70/);
      assert.equal(docs[1].attrs['aria-selected'], 'true');
      check();
    }
    box.fire('keydown', { key: 'ArrowLeft' });
    play.fire('click');
    assert.equal(timers.size, 1);
    timers.values().next().value(); check();
    observers.at(-1).f(); check();
    cleanup();
    assert.equal(timers.size, 0);
    assert.ok(observers.at(-1).closed);
  }
}
const p = 1 / (1 + Math.exp(-0.7));
assert.ok(Math.abs(p - 0.6681877722) < 1e-9);
assert.ok(Math.abs(-Math.log(p) - 0.4031860489) < 1e-9);
// Для одного уникального максимума производная по клетке — индикатор победителя.
const a = [0.23, 0.81, 0.19], h = 1e-6;
for (let i = 0; i < a.length; i++) {
  const x = [...a], y = [...a]; x[i] += h; y[i] -= h;
  assert.ok(Math.abs((Math.max(...x) - Math.max(...y)) / (2 * h) - Number(i === 1)) < 1e-8);
}
console.log('Схемы эмбеддингов: ' + frames + ' состояний, переключатели, очистка и арифметика — OK; без визуальной проверки.');
