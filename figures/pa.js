/* Иллюстрации раздела inference/paged-attention. */

/* ---------- Непрерывный резерв и блоки по требованию ---------- */
const PA_SLOTS = 64, PA_BS = 4, PA_NB = PA_SLOTS / PA_BS;
/* Условная нагрузка: приход, промпт, длина ответа (заранее неизвестна) и лимит max_tokens. */
const PA_LOAD = [
  { id: "A", arr: 1, p: 4, g: 8, m: 11 }, { id: "B", arr: 1, p: 3, g: 5, m: 9 },
  { id: "C", arr: 3, p: 9, g: 10, m: 14 }, { id: "D", arr: 4, p: 5, g: 5, m: 8 },
  { id: "E", arr: 5, p: 7, g: 6, m: 14 }, { id: "F", arr: 5, p: 4, g: 3, m: 12 },
  { id: "G", arr: 7, p: 8, g: 3, m: 5 }, { id: "H", arr: 9, p: 10, g: 2, m: 8 }
];
/* Continuous batching с двумя способами выделения памяти. За шаг идущий запрос дописывает
   в кеш один токен, принятый — весь промпт. Очередь обслуживается строго по порядку прихода.
   res: непрерывный резерв на промпт + max_tokens, первый подходящий свободный отрезок.
   paged: блоки по PA_BS ячеек выдаются по мере заполнения; если блока нет, вытесняется
   запрос, принятый последним, и позже пересчитывает промпт вместе с готовой частью ответа. */
function paSimAlloc(reqs, mode){
  const st = {}; reqs.forEach((r) => { st[r.id] = { gen: 0, len: 0, waited: 0, pre: false }; });
  const cell = new Array(PA_SLOTS).fill(null), blk = new Array(PA_NB).fill(null);
  const table = {}, resv = {}, frames = [];
  let queue = [], running = [], done = 0, t = 0;
  const freeBlocks = () => blk.reduce((a, x) => a + (x === null), 0);
  const takeBlock = (id) => { const b = blk.indexOf(null); blk[b] = id; table[id].push(b); return b; };
  while (done < reqs.length && t < 60){
    t++;
    const ev = { admit: [], grow: [], fail: null, preempt: [], finish: [] };
    reqs.filter((r) => r.arr === t).forEach((r) => queue.push(r));
    // decode: идущим нужен новый блок, если последний заполнен
    if (mode === "paged"){
      for (const r of running.slice()){
        if (!running.includes(r) || st[r.id].len % PA_BS) continue;
        while (!freeBlocks()){
          const v = running.pop();
          ev.preempt.push({ id: v.id, by: r.id, blocks: table[v.id].slice() });
          table[v.id].forEach((b) => { blk[b] = null; }); delete table[v.id];
          st[v.id].len = 0; st[v.id].pre = true; queue.unshift(v);
          if (v === r) break;
        }
        if (running.includes(r)) ev.grow.push({ id: r.id, b: takeBlock(r.id) });
      }
    }
    running.forEach((r) => { st[r.id].len++; st[r.id].gen++; });
    // приём из очереди
    while (queue.length){
      const r = queue[0], s = st[r.id], need = r.p + s.gen;
      if (mode === "res"){
        const size = r.p + r.m;
        let run = 0, from = -1, best = 0, free = 0;
        for (let i = 0; i < PA_SLOTS; i++){
          if (cell[i] === null){ run++; free++; best = Math.max(best, run); if (run >= size && from < 0) from = i - size + 1; }
          else run = 0;
        }
        if (from < 0){ ev.fail = { id: r.id, size, free, best }; break; }
        for (let i = from; i < from + size; i++) cell[i] = r.id;
        resv[r.id] = { from, size };
        ev.admit.push({ id: r.id, from, size });
      } else {
        const nb = Math.ceil(need / PA_BS), free = freeBlocks();
        if (nb > free){ ev.fail = { id: r.id, nb, free }; break; }
        table[r.id] = [];
        for (let k = 0; k < nb; k++) takeBlock(r.id);
        ev.admit.push({ id: r.id, blocks: table[r.id].slice(), resumed: s.pre, gen: s.gen });
      }
      queue.shift(); running.push(r); s.len = need;
    }
    queue.forEach((r) => { st[r.id].waited++; });
    const snap = {
      t, ev, running: running.map((r) => r.id), queue: queue.map((r) => r.id),
      cell: cell.slice(), blk: blk.slice(),
      table: Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.slice()])),
      resv: Object.fromEntries(Object.entries(resv).map(([k, v]) => [k, { ...v }])),
      len: Object.fromEntries(reqs.map((r) => [r.id, st[r.id].len]))
    };
    frames.push(snap);
    // кто дописал ответ, уходит после шага
    for (const r of running.slice()){
      if (st[r.id].gen < r.g) continue;
      running.splice(running.indexOf(r), 1); done++;
      if (mode === "res"){
        ev.finish.push({ id: r.id, used: r.p + r.g, size: resv[r.id].size });
        for (let i = 0; i < PA_SLOTS; i++) if (cell[i] === r.id) cell[i] = null;
        delete resv[r.id];
      } else {
        ev.finish.push({ id: r.id, blocks: table[r.id].slice() });
        table[r.id].forEach((b) => { blk[b] = null; }); delete table[r.id];
      }
    }
  }
  return { frames, T: frames.length, waited: Object.fromEntries(reqs.map((r) => [r.id, st[r.id].waited])) };
}

