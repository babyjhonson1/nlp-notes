/* Иллюстрации раздела rag/ann: Annoy, LSH, IVF, skip list, HNSW. */

// ---------- HNSW engine (demo) ----------
const HNSW_PTS = [ // u,v in plate coords; level; listed in insertion order
  [377,107,1],[201,96,0],[405,43,0],[235,40,2],[479,121,0],[110,46,1],[282,81,0],[590,31,0],
  [172,35,0],[545,97,1],[66,105,0],[472,69,2],[295,20,0],[429,99,0],[350,36,1],[140,91,0],
  [452,20,0],[248,121,0],[524,44,0],[323,121,0]
].map(([u,v,level],i)=>({id:i,name:String.fromCharCode(65+i),u,v,level}));

function hnswBuild(P, cfg){
  const {M, efC} = cfg; const Mmax = l => l===0 ? 2*M : M;
  const dd = (a,b) => Math.hypot(a.u-b.u, a.v-b.v);
  const links = [new Map(), new Map(), new Map()];
  const nb = (id,l) => links[l].get(id) || [];
  let ep = null, L = -1; const inserted = [];
  const steps = [];
  const nm = id => P[id].name;
  const list = ids => ids.map(nm).join(', ');
  const snap = (insIdx, cap, hl={}) => steps.push({
    ins: insIdx, cap, hl, ep, L, inserted: inserted.slice(),
    links: links.map(m => { const o={}; m.forEach((v,k)=>o[k]=v.slice()); return o; })
  });
  function searchLayer(q, eps, ef, l){
    const dq = id => dd(P[id], q);
    const vis = new Set(eps); let C = eps.slice(); let W = eps.slice().sort((a,b)=>dq(a)-dq(b));
    while (C.length){
      C.sort((a,b)=>dq(a)-dq(b)); const c = C.shift();
      if (dq(c) > dq(W[W.length-1])) break;
      for (const e of nb(c,l)){
        if (vis.has(e)) continue; vis.add(e);
        if (W.length < ef || dq(e) < dq(W[W.length-1])){
          C.push(e); W.push(e); W.sort((a,b)=>dq(a)-dq(b)); if (W.length > ef) W.pop();
        }
      }
    }
    return W;
  }
  function heuristic(base, cands, mx){
    const s = cands.slice().sort((a,b)=>dd(P[a],base)-dd(P[b],base));
    const R=[], rej=[], skip=[];
    for (const e of s){
      if (R.length >= mx){ skip.push(e); continue; }
      const by = R.find(r => dd(P[e],P[r]) < dd(P[e],base));
      if (by === undefined) R.push(e); else rej.push({id:e, by});
    }
    return {R, rej, skip};
  }
  P.forEach((q, i) => {
    const l = q.level; inserted.push(q.id);
    for (let lc=0; lc<=l; lc++) links[lc].set(q.id, []);
    const base = {ins:i, node:q.id};
    if (ep === null){
      ep = q.id; L = l;
      snap(i, `Первая точка ${q.name}. Её уровень ${l}, поэтому она появляется на слоях 0…${l}. Соединять пока не с кем — ${q.name} становится точкой входа (EP).`, {...base, active:l});
      return;
    }
    const lvlTxt = l===0 ? 'только на слое 0' : `на слоях 0…${l}`;
    snap(i, `Вставляем точку ${q.name}. Случайно выпал уровень ${l} — она будет ${lvlTxt}. Поиск места для неё начинаем с точки входа ${nm(ep)} на верхнем слое ${L}.`, {...base, active: Math.max(L,l), cur:{l:L,id:ep}});
    let cur = ep; const path = []; const desc = [];
    for (let lc = L; lc > l; lc--){
      const hop = [cur]; let curD = dd(P[cur], q), changed = true;
      while (changed){ changed=false;
        for (const e of nb(cur,lc)){ const d = dd(P[e],q); if (d < curD){ curD=d; cur=e; changed=true; } }
        if (changed) { path.push({l:lc, a:hop[hop.length-1], b:cur}); hop.push(cur); }
      }
      const txt = hop.length>1
        ? `Слой ${lc}: жадно идём к ${q.name}: ${hop.map(nm).join(' → ')}. Ближе на этом слое не подобраться, поэтому из ${nm(cur)} спускаемся на слой ${lc-1}.`
        : `Слой ${lc}: среди соседей ${nm(cur)} нет точки ближе к ${q.name}, поэтому сразу спускаемся на слой ${lc-1}, оставаясь в ${nm(cur)}.`;
      desc.push({id:cur, from:lc, to:lc-1});
      snap(i, txt, {...base, active:lc, path:path.slice(), cur:{l:lc,id:cur}, desc:desc.slice()});
    }
    let Wn = [cur];
    for (let lc = Math.min(L,l); lc >= 0; lc--){
      const W = searchLayer(q, Wn, efC, lc);
      const r = dd(P[W[W.length-1]], q);
      snap(i, `Слой ${lc}: ищем ближайших к ${q.name} с efConstruction = ${efC}. Кандидаты: ${list(W)}.`, {...base, active:lc, path:path.slice(), desc:desc.slice(), cand:{l:lc, ids:W}, circle:{l:lc, r}});
      const {R, rej, skip} = heuristic(q, W, M);
      if (W.length > 1){
        let t = `Выбираем до M = ${M} соседей эвристикой: идём по кандидатам от ближнего к дальнему. `;
        t += `Берём ${list(R)}. `;
        const byB = new Map(); rej.forEach(x => { if (!byB.has(x.by)) byB.set(x.by, []); byB.get(x.by).push(x.id); });
        byB.forEach((ids, b) => {
          t += ids.length === 1
            ? `${nm(ids[0])} отбрасываем: она ближе к уже выбранной ${nm(b)}, чем к ${q.name}, — до неё и так дойдём через ${nm(b)}. `
            : `${list(ids)} отбрасываем: каждая из них ближе к уже выбранной ${nm(b)}, чем к ${q.name}, — до них и так дойдём через ${nm(b)}. `;
        });
        if (skip.length) t += skip.length === 1 ? `${list(skip)} уже не нужна: M соседей набрано.` : `${list(skip)} уже не нужны: M соседей набрано.`;
        snap(i, t.trim(), {...base, active:lc, path:path.slice(), desc:desc.slice(), cand:{l:lc, ids:W}, sel:{l:lc, ids:R}, rej:{l:lc, list:rej}, skip:{l:lc, ids:skip}});
      }
      const newE = [];
      for (const n of R){ links[lc].get(q.id).push(n); links[lc].get(n).push(q.id); newE.push({l:lc, a:q.id, b:n}); }
      snap(i, `Слой ${lc}: соединяем ${q.name} с ${list(R)} рёбрами в обе стороны.`, {...base, active:lc, path:path.slice(), desc:desc.slice(), newE});
      const removed = [], over = [];
      for (const n of R){
        const conns = links[lc].get(n);
        if (conns.length > Mmax(lc)){
          const {R:keep} = heuristic(P[n], conns, Mmax(lc));
          for (const x of conns) if (!keep.includes(x)) removed.push({l:lc, a:n, b:x});
          over.push({n, k:conns.length});
          links[lc].set(n, keep);
        }
      }
      if (removed.length){
        const parts = over.map(o => {
          const rm = removed.filter(x=>x.a===o.n).map(x=>nm(x.b));
          const links = rm.map(x => `${nm(o.n)} → ${x}`).join(' и ');
          return `у ${nm(o.n)} стало ${o.k} ${plural(o.k,'связь','связи','связей')} при лимите ${Mmax(lc)}: по той же эвристике оставляем лучшие, ${rm.length===1?'ссылку':'ссылки'} ${links} удаляем`;
        });
        const oneWay = removed.filter(x => (links[lc].get(x.b)||[]).includes(x.a));
        let t = `Слой ${lc}: ${parts.join('; ')}.`;
        if (oneWay.length) t += oneWay.length === 1
          ? ` Обратная ссылка ${nm(oneWay[0].b)} → ${nm(oneWay[0].a)} остаётся (пунктир со стрелкой): рёбра в HNSW направленные.`
          : ` Обратные ссылки ${oneWay.map(x=>`${nm(x.b)} → ${nm(x.a)}`).join(' и ')} остаются (пунктир со стрелкой): рёбра в HNSW направленные.`;
        snap(i, t, {...base, active:lc, path:path.slice(), desc:desc.slice(), removed, over:over.map(o=>o.n), overL:lc});
      }
      Wn = W;
    }
    if (l > L){
      const old = ep; ep = q.id; L = l;
      snap(i, `Уровень ${q.name} (${l}) выше прежнего верхнего слоя — теперь ${q.name} новая точка входа вместо ${nm(old)}. Все следующие поиски будут начинаться с неё.`, {...base, active:l, epChange:true});
    }
  });
  snap(P.length-1, `Граф готов: ${P.length} точек на слое 0, ${P.filter(p=>p.level>=1).length} на слое 1, ${P.filter(p=>p.level>=2).length} на слое 2. Переключитесь на «Поиск», чтобы найти соседей для своего запроса.`, {done:true});
  return {steps, links, ep, L};
}

