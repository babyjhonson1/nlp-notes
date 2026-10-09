/* Иллюстрации раздела inference/continuous-batching. */

/* ---------- Почему батч: время decode-шага и пропускная способность ---------- */
function mountCbRoofline(box){
  const WGT = 14e9, BWD = 3e12, PEAK = 6e14, KVT = 524288, MEM = 58e9, FPT = 14e9;
  const CTXS = [512, 2048, 8192], YMIN = 100, YMAX = 20000;
  let ctx = 2048, bi = 5;
  const model = (b, c) => {
    const w = WGT / BWD * 1e3, kv = b * c * KVT / BWD * 1e3, comp = b * FPT / PEAK * 1e3;
    const t = Math.max(w + kv, comp);
    return { w, kv, comp, t, tp: b / t * 1e3 };
  };
  const cap = (c) => Math.floor(MEM / (c * KVT));

  box.innerHTML = `
    <div class="fig-stage" style="margin-top:12px"><svg class="cb-roof" role="img" aria-label="Пропускная способность decode в зависимости от размера батча"></svg></div>
    <div class="fig-stage" style="margin-top:6px"><svg class="cb-bar" role="img" aria-label="Из чего складывается время шага"></svg></div>
    <div class="fig-row">
      <label class="fig-range">размер батча <input type="range" min="0" max="9" step="1" value="${bi}" data-b> <output>${2 ** bi}</output></label>
      <span class="spacer"></span>
      <span class="fig-seg">контекст
        <span class="fig-tabs" role="tablist" aria-label="Средняя длина контекста">${CTXS.map((c) => `<button type="button" data-ctx="${c}" aria-selected="${c === ctx}">${c}</button>`).join("")}</span>
      </span>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="cb-curve"/></svg>`, "выбранная длина контекста"],
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="cb-curve other"/></svg>`, "другие длины"],
      [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="cb-ideal"/></svg>`, "если бы шаг не дорожал с ростом размера батча"],
      [`<svg viewBox="0 0 22 14"><rect x="3" y="1.5" width="16" height="11" class="cb-wall"/><line x1="3" y1="1" x2="3" y2="13" class="cb-wall-l"/></svg>`, "кеш не помещается в память"]
    ])}</div>`;
  const svg = box.querySelector(".cb-roof"), bar = box.querySelector(".cb-bar"), say = box.querySelector(".fig-say");
  const range = box.querySelector("[data-b]"), out = range.parentElement.querySelector("output");

  function draw(){
    const B = 2 ** bi, VW = cbFit(svg, 340, 640), VH = VW < 480 ? 270 : 300;
    const L = VW < 480 ? 48 : 58, R = VW - 16, T = 26, BT = VH - 42;
    const x = (b) => L + Math.log2(b) / 9 * (R - L);
    const y = (v) => BT - (Math.log10(v) - Math.log10(YMIN)) / (Math.log10(YMAX) - Math.log10(YMIN)) * (BT - T);
    const yc = (v) => Math.max(T, Math.min(BT, y(v)));
    let s = "";
    // сетка и оси
    [100, 200, 500, 1000, 2000, 5000, 10000, 20000].forEach((v) => {
      s += `<line x1="${L}" y1="${f1(y(v))}" x2="${R}" y2="${f1(y(v))}" class="cb-grid"/>`;
      s += `<text x="${L - 6}" y="${f1(y(v))}" class="cb-num" style="text-anchor:end">${v.toLocaleString("ru-RU")}</text>`;
    });
    for (let k = 0; k <= 9; k++){
      const xx = x(2 ** k);
      s += `<line x1="${f1(xx)}" y1="${T}" x2="${f1(xx)}" y2="${BT}" class="cb-grid"/>`;
      if (VW >= 420 || k % 2 === 0 || k === 9) s += `<text x="${f1(xx)}" y="${BT + 13}" class="cb-num">${2 ** k}</text>`;
    }
    s += `<line x1="${L}" y1="${BT}" x2="${R}" y2="${BT}" class="cb-axis"/><line x1="${L}" y1="${T}" x2="${L}" y2="${BT}" class="cb-axis"/>`;
    s += `<text x="${L}" y="11" class="muted-t" dominant-baseline="central">токенов в секунду</text>`;
    s += `<text x="${(L + R) / 2}" y="${VH - 8}" class="muted-t" text-anchor="middle">размер батча B, последовательностей</text>`;
    // стена памяти
    const c = cap(ctx);
    if (c < 512){
      const xw = x(c);
      s += `<rect x="${f1(xw)}" y="${T}" width="${f1(R - xw)}" height="${BT - T}" class="cb-wall"/><line x1="${f1(xw)}" y1="${T}" x2="${f1(xw)}" y2="${BT}" class="cb-wall-l"/>`;
      const tx = R - 6;
      if (R - xw > 76) s += `<text x="${tx}" y="${BT - 26}" class="cb-bad-t" text-anchor="end">не влезает</text><text x="${tx}" y="${BT - 11}" class="cb-bad-t" text-anchor="end">в память</text>`;
      else s += `<text x="${f1(xw - 6)}" y="${BT - 11}" class="cb-bad-t" text-anchor="end">предел памяти</text>`;
    }
    // идеальная линия: время шага как при B = 1
    const t1 = model(1, ctx).t;
    let ideal = ""; for (let k = 0; k <= 90; k++){ const b = 2 ** (k / 10), v = b / t1 * 1e3; if (v > YMAX) break; ideal += (ideal ? " L" : "M") + f1(x(b)) + " " + f1(y(v)); }
    s += `<path d="${ideal}" class="cb-ideal"/>`;
    // кривые
    const pt = (b, cc) => f1(x(b)) + " " + f1(yc(model(b, cc).tp));
    const path = (from, to, cc) => {
      const bs = [from]; for (let k = 0; k <= 90; k++){ const b = 2 ** (k / 10); if (b > from && b < to) bs.push(b); } bs.push(to);
      return bs.map((b, i) => (i ? "L" : "M") + pt(b, cc)).join(" ");
    };
    CTXS.forEach((cc) => {
      if (cc === ctx) return;
      s += `<path d="${path(1, 512, cc)}" class="cb-curve other"/>`;
      s += `<text x="${R}" y="${f1(yc(model(512, cc).tp) - 9)}" class="cb-num" style="text-anchor:end">${cc}</text>`;
    });
    if (c >= 512) s += `<path d="${path(1, 512, ctx)}" class="cb-curve"/>`;
    else s += `<path d="${path(1, c, ctx)}" class="cb-curve"/><path d="${path(c, 512, ctx)}" class="cb-curve over"/>`;
    if (x(2 ** bi) < R - 70) s += `<text x="${R}" y="${f1(yc(model(512, ctx).tp) - 9)}" class="cb-num" style="text-anchor:end;fill:var(--chapter-ink);font-weight:600">${ctx}</text>`;
    // отметка
    const m = model(B, ctx), mx = x(B), my = yc(m.tp), over = B > c;
    s += `<line x1="${f1(mx)}" y1="${f1(my)}" x2="${f1(mx)}" y2="${BT}" class="cb-guide"/>`;
    s += `<circle cx="${f1(mx)}" cy="${f1(my)}" r="6" class="cb-mark${over ? " bad" : ""}"/>`;
    const lbl = `${Math.round(m.tp).toLocaleString("ru-RU")} ток/с`, right = mx < (L + R) / 2;
    s += `<text x="${f1(mx + (right ? 10 : -10))}" y="${f1(my - 12)}" class="tag${over ? "" : " acc"}" text-anchor="${right ? "start" : "end"}"${over ? ' style="fill:var(--fig-bad)"' : ""}>${lbl}</text>`;
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;

    // полоса «из чего состоит шаг»
    const LB = VW < 480 ? 88 : 96, RB = VW - 8, BW2 = RB - LB, scale = BW2 / m.t;
    const ww = m.w * scale, kw = m.kv * scale, cw2 = Math.max(1.5, m.comp * scale);
    let b = "";
    b += `<text x="0" y="12" class="muted-t" dominant-baseline="central">чтение</text>`;
    b += `<rect x="${LB}" y="2" width="${f1(ww)}" height="20" class="cb-seg-w"/>`;
    b += `<rect x="${f1(LB + ww)}" y="2" width="${f1(kw)}" height="20" class="cb-seg-kv"/>`;
    const fit = (w, ...opts) => opts.find((o) => w > o.length * 6.8 + 10);
    const wl = fit(ww, `веса ${fmtMs(m.w)} мс`, "веса"), kl = fit(kw, `кеш ${fmtMs(m.kv)} мс`, "кеш");
    if (wl) b += `<text x="${LB + 6}" y="12" class="cb-seg-t">${wl}</text>`;
    if (kl) b += `<text x="${f1(LB + ww + 6)}" y="12" class="cb-seg-t in">${kl}</text>`;
    b += `<text x="0" y="38" class="muted-t" dominant-baseline="central">вычисления</text>`;
    b += `<rect x="${LB}" y="31" width="${f1(cw2)}" height="14" class="cb-seg-c"/>`;
    b += `<text x="${f1(LB + cw2 + 6)}" y="38" class="cb-seg-t" style="font-weight:500">${fmtMs(m.comp)} мс — идут параллельно с чтением</text>`;
    bar.setAttribute("viewBox", `0 0 ${VW} 48`);
    bar.innerHTML = b;

    // подпись
    const m1 = model(1, ctx);
    const times = (v) => { const d = v < 10 ? 1 : 0, n = Math.round(v); return `в ${fmtN(v, d)} ${d ? "раза" : plural(n, "раз", "раза", "раз")}`; };
    const gain = m.tp / m1.tp, slow = m.t / m1.t;
    let t = `<b>\\(B = ${B}\\)</b>, контекст ${ctx} токенов: шаг длится ${fmtMs(m.t)} мс, `;
    if (B === 1) t += `и почти всё это время GPU читает 14 ГБ весов ради одного токена. Получается ${Math.round(m.tp)} токенов в секунду.`;
    else {
      t += `из них ${fmtMs(m.w)} мс на чтение весов и ${fmtMs(m.kv)} мс на чтение кеша. Это ${Math.round(m.tp).toLocaleString("ru-RU")} токенов в секунду — ${times(gain)} больше, чем при \\(B = 1\\)`;
      t += gain >= B / 2 ? `, а шаг подорожал всего ${times(slow)}.`
        : `: шаг подорожал ${times(slow)}${m.kv > m.w ? ", и большая часть времени уходит на чтение кеша" : ""}.`;
    }
    if (over) t += ` <b>Но столько не помещается:</b> кеш ${B} последовательностей по ${ctx} токенов занял бы ${fmtN(B * ctx * KVT / 1e9, 0)} ГБ, а под кеш есть 58. Максимум — ${c} ${plural(c, "последовательность", "последовательности", "последовательностей")}.`;
    say.innerHTML = t;
  }
  range.addEventListener("input", () => { bi = +range.value; out.value = 2 ** bi; draw(); });
  box.querySelectorAll("[data-ctx]").forEach((btn) => btn.addEventListener("click", () => {
    ctx = +btn.dataset.ctx;
    box.querySelectorAll("[data-ctx]").forEach((x) => x.setAttribute("aria-selected", String(x === btn)));
    draw();
  }));
  draw();
  return cbResize(svg, draw);
}

/* ---------- Статический батчинг и continuous batching по шагам ---------- */
const CB_LOAD = [
  { id: "A", arr: 1, len: 4 }, { id: "B", arr: 1, len: 9 }, { id: "C", arr: 1, len: 3 }, { id: "D", arr: 2, len: 5 },
  { id: "E", arr: 4, len: 2 }, { id: "F", arr: 5, len: 6 }, { id: "G", arr: 7, len: 3 }, { id: "H", arr: 9, len: 4 }
];
function cbSimulate(reqs, S){
  const order = reqs.slice().sort((a, b) => a.arr - b.arr || a.id.localeCompare(b.id));
  // статический: батч живёт, пока не допишет самый длинный ответ
  const st = { res: {}, batches: [] };
  { const pend = order.slice(); let t = 1;
    while (pend.length){
      const av = pend.filter((r) => r.arr <= t);
      if (!av.length){ t = pend[0].arr; continue; }
      const take = av.slice(0, S), end = t + Math.max(...take.map((r) => r.len)) - 1;
      take.forEach((r, k) => { st.res[r.id] = { start: t, end: t + r.len - 1, slot: k, batch: st.batches.length }; pend.splice(pend.indexOf(r), 1); });
      st.batches.push({ start: t, end, ids: take.map((r) => r.id) });
      t = end + 1;
    }
    st.T = t - 1;
  }
  // continuous: перед каждым шагом освобождаем слоты и сразу занимаем их из очереди
  const ct = { res: {} };
  { const pend = order.slice(), slots = new Array(S).fill(null); let t = 1, T = 0;
    while (pend.length || slots.some(Boolean)){
      for (let k = 0; k < S; k++) if (slots[k] && ct.res[slots[k]].end < t) slots[k] = null;
      for (let k = 0; k < S; k++) if (!slots[k] && pend.length && pend[0].arr <= t){
        const r = pend.shift(); ct.res[r.id] = { start: t, end: t + r.len - 1, slot: k }; slots[k] = r.id; T = Math.max(T, t + r.len - 1);
      }
      if (!slots.some(Boolean)){ if (!pend.length) break; t = pend[0].arr; continue; }
      t++;
    }
    ct.T = T;
  }
  return { st, ct };
}
function cbRandomLoad(seed){
  for (let s = seed; s < seed + 500; s++){
    const r = rng(s * 7919 + 13), out = []; let a = 1;
    for (let i = 0; i < 8; i++){
      if (i >= 2) a += Math.floor(r() * 3);
      const long = r() < 0.22;
      out.push({ id: "ABCDEFGH"[i], arr: a, len: long ? 9 + Math.floor(r() * 4) : 2 + Math.floor(r() * 6) });
    }
    const s2 = cbSimulate(out, 2), s3 = cbSimulate(out, 3);
    if (s2.st.T <= 28 && s3.ct.T < s3.st.T) return out;
  }
  return CB_LOAD;
}

function mountCbSchedule(box){
  let reqs = CB_LOAD, S = 3, mode = "static", cur = 1, timer = null, seed = 1;
  let sim, Tmax, maxQ = {};
  const idx = (id) => reqs.findIndex((r) => r.id === id);
  const color = (id) => CB_G[idx(id) % CB_G.length];
  const simOf = (m) => m === "static" ? sim.st : sim.ct;
  const Tof = (m) => simOf(m).T;
  const queueAt = (m, t) => reqs.filter((r) => r.arr <= t && simOf(m).res[r.id].start > t);
  function recompute(){
    sim = cbSimulate(reqs, S);
    Tmax = Math.max(sim.st.T, sim.ct.T);
    ["static", "cont"].forEach((m) => { maxQ[m] = 1; for (let t = 1; t <= Tmax; t++) maxQ[m] = Math.max(maxQ[m], queueAt(m, t).length); });
  }
  function cellAt(m, k, t){
    const sm = simOf(m);
    for (const r of reqs){
      const x = sm.res[r.id]; if (x.slot !== k) continue;
      if (t >= x.start && t <= x.end) return { id: r.id, kind: t === x.start ? "pre" : "dec" };
      if (m === "static"){ const b = sim.st.batches[x.batch]; if (t > x.end && t <= b.end) return { id: r.id, kind: "pad" }; }
    }
    return null;
  }
  const steps = (n) => `${n} ${plural(n, "шаг", "шага", "шагов")}`;
  const stepsGen = (n) => `${n} ${plural(n, "шага", "шагов", "шагов")}`;
  function metrics(m){
    const sm = simOf(m), useful = reqs.reduce((a, r) => a + r.len, 0);
    const wait = reqs.reduce((a, r) => a + sm.res[r.id].start - r.arr, 0) / reqs.length;
    const resp = reqs.reduce((a, r) => a + sm.res[r.id].end - r.arr + 1, 0) / reqs.length;
    return { T: sm.T, util: useful / (sm.T * S), wait, resp };
  }

  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Режим">
        <button type="button" role="tab" data-mode="static" aria-selected="true">Статический</button>
        <button type="button" role="tab" data-mode="cont" aria-selected="false">Continuous</button>
      </div>
      <span class="spacer"></span>
      <span class="fig-status" aria-live="off"></span>
    </div>
    <div class="fig-stage cb-scroll" style="margin-top:12px"><svg class="cb-sched" tabindex="0" role="img" aria-label="Расписание запросов по слотам батча"></svg></div>
    <div class="fig-row">
      <button class="fig-btn icon" type="button" data-act="back" aria-label="Шаг назад" title="Шаг назад (←)">${ICON.prev}</button>
      <button class="fig-btn primary" type="button" data-act="play"></button>
      <button class="fig-btn icon" type="button" data-act="fwd" aria-label="Шаг вперёд" title="Шаг вперёд (→)">${ICON.next}</button>
      <span class="spacer"></span>
      <span class="fig-seg">слотов
        <span class="fig-tabs" role="tablist" aria-label="Слотов в батче">${[2, 3, 4].map((n) => `<button type="button" data-s="${n}" aria-selected="${n === S}">${n}</button>`).join("")}</span>
      </span>
      <button class="fig-btn" type="button" data-act="rand">${ICON.dice} Другая нагрузка</button>
    </div>
    <div class="fig-row"><input class="fig-scrub" type="range" min="1" value="1" aria-label="Номер шага"></div>
    <div class="fig-row"><div class="table-wrap" style="width:100%"><table class="cb-metrics"></table></div></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("cb-cell pre", "--gc:var(--fig-node)"), "prefill: первый токен"],
      [cbSwatch("cb-cell dec", "--gc:var(--fig-node)"), "decode"],
      [`<svg viewBox="0 0 22 14"><defs>${cbHatchDef("cbs-hatch-lg")}</defs><rect x="3" y="1.5" width="16" height="11" rx="2" class="cb-cell pad" style="fill:url(#cbs-hatch-lg)"/></svg>`, "ответ готов, но слот занят до конца батча"],
      [cbSwatch("cb-chip"), "ждёт в очереди"],
      [`<svg viewBox="0 0 22 14"><rect x="5" y="1" width="12" height="12" rx="2" class="cb-col"/></svg>`, "текущий шаг"]
    ])}</div>`;
  const svg = box.querySelector("svg"), say = box.querySelector(".fig-say"), status = box.querySelector(".fig-status");
  const scrub = box.querySelector(".fig-scrub"), playBtn = box.querySelector('[data-act="play"]'), table = box.querySelector(".cb-metrics");

  function narrate(){
    const t = cur, T = Tof(mode), parts = [];
    if (mode === "static"){
      const b = sim.st.batches.find((x) => t >= x.start && t <= x.end);
      if (!b) parts.push("GPU простаивает: очередь пуста.");
      else {
        const bi = sim.st.batches.indexOf(b) + 1;
        if (t === b.start){
          const lg = b.ids.reduce((p, id) => sim.st.res[id].end > sim.st.res[p].end ? id : p, b.ids[0]);
          parts.push(`Начинается батч ${bi}: ${joinRu(b.ids)}, у всех prefill. Он продлится, пока не допишет самый длинный ответ, ${lg}: ${steps(b.end - b.start + 1)}.`);
          if (b.ids.length < S){
            const empty = S - b.ids.length === 1 ? "один слот пустует" : "остальные слоты пустуют";
            const later = reqs.some((r) => sim.st.res[r.id].start > b.start);
            parts.push(later
              ? `К этому шагу пришло только ${b.ids.length} ${plural(b.ids.length, "запрос", "запроса", "запросов")}, и ${empty} весь батч, даже когда в очереди появятся новые.`
              : `Запросов больше нет, и ${empty} до конца.`);
          }
        } else {
          const fin = b.ids.filter((id) => sim.st.res[id].end === t - 1);
          if (fin.length) parts.push(fin.length > 1
            ? `${joinRu(fin)} дописали ответы, но из батча не выходят: до его конца их слоты генерируют pad.`
            : `${fin[0]} дописал ответ, но из батча не выходит: до его конца слот генерирует pad.`);
          const pads = b.ids.filter((id) => sim.st.res[id].end < t - 1);
          if (pads.length) parts.push(`${pads.length === 1 ? "Ещё один слот" : `Ещё ${pads.length} слота`} по-прежнему ${pads.length === 1 ? "работает" : "работают"} вхолостую.`);
          if (!fin.length && !pads.length) parts.push(`Батч ${bi}: ${joinRu(b.ids)} генерируют по токену.`);
        }
      }
      const arrived = queueAt(mode, t).filter((r) => r.arr === t).map((r) => r.id);
      if (arrived.length) parts.push(`${arrived.length > 1 ? "Пришли" : "Пришёл"} ${joinRu(arrived)}: ${arrived.length > 1 ? "ждут" : "ждёт"} конца батча, хотя ${arrived.length > 1 ? "им" : "ему"} хватило бы места.`);
      const old = queueAt(mode, t).filter((r) => r.arr < t);
      if (old.length){
        const w = old[0];
        parts.push(old.length > 1
          ? `В очереди ждут ${joinRu(old.map((r) => r.id))}; дольше всех ${w.id} — уже ${steps(t - w.arr)}.`
          : `В очереди ждёт ${w.id} — уже ${steps(t - w.arr)}.`);
      }
      if (t === T) parts.push(`Последний шаг: вся нагрузка обслужена за ${steps(T)}, continuous справился бы за ${sim.ct.T}.`);
    } else {
      const left = reqs.filter((r) => sim.ct.res[r.id].end === t - 1).map((r) => r.id);
      if (left.length) parts.push(`${joinRu(left)} ${left.length > 1 ? "закончили" : "закончил"} на прошлом шаге и ${left.length > 1 ? "ушли" : "ушёл"} из батча.`);
      const joined = reqs.filter((r) => sim.ct.res[r.id].start === t);
      if (joined.length){
        const now = joined.filter((r) => r.arr === t).map((r) => r.id), waited = joined.filter((r) => r.arr < t);
        if (now.length) parts.push(`${joinRu(now)} ${now.length > 1 ? "пришли и сразу попадают" : "пришёл и сразу попадает"} в батч, у ${now.length > 1 ? "них" : "него"} prefill.`);
        waited.forEach((r) => parts.push(`${r.id} занимает освободившийся слот после ${stepsGen(t - r.arr)} в очереди, у него prefill.`));
      }
      const q = queueAt(mode, t), active = reqs.filter((r) => { const x = sim.ct.res[r.id]; return t >= x.start && t <= x.end; });
      if (q.length) parts.push(`${joinRu(q.map((r) => r.id))} ${q.length > 1 ? "ждут" : "ждёт"} в очереди: свободных слотов нет.`);
      else if (active.length < S) parts.push(`${S - active.length === 1 ? "Один слот свободен" : `Свободно ${S - active.length} слота`}, но очередь пуста — занять некому.`);
      if (!left.length && !joined.length && !q.length && active.length === S) parts.push(`${joinRu(active.map((r) => r.id))} генерируют по токену, все слоты заняты полезной работой.`);
      if (t === T) parts.push(`Последний шаг: вся нагрузка обслужена за ${steps(T)} вместо ${sim.st.T} у статического батчинга.`);
    }
    return `<b>Шаг ${t}.</b> ` + parts.join(" ");
  }

  function draw(){
    const T = Tof(mode);
    cur = Math.max(1, Math.min(T, cur));
    const VW = cbFit(svg, 360, 640), LX = VW < 480 ? 50 : 62, cw = (VW - LX - 4) / Tmax;
    const HY = 10, QY = 26, QH = maxQ[mode] * 15, BY = QY + QH + 6, SY = BY + 22, RH = VW < 480 ? 26 : 28, RG = 6;
    const VH = SY + S * (RH + RG) - RG + 3;
    const X = (t) => LX + (t - 1) * cw;
    let s = `<defs>${cbHatchDef("cbs-hatch")}</defs>`;
    s += `<rect x="${f1(X(cur))}" y="1" width="${f1(cw)}" height="${VH - 2}" rx="3" class="cb-col"/>`;
    // номера шагов
    for (let t = 1; t <= Tmax; t++) if (cw >= 17 || t % 2 === 1) s += `<text x="${f1(X(t) + cw / 2)}" y="${HY + 2}" class="cb-num"${t === cur ? ' style="fill:var(--fig-accent);font-weight:600"' : ""}>${t}</text>`;
    s += `<text x="0" y="${HY + 2}" class="muted-t" dominant-baseline="central">шаг</text>`;
    // очередь
    s += `<text x="0" y="${QY + 7}" class="muted-t" dominant-baseline="central">очередь</text>`;
    for (let t = 1; t <= Math.min(T, Tmax); t++){
      const q = queueAt(mode, t), op = t > cur ? ' opacity="0.25"' : "";
      q.forEach((r, i) => {
        const y = QY + i * 15;
        s += `<g${op}><rect x="${f1(X(t) + 2)}" y="${y}" width="${f1(cw - 4)}" height="13" rx="3" class="cb-chip"/><text x="${f1(X(t) + cw / 2)}" y="${y + 6.5}" class="cb-chip-t">${r.id}</text></g>`;
      });
    }
    // границы батчей
    if (mode === "static"){
      sim.st.batches.forEach((b, i) => {
        const x1 = X(b.start) + 2, x2 = X(b.end + 1) - 2, y = BY + 14, op = b.start > cur ? ' opacity="0.35"' : "";
        s += `<g${op}><path d="M${f1(x1)} ${y + 4} V${y} H${f1(x2)} V${y + 4}" class="cb-brace"/>`;
        s += `<text x="${f1((x1 + x2) / 2)}" y="${BY + 5}" class="cb-num">${x2 - x1 > 46 ? "батч " : ""}${i + 1}</text></g>`;
      });
    } else {
      s += `<text x="${f1(LX + 2)}" y="${BY + 9}" class="cb-num" style="text-anchor:start">состав батча пересобирается на каждом шаге</text>`;
    }
    // слоты
    for (let k = 0; k < S; k++){
      const y = SY + k * (RH + RG);
      s += `<text x="0" y="${y + RH / 2}" class="muted-t" dominant-baseline="central">слот ${k + 1}</text>`;
      for (let t = 1; t <= Tmax; t++){
        const c = t <= T ? cellAt(mode, k, t) : null, x = X(t) + 1.5, w = cw - 3, op = t > cur ? ' opacity="0.25"' : "";
        if (!c){ s += `<rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${RH}" rx="3" class="cb-cell empty"${t > T ? ' opacity="0.5"' : ""}/>`; continue; }
        const g = color(c.id);
        s += `<g style="--gc:${g}"${op}><rect x="${f1(x)}" y="${y}" width="${f1(w)}" height="${RH}" rx="3" class="cb-cell ${c.kind}"/>`;
        if (c.kind !== "pad") s += `<text x="${f1(x + w / 2)}" y="${y + RH / 2}" class="cb-t ${c.kind === "pre" ? "on-pre" : "on-dec"}">${c.id}</text>`;
        s += `</g>`;
      }
    }
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;
    // на узком экране схема прокручивается вбок: держим текущий шаг в поле зрения
    const wrap = svg.parentElement;
    if (wrap.scrollWidth > wrap.clientWidth + 1){
      const k = svg.getBoundingClientRect().width / VW, cx0 = X(cur) * k, cx1 = (X(cur) + cw) * k;
      if (cx0 < wrap.scrollLeft + LX * k) wrap.scrollLeft = Math.max(0, cx0 - LX * k);
      else if (cx1 > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = cx1 - wrap.clientWidth + 8;
    }

    say.innerHTML = narrate();
    const active = reqs.filter((r) => { const x = simOf(mode).res[r.id]; return cur >= x.start && cur <= x.end; }).length;
    status.textContent = `Шаг ${cur} из ${T} · полезных слотов ${active} из ${S} · в очереди ${queueAt(mode, cur).length}`;
    scrub.max = T; scrub.value = cur;
    box.querySelector('[data-act="back"]').disabled = cur === 1;
    box.querySelector('[data-act="fwd"]').disabled = cur === T;
    playBtn.innerHTML = timer ? `${ICON.pause}Пауза` : `${ICON.play}${cur === T ? "Сначала" : "Пуск"}`;

    const ms = metrics("static"), mc = metrics("cont"), on = (m) => mode === m ? ' class="on"' : "";
    const pct = (x) => Math.round(x * 100) + "%";
    table.innerHTML = `
      <thead><tr><th></th><th${on("static")}>Статический</th><th${on("cont")}>Continuous</th></tr></thead>
      <tbody>
        <tr><td>Шагов всего</td><td${on("static")}>${ms.T}</td><td${on("cont")}>${mc.T}</td></tr>
        <tr><td>Полезная загрузка слотов</td><td${on("static")}>${pct(ms.util)}</td><td${on("cont")}>${pct(mc.util)}</td></tr>
        <tr><td>Среднее ожидание в очереди</td><td${on("static")}>${fmtN(ms.wait)} шага</td><td${on("cont")}>${fmtN(mc.wait)} шага</td></tr>
        <tr><td>Среднее время ответа</td><td${on("static")}>${fmtN(ms.resp)} шага</td><td${on("cont")}>${fmtN(mc.resp)} шага</td></tr>
      </tbody>`;
  }
  function stop(){ if (timer){ clearInterval(timer); timer = null; } }
  function go(t){ cur = t; draw(); }
  function play(){
    if (timer){ stop(); draw(); return; }
    if (cur >= Tof(mode)) cur = 1;
    timer = setInterval(() => { if (cur >= Tof(mode)){ stop(); draw(); return; } cur++; draw(); }, 1100);
    draw();
  }
  function setMode(m){
    stop(); mode = m; cur = 1;
    box.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
    draw();
  }
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); }));
  box.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => {
    S = +b.dataset.s; box.querySelectorAll("[data-s]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    stop(); recompute(); go(1);
  }));
  box.querySelector('[data-act="back"]').addEventListener("click", () => { stop(); go(cur - 1); });
  box.querySelector('[data-act="fwd"]').addEventListener("click", () => { stop(); go(cur + 1); });
  playBtn.addEventListener("click", play);
  scrub.addEventListener("input", () => { stop(); go(+scrub.value); });
  box.querySelector('[data-act="rand"]').addEventListener("click", () => { stop(); seed += 1; reqs = cbRandomLoad(seed * 31); recompute(); go(1); });
  box.addEventListener("keydown", (e) => {
    if (e.target.matches("input")) return;
    if (e.key === "ArrowRight"){ e.preventDefault(); stop(); go(cur + 1); }
    if (e.key === "ArrowLeft"){ e.preventDefault(); stop(); go(cur - 1); }
  });
  recompute();
  draw();
  const off = cbResize(svg, draw);
  return () => { stop(); off(); };
}

