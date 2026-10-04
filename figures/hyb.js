/* Иллюстрация раздела rag/hybrid-search: пошаговое накопление Reciprocal Rank Fusion. */

function mountHybRrf(box){
  const DOCS = {
    A: "ERR-4031: банк отклонил платёж",
    B: "ERR-4013: лимит попыток входа",
    C: "Оплата картой",
    D: "Справочник кодов ошибок",
    E: "Смена способа оплаты"
  };
  // Выдачи из примера в тексте раздела: оценки BM25 и демонстрационные косинусы.
  const LISTS = [
    { key: "lex", title: "BM25", items: [["D", "12,4"], ["A", "11,0"], ["E", "5,1"], ["C", "4,0"]] },
    { key: "dense", title: "Плотный поиск", items: [["C", "0,83"], ["A", "0,81"], ["B", "0,79"], ["E", "0,74"]] }
  ];
  const DEPTH = 4;
  const KS = [1, 10, 60];
  let k = 60;

  box.innerHTML = `
    <div class="fig-stage hyb-stage">
      <div class="hyb-lists">
        ${LISTS.map((list) => `<div class="hyb-list ${list.key}">
          <div class="hyb-cap">${list.title}<span>оценка</span><span>вклад</span></div>
          ${list.items.map(([doc, score], i) => `<div class="hyb-item" data-list="${list.key}" data-rank="${i + 1}">
            <span class="hyb-rank">${i + 1}</span><b>${doc}</b><span class="hyb-title">${DOCS[doc]}</span><span class="hyb-score">${score}</span><span class="hyb-add"></span>
          </div>`).join("")}
        </div>`).join("")}
      </div>
      <div class="hyb-fused">
        <div class="hyb-cap">Сумма RRF</div>
        <div class="hyb-fused-rows" aria-live="polite"></div>
      </div>
    </div>
    ${vlControls(`<div class="fig-tabs" role="tablist" aria-label="Константа k">${KS.map((v) => `<button type="button" role="tab" data-k="${v}" aria-selected="${v === k}">\\(k=${v}\\)</button>`).join("")}</div>`)}
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="hyb-key lex"></i>вклад места в BM25</span>
      <span><i class="hyb-key dense"></i>вклад места в плотном поиске</span>
      <span><i class="hyb-key cur"></i>места, учтённые на этом шаге</span>
    </div>`;

  const fusedBox = box.querySelector(".hyb-fused-rows");
  const say = box.querySelector(".fig-say");
  const digits = () => (k >= 60 ? 5 : k >= 10 ? 4 : 3);
  const fmt = (v) => v.toLocaleString("ru-RU", { minimumFractionDigits: digits(), maximumFractionDigits: digits() });
  const tex = (v) => v.toFixed(digits()).replace(".", "{,}");
  const docAt = (list, rank) => list.items[rank - 1][0];

  function scores(upTo){
    const s = {};
    Object.keys(DOCS).forEach((d) => { s[d] = { lex: 0, dense: 0 }; });
    for (const list of LISTS){
      list.items.slice(0, upTo).forEach(([doc], i) => { s[doc][list.key] = 1 / (k + i + 1); });
    }
    return s;
  }
  const total = (x) => x.lex + x.dense;
  const order = (s) => Object.keys(DOCS).sort((a, b) => total(s[b]) - total(s[a]) || a.localeCompare(b));

  function text(step, s){
    if (step === 0){
      return "BM25 и плотный поиск вернули по четыре кандидата. Их оценки несравнимы, поэтому RRF использует только места. Документ, которого нет в списке, получает от этого списка ноль.";
    }
    if (step <= DEPTH){
      const r = step;
      const a = docAt(LISTS[0], r), b = docAt(LISTS[1], r);
      const add = `\\(\\tfrac{1}{${k}+${r}}\\approx ${tex(1 / (k + r))}\\)`;
      let t = a === b
        ? `Место ${r}: ${a} стоит ${["первым", "вторым", "третьим", "четвёртым"][r - 1]} в обоих списках и получает ${add} дважды.`
        : `Место ${r}: ${a} из BM25 и ${b} из плотного поиска получают по ${add}.`;
      const both = [a, b].filter((d, i, arr) => arr.indexOf(d) === i && s[d].lex > 0 && s[d].dense > 0);
      if (both.length && a !== b) t += ` ${both.join(" и ")} теперь ${both.length > 1 ? "имеют" : "имеет"} вклады из обоих списков.`;
      return t;
    }
    const o = order(s);
    let t = `Итог при \\(k=${k}\\): ${o.join(" → ")}.`;
    if (k >= 10){
      const ratio = ((k + 4) / (k + 1)).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
      t += ` Первым стал A — второй в обоих списках. E с третьим и четвёртым местами обходит D, лидера BM25: первое место весит лишь в ${ratio} раза больше четвёртого, и важнее, в скольких списках есть документ.`;
    } else {
      t += " При \\(k=1\\) первое место весит в полтора раза больше второго и в 2,5 раза больше четвёртого, поэтому C, лидер плотного поиска, обходит A, а D, лидер BM25, обходит E.";
    }
    return t;
  }

  function draw(step){
    const upTo = Math.min(step, DEPTH);
    const s = scores(upTo);
    box.querySelectorAll(".hyb-item").forEach((el) => {
      const r = Number(el.dataset.rank);
      el.classList.toggle("done", r <= upTo);
      el.classList.toggle("cur", step <= DEPTH && r === step);
      el.querySelector(".hyb-add").textContent = r <= upTo ? "+" + fmt(1 / (k + r)) : "";
    });
    const max = 2 / (k + 1);
    fusedBox.innerHTML = order(s).map((d, i) => {
      const v = total(s[d]);
      return `<div class="hyb-row${v === 0 ? " zero" : ""}">
        <span class="hyb-rank">${v > 0 ? i + 1 : ""}</span><b>${d}</b><span class="hyb-title">${DOCS[d]}</span>
        <div class="hyb-bar" aria-hidden="true"><i class="lex" style="width:${100 * s[d].lex / max}%"></i><i class="dense" style="width:${100 * s[d].dense / max}%"></i></div>
        <strong>${v > 0 ? fmt(v) : "—"}</strong>
      </div>`;
    }).join("");
    say.innerHTML = text(step, s);
  }

  const NAMES = ["две выдачи", "место 1", "место 2", "место 3", "место 4", "итог"];
  const player = vlPlayer(box, { count: () => NAMES.length, draw, label: (i, n) => `шаг ${i + 1} из ${n}: ${NAMES[i]}` });
  box.querySelectorAll("[data-k]").forEach((button) => {
    button.addEventListener("click", () => {
      k = Number(button.dataset.k);
      box.querySelectorAll("[data-k]").forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      player.paint();
    });
  });
  player.paint();
  return () => player.stop();
}

Object.assign(FIGURES, {
  "hyb-rrf": mountHybRrf
});