function hnswSearch(P, G, q, ef, k){
  const dd = (a,b) => Math.hypot(a.u-b.u, a.v-b.v);
  const dq = id => dd(P[id], q); const nm = id => P[id].name;
  const nb = (id,l) => G.links[l].get(id) || [];
  const steps = []; let ndist = 0; const path=[], desc=[];
  const snap = (cap, hl) => steps.push({cap, hl:{...hl, path:path.slice(), desc:desc.slice()}, nd: ndist});
  let cur = G.ep; ndist++; let curD = dq(cur);
  snap(`Поиск всегда начинается с точки входа ${nm(cur)} на верхнем слое ${G.L}. Пунктир — расстояние от запроса до лучшей найденной точки.`, {phase:G.L, active:G.L, cur:{l:G.L,id:cur}, circle:{l:G.L, r:curD}});
  for (let lc = G.L; lc > 0; lc--){
    while (true){
      const ns = nb(cur, lc); ndist += ns.length;
      let best = null, bd = curD;
      for (const e of ns){ const d = dq(e); if (d < bd){ bd=d; best=e; } }
      if (best !== null){
        path.push({l:lc, a:cur, b:best});
        snap(`Слой ${lc}: смотрим соседей ${nm(cur)} — ${ns.map(nm).join(', ')}. Ближе всех к запросу ${nm(best)}, и она ближе, чем ${nm(cur)}, — переходим.`, {phase:lc, active:lc, cur:{l:lc,id:best}, looked:{l:lc, from:cur, ids:ns}, circle:{l:lc, r:bd}});
        cur = best; curD = bd;
      } else {
        desc.push({id:cur, from:lc, to:lc-1});
        snap(ns.length
          ? `Слой ${lc}: соседи ${nm(cur)} (${ns.map(nm).join(', ')}) дальше от запроса, чем сама ${nm(cur)}. Это локальный минимум слоя — спускаемся на слой ${lc-1}, оставаясь в ${nm(cur)}.`
          : `Слой ${lc}: у ${nm(cur)} здесь нет соседей — спускаемся на слой ${lc-1}, оставаясь в ${nm(cur)}.`,
          {phase:lc, active:lc-1, cur:{l:lc-1,id:cur}, looked:{l:lc, from:cur, ids:ns}, circle:{l:lc-1, r:curD}});
        break;
      }
    }
  }
  // layer 0 beam search
  const vis = new Set([cur]); let C=[cur], W=[cur];
  snap((ef === 1 ? `Слой 0: ef = 1, поэтому поиск остаётся чисто жадным — W хранит одну лучшую точку.` : `Слой 0: теперь держим не одну лучшую точку, а ef = ${ef} лучших.`) + ` W — лучшие найденные (заливка), C — кандидаты, чьих соседей ещё не смотрели (обводка). Пока в обоих множествах только ${nm(cur)}.`, {phase:0, active:0, W:W.slice(), C:C.slice(), vis:[...vis], circle:{l:0, r:dq(W[W.length-1])}});
  while (C.length){
    C.sort((a,b)=>dq(a)-dq(b)); const c = C.shift();
    const f = W[W.length-1];
    if (dq(c) > dq(f)){
      snap(`Ближайший из оставшихся кандидатов, ${nm(c)}, дальше худшей точки в W (${nm(f)}). Улучшить результат уже нечем — останавливаемся.`, {phase:0, active:0, W:W.slice(), C:[c, ...C], vis:[...vis], expand:c, circle:{l:0, r:dq(f)}, stop:true});
      C = []; break;
    }
    const notes = []; const added=[];
    for (const e of nb(c,0)){
      if (vis.has(e)){ notes.push(`${nm(e)} уже видели`); continue; }
      vis.add(e); ndist++;
      const fw = W[W.length-1];
      if (W.length < ef || dq(e) < dq(fw)){
        C.push(e); W.push(e); W.sort((a,b)=>dq(a)-dq(b)); added.push(e);
        let t = `${nm(e)} — в W`;
        if (W.length > ef){ const out = W.pop(); t += out===e ? '' : ` (вытесняет ${nm(out)})`; }
        notes.push(t);
      } else notes.push(`${nm(e)} дальше худшего в W — мимо`);
    }
    snap(`Раскрываем ближайшего кандидата ${nm(c)}: ${notes.join('; ')}.`, {phase:0, active:0, W:W.slice(), C:C.slice(), vis:[...vis], expand:c, added, circle:{l:0, r:dq(W[W.length-1])}});
  }
  const found = W.slice(0,k);
  const exact = P.map(p=>p.id).sort((a,b)=>dq(a)-dq(b)).slice(0,k);
  const hit = found.filter(id=>exact.includes(id)).length;
  snap(`${k === 1 ? 'Ответ — ближайшая точка из W' : `Ответ — ${k} ближайшие точки из W`}: ${found.map(nm).join(', ')}. Полный перебор дал бы ${exact.map(nm).join(', ')}: recall@${k} = ${hit}/${k}. Расстояний посчитано ${ndist} вместо ${P.length}; на миллионах точек HNSW считает тысячи расстояний вместо миллионов.`, {phase:-1, active:0, W:W.slice(), vis:[...vis], found, exact, circle:{l:0, r:dq(found[found.length-1])}, final:true});
  return steps;
}

