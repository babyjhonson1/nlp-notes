// Без браузера, моделей и сторонних пакетов: арифметика и обработчики схем BGE.
// Это не проверка визуальной раскладки. Запуск: node tools/test-bge.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function element(dataset = {}) {
  return {
    dataset, innerHTML: '', textContent: '', attrs: {}, events: {}, disabled: false,
    setAttribute(key, value) { this.attrs[key] = String(value); },
    addEventListener(type, handler) { (this.events[type] ||= []).push(handler); },
    matches: () => false,
    fire(type, event = {}) {
      for (const handler of this.events[type] || []) {
        handler({ target: this, preventDefault() {}, ...event });
      }
    }
  };
}
let nextTimer = 0;
const timers = new Map(), observers = [];
const context = vm.createContext({
  console,
  setInterval(fn) { timers.set(++nextTimer, fn); return nextTimer; },
  clearInterval(id) { timers.delete(id); },
  ResizeObserver: class {
    constructor(fn) { this.fn = fn; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
});
const run = code => vm.runInContext(code, context);
for (const file of ['assets/core.js', 'figures/common.js', 'figures/vl.js', 'figures/mdl.js', 'figures/bge.js']) {
  run(fs.readFileSync(path.join(root, file), 'utf8'));
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, a + ' != ' + b);
const st = run('bgeDistillExample()');
for (const p of [...Object.values(st.probs), st.teacher]) {
  near(p.reduce((a, b) => a + b, 0), 1);
  assert.ok(p.every(v => v > 0 && v < 1));
}
[4.3, 1.95, 0].forEach((v, i) => near(st.ensemble[i], v));
[0.9017638961, 0.0860004673, 0.0122356366].forEach((v, i) => near(st.teacher[i], v));
const z = Array.from(run('BGE_KD_LOGITS.lex'));
const ce = logits => {
  context.testLogits = logits;
  const p = run('bgeSoftmax(testLogits)');
  return -p.reduce((sum, v, i) => sum + st.teacher[i] * Math.log(v), 0);
};
// Цель зафиксирована: численная производная мягкой CE равна P - T.
for (let i = 0; i < z.length; i++) {
  const plus = [...z], minus = [...z], h = 1e-5;
  plus[i] += h; minus[i] -= h;
  near((ce(plus) - ce(minus)) / (2 * h), st.gradient[i], 1e-7);
}
assert.ok(st.gradient[0] < 0 && st.gradient[1] > 0 && st.gradient[2] > 0);
assert.ok(ce(z.map((v, i) => v - 0.1 * st.gradient[i])) < ce(z));
const pContrast = run('bgeSoftmax([0.72, 0.68, 0.12].map(s => s / 0.1))');
near(pContrast[0], 0.5978005250);
near(-Math.log(pContrast[0]), 0.5144981507);

const mounts = run('({ "bge-flow": FIGURES["bge-flow"], "bge-retromae": FIGURES["bge-retromae"], "bge-distill": FIGURES["bge-distill"] })');
const counts = { 'bge-flow': 6, 'bge-retromae': 3, 'bge-distill': 4 };
let frames = 0;
for (const width of [340, 480, 680]) {
  for (const [id, mount] of Object.entries(mounts)) {
    const box = element(), svg = element(), stage = element(), say = element(), status = element();
    const back = element(), fwd = element(), play = element();
    const docs = [element({ doc: 'p1' }), element({ doc: 'p2' })];
    const targets = [element({ target: '1' }), element({ target: '5' })];
    stage.querySelector = selector => selector === 'svg' ? svg : null;
    stage.getBoundingClientRect = () => ({ width });
    const selectors = {
      '.fig-stage': stage, '.fig-say': say, '.fig-status': status,
      '[data-act="back"]': back, '[data-act="fwd"]': fwd, '[data-act="play"]': play
    };
    box.querySelector = selector => selectors[selector] || null;
    box.querySelectorAll = selector => selector === '[data-doc]' ? docs :
      selector === '[data-target]' ? targets : [];
    const cleanup = mount(box);
    assert.equal(typeof cleanup, 'function');
    const positions = ['fig-stage', 'fig-row', 'fig-say', 'fig-legend'].map(s => box.innerHTML.indexOf(s));
    assert.ok(positions.every((v, i) => v >= 0 && (i === 0 || v > positions[i - 1])));
    const viewBox = svg.attrs.viewBox;
    assert.equal(Number(viewBox.split(' ')[2]), width);
    const checkFrame = () => {
      frames++;
      assert.equal(svg.attrs.viewBox, viewBox, 'Управление не должно прыгать между кадрами');
      assert.doesNotMatch(svg.innerHTML + say.innerHTML, /NaN|undefined|Infinity/);
      assert.match(svg.innerHTML, /<text /);
      assert.ok(say.innerHTML.length > 60);
      assert.equal((say.innerHTML.match(/\\\(/g) || []).length, (say.innerHTML.match(/\\\)/g) || []).length);
    };
    checkFrame();
    assert.ok(back.disabled);
    for (let i = 1; i < counts[id]; i++) {
      fwd.fire('click');
      assert.match(status.textContent, new RegExp('шаг ' + (i + 1) + ' из ' + counts[id]));
      checkFrame();
    }
    assert.ok(fwd.disabled);
    box.fire('keydown', { key: 'ArrowLeft' });
    assert.ok(!fwd.disabled);
    if (id === 'bge-flow') {
      docs[1].fire('click');
      assert.equal(docs[1].attrs['aria-selected'], 'true');
      fwd.fire('click');
      assert.match(say.innerHTML, /0\.326/);
      checkFrame();
    }
    if (id === 'bge-retromae') {
      for (const target of targets) {
        target.fire('click');
        assert.equal(target.attrs['aria-pressed'], 'true');
        assert.match(status.textContent, /шаг 3 из 3/);
        assert.match(say.innerHTML, target.dataset.target === '1' ? /цель — «почты»/ : /цель — «поддержку»/);
        checkFrame();
      }
    }
    play.fire('click');
    assert.equal(timers.size, 1);
    timers.values().next().value();
    checkFrame();
    observers.at(-1).fn();
    checkFrame();
    cleanup();
    assert.equal(timers.size, 0);
    assert.ok(observers.at(-1).disconnected);
  }
}
console.log('BGE: арифметика InfoNCE/KD, градиент с фиксированной целью и ' + frames + ' состояний схем — OK (без визуальной проверки).');