function mountPaAlloc(box){
  const reqs = PA_LOAD, byId = Object.fromEntries(reqs.map((r) => [r.id, r]));
  const sims = { res: paSimAlloc(reqs, "res"), paged: paSimAlloc(reqs, "paged") };
  const color = (id) => CB_G["ABCDEFGH".indexOf(id) % CB_G.length];
  let mode = "res";
  const cellsAcc = (n) => `${n} ${plural(n, "ячейку", "ячейки", "ячеек")}`;
  const cellsGen = (n) => `${n} ${plural(n, "ячейки", "ячеек", "ячеек")}`;
  const blocks = (n) => `${n} ${plural(n, "блок", "блока", "блоков")}`;
  const blist = (a) => joinRu(a.map(String));

  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Способ выделения памяти">
        <button type="button" role="tab" data-mode="res" aria-selected="true">Непрерывный резерв</button>
        <button type="button" role="tab" data-mode="paged" aria-selected="false">Блоки по требованию</button>
      </div>
    </div>
    <div class="fig-stage" style="margin-top:12px">
      <svg class="pa-mem" tabindex="0" role="img" aria-label="Память под KV-cache: 64 ячейки"></svg>
      <div class="pa-lines"><div class="pa-run"></div><div class="pa-wait"></div></div>
    </div>
    ${vlControls()}
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Номер шага"></div>
    <div class="fig-row"><div class="table-wrap" style="width:100%"><table class="cb-metrics"></table></div></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("pa-c pre", "--gc:var(--fig-node)"), "промпт"],
      [cbSwatch("pa-c dec", "--gc:var(--fig-node)"), "ответ"],
      [cbSwatch("pa-c resv", "--gc:var(--fig-node)"), "выделено, заполнится позже"],
      [`<svg viewBox="0 0 22 14"><defs><pattern id="pa-hatch-lg" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="pa-hatch-l"/></pattern></defs><rect x="3" y="1.5" width="16" height="11" rx="2" class="pa-c never" style="fill:url(#pa-hatch-lg)"/></svg>`, "выделено, не понадобится"],
      [cbSwatch("pa-c free"), "свободно"],
      [`<svg viewBox="0 0 22 14"><rect x="3" y="1.5" width="16" height="11" rx="2" class="pa-new"/></svg>`, "блок выдан на этом шаге"]
    ])}</div>`;
  const svg = box.querySelector(".pa-mem"), say = box.querySelector(".fig-say");
  const runEl = box.querySelector(".pa-run"), waitEl = box.querySelector(".pa-wait"), table = box.querySelector(".cb-metrics");

  const sim = () => sims[mode];
  function cellState(f, i){
    if (mode === "res"){
      const id = f.cell[i]; if (!id) return null;
      const k = i - f.resv[id].from, r = byId[id];
      return { id, k, kind: k < f.len[id] ? (k < r.p ? "pre" : "dec") : k < r.p + r.g ? "resv" : "never" };
    }
    const b = Math.floor(i / PA_BS), id = f.blk[b]; if (!id) return null;
    const k = f.table[id].indexOf(b) * PA_BS + i % PA_BS, r = byId[id];
    return { id, k, kind: k < f.len[id] ? (k < r.p ? "pre" : "dec") : k < r.p + r.g ? "resv" : "never" };
  }

  function narrate(f){
    const ev = f.ev, parts = [], T = sim().T;
    if (mode === "res"){
      if (ev.admit.length){
        const a = ev.admit;
        parts.push(a.length > 1
          ? `${joinRu(a.map((x) => x.id))} приняты: резервы на ${joinRu(a.map((x) => String(x.size)))} ${plural(a[a.length - 1].size, "ячейку", "ячейки", "ячеек")} подряд — промпт плюс лимит max_tokens.`
          : `${a[0].id} принят: резерв на ${cellsAcc(a[0].size)} подряд — промпт из ${byId[a[0].id].p} токенов плюс лимит ${byId[a[0].id].m}.`);
      }
      if (ev.fail){
        const x = ev.fail;
        parts.push(x.free >= x.size
          ? `<b>Внешняя фрагментация:</b> ${x.id} нужен непрерывный отрезок из ${cellsGen(x.size)}. Свободно ${x.free}, но самый длинный свободный отрезок — ${x.best}.`
          : `${x.id} нужен непрерывный отрезок из ${cellsGen(x.size)}, а свободных ячеек всего ${x.free}.`);
        if (f.queue.length > 1) parts.push(`За ним по порядку ${f.queue.length > 2 ? "ждут" : "ждёт"} ${joinRu(f.queue.slice(1))}.`);
      }
      ev.finish.forEach((x) => parts.push(`${x.id} дописал ответ: из ${cellsGen(x.size)} резерва токены заняли ${x.used}, ${x.size - x.used === 0 ? "пустых не осталось" : `ещё ${x.size - x.used} так и не понадобились`}. После шага резерв освобождается.`));
      if (!parts.length) parts.push(`${joinRu(f.running)} ${f.running.length > 1 ? "дописывают по токену в свои резервы" : "дописывает по токену в свой резерв"}. Пунктирные ячейки уже заняты, хотя токенов в них ещё нет.`);
    } else {
      ev.preempt.forEach((x) => parts.push(`<b>Память кончилась:</b> ${x.by} нужен новый блок, а свободных нет. Вытеснен ${x.id === x.by ? "он сам: он принят последним" : `${x.id}, принятый последним`}: его ${x.blocks.length === 1 ? "блок" : "блоки"} ${blist(x.blocks)} освобождены, сам он вернулся в начало очереди и позже пересчитает свой кеш.`));
      if (ev.grow.length) parts.push(`${ev.grow.length > 1 ? "Заполнили последний блок и получили новые" : "Заполнил последний блок и получил новый"}: ${joinRu(ev.grow.map((x) => `${x.id} — ${x.b}`))}.`);
      ev.admit.forEach((x) => parts.push(x.resumed
        ? `${x.id} возвращается после вытеснения: prefill заново считает ${x.gen ? "промпт и готовую часть ответа" : "его промпт"}, ${x.blocks.length === 1 ? "выдан блок" : "выданы блоки"} ${blist(x.blocks)}.`
        : `${x.id} принят: под промпт из ${byId[x.id].p} токенов ${x.blocks.length === 1 ? "выдан блок" : "выданы блоки"} ${blist(x.blocks)}.`));
      if (ev.fail) parts.push(`${ev.fail.id} ждёт: нужно ${blocks(ev.fail.nb)}, свободно ${ev.fail.free}.`);
      ev.finish.forEach((x) => parts.push(`${x.id} дописал ответ; после шага ${x.blocks.length === 1 ? "его блок" : "его блоки"} ${blist(x.blocks)} вернутся в пул.`));
      if (!parts.length) parts.push(`${joinRu(f.running)} ${f.running.length > 1 ? "дописывают" : "дописывает"} по токену. Пока последний блок не заполнен, новая память не нужна.`);
    }
    if (f.t === T){
      const other = sims[mode === "res" ? "paged" : "res"].T;
      parts.push(`Нагрузка обслужена за ${T} ${plural(T, "шаг", "шага", "шагов")}; ${mode === "res" ? "с блоками" : "с непрерывным резервом"} — за ${other}.`);
    }
    return `<b>Шаг ${f.t}.</b> ` + parts.join(" ");
  }

  function metrics(m){
    const s = sims[m], fr = s.frames;
    const conc = fr.reduce((a, f) => a + f.running.length, 0) / fr.length;
    const maxc = Math.max(...fr.map((f) => f.running.length));
    let uSum = 0, uN = 0;
    fr.forEach((f) => {
      const tok = f.running.reduce((a, id) => a + f.len[id], 0);
      const alloc = m === "res" ? f.cell.filter(Boolean).length : f.blk.filter(Boolean).length * PA_BS;
      if (alloc){ uSum += tok / alloc; uN++; }
    });
    const wait = reqs.reduce((a, r) => a + s.waited[r.id], 0) / reqs.length;
    const pre = fr.reduce((a, f) => a + f.ev.preempt.length, 0);
    return { T: s.T, conc, maxc, util: uSum / uN, wait, pre };
  }
  const MET = { res: metrics("res"), paged: metrics("paged") };
  function drawTable(){
    const on = (m) => mode === m ? ' class="on"' : "", a = MET.res, b = MET.paged;
    const pct = (x) => Math.round(x * 100) + "%";
    table.innerHTML = `
      <thead><tr><th></th><th${on("res")}>Резерв</th><th${on("paged")}>Блоки</th></tr></thead>
      <tbody>
        <tr><td>Шагов на всю нагрузку</td><td${on("res")}>${a.T}</td><td${on("paged")}>${b.T}</td></tr>
        <tr><td>Запросов одновременно, в среднем / максимум</td><td${on("res")}>${fmtN(a.conc)} / ${a.maxc}</td><td${on("paged")}>${fmtN(b.conc)} / ${b.maxc}</td></tr>
        <tr><td>Выделенной памяти занято токенами</td><td${on("res")}>${pct(a.util)}</td><td${on("paged")}>${pct(b.util)}</td></tr>
        <tr><td>Ожидание в очереди, шагов на запрос</td><td${on("res")}>${fmtN(a.wait)}</td><td${on("paged")}>${fmtN(b.wait)}</td></tr>
        <tr><td>Вытеснений</td><td${on("res")}>${a.pre}</td><td${on("paged")}>${b.pre}</td></tr>
      </tbody>`;
  }

  function draw(i){
    const f = sim().frames[i];
    const VW = cbFit(svg, 340, 640), narrow = VW < 480, LX = narrow ? 20 : 26;
    const paged = mode === "paged", BG = paged ? (narrow ? 5 : 8) : 2, IG = 2;
    const cw = paged ? (VW - LX - 3 * BG - 12 * IG) / 16 : (VW - LX - 15 * IG) / 16;
    const CH = narrow ? 22 : 26, TOP = 15, RS = CH + 19;
    const X = (c) => {
      if (!paged) return LX + c * (cw + IG);
      const b = Math.floor(c / PA_BS), k = c % PA_BS;
      return LX + b * (PA_BS * cw + 3 * IG + BG) + k * (cw + IG);
    };
    const newBlocks = new Set(paged ? [...f.ev.grow.map((x) => x.b), ...f.ev.admit.flatMap((x) => x.blocks)] : []);
    const freed = new Set(paged ? f.ev.preempt.flatMap((x) => x.blocks).filter((b) => !f.blk[b]) : []);
    let s = `<defs><pattern id="pa-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="pa-hatch-l"/></pattern></defs>`;
    for (let row = 0; row < 4; row++){
      const y = TOP + row * RS;
      s += `<text x="${LX - 6}" y="${y + CH / 2}" class="cb-num" style="text-anchor:end">${row * 16}</text>`;
      if (paged) for (let bb = 0; bb < 4; bb++){
        const b = row * 4 + bb, x0 = X(b * PA_BS), w = PA_BS * cw + 3 * IG;
        s += `<text x="${f1(x0 + w / 2)}" y="${y - 5}" class="pa-bn${newBlocks.has(b) ? " new" : ""}">блок ${b}</text>`;
      }
      let prev = null;
      for (let c = 0; c < 16; c++){
        const idx = row * 16 + c, x = X(c), cs = cellState(f, idx);
        if (!cs){ s += `<rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${CH}" rx="2.5" class="pa-c free"/>`; prev = null; continue; }
        const first = cs.id !== prev || (paged && c % PA_BS === 0);
        prev = cs.id;
        s += `<g style="--gc:${color(cs.id)}"><rect x="${f1(x)}" y="${y}" width="${f1(cw)}" height="${CH}" rx="2.5" class="pa-c ${cs.kind}"/>`;
        if (first && cw >= 11) s += `<text x="${f1(x + cw / 2)}" y="${y + CH / 2}" class="cb-t ${cs.kind === "pre" ? "on-pre" : "on-dec"}">${cs.id}</text>`;
        s += `</g>`;
      }
      if (paged) for (let bb = 0; bb < 4; bb++){
        const b = row * 4 + bb, x0 = X(b * PA_BS) - 2, w = PA_BS * cw + 3 * IG + 4;
        if (newBlocks.has(b)) s += `<rect x="${f1(x0)}" y="${y - 2}" width="${f1(w)}" height="${CH + 4}" rx="4" class="pa-new"/>`;
        else if (freed.has(b)) s += `<rect x="${f1(x0)}" y="${y - 2}" width="${f1(w)}" height="${CH + 4}" rx="4" class="pa-freed"/>`;
      }
    }
    const VH = TOP + 4 * RS - 17;
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;

    const chip = (id, txt, cls = "") => `<span class="pa-chip ${cls}" style="--gc:${color(id)}"><b>${id}</b>${txt}</span>`;
    const run = f.running.map((id) => {
      if (!paged){ const r = f.resv[id]; return chip(id, `ячейки ${r.from}–${r.from + r.size - 1}`); }
      return chip(id, (f.table[id] || []).join(", "));
    });
    runEl.innerHTML = `<span>${paged ? "Таблицы блоков:" : "Резервы:"}</span>${run.join("") || "—"}`;
    waitEl.innerHTML = `<span>Очередь:</span>${f.queue.map((id) => chip(id, "", "wait")).join("") || "пусто"}`;
    say.innerHTML = narrate(f);
  }

  const player = vlPlayer(box, {
    count: () => sim().T,
    draw,
    interval: 1300,
    label: (i, n) => {
      const f = sim().frames[i], tok = f.running.reduce((a, id) => a + f.len[id], 0);
      return `шаг ${i + 1} из ${n} · токенов в кеше ${tok} из ${PA_SLOTS}`;
    }
  });
  box.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.mode === mode) return;
    mode = b.dataset.mode; player.stop();
    box.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    drawTable(); player.go(Math.min(player.i, sim().T - 1));
  }));
  drawTable();
  player.go(0);
  const off = cbResize(svg, () => draw(player.i));
  return () => { player.stop(); off(); };
}