/* ---------- Annoy: дерево случайных проекций ---------- */
function mountAnnoy(box){
  const W = 420, H = 300, R = rng(41), P = [];
  for (let i = 0; i < 46; i++){
    const c = i % 3 === 0 ? [120, 90] : i % 3 === 1 ? [300, 200] : [R() * W, R() * H];
    const s = i % 3 === 2 ? 0 : 55;
    P.push([Math.min(W - 14, Math.max(14, c[0] + gauss(R) * s)), Math.min(H - 14, Math.max(14, c[1] + gauss(R) * s * 0.8))]);
  }
  let seed = 3, q = [236, 128], tree = null;
  function split(ids, poly, depth, r){
    const node = { ids, poly, depth };
    if (depth === 3) return node;
    let n, c;
    if (ids.length >= 2){
      const i = Math.floor(r() * ids.length); let j = Math.floor(r() * (ids.length - 1)); if (j >= i) j++;
      let a = P[ids[i]].slice(), b = P[ids[j]].slice();
      // как в Annoy: две случайные точки чуть уточняем итерациями 2-means
      for (let it = 0; it < 3; it++){
        const A = [0, 0, 0], B = [0, 0, 0];
        ids.forEach(id => { const p = P[id], T = d2(p, a) <= d2(p, b) ? A : B; T[0] += p[0]; T[1] += p[1]; T[2]++; });
        if (A[2] && B[2]){ a = [A[0] / A[2], A[1] / A[2]]; b = [B[0] / B[2], B[1] / B[2]]; }
      }
      n = [b[0] - a[0], b[1] - a[1]]; c = n[0] * (a[0] + b[0]) / 2 + n[1] * (a[1] + b[1]) / 2;
    } else {
      const ang = r() * Math.PI, cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      n = [Math.cos(ang), Math.sin(ang)]; c = n[0] * cx + n[1] * cy;
    }
    node.n = n; node.c = c; node.seg = lineInPoly(poly, n, c);
    const side = (p) => n[0] * p[0] + n[1] * p[1] < c;
    node.L = split(ids.filter(id => side(P[id])), clipPoly(poly, n, c), depth + 1, r);
    node.R = split(ids.filter(id => !side(P[id])), clipPoly(poly, [-n[0], -n[1]], -c), depth + 1, r);
    return node;
  }
  function build(){ tree = split(P.map((_, i) => i), [[0, 0], [W, 0], [W, H], [0, H]], 0, rng(seed)); }
  function pathTo(p){
    const path = []; let nd = tree, idx = 0;
    while (nd.L){ path.push(nd); const left = nd.n[0] * p[0] + nd.n[1] * p[1] < nd.c; idx = idx * 2 + (left ? 0 : 1); nd = left ? nd.L : nd.R; }
    path.push(nd); return { path, leaf: nd, idx };
  }
  box.innerHTML = `
    <div class="fig-split">
      <div class="wide"><svg class="clickable plane" viewBox="0 0 ${W} ${H}" role="img" aria-label="Разбиение плоскости деревом случайных проекций"></svg></div>
      <div><svg class="tree" viewBox="0 0 300 250" role="img" aria-label="Путь запроса по дереву"></svg></div>
    </div>
    <div class="fig-row"><button class="fig-btn" type="button" data-act="reroll">${ICON.dice} Построить другое дерево</button></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([[LG.q(), "запрос"], [LG.cell("on"), "лист запроса"], [LG.dot("hit"), "кандидаты из листа"], [LG.line("path"), "разрезы на пути"], [LG.ring(""), "настоящий ближайший сосед"], [LG.ring("miss"), "он же, если дерево его пропустило"]])}</div>`;
  const plane = box.querySelector(".plane"), tsvg = box.querySelector(".tree"), say = box.querySelector(".fig-say");
  function draw(){
    const { path, leaf, idx } = pathTo(q);
    const leaves = [], splits = [];
    (function walk(nd){ if (!nd.L){ leaves.push(nd); return; } splits.push(nd); walk(nd.L); walk(nd.R); })(tree);
    const nn = P.reduce((b, p, i) => d2(p, q) < d2(P[b], q) ? i : b, 0);
    const inLeaf = new Set(leaf.ids);
    let s = leaves.map(l => `<polygon points="${polyStr(l.poly)}" class="cell${l === leaf ? " on" : ""}"/>`).join("");
    s += splits.filter(nd => nd.seg).map(nd => `<line x1="${f1(nd.seg[0][0])}" y1="${f1(nd.seg[0][1])}" x2="${f1(nd.seg[1][0])}" y2="${f1(nd.seg[1][1])}" class="split${path.includes(nd) ? " on" : ""}"/>`).join("");
    s += P.map((p, i) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="4.2" class="dot${inLeaf.has(i) ? " hit" : ""}"/>`).join("");
    s += `<circle cx="${f1(P[nn][0])}" cy="${f1(P[nn][1])}" r="8.5" class="ring ${inLeaf.has(nn) ? "" : "miss"}"/>`;
    s += qMark(q[0], q[1], 7.5) + `<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="4" class="frame"/>`;
    plane.innerHTML = s;
    // дерево
    const X = (depth, j) => (j + 0.5) * 300 / (1 << depth), Y = (depth) => 24 + depth * 62;
    let t = "", nodes = "";
    const onIdx = (depth) => idx >> (3 - depth);
    for (let depth = 0; depth < 3; depth++){
      for (let j = 0; j < (1 << depth); j++){
        for (const k of [0, 1]){
          const cj = j * 2 + k, on = onIdx(depth) === j && onIdx(depth + 1) === cj;
          t += `<line x1="${f1(X(depth, j))}" y1="${Y(depth)}" x2="${f1(X(depth + 1, cj))}" y2="${Y(depth + 1)}" class="split${on ? " on" : ""}"/>`;
        }
        nodes += `<circle cx="${f1(X(depth, j))}" cy="${Y(depth)}" r="7" class="tnode${onIdx(depth) === j ? " on" : ""}"/>`;
      }
    }
    leaves.forEach((l, j) => {
      const on = j === idx, x = X(3, j), y = Y(3);
      nodes += `<rect x="${f1(x - 15)}" y="${y - 12}" width="30" height="24" rx="5" class="tleaf${on ? " on" : ""}"/><text x="${f1(x)}" y="${y}" class="tleaf-t${on ? " on" : ""}">${l.ids.length}</text>`;
    });
    tsvg.innerHTML = t + nodes + `<text x="150" y="${Y(3) + 34}" class="muted-t" text-anchor="middle">в листьях — число точек</text>`;
    const n = leaf.ids.length;
    say.innerHTML = `Запрос спустился по трём разрезам в лист с ${n} ${n === 1 ? "точкой" : "точками"} — только с ними он и сравнивается. ` +
      (inLeaf.has(nn) ? "Настоящий ближайший сосед оказался в этом же листе, и дерево его нашло." : "Настоящий ближайший сосед лежит по другую сторону разреза, и одно дерево его <b>пропустило</b>. Поэтому деревьев строят много и объединяют кандидатов из всех.");
  }
  plane.addEventListener("click", (e) => { const p = svgPoint(plane, e); q = [Math.max(6, Math.min(W - 6, p.x)), Math.max(6, Math.min(H - 6, p.y))]; draw(); });
  box.querySelector('[data-act="reroll"]').addEventListener("click", () => { seed += 1; build(); draw(); });
  build(); draw();
}

/* ---------- LSH: случайные гиперплоскости ---------- */
function mountLsh(box){
  const W = 640, H = 360, O = [320, 180], R = rng(17), P = [];
  for (let i = 0; i < 60; i++){ const a = R() * Math.PI * 2, r = 45 + R() * 105; P.push([O[0] + r * Math.cos(a), O[1] + r * Math.sin(a)]); }
  let seed = 11, L = 1, q = [O[0] + 120 * Math.cos(-0.5), O[1] + 120 * Math.sin(-0.5)], tables = [];
  const KB = 3;
  function gen(){
    const r = rng(seed);
    // случайные направления; слишком близкие друг к другу перебрасываем, чтобы корзины были видны
    const one = () => { for (;;){ const a = Array.from({ length: KB }, () => r() * Math.PI).sort((x, y) => x - y);
      const gaps = a.map((x, i) => (i + 1 < a.length ? a[i + 1] : a[0] + Math.PI) - x); if (Math.min(...gaps) > 0.38) return a; } };
    tables = [0, 1, 2].map(one);
  }
  const code = (p, t) => tables[t].map(phi => (Math.cos(phi) * (p[0] - O[0]) + Math.sin(phi) * (p[1] - O[1]) >= 0 ? "1" : "0")).join("");
  const ang = (p) => Math.atan2(p[1] - O[1], p[0] - O[0]);
  const cosSim = (a, b) => { const ax = a[0] - O[0], ay = a[1] - O[1], bx = b[0] - O[0], by = b[1] - O[1]; return (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)); };
  function wedges(t){
    const b = []; tables[t].forEach(phi => { b.push(phi + Math.PI / 2, phi - Math.PI / 2); });
    const norm = b.map(a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y);
    return norm.map((a, i) => { const e = i + 1 < norm.length ? norm[i + 1] : norm[0] + 2 * Math.PI; return [a, e]; });
  }
  const far = (a, r = 1200) => [O[0] + r * Math.cos(a), O[1] + r * Math.sin(a)];
  box.innerHTML = `
    <svg class="clickable" viewBox="0 0 ${W} ${H}" role="img" aria-label="Корзины LSH на плоскости">
      <defs><clipPath id="lsh-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>
      <g clip-path="url(#lsh-clip)" class="lsh-g"></g>
    </svg>
    <div class="fig-row">
      <span class="fig-seg">Таблиц \\(L\\):<span class="fig-tabs" role="group" aria-label="Число таблиц">
        <button type="button" data-l="1" aria-selected="true">1</button><button type="button" data-l="2" aria-selected="false">2</button><button type="button" data-l="3" aria-selected="false">3</button>
      </span></span>
      <button class="fig-btn" type="button" data-act="reroll">${ICON.dice} Новые гиперплоскости</button>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([[LG.q(), "запрос"], [LG.wedge(), "корзина запроса"], [LG.dot("hit"), "кандидаты"], [LG.ring("miss"), "самый похожий по косинусу, если он не среди кандидатов"]])}</div>`;
  const svg = box.querySelector("svg"), g = box.querySelector(".lsh-g"), say = box.querySelector(".fig-say");
  const dashes = ["", "7 5", "2 4"];
  function draw(){
    const qa = ang(q); let s = "";
    const cand = new Set(), codes = [];
    for (let t = 0; t < L; t++){
      const qc = code(q, t); codes.push(qc);
      P.forEach((p, i) => { if (code(p, t) === qc) cand.add(i); });
      const ws = wedges(t);
      const w = ws.find(([a, e]) => { let x = qa; while (x < a) x += 2 * Math.PI; return x < e; });
      if (w){ const A = far(w[0]), B = far(w[1]), M = far((w[0] + w[1]) / 2); s += `<polygon points="${polyStr([O, A, M, B])}" class="wedge"/>`; }
    }
    for (let t = 0; t < L; t++){
      tables[t].forEach(phi => { const A = far(phi + Math.PI / 2), B = far(phi - Math.PI / 2); s += `<line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(B[0])}" y2="${f1(B[1])}" class="hp" ${dashes[t] ? `stroke-dasharray="${dashes[t]}"` : ""}/>`; });
    }
    if (L === 1){
      wedges(0).forEach(([a, e]) => { const m = (a + e) / 2, p = [O[0] + 166 * Math.cos(m), O[1] + 166 * Math.sin(m)]; const c = code(p, 0); s += `<text x="${f1(p[0])}" y="${f1(p[1])}" class="${c === codes[0] ? "tag acc" : "muted-t"}" text-anchor="middle" dominant-baseline="central">${c}</text>`; });
    }
    const qe = [O[0] + 172 * Math.cos(qa), O[1] + 172 * Math.sin(qa)];
    s += `<line x1="${O[0]}" y1="${O[1]}" x2="${f1(qe[0])}" y2="${f1(qe[1])}" class="e look"/>`;
    P.forEach((p, i) => { s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="4.2" class="dot${cand.has(i) ? " hit" : ""}"/>`; });
    const nn = P.reduce((b, p, i) => cosSim(p, q) > cosSim(P[b], q) ? i : b, 0);
    if (!cand.has(nn)) s += `<circle cx="${f1(P[nn][0])}" cy="${f1(P[nn][1])}" r="8.5" class="ring miss"/>`;
    s += `<path d="M${O[0] - 5} ${O[1]}h10M${O[0]} ${O[1] - 5}v10" stroke="currentColor" style="color:var(--muted)" stroke-width="1.4"/>`;
    s += qMark(q[0], q[1], 7.5);
    g.innerHTML = s;
    const n = cand.size;
    say.innerHTML = (L === 1 ? `Код запроса — <b>${codes[0]}</b>. ` : `Коды запроса в ${L} таблицах: <b>${codes.join(" · ")}</b>. `) +
      `Кандидатов ${n} из ${P.length}${L > 1 ? " — это объединение корзин из всех таблиц" : ""}. ` +
      (cand.has(nn) ? "Самый похожий по косинусу вектор среди них." : "Самый похожий по косинусу вектор попал в соседнюю корзину — <b>промах</b>." + (L < 3 ? " Добавьте таблицу." : ""));
  }
  svg.addEventListener("click", (e) => { const p = svgPoint(svg, e); if (Math.hypot(p.x - O[0], p.y - O[1]) < 8) return; q = [p.x, p.y]; draw(); });
  function pickQuery(){
    // запрос по умолчанию: одна таблица промахивается, две — уже находят
    let best = null;
    for (let a = -Math.PI; a < Math.PI; a += 0.01){
      const p = [O[0] + 120 * Math.cos(a), O[1] + 120 * Math.sin(a)];
      const nn = P.reduce((b, x, i) => cosSim(x, p) > cosSim(P[b], p) ? i : b, 0);
      const c0 = code(p, 0), c1 = code(p, 1);
      if (code(P[nn], 0) !== c0 && code(P[nn], 1) === c1){ const sc = Math.abs(a + 0.6); if (!best || sc < best.sc) best = { sc, p }; }
    }
    if (best) q = best.p;
  }
  box.querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => {
    L = +b.dataset.l; box.querySelectorAll("[data-l]").forEach(x => x.setAttribute("aria-selected", String(x === b))); draw();
  }));
  box.querySelector('[data-act="reroll"]').addEventListener("click", () => { seed += 1; gen(); draw(); });
  gen(); pickQuery(); draw();
}

/* ---------- IVF: ячейки Вороного и nprobe ---------- */
function mountIvf(box){
  const W = 640, H = 380, R = rng(7), P = [], K = 12;
  const blobs = [[140, 110, 50], [330, 250, 60], [500, 120, 45], [520, 300, 40], [230, 300, 35]];
  for (let i = 0; i < 145; i++){ const b = blobs[i % blobs.length]; P.push([b[0] + gauss(R) * b[2], b[1] + gauss(R) * b[2] * 0.85]); }
  for (let i = 0; i < 35; i++) P.push([20 + R() * (W - 40), 20 + R() * (H - 40)]);
  P.forEach(p => { p[0] = Math.max(10, Math.min(W - 10, p[0])); p[1] = Math.max(10, Math.min(H - 10, p[1])); });
  // k-means++ и 25 итераций Ллойда
  const C = [P[Math.floor(R() * P.length)].slice()];
  while (C.length < K){
    const dd = P.map(p => Math.min(...C.map(c => d2(p, c))) ** 2), tot = dd.reduce((a, b) => a + b, 0);
    let x = R() * tot, i = 0; while (x > dd[i]) x -= dd[i++]; C.push(P[Math.min(i, P.length - 1)].slice());
  }
  const near = (p) => C.reduce((b, c, i) => d2(p, c) < d2(p, C[b]) ? i : b, 0);
  for (let it = 0; it < 25; it++){
    const sx = C.map(() => [0, 0, 0]);
    P.forEach(p => { const k = near(p); sx[k][0] += p[0]; sx[k][1] += p[1]; sx[k][2]++; });
    sx.forEach((s, k) => { if (s[2]) C[k] = [s[0] / s[2], s[1] / s[2]]; });
  }
  const own = P.map(near);
  const cells = C.map((c, i) => {
    let poly = [[0, 0], [W, 0], [W, H], [0, H]];
    C.forEach((o, j) => { if (j !== i) poly = clipPoly(poly, [o[0] - c[0], o[1] - c[1]], ((o[0] ** 2 + o[1] ** 2) - (c[0] ** 2 + c[1] ** 2)) / 2); });
    return poly;
  });
  const ranked = (q) => C.map((_, i) => i).sort((a, b) => d2(q, C[a]) - d2(q, C[b]));
  const nnOf = (q) => P.reduce((b, p, i) => d2(p, q) < d2(P[b], q) ? i : b, 0);
  // запрос по умолчанию: у границы, где nprobe = 1 промахивается, а nprobe = 2 уже находит
  let q = [W / 2, H / 2], bestScore = Infinity;
  for (let x = 40; x < W - 40; x += 6) for (let y = 40; y < H - 40; y += 6){
    const rk = ranked([x, y]), nn = nnOf([x, y]);
    if (own[nn] !== rk[0] && own[nn] === rk[1]){ const sc = d2([x, y], [W / 2, H / 2]); if (sc < bestScore){ bestScore = sc; q = [x, y]; } }
  }
  let np = 1;
  box.innerHTML = `
    <svg class="clickable" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ячейки IVF и выбор nprobe"></svg>
    <div class="fig-row"><label class="fig-range">nprobe <input type="range" min="1" max="6" value="1" data-np> <output>1</output></label></div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend">${legend([[LG.q(), "запрос"], [LG.cent(""), "центроиды"], [LG.cell("on"), "просмотренные ячейки"], [LG.dot("hit"), "точки, с которыми сравниваем"], [LG.ring(""), "найденный ближайший"], [LG.ring("miss"), "настоящий ближайший, если пропущен"]])}</div>`;
  const svg = box.querySelector("svg"), say = box.querySelector(".fig-say"), range = box.querySelector("[data-np]"), out = box.querySelector("output");
  function draw(){
    const rk = ranked(q), probed = new Set(rk.slice(0, np));
    const cand = P.map((_, i) => i).filter(i => probed.has(own[i]));
    const nn = nnOf(q), found = cand.reduce((b, i) => b === -1 || d2(P[i], q) < d2(P[b], q) ? i : b, -1);
    let s = cells.map((poly, i) => `<polygon points="${polyStr(poly)}" class="cell${probed.has(i) ? " on" : ""}"/>`).join("");
    s += P.map((p, i) => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.6" class="dot${probed.has(own[i]) ? " hit" : ""}"/>`).join("");
    s += C.map((c, i) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="5.5" class="cent${probed.has(i) ? " on" : ""}"/>`).join("");
    if (found >= 0) s += `<circle cx="${f1(P[found][0])}" cy="${f1(P[found][1])}" r="8" class="ring"/>`;
    if (found !== nn) s += `<circle cx="${f1(P[nn][0])}" cy="${f1(P[nn][1])}" r="8" class="ring miss"/>`;
    s += qMark(q[0], q[1], 7.5) + `<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="4" class="frame"/>`;
    svg.innerHTML = s;
    const cw = np === 1 ? "ячейку" : np < 5 ? "ячейки" : "ячеек";
    say.innerHTML = `Просматриваем ${np} ${cw} из ${K}: ${K} расстояний до центроидов и ${cand.length} до точек — всего ${K + cand.length} вместо ${P.length}. ` +
      (found === nn ? "Ближайший сосед найден." : "Настоящий ближайший сосед лежит в непросмотренной ячейке — <b>промах</b>: вернётся точка подальше.");
  }
  range.addEventListener("input", () => { np = +range.value; out.value = np; draw(); });
  svg.addEventListener("click", (e) => { const p = svgPoint(svg, e); q = [Math.max(6, Math.min(W - 6, p.x)), Math.max(6, Math.min(H - 6, p.y))]; draw(); });
  draw();
}

/* ---------- Список с пропусками ---------- */
function mountSkip(box){
  const keys = [3, 7, 12, 19, 25, 31, 38, 44, 52], lvl = { 19: 2, 44: 2, 7: 1, 31: 1 };
  const X = (i) => i < 0 ? 64 : 124 + i * 62, Y = (l) => 26 + (2 - l) * 50, BW = 40, BH = 26;
  const on = new Set(["2:19", "1:19", "1:31", "0:31"]), goal = "0:38";
  const onE = new Set(["2:-1-19", "1:19-31", "0:31-38"]), look = new Set(["2:19-44", "1:31-44"]);
  let s = "";
  const down = new Set(["19:2", "31:1"]);
  keys.forEach((k, i) => { for (let l = lvl[k] || 0; l >= 1; l--) s += `<line x1="${X(i) + BW / 2}" y1="${Y(l) + BH}" x2="${X(i) + BW / 2}" y2="${Y(l - 1)}" class="sl-e${down.has(k + ":" + l) ? " on" : ""}" stroke-dasharray="3 3"/>`; });
  s += `<line x1="${X(-1) + BW / 2}" y1="${Y(2) + BH / 2}" x2="${X(-1) + BW / 2}" y2="${Y(0) + BH / 2}" class="sl-e" stroke-dasharray="3 3"/>`;
  for (let l = 2; l >= 0; l--){
    const row = [-1, ...keys.map((k, i) => (lvl[k] || 0) >= l ? i : null).filter(i => i !== null)];
    for (let j = 0; j + 1 < row.length; j++){
      const a = row[j], b = row[j + 1], ka = a < 0 ? -1 : keys[a], kb = keys[b];
      const id = `${l}:${ka}-${kb}`, cls = onE.has(id) ? " on" : "";
      s += `<line x1="${X(a) + BW}" y1="${Y(l) + BH / 2}" x2="${X(b) - 3}" y2="${Y(l) + BH / 2}" class="sl-e${cls}" ${look.has(id) ? 'stroke-dasharray="4 4"' : ""}/>`;
    }
    s += `<text x="8" y="${Y(l) + BH / 2}" class="muted-t" dominant-baseline="central">ур. ${l}</text>`;
    s += `<rect x="${X(-1)}" y="${Y(l)}" width="${BW}" height="${BH}" rx="5" class="sl-head"/><text x="${X(-1) + BW / 2}" y="${Y(l) + BH / 2}" class="sl-t">−∞</text>`;
    keys.forEach((k, i) => {
      if ((lvl[k] || 0) < l) return;
      const id = `${l}:${k}`, cls = id === goal ? " goal" : on.has(id) ? " on" : "";
      s += `<rect x="${X(i)}" y="${Y(l)}" width="${BW}" height="${BH}" rx="5" class="sl-box${cls}"/><text x="${X(i) + BW / 2}" y="${Y(l) + BH / 2}" class="sl-t">${k}</text>`;
    });
  }
  box.innerHTML = `<svg viewBox="0 0 690 158" role="img" aria-label="Поиск числа 38 в списке с пропусками">${s}</svg>
    <div class="fig-legend">${legend([[LG.line("path"), "путь поиска"], [`<svg viewBox="0 0 22 14"><line x1="2" y1="7" x2="20" y2="7" class="sl-e" stroke-dasharray="4 4"/></svg>`, "проверили и не пошли: следующий элемент больше 38"]])}</div>`;
}


/* ---------- HNSW: построение и поиск по шагам ---------- */
function mountHnsw(box){
  const P = HNSW_PTS, M = 2, EFC = 5;
  const built = hnswBuild(P, { M, efC: EFC });
  const fin = built.steps[built.steps.length - 1];
  const graph = { links: fin.links.map(o => new Map(Object.entries(o).map(([k, v]) => [+k, v]))), ep: fin.ep, L: fin.L };
  const PX = 6, PW = 560, PH = 140, PS = 60, VW = PX + PS + PW + 6;
  let NR = 9;
  const plateY = (l) => 22 + (2 - l) * 170;
  const pos = (l, u, v) => [PX + u, plateY(l) + v];
  const leftU = (v) => PS * (1 - v / PH);
  const platePoly = (l) => [pos(l, PS, 0), pos(l, PS + PW, 0), pos(l, PW, PH), pos(l, 0, PH)];

  let mode = "build", idx = 0, timer = null, ef = 4, q = { u: 401, v: 58 }, sSteps = [];
  const k = () => Math.min(3, ef);
  const recompute = () => { sSteps = hnswSearch(P, graph, q, ef, k()); };
  recompute();

  box.innerHTML = `
    <div class="fig-row">
      <div class="fig-tabs" role="tablist" aria-label="Режим">
        <button type="button" role="tab" data-mode="build" aria-selected="true">Построение графа</button>
        <button type="button" role="tab" data-mode="search" aria-selected="false">Поиск</button>
      </div>
      <span class="spacer"></span>
      <span class="fig-status" aria-live="off"></span>
    </div>
    <div class="fig-stage" style="margin-top:12px">
      <svg class="hnsw-svg" viewBox="0 0 ${VW} 516" tabindex="0" role="img" aria-label="Слои графа HNSW"></svg>
    </div>
    <div class="fig-row">
      <button class="fig-btn icon" type="button" data-act="back" aria-label="Шаг назад" title="Шаг назад (←)">${ICON.prev}</button>
      <button class="fig-btn primary" type="button" data-act="play"></button>
      <button class="fig-btn icon" type="button" data-act="fwd" aria-label="Шаг вперёд" title="Шаг вперёд (→)">${ICON.next}</button>
      <span class="spacer"></span>
      <button class="fig-btn" type="button" data-act="pphase">${ICON.prev2}<span></span></button>
      <button class="fig-btn" type="button" data-act="nphase"><span></span>${ICON.next2}</button>
    </div>
    <div class="fig-row"><input class="fig-scrub" type="range" min="0" value="0" aria-label="Номер шага"></div>
    <div class="fig-row search-only" hidden>
      <label class="fig-range">ef <input type="range" min="1" max="8" value="${ef}" data-ef> <output>${ef}</output></label>
      <button class="fig-btn" type="button" data-act="rand">${ICON.dice} Случайный запрос</button>
      <span class="fig-hint">или кликните по слою 0</span>
    </div>
    <p class="fig-say" aria-live="polite"></p>
    <div class="fig-legend"></div>`;
  const svg = box.querySelector("svg"), say = box.querySelector(".fig-say"), status = box.querySelector(".fig-status");
  const scrub = box.querySelector(".fig-scrub"), playBtn = box.querySelector('[data-act="play"]');
  const pBtn = box.querySelector('[data-act="pphase"]'), nBtn = box.querySelector('[data-act="nphase"]');
  const legendEl = box.querySelector(".fig-legend"), searchRow = box.querySelector(".search-only");
  const efIn = box.querySelector("[data-ef]"), efOut = searchRow.querySelector("output");

  const steps = () => mode === "build" ? built.steps : sSteps;
  const phaseOf = (st) => mode === "build" ? st.ins : st.hl.phase;

  function edgeLine(a, b, cls, l, shorten = true, marker = false){
    const A = pos(l, P[a].u, P[a].v), B = pos(l, P[b].u, P[b].v);
    let [x2, y2] = B;
    if (shorten){ const d = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; x2 = B[0] - (B[0] - A[0]) * (NR + 2) / d; y2 = B[1] - (B[1] - A[1]) * (NR + 2) / d; }
    return `<line x1="${f1(A[0])}" y1="${f1(A[1])}" x2="${f1(x2)}" y2="${f1(y2)}" class="e ${cls}"${marker ? ' marker-end="url(#hnsw-arr)"' : ""}/>`;
  }

  function draw(){
    const st = steps()[idx], hl = st.hl;
    const links = mode === "build" ? st.links : fin.links;
    const inserted = new Set(mode === "build" ? st.inserted : P.map(p => p.id));
    const ep = mode === "build" ? st.ep : graph.ep;
    const active = hl.active;
    const has = (id, l) => inserted.has(id) && P[id].level >= l;
    const at = (o, l) => o && o.l === l;
    let s = `<defs><marker id="hnsw-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="arrowhead"/></marker>${[0, 1, 2].map(l => `<clipPath id="hnsw-clip-${l}"><polygon points="${polyStr(platePoly(l))}"/></clipPath>`).join("")}</defs>`;

    // вертикальные связи «та же точка на соседних слоях»
    let vl = "";
    P.forEach(p => {
      if (!inserted.has(p.id)) return;
      for (let l = p.level; l >= 1; l--){
        const hot = (hl.desc || []).some(d => d.id === p.id && d.from === l);
        const A = pos(l, p.u, p.v), B = pos(l - 1, p.u, p.v);
        vl += `<line x1="${f1(A[0])}" y1="${f1(A[1] + NR)}" x2="${f1(B[0])}" y2="${f1(B[1] - NR)}" class="vlink${hot ? " hot" : ""}"/>`;
      }
    });
    if (mode === "search"){
      for (let l = 2; l >= 1; l--){ const A = pos(l, q.u, q.v), B = pos(l - 1, q.u, q.v); vl += `<line x1="${f1(A[0])}" y1="${f1(A[1] + 8)}" x2="${f1(B[0])}" y2="${f1(B[1] - 8)}" class="vlink"/>`; }
    }

    let plates = "";
    for (let l = 2; l >= 0; l--){
      const on = active === l;
      plates += `<polygon points="${polyStr(platePoly(l))}" class="plate${on ? " on" : ""}"/>`;
      plates += `<text x="${f1(PX + leftU(16) + 10)}" y="${plateY(l) + 16}" class="lay-label${on ? " on" : ""}" dominant-baseline="central">слой ${l}</text>`;
    }
    s += plates + vl;

    for (let l = 2; l >= 0; l--){
      const dim = active !== undefined && active !== null && active !== l && !hl.done;
      let g = "";
      // рёбра графа
      const L = links[l] || {}, seen = new Set();
      Object.keys(L).forEach(a => {
        a = +a; if (!has(a, l)) return;
        L[a].forEach(b => {
          const key = a < b ? a + "-" + b : b + "-" + a; if (seen.has(key)) return;
          const back = (L[b] || []).includes(a);
          if (back){ seen.add(key); g += edgeLine(a, b, "", l, false); }
          else g += edgeLine(a, b, "one", l, true, true);
        });
      });
      (hl.removed || []).filter(e => e.l === l).forEach(e => { g += edgeLine(e.a, e.b, "gone", l, true, true); });
      (hl.newE || []).filter(e => e.l === l).forEach(e => { g += edgeLine(e.a, e.b, "new", l, false); });
      if (at(hl.rej, l)) hl.rej.list.forEach(x => { g += edgeLine(x.id, x.by, "why", l, false); });
      if (at(hl.looked, l)) hl.looked.ids.forEach(id => { g += edgeLine(hl.looked.from, id, "look", l, false); });
      if (mode === "search" && l === 0 && hl.expand !== undefined && !hl.stop) (L[hl.expand] || []).forEach(id => { g += edgeLine(hl.expand, id, "look", l, false); });
      (hl.path || []).filter(e => e.l === l).forEach(e => { g += edgeLine(e.a, e.b, "path", l, false); });

      // окружность «радиус поиска»
      if (at(hl.circle, l)){
        const c = mode === "build" ? P[hl.node] : q, C = pos(l, c.u, c.v);
        g += `<circle cx="${f1(C[0])}" cy="${f1(C[1])}" r="${f1(hl.circle.r + NR + 3)}" class="radius" clip-path="url(#hnsw-clip-${l})"/>`;
      }

      // точки
      const Wset = new Set(l === 0 ? (hl.W || []) : []), Cset = new Set(l === 0 ? (hl.C || []) : []), vis = new Set(l === 0 ? (hl.vis || []) : []);
      const cand = at(hl.cand, l) ? new Set(hl.cand.ids) : new Set();
      const sel = at(hl.sel, l) ? new Set(hl.sel.ids) : new Set();
      const rej = at(hl.rej, l) ? new Set(hl.rej.list.map(x => x.id)) : new Set();
      const found = new Set(l === 0 && hl.final ? hl.found : []), exact = new Set(l === 0 && hl.final ? hl.exact : []);
      if (mode === "build" && l === 0) P.forEach(p => { if (!inserted.has(p.id)){ const C = pos(0, p.u, p.v); g += `<circle cx="${f1(C[0])}" cy="${f1(C[1])}" r="5" class="ghost"/>`; } });
      P.forEach(p => {
        if (!has(p.id, l)) return;
        const [x, y] = pos(l, p.u, p.v);
        let cls = "", rings = "";
        if (mode === "build"){
          if (p.id === hl.node && !hl.done) cls = "new";
          else if (sel.has(p.id)) cls = "hit";
          else if (rej.has(p.id)) cls = "bad";
          if (cand.has(p.id) && p.id !== hl.node) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 3.5}" class="ring"/>`;
          if ((hl.cur && hl.cur.l === l && hl.cur.id === p.id) || ((hl.over || []).includes(p.id) && hl.overL === l)) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 3.5}" class="ring acc"/>`;
        } else {
          if (hl.final) cls = found.has(p.id) ? "hit" : vis.has(p.id) ? "seen" : "";
          else if (Wset.has(p.id)) cls = "hit";
          else if (vis.has(p.id)) cls = "seen";
          if (Cset.has(p.id)) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 3.5}" class="ring"/>`;
          if ((hl.cur && hl.cur.l === l && hl.cur.id === p.id) || (l === 0 && hl.expand === p.id)) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 4}" class="ring acc"/>`;
          if (found.has(p.id)) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 3.5}" class="ring"/>`;
          if (exact.has(p.id) && !found.has(p.id)) rings += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR + 3.5}" class="ring miss"/>`;
        }
        const tcls = cls === "hit" ? " on-hit" : "";
        g += rings + `<circle cx="${f1(x)}" cy="${f1(y)}" r="${NR}" class="n ${cls}"/><text x="${f1(x)}" y="${f1(y + 0.5)}" class="n-t${tcls}">${p.name}</text>`;
        if (ep === p.id && l === P[p.id].level) g += `<text x="${f1(x + NR + 3)}" y="${f1(y - NR - 2)}" class="tag${mode === "build" && hl.epChange ? " acc" : ""}">EP</text>`;
      });
      if (mode === "search"){ const [x, y] = pos(l, q.u, q.v); g += qMark(x, y, NR > 10 ? 10 : 8); }
      s += `<g opacity="${dim ? 0.42 : 1}">${g}</g>`;
    }
    svg.innerHTML = s;

    // подписи и состояние кнопок
    const all = steps(), n = all.length;
    say.innerHTML = st.cap;
    if (mode === "build"){
      status.textContent = `Шаг ${idx + 1} из ${n} · точка ${P[st.ins].name} (${st.ins + 1} из ${P.length})`;
    } else {
      const ph = st.hl.phase;
      status.textContent = `Шаг ${idx + 1} из ${n} · ${ph >= 0 ? "слой " + ph : "итог"} · расстояний: ${st.nd}`;
    }
    scrub.max = n - 1; scrub.value = idx;
    box.querySelector('[data-act="back"]').disabled = idx === 0;
    box.querySelector('[data-act="fwd"]').disabled = idx === n - 1;
    pBtn.disabled = idx === 0; nBtn.disabled = idx === n - 1;
    playBtn.innerHTML = timer ? `${ICON.pause}Пауза` : `${ICON.play}${idx === n - 1 ? "Сначала" : "Пуск"}`;
  }

  function setMode(m){
    stop(); mode = m; idx = 0;
    box.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
    searchRow.hidden = m !== "search";
    pBtn.querySelector("span").textContent = m === "build" ? "Пред. точка" : "Пред. слой";
    nBtn.querySelector("span").textContent = m === "build" ? "След. точка" : "След. слой";
    legendEl.innerHTML = m === "build"
      ? legend([[LG.node("new"), "вставляемая точка"], [LG.ring("acc"), "текущая вершина"], [LG.line("path"), "жадный спуск"], [LG.ring(""), "кандидаты"], [LG.node("hit"), "выбранные соседи"], [LG.node("bad"), "отброшены эвристикой"], [LG.line("new"), "новые рёбра"], [LG.line("gone"), "удалённая ссылка"], [LG.arrow(), "односторонняя ссылка"]])
      : legend([[LG.q(), "запрос q"], [LG.ring("acc"), "текущая вершина"], [LG.line("path"), "пройденный путь"], [LG.node("hit"), "W — лучшие найденные"], [LG.ring(""), "C — ещё не раскрытые"], [LG.node("seen"), "расстояние посчитано"], [LG.ring("miss"), "пропущенный сосед"]]);
    draw();
  }
  function go(i){ idx = Math.max(0, Math.min(steps().length - 1, i)); draw(); }
  function jumpPhase(dir){
    const all = steps(), cur = phaseOf(all[idx]);
    if (dir > 0){ let i = idx; while (i < all.length - 1 && phaseOf(all[i]) === cur) i++; go(i); }
    else {
      let i = idx; while (i > 0 && phaseOf(all[i - 1]) === cur) i--;
      if (i === idx && i > 0){ const pv = phaseOf(all[i - 1]); i--; while (i > 0 && phaseOf(all[i - 1]) === pv) i--; }
      go(i);
    }
  }
  function stop(){ if (timer){ clearInterval(timer); timer = null; } }
  function play(){
    if (timer){ stop(); draw(); return; }
    if (idx >= steps().length - 1) idx = 0;
    timer = setInterval(() => { if (idx >= steps().length - 1){ stop(); draw(); return; } idx++; draw(); }, 1300);
    draw();
  }

  box.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); }));
  box.querySelector('[data-act="back"]').addEventListener("click", () => { stop(); go(idx - 1); });
  box.querySelector('[data-act="fwd"]').addEventListener("click", () => { stop(); go(idx + 1); });
  pBtn.addEventListener("click", () => { stop(); jumpPhase(-1); });
  nBtn.addEventListener("click", () => { stop(); jumpPhase(1); });
  playBtn.addEventListener("click", play);
  scrub.addEventListener("input", () => { stop(); go(+scrub.value); });
  efIn.addEventListener("input", () => { ef = +efIn.value; efOut.value = ef; stop(); recompute(); go(0); });
  box.querySelector('[data-act="rand"]').addEventListener("click", () => {
    stop(); const v = 12 + Math.random() * (PH - 24); q = { u: leftU(v) + 12 + Math.random() * (PW - 24), v }; recompute(); go(0);
  });
  svg.addEventListener("click", (e) => {
    const p = svgPoint(svg, e), v = p.y - plateY(0), u = p.x - PX;
    if (v < -6 || v > PH + 6) return;
    const vv = Math.max(8, Math.min(PH - 8, v)), lu = leftU(vv);
    if (u < lu - 6 || u > lu + PW + 6) return;
    q = { u: Math.max(lu + 8, Math.min(lu + PW - 8, u)), v: vv };
    recompute();
    if (mode !== "search") setMode("search"); else { stop(); go(0); }
  });
  box.addEventListener("keydown", (e) => {
    if (e.target.matches("input")) return;
    if (e.key === "ArrowRight"){ e.preventDefault(); stop(); go(idx + 1); }
    if (e.key === "ArrowLeft"){ e.preventDefault(); stop(); go(idx - 1); }
  });
  // на узком экране рисуем вершины крупнее, иначе буквы не прочитать
  const ro = new ResizeObserver(() => {
    const big = svg.clientWidth > 0 && svg.clientWidth < 520;
    if (big === (NR > 10)) return;
    NR = big ? 12.5 : 9; svg.classList.toggle("big", big); draw();
  });
  ro.observe(svg);
  setMode("build");
  return () => { stop(); ro.disconnect(); };
}

// Регистрация иллюстраций: имя из data-figure → функция монтирования
Object.assign(FIGURES, {
  annoy: mountAnnoy,
  lsh: mountLsh,
  ivf: mountIvf,
  skiplist: mountSkip,
  hnsw: mountHnsw
});