/* ---------- Прямоугольный батч, плоский батч и attention ---------- */
function mountCbFlat(box){
  const SEQ = [
    { id: "A", g: "var(--g1)", ctx: 7, n: 1, kind: "decode" },
    { id: "B", g: "var(--g2)", ctx: 5, n: 1, kind: "decode" },
    { id: "C", g: "var(--g3)", ctx: 0, n: 6, kind: "prefill" }
  ];
  const TOK = [];
  SEQ.forEach((q, si) => { for (let j = 0; j < q.n; j++) TOK.push({ si, pos: q.ctx + j, label: q.id.toLowerCase() + subN(q.ctx + j) }); });
  let tab = "rect";
  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Представление">
        <button type="button" role="tab" data-tab="rect" aria-selected="true">Тензор [B, L]</button>
        <button type="button" role="tab" data-tab="flat" aria-selected="false">Плоский батч</button>
        <button type="button" role="tab" data-tab="attn" aria-selected="false">Attention</button>
      </div>
    </div>
    <div class="fig-stage" style="margin-top:12px"><svg role="img" aria-label="Раскладка токенов одного шага"></svg></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend"></div>`;
  const svg = box.querySelector("svg"), say = box.querySelector(".fig-say"), legEl = box.querySelector(".fig-legend");
  const seqLeg = SEQ.map((q) => [cbSwatch("cb-cell pre", `--gc:${q.g}`), `${q.id}: ${q.kind}`]);

  function drawRect(VW){
    const LX = 64, cols = 6, gap = 4, cw = Math.min(64, (VW - LX - 4) / cols - gap), RH = 34, Y0 = 24;
    let s = `<defs>${cbHatchDef("cbf-hatch")}</defs>`;
    s += `<text x="${LX}" y="9" class="muted-t" dominant-baseline="central">новые токены шага, L = 6</text>`;
    SEQ.forEach((q, i) => {
      const y = Y0 + i * (RH + 8);
      s += `<g style="--gc:${q.g}"><text x="0" y="${y + 11}" class="cb-t seq" style="text-anchor:start;font-size:13px">${q.id}</text>`;
      s += `<text x="0" y="${y + 25}" class="muted-t" dominant-baseline="central" style="font-size:11px">${q.kind}</text>`;
      for (let j = 0; j < cols; j++){
        const x = LX + j * (cw + gap);
        if (j < q.n){
          s += `<rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${RH}" rx="4" class="cb-cell pre"/><text x="${f1(x + cw / 2)}" y="${y + RH / 2}" class="cb-t on-pre" style="font-size:12px">${q.id.toLowerCase() + subN(q.ctx + j)}</text>`;
        } else {
          s += `<rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${RH}" rx="4" class="cb-cell pad" style="fill:url(#cbf-hatch)"/><text x="${f1(x + cw / 2)}" y="${y + RH / 2}" class="cb-t pad-t">pad</text>`;
        }
      }
      s += `</g>`;
    });
    return { s, VH: Y0 + 3 * (RH + 8) - 4 };
  }

  function drawFlat(VW){
    const LX = VW < 480 ? 112 : 132, n = TOK.length, gap = 3, cw = Math.min(58, (VW - LX - 6) / n - gap);
    const X = (i) => LX + i * (cw + gap), Y = 46, RH = 34;
    let s = "";
    // скобки последовательностей
    let i0 = 0;
    SEQ.forEach((q) => {
      const x1 = X(i0) + 1, x2 = X(i0 + q.n - 1) + cw - 1;
      s += `<g style="--gc:${q.g}"><path d="M${f1(x1)} ${Y - 6} V${Y - 11} H${f1(x2)} V${Y - 6}" class="cb-brace seq"/>`;
      const lbl = q.n > 1 ? `${q.id}: prefill, ${q.n} токенов` : q.id;
      s += `<text x="${f1((x1 + x2) / 2)}" y="${Y - 21}" class="cb-t seq" style="font-size:12px">${lbl}</text></g>`;
      i0 += q.n;
    });
    s += `<text x="0" y="${Y + RH / 2}" class="muted-t" dominant-baseline="central">токены</text>`;
    TOK.forEach((tk, i) => {
      const q = SEQ[tk.si];
      s += `<g style="--gc:${q.g}"><rect x="${f1(X(i))}" y="${Y}" width="${f1(cw)}" height="${RH}" rx="4" class="cb-cell pre"/><text x="${f1(X(i) + cw / 2)}" y="${Y + RH / 2}" class="cb-t on-pre" style="font-size:12px">${tk.label}</text></g>`;
      s += `<text x="${f1(X(i) + cw / 2)}" y="${Y + RH + 10}" class="cb-num">${i}</text>`;
    });
    // метаданные
    const rows = [["positions", Y + RH + 34], ["query_start_loc", Y + RH + 62], ["logits_indices", Y + RH + 90]];
    rows.forEach(([name, y]) => { s += `<text x="0" y="${y}" class="cb-mono">${name}</text>`; });
    TOK.forEach((tk, i) => { s += `<text x="${f1(X(i) + cw / 2)}" y="${rows[0][1]}" class="cb-val">${tk.pos}</text>`; });
    let start = 0; const bounds = [0];
    SEQ.forEach((q) => { start += q.n; bounds.push(start); });
    bounds.forEach((b) => {
      const x = b < n ? X(b) - gap / 2 : X(n - 1) + cw + gap / 2;
      s += `<line x1="${f1(x)}" y1="${Y - 4}" x2="${f1(x)}" y2="${rows[1][1] - 9}" class="cb-guide"/>`;
      s += `<text x="${f1(x)}" y="${rows[1][1]}" class="cb-val" style="fill:var(--fig-accent);font-weight:600">${b}</text>`;
    });
    let last = -1;
    SEQ.forEach((q) => { last += q.n; const x = X(last) + cw / 2; s += `<path d="M${f1(x - 5)} ${rows[2][1] - 4} L${f1(x)} ${rows[2][1] + 4} L${f1(x + 5)} ${rows[2][1] - 4}" class="cb-span" style="stroke:${q.g}"/>`; });
    return { s, VH: rows[2][1] + 12 };
  }

  function drawAttn(VW){
    const keys = []; SEQ.forEach((q, si) => { for (let j = 0; j < q.ctx + q.n; j++) keys.push({ si, pos: j, cached: j < q.ctx }); });
    const LX = 36, ggap = 6, nk = keys.length, cs = Math.min(24, (VW - LX - 4 - 2 * ggap) / nk);
    const kx = (i) => LX + i * cs + keys[i].si * ggap, Y0 = 46;
    let s = "";
    // подписи групп ключей
    SEQ.forEach((q, si) => {
      const ids = keys.map((k, i) => k.si === si ? i : -1).filter((i) => i >= 0), x1 = kx(ids[0]), x2 = kx(ids[ids.length - 1]) + cs;
      const opts = q.ctx ? [`ключи ${q.id}: ${q.ctx} из кеша + ${q.n}`, `ключи ${q.id}`, q.id] : [`ключи ${q.id}: ${q.n} новых`, `ключи ${q.id}`, q.id];
      const lbl = opts.find((o) => o.length * 6.6 < x2 - x1 + 4) || q.id;
      s += `<text x="${f1((x1 + x2) / 2)}" y="10" class="cb-t seq" style="--gc:${q.g};font-size:11.5px">${lbl}</text>`;
    });
    keys.forEach((k, i) => { const q = SEQ[k.si]; s += `<rect x="${f1(kx(i) + 1)}" y="22" width="${f1(cs - 2)}" height="10" rx="2" class="cb-cell ${k.cached ? "cached" : "pre"}" style="--gc:${q.g}"/>`; });
    let need = 0;
    TOK.forEach((tk, r) => {
      const q = SEQ[tk.si], y = Y0 + r * cs;
      s += `<text x="${LX - 6}" y="${f1(y + cs / 2)}" class="cb-t seq" style="--gc:${q.g};text-anchor:end;font-size:12px">${tk.label}</text>`;
      keys.forEach((k, i) => {
        const ok = k.si === tk.si && k.pos <= tk.pos;
        if (ok) need++;
        s += ok
          ? `<rect x="${f1(kx(i) + 1)}" y="${f1(y + 1)}" width="${f1(cs - 2)}" height="${f1(cs - 2)}" rx="2" class="cb-cell ${k.cached ? "cached" : "pre"}" style="--gc:${q.g}"/>`
          : `<rect x="${f1(kx(i) + 1.5)}" y="${f1(y + 1.5)}" width="${f1(cs - 3)}" height="${f1(cs - 3)}" rx="2" class="cb-cell mask"/>`;
      });
    });
    return { s, VH: Y0 + TOK.length * cs + 4, nk, need };
  }

  function draw(){
    const VW = cbFit(svg, 360, 640);
    let r;
    if (tab === "rect"){
      r = drawRect(VW);
      say.innerHTML = "В прямоугольном тензоре на каждую последовательность отводится по 6 позиций — столько, сколько новых токенов у C. Из 18 позиций настоящих 8, а <b>10 позиций паддинга</b> пройдут через все линейные слои и MLP впустую. Кеш тоже пришлось бы выравнивать: у A в нём 7 токенов, у B — 5, у C — ни одного.";
      legEl.innerHTML = legend([...seqLeg, [`<svg viewBox="0 0 22 14"><defs>${cbHatchDef("cbf-hatch-lg")}</defs><rect x="3" y="1.5" width="16" height="11" rx="2" class="cb-cell pad" style="fill:url(#cbf-hatch-lg)"/></svg>`, "паддинг"]]);
    } else if (tab === "flat"){
      r = drawFlat(VW);
      say.innerHTML = "Все 8 токенов шага склеены в один тензор \\([8, d]\\), и линейные слои умножают его на свои матрицы одним вызовом, без паддинга. Где чья последовательность, знают только метаданные: границы в <code>query_start_loc</code>, позиции для RoPE в <code>positions</code> и номера токенов, для которых нужны логиты, — по последнему у каждой последовательности.";
      legEl.innerHTML = legend([...seqLeg, [`<svg viewBox="0 0 22 14"><line x1="11" y1="1" x2="11" y2="13" class="cb-guide"/></svg>`, "границы последовательностей"]]);
    } else {
      r = drawAttn(VW);
      const dense = TOK.length * r.nk;
      say.innerHTML = `Строки — query новых токенов, столбцы — все ключи шага. Если считать attention одной плотной матрицей с маской, это ${TOK.length} × ${r.nk} = ${dense} произведений q·k, из которых нужны <b>${r.need}</b>: каждый токен смотрит только на свою последовательность, а внутри prefill C — ещё и только назад. Varlen-ядро проходит по каждой последовательности отдельно и считает только закрашенные клетки.`;
      legEl.innerHTML = legend([[cbSwatch("cb-cell cached", "--gc:var(--g1)"), "ключ из кеша"], [cbSwatch("cb-cell pre", "--gc:var(--g1)"), "ключ посчитан на этом шаге"], [cbSwatch("cb-cell mask"), "не нужно: другая последовательность или будущее"]]);
    }
    svg.setAttribute("viewBox", `0 0 ${VW} ${r.VH}`);
    svg.innerHTML = r.s;
  }
  box.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab; box.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw();
  }));
  draw();
  return cbResize(svg, draw);
}