/* ---------- Prefix caching: цепочка хешей, счётчики ссылок, очередь вытеснения ---------- */
const PA_PB = 4, PA_POOL = 12;
const PA_SYS = ["Ты", "помощник", "сервиса.", "Отвечай", "по", "документации", "и", "кратко."];
const PA_Q1 = ["Как", "сменить", "тариф", "на", "годовой?"];
const PA_A1 = ["Откройте", "«Тарифы»", "→", "«Сменить»", "и", "выберите", "годовой."];
const PA_Q2 = ["Как", "сбросить", "пароль?"];
const PA_A2 = ["Нажмите", "«Забыли", "пароль?»", "при", "входе."];
const PA_A3 = ["Откройте", "«Тарифы»", "→", "«Сменить»", "→", "«Годовой»."];
const PA_Q4 = ["А", "на", "месячный?"];
const PA_PLAN = [
  [["arrive", "A", [...PA_SYS, ...PA_Q1]]],
  [["gen", "A", PA_A1.slice(0, 3)], ["arrive", "B", [...PA_SYS, ...PA_Q2]]],
  [["gen", "A", PA_A1.slice(3)], ["gen", "B", PA_A2], ["finish", "A"], ["finish", "B"]],
  [["arrive", "C", ["[12:05]", ...PA_SYS, ...PA_Q1]]],
  [["gen", "C", PA_A3], ["finish", "C"]],
  [["arrive", "D", [...PA_SYS, ...PA_Q1, ...PA_A1, ...PA_Q4]]]
];
/* учебный хеш (FNV-1a): от хеша предыдущего блока и токенов текущего */
function paHash(parent, toks){
  let h = 0x811c9dc5;
  const s = parent + "|" + toks.join(" ");
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0").slice(0, 3);
}
/* Менеджер блоков в духе vLLM: попадания по цепочке хешей (не дальше n − 1 токенов),
   кешируются только полные блоки, освобождённые блоки встают в хвост очереди
   в обратном порядке, новый блок берётся из головы очереди с удалением его хеша. */
