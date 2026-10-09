/* Один условный decode-шаг; без модели и без внешних зависимостей. */
const DEC_TOKENS = ["тихо", "спокойно", "темно", "холодно", "шумно", "квант"];
const DEC_PROBS = [0.40, 0.25, 0.15, 0.10, 0.06, 0.04];

function decDistribution(temperature, mode, k, p, mu){
  const logits = DEC_PROBS.map(Math.log), peak = Math.max(...logits);
  const weights = logits.map(z => Math.exp((z - peak) / temperature));
  const total = weights.reduce((a, b) => a + b, 0);
  const before = weights.map(v => v / total);
  let keep = weights.map((_, i) => i).sort((a, b) => weights[b] - weights[a] || a - b);
  if (mode === "minp" || mode === "chain") keep = keep.filter(i => weights[i] >= mu);
  if (mode === "topk" || mode === "chain") keep = keep.slice(0, k);
  if ((mode === "topp" || mode === "chain") && p < 1){
    const target = p * keep.reduce((s, i) => s + weights[i], 0);
    let mass = 0, end = 0;
    do { mass += weights[keep[end++]]; } while (mass < target && end < keep.length);
    keep = keep.slice(0, end);
  }
  const mass = keep.reduce((s, i) => s + before[i], 0);
  const after = before.map((v, i) => keep.includes(i) ? v / mass : 0);
  return { before, after, keep, mass };
}

function mountDecDistribution(box){
  box.innerHTML = `
    <div class="fig-stage dec-stage">
      <p class="dec-context">Условный контекст: «В саду было…»</p>
      <div class="dec-head"><span>Токен</span><span>После температуры</span><span>После фильтра</span></div>
      <div data-dec-bars></div>
    </div>
    <div class="fig-row dec-controls">
      <label class="fig-range">Температура <input type="range" min="0.25" max="2" step="0.05" value="1" data-dec="temperature"><output>1,00</output></label>
      <label>Фильтр <select data-dec="mode" aria-label="Способ отбора кандидатов">
        <option value="none">Без фильтра</option><option value="topk">Top-k</option><option value="topp" selected>Top-p</option><option value="minp">Min-p</option><option value="chain">Цепочка</option>
      </select></label>
      <label class="fig-range">Top-k <input type="range" min="1" max="6" step="1" value="3" data-dec="k"><output>3</output></label>
      <label class="fig-range">Top-p <input type="range" min="0.05" max="1" step="0.05" value="0.8" data-dec="p"><output>0,80</output></label>
      <label class="fig-range">Min-p <input type="range" min="0" max="1" step="0.05" value="0.2" data-dec="mu"><output>0,20</output></label>
      <button type="button" data-dec-reset>Сбросить</button>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("dec-before"), "до фильтра"],
      [cbSwatch("dec-after"), "после фильтра и нормировки"]
    ])}</div>`;
  const bars = box.querySelector("[data-dec-bars]"), say = box.querySelector(".fig-say");
  const fields = Object.fromEntries([...box.querySelectorAll("[data-dec]")].map(el => [el.dataset.dec, el]));
  function draw(){
    const t = +fields.temperature.value, mode = fields.mode.value;
    const k = +fields.k.value, p = +fields.p.value, mu = +fields.mu.value;
    const state = decDistribution(t, mode, k, p, mu);
    const enabled = { k: mode === "topk" || mode === "chain", p: mode === "topp" || mode === "chain", mu: mode === "minp" || mode === "chain" };
    Object.entries(enabled).forEach(([key, on]) => { fields[key].disabled = !on; });
    for (const key of ["temperature", "k", "p", "mu"]){
      const el = fields[key];
      el.parentElement.querySelector("output").textContent = fmtN(+el.value, key === "k" ? 0 : 2);
    }
    bars.innerHTML = DEC_TOKENS.map((token, i) => {
      const meter = (value, cls) => `<span class="dec-meter"><span class="dec-track" aria-hidden="true"><span class="${cls}" style="width:${value * 100}%"></span></span><span class="dec-value">${fmtN(value * 100, 1)}%</span></span>`;
      return `<div class="dec-item${state.keep.includes(i) ? "" : " dec-excluded"}"><span class="dec-token">${token}</span>${meter(state.before[i], "dec-before")}${meter(state.after[i], "dec-after")}</div>`;
    }).join("");
    const count = state.keep.length;
    const kept = state.keep.map(i => `«${DEC_TOKENS[i]}»`);
    const how = {
      none: "Фильтр выключен: температура меняет вероятности, но не удаляет кандидатов.",
      topk: "Top-k оставляет заданное число лидеров. Температура меняет их доли, но не порядок.",
      topp: "Top-p набирает массу по убыванию вероятностей. Токен, пересёкший порог, включён.",
      minp: `Min-p сравнивает каждый токен с лидером. Порог до фильтра: ${fmtN(mu * state.before[0] * 100, 2)}%.`,
      chain: "Сначала min-p, затем top-k; top-p набирает долю от массы оставшихся кандидатов."
    }[mode];
    say.textContent = `${how} Осталось ${count} из ${DEC_TOKENS.length}: ${joinRu(kept)}. Сохранено ${fmtN(state.mass * 100, 1)}% массы распределения после температуры; нормировка растягивает её до 100%.`;
  }
  const reset = () => {
    const defaults = { temperature: "1", mode: "topp", k: "3", p: "0.8", mu: "0.2" };
    Object.entries(defaults).forEach(([key, value]) => { fields[key].value = value; });
    draw();
  };
  Object.values(fields).forEach(el => el.addEventListener("input", draw));
  const button = box.querySelector("[data-dec-reset]");
  button.addEventListener("click", reset);
  draw();
  return () => {
    Object.values(fields).forEach(el => el.removeEventListener("input", draw));
    button.removeEventListener("click", reset);
  };
}

Object.assign(FIGURES, {
  "dec-distribution": mountDecDistribution
});