/* ---------- Chunked prefill: бюджет токенов на шаг ---------- */
function mountCbChunked(box){
  const BASE = 8, PER = 0.04, DEC = 4, ARR = 20, AFTER = 4;
  const BUDGETS = [128, 256, 512, 1024, Infinity];
  let budget = Infinity, P = 2000;
  function sim(P, budget){
    const steps = []; let t = 0, rem = P, first = null, after = 0;
    while (t < 10000){
      const decoding = first !== null, dec = DEC + (decoding ? 1 : 0);
      const pre = t >= ARR && rem > 0 ? Math.min(rem, budget - dec) : 0;
      const dur = BASE + PER * (dec + pre);
      const st = { t0: t, t1: t + dur, dec, pre, emitNew: decoding };
      t += dur;
      if (pre){ rem -= pre; if (!rem){ first = t; st.emitNew = true; st.first = true; } }
      steps.push(st);
      if (!pre && first !== null && ++after >= AFTER) break;
    }
    const preSteps = steps.filter((s) => s.pre);
    return { steps, first, ttft: first - ARR, chunks: preSteps.length, maxGap: Math.max(...steps.map((s) => s.t1 - s.t0)), end: t, startPre: preSteps[0].t0 };
  }
  box.innerHTML = `
    <div class="fig-row">
      <span class="fig-seg">бюджет токенов
        <span class="fig-tabs" role="tablist" aria-label="Бюджет токенов на шаг">${BUDGETS.map((b) => `<button type="button" data-bud="${b}" aria-selected="${b === budget}"${b === Infinity ? ' title="без ограничения" aria-label="без ограничения"' : ""}>${b === Infinity ? "∞" : b}</button>`).join("")}</span>
      </span>
      <span class="spacer"></span>
      <label class="fig-range">промпт <input type="range" min="500" max="4000" step="500" value="${P}" data-p> <output>${P}</output></label>
    </div>
    <div class="fig-stage" style="margin-top:12px"><svg role="img" aria-label="Шаги модели во времени"></svg></div>
    <div class="fig-row cb-stats" style="margin-top:10px"></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("cb-step"), "шаг: чтение весов и decode"],
      [cbSwatch("cb-step pre"), "кусок промпта в шаге"],
      [`<svg viewBox="0 0 22 14"><line x1="11" y1="2" x2="11" y2="12" class="cb-tick"/></svg>`, "очередной токен у идущих запросов"],
      [LG.q(), "новый запрос пришёл"],
      [`<svg viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" class="n hit"/></svg>`, "его первый токен"]
    ])}</div>`;
  const svg = box.querySelector("svg"), say = box.querySelector(".fig-say"), stats = box.querySelector(".cb-stats");
  const pIn = box.querySelector("[data-p]"), pOut = pIn.parentElement.querySelector("output");

  function draw(){
    const r = sim(P, budget), rInf = sim(P, Infinity);
    const xmaxRaw = Math.max(...BUDGETS.map((b) => sim(P, b).end)), step = xmaxRaw > 400 ? 100 : 50, XMAX = Math.ceil(xmaxRaw / step) * step;
    const VW = cbFit(svg, 360, 640), narrow = VW < 480, LX = narrow ? 64 : 116, RX = VW - 10;
    const X = (t) => LX + t / XMAX * (RX - LX);
    const Y1 = 8, Y2 = 58, Y3 = 116, YA = 166, VH = YA + 26;
    let s = "";
    const lab = (y, a, b) => `<text x="0" y="${y}" class="muted-t" dominant-baseline="central">${narrow ? b : a}</text>`;
    s += lab(Y1 + 14, "шаги GPU", "шаги") + lab(Y2 + 8, "4 идущих запроса", "идущие") + lab(Y3 + 8, "новый запрос", "новый");
    // шаги
    r.steps.forEach((st) => {
      const x0 = X(st.t0) + 0.5, x1 = X(st.t1) - 0.5, dw = (x1 - x0) * (BASE + PER * st.dec) / (st.t1 - st.t0);
      s += `<rect x="${f1(x0)}" y="${Y1}" width="${f1(Math.max(1, dw))}" height="28" class="cb-step"/>`;
      if (st.pre){
        const pw = x1 - x0 - dw;
        s += `<rect x="${f1(x0 + dw)}" y="${Y1}" width="${f1(Math.max(1, pw))}" height="28" class="cb-step pre"/>`;
        if (pw > 40) s += `<text x="${f1(x0 + dw + pw / 2)}" y="${Y1 + 14}" class="cb-t on-pre">+${st.pre}</text>`;
      }
    });
    // токены идущих запросов
    let gap = r.steps[0];
    r.steps.forEach((st) => { if (st.t1 - st.t0 > gap.t1 - gap.t0) gap = st; s += `<line x1="${f1(X(st.t1))}" y1="${Y2}" x2="${f1(X(st.t1))}" y2="${Y2 + 16}" class="cb-tick"/>`; });
    {
      const gx0 = X(gap.t0), gx1 = X(gap.t1), y = Y2 + 24, big = gap.t1 - gap.t0 > 20;
      s += `<path d="M${f1(gx0)} ${y - 4} V${y} H${f1(gx1)} V${y - 4}" class="${big ? "cb-gap" : "cb-brace"}"/>`;
      const tx = Math.min(RX - 4, Math.max(LX, (gx0 + gx1) / 2));
      s += `<text x="${f1(tx)}" y="${y + 13}" class="${big ? "cb-bad-t" : "muted-t"}" text-anchor="middle" dominant-baseline="central">пауза ${fmtMs(gap.t1 - gap.t0)} мс</text>`;
    }
    // новый запрос
    const ya = Y3 + 8, xa = X(ARR), xs = X(r.startPre), xf = X(r.first);
    if (xs - xa > 2) s += `<line x1="${f1(xa)}" y1="${ya}" x2="${f1(xs)}" y2="${ya}" class="cb-wait"/>`;
    r.steps.forEach((st) => {
      if (st.pre) s += `<rect x="${f1(X(st.t0) + 0.5)}" y="${Y3 + 3}" width="${f1(Math.max(1, X(st.t1) - X(st.t0) - 1))}" height="10" rx="2" class="cb-step pre" opacity="0.55"/>`;
      if (st.emitNew && !st.first) s += `<line x1="${f1(X(st.t1))}" y1="${Y3}" x2="${f1(X(st.t1))}" y2="${Y3 + 16}" class="cb-tick new"/>`;
    });
    s += qMark(xa, ya, 6);
    s += `<circle cx="${f1(xf)}" cy="${ya}" r="5" class="n hit"/>`;
    {
      const y = Y3 + 26;
      s += `<path d="M${f1(xa)} ${y - 4} V${y} H${f1(xf)} V${y - 4}" class="cb-span"/>`;
      s += `<text x="${f1(Math.min(RX - 50, (xa + xf) / 2))}" y="${y + 13}" class="cb-span-t" text-anchor="middle" dominant-baseline="central">TTFT ${fmtMs(r.ttft)} мс</text>`;
    }
    // ось времени
    s += `<line x1="${LX}" y1="${YA}" x2="${RX}" y2="${YA}" class="cb-axis"/>`;
    for (let t = 0; t <= XMAX; t += step){
      s += `<line x1="${f1(X(t))}" y1="${YA}" x2="${f1(X(t))}" y2="${YA + 4}" class="cb-axis"/>`;
      s += `<text x="${f1(X(t))}" y="${YA + 14}" class="cb-num"${t === XMAX ? ' style="text-anchor:end"' : ""}>${t}${t === XMAX ? " мс" : ""}</text>`;
    }
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;

    const gapBad = r.maxGap > 20;
    stats.innerHTML = `<span>до первого токена <b>${fmtMs(r.ttft)} мс</b></span><span>самая долгая пауза у идущих <b class="${gapBad ? "bad" : ""}">${fmtMs(r.maxGap)} мс</b></span><span>шагов на prefill <b>${r.chunks}</b></span>`;
    if (budget === Infinity){
      say.innerHTML = `Без ограничения весь промпт попадает в один шаг: он длится ${fmtMs(r.maxGap)} мс вместо ${fmtMs(BASE + PER * DEC)}, и четыре запроса, которые уже генерируют ответ, на это время замирают. Зато первый токен нового запроса готов быстрее всего — через ${fmtMs(r.ttft)} мс.`;
    } else if (r.chunks === 1){
      say.innerHTML = `Промпт целиком влезает в бюджет ${budget}, и prefill проходит за один шаг — так же, как без ограничения. Пауза у идущих запросов — ${fmtMs(r.maxGap)} мс. Уменьшите бюджет или удлините промпт, чтобы увидеть разбиение на куски.`;
    } else {
      say.innerHTML = `Бюджет ${budget}: в каждом шаге 4–5 decode-токенов и кусок промпта до ${budget - DEC} токенов, prefill растягивается на ${r.chunks} ${plural(r.chunks, "шаг", "шага", "шагов")}. Идущие запросы получают токены не реже чем раз в ${fmtMs(r.maxGap)} мс вместо паузы в ${fmtMs(rInf.maxGap)} мс, а первый токен нового запроса приходит через ${fmtMs(r.ttft)} мс — на ${fmtMs(r.ttft - rInf.ttft)} мс позже, чем без ограничения: каждый лишний шаг заново платит ${BASE} мс за чтение весов.`;
    }
  }
  box.querySelectorAll("[data-bud]").forEach((b) => b.addEventListener("click", () => {
    budget = b.dataset.bud === "Infinity" ? Infinity : +b.dataset.bud;
    box.querySelectorAll("[data-bud]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    draw();
  }));
  pIn.addEventListener("input", () => { P = +pIn.value; pOut.value = P; draw(); });
  draw();
  return cbResize(svg, draw);
}

// Регистрация иллюстраций: имя из data-figure → функция монтирования
Object.assign(FIGURES, {
  "cb-roofline": mountCbRoofline,
  "cb-schedule": mountCbSchedule,
  "cb-flat": mountCbFlat,
  "cb-chunked": mountCbChunked
});