function paRunPlan(){
  const blocks = Array.from({ length: PA_POOL }, () => ({ hash: null, ref: 0 }));
  const cache = new Map(), reqs = {}, order = [];
  let queue = blocks.map((_, i) => i);
  const frames = [];
  const alloc = (rec) => {
    const b = queue.shift(), old = blocks[b].hash;
    if (old){ cache.delete(old); rec.evict.push({ b, hash: old }); blocks[b].hash = null; }
    blocks[b].ref = 1;
    return b;
  };
  const seal = (r, j) => {
    const parent = j ? r.hashes[j - 1] : "root", h = paHash(parent, r.tokens.slice(j * PA_PB, (j + 1) * PA_PB));
    r.hashes[j] = h;
    if (!cache.has(h)){ cache.set(h, r.table[j]); blocks[r.table[j]].hash = h; }
  };
  for (const step of PA_PLAN){
    const rec = { acts: [], evict: [] };
    for (const [op, id, toks] of step){
      if (op === "arrive"){
        const n = toks.length, r = { id, tokens: toks.slice(), table: [], hashes: [], kind: [], n0: n, done: false };
        reqs[id] = r; order.push(id);
        let parent = "root", m = 0;
        while ((m + 1) * PA_PB <= n - 1){
          const h = paHash(parent, toks.slice(m * PA_PB, (m + 1) * PA_PB));
          if (!cache.has(h)) break;
          const b = cache.get(h);
          if (blocks[b].ref === 0) queue = queue.filter((x) => x !== b);
          blocks[b].ref++;
          r.table.push(b); r.hashes.push(h); r.kind.push("hit");
          parent = h; m++;
        }
        const nb = Math.ceil(n / PA_PB);
        for (let j = m; j < nb; j++){
          r.table.push(alloc(rec));
          if ((j + 1) * PA_PB <= n){ r.kind.push("calc"); seal(r, j); } else r.kind.push("part");
        }
        rec.acts.push({ op, id, n, hit: m * PA_PB, hitBlocks: r.table.slice(0, m), newBlocks: r.table.slice(m) });
      } else if (op === "gen"){
        const r = reqs[id], added = [];
        for (const tk of toks){
          if (r.tokens.length % PA_PB === 0){ r.table.push(alloc(rec)); r.kind.push("part"); added.push(r.table[r.table.length - 1]); }
          r.tokens.push(tk);
          if (r.tokens.length % PA_PB === 0){ const j = r.tokens.length / PA_PB - 1; r.kind[j] = "calc"; seal(r, j); }
        }
        rec.acts.push({ op, id, k: toks.length, added });
      } else if (op === "finish"){
        const r = reqs[id], freed = [];
        r.table.slice().reverse().forEach((b) => {
          blocks[b].ref--;
          if (blocks[b].ref === 0){ queue.push(b); freed.push(b); }
        });
        r.done = true;
        rec.acts.push({ op, id, freed });
      }
    }
    frames.push({
      rec, queue: queue.slice(),
      blocks: blocks.map((x) => ({ ...x })),
      reqs: order.map((id) => { const r = reqs[id]; return { ...r, tokens: r.tokens.slice(), table: r.table.slice(), hashes: r.hashes.slice(), kind: r.kind.slice() }; })
    });
  }
  return frames;
}

function mountPaPrefix(box){
  const frames = paRunPlan();
  box.innerHTML = `
    <div class="fig-stage"><svg class="pa-pfx" tabindex="0" role="img" aria-label="Логические блоки запросов и физические блоки памяти"></svg></div>
    ${vlControls()}
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([
      [cbSwatch("pa-lb hit"), "найден в кеше"],
      [cbSwatch("pa-lb calc"), "посчитан этим запросом"],
      [cbSwatch("pa-lb part"), "неполный: не кешируется"],
      [cbSwatch("pa-lb cached"), "свободен, хеш сохранён"],
      [cbSwatch("pa-lb gone"), "вытеснен из кеша"]
    ])}</div>`;
  const svg = box.querySelector(".pa-pfx"), say = box.querySelector(".fig-say");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const blocksText = (toks) => {
    const out = [];
    for (let j = 0; j < toks.length; j += PA_PB) out.push(esc(toks.slice(j, j + PA_PB).join(" ")));
    return `<span class="pa-tok">${out.join("<i>|</i>")}</span>`;
  };
  const bl = (a) => `${a.length === 1 ? "блок" : "блоки"} ${joinRu(a.map(String))}`;
  const toks = (n) => `${n} ${plural(n, "токен", "токена", "токенов")}`;

  function narrate(i){
    const f = frames[i], acts = f.rec.acts, R = (id) => f.reqs.find((r) => r.id === id);
    const qpos = (b) => f.queue.indexOf(b) + 1;
    switch (i){
      case 0: {
        const a = acts[0], r = R("A");
        return `<b>Запрос A</b> — первый ход диалога: системный промпт и вопрос. Кеш пуст, поэтому prefill считает все ${toks(a.n)}. Три полных блока получают хеши и попадают в таблицу кеша; четвёртый заполнен на четверть и не кешируется.<br>Блоки A: ${blocksText(r.tokens)}`;
      }
      case 1: {
        const b = acts[1];
        return `A сгенерировал три токена ответа: его последний блок заполнился и тоже получил хеш. Приходит <b>B</b> — другой пользователь с тем же системным промптом. Хеши первых двух блоков совпали с хешами A, и ${bl(b.hitBlocks)} вошли в таблицу B без вычислений; у каждого из них теперь два владельца. Prefill считает ${b.n - b.hit} ${plural(b.n - b.hit, "токен", "токена", "токенов")} из ${b.n}.<br>Блоки B: ${blocksText(R("B").tokens)}`;
      }
      case 2: {
        const fa = acts.find((x) => x.op === "finish" && x.id === "A"), fb = acts.find((x) => x.op === "finish" && x.id === "B");
        const held = R("A").table.filter((b) => !fa.freed.includes(b));
        return `A и B дописали ответы и закончили. Блоки, на которые больше никто не ссылается, не стираются: они встают в очередь свободных вместе с хешами. A отдаёт ${bl(fa.freed)}; ${bl(held)} ещё держит B. Затем B отдаёт ${bl(fb.freed)}. Каждый запрос освобождает блоки с конца, поэтому хвосты стоят ближе к голове очереди и будут вытеснены раньше, а общие блоки системного промпта — позже всех.`;
      }
      case 3: {
        const c = acts[0];
        return `<b>C</b> задаёт тот же вопрос, что и A, но сервис вписал в начало время запроса. Остальной текст совпадает с A, однако сдвинут на токен и идёт после другого начала. Хеш первого блока другой, а через цепочку — и всех следующих. Попаданий нет: prefill считает все ${toks(c.n)}.<br>Блоки C: ${blocksText(R("C").tokens)}`;
      }
      case 4: {
        const fc = acts.find((x) => x.op === "finish");
        const empty = f.blocks.filter((x) => !x.hash).length, busy = f.blocks.filter((x) => x.ref > 0).length;
        return `C ответил и закончил. Его ${bl(fc.freed)} тоже ушли в хвост очереди, начиная с последнего. ${empty ? `Пустых блоков осталось ${empty}.` : `Теперь каждый из ${PA_POOL} блоков хранит чей-то кеш и пустых не осталось${busy ? "" : ", хотя ни один запрос не выполняется"}.`}`;
      }
      default: {
        const d = acts[0], ev = f.rec.evict[0];
        const B = R("B"), keep = B.table.filter((b, j) => f.blocks[b].hash === B.hashes[j]);
        const tail = ev ? ` Пустых блоков нет, поэтому новый берётся из головы очереди — блок ${ev.b}, хвост ответа B. Его хеш #${ev.hash} удалён из кеша: если диалог B продолжится, найдутся только ${bl(keep)}.` : "";
        return `<b>D</b> — второй ход диалога A: история (системный промпт, вопрос и ответ A) и новый вопрос. Найдены все пять блоков истории, в том числе блоки с ответом модели: их K и V посчитаны ещё при генерации. Prefill считает ${d.n - d.hit} ${plural(d.n - d.hit, "токен", "токена", "токенов")} из ${d.n}.${tail}<br>Блоки D: ${blocksText(R("D").tokens)}`;
      }
    }
  }

  function draw(i){
    const f = frames[i], acts = f.rec.acts, active = new Set(acts.map((a) => a.id));
    const VW = cbFit(svg, 340, 640), narrow = VW < 480, LX = 22, G = narrow ? 4 : 6;
    const bw = (VW - LX - 5 * G) / 6, BH = 34, RS = BH + 8;
    const evicted = new Set(f.rec.evict.map((x) => x.b));
    let s = `<text x="0" y="8" class="muted-t" dominant-baseline="central">Логические блоки запросов → номер физического блока</text>`;
    let y = 22;
    f.reqs.forEach((r) => {
      const now = active.has(r.id);
      s += `<g${!now && r.done ? ' class="pa-dim"' : ""}>`;
      s += `<text x="0" y="${y + BH / 2}" class="pa-rl${now ? " now" : ""}">${r.id}</text>`;
      r.table.forEach((b, j) => {
        const x = LX + j * (bw + G);
        let cls = r.kind[j], htxt = r.hashes[j] ? "#" + r.hashes[j] : "—", gone = false;
        if (r.done && r.hashes[j] && f.blocks[b].hash !== r.hashes[j]){ cls = "gone"; gone = true; }
        s += `<rect x="${f1(x)}" y="${y}" width="${f1(bw)}" height="${BH}" rx="4" class="pa-lb ${cls}"/>`;
        s += `<text x="${f1(x + bw / 2)}" y="${y + 11}" class="pa-h${gone ? " gone" : ""}">${htxt}</text>`;
        s += `<text x="${f1(x + bw / 2)}" y="${y + 25}" class="pa-s${gone ? " bad" : ""}">${gone ? "вытеснен" : "→ " + b}</text>`;
      });
      s += `</g>`;
      y += RS;
    });
    y = 22 + 4 * RS + 8;
    s += `<text x="0" y="${y}" class="muted-t" dominant-baseline="central">Физическая память: ${PA_POOL} блоков</text>`;
    y += 14;
    const perRow = narrow ? 6 : 12, pw = (VW - (perRow - 1) * G) / perRow, PH = 46;
    f.blocks.forEach((blk, b) => {
      const x = (b % perRow) * (pw + G), yy = y + Math.floor(b / perRow) * (PH + G);
      const cls = evicted.has(b) ? "evict" : blk.ref > 0 ? "used" : blk.hash ? "cached" : "empty";
      const status = blk.ref > 0 ? `ref ${blk.ref}` : blk.hash ? `оч. ${f.queue.indexOf(b) + 1}` : "пуст";
      s += `<rect x="${f1(x)}" y="${yy}" width="${f1(pw)}" height="${PH}" rx="4" class="pa-lb ${cls === "evict" ? "used" : cls}"/>`;
      if (cls === "evict") s += `<rect x="${f1(x - 2)}" y="${yy - 2}" width="${f1(pw + 4)}" height="${PH + 4}" rx="5" class="pa-lb evict"/>`;
      s += `<text x="${f1(x + 6)}" y="${yy + 9}" class="pa-s" style="text-anchor:start">${b}</text>`;
      s += `<text x="${f1(x + pw / 2)}" y="${yy + 23}" class="pa-h">${blk.hash ? "#" + blk.hash : ""}</text>`;
      s += `<text x="${f1(x + pw / 2)}" y="${yy + 37}" class="pa-s">${status}</text>`;
    });
    const VH = y + Math.ceil(PA_POOL / perRow) * (PH + G) - G + 2;
    svg.setAttribute("viewBox", `0 0 ${VW} ${VH}`);
    svg.innerHTML = s;
    say.innerHTML = narrate(i);
  }
  const player = vlPlayer(box, { count: () => frames.length, draw, interval: 3200 });
  player.go(0);
  const off = cbResize(svg, () => draw(player.i));
  return () => { player.stop(); off(); };
}

Object.assign(FIGURES, {
  "pa-alloc": mountPaAlloc,
  "pa-prefix": mountPaPrefix
});
