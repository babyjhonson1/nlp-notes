/* Краткие определения для выбранных терминов.
   Полные объяснения живут в главе «Справочник», а этот реестр питает всплывающие карточки. */

const GLOSSARY = Object.freeze({
  recall: {
    label: "Recall@k",
    name: "Полнота поиска",
    definition: "Доля известных релевантных объектов, попавших в первые \\(k\\) результатов.",
    formula: "\\[\\operatorname{Recall@}k=\\frac{|D_k(q)\\cap R_q|}{|R_q|}.\\]",
    detail: "\\(D_k(q)\\) — выдача до выбранной глубины, \\(R_q\\) — все известные релевантные объекты запроса. При пустом \\(R_q\\) значение не определено. Это не ANN-recall относительно точного поиска.",
    href: "#/reference/retrieval-metrics/metrics-pr"
  },
  mmr: {
    label: "MMR",
    name: "Maximal Marginal Relevance",
    definition: "Жадный отбор по релевантности со штрафом за повтор уже выбранного. Это критерий отбора, не метрика качества.",
    formula: "\\[\\begin{aligned}i^\\ast&amp;=\\arg\\max_{i\\in C\\setminus S}\\left[\\lambda r_i-(1-\\lambda)\\max_{j\\in S}s_{ij}\\right],\\\\&amp;0\\le\\lambda\\le1.\\end{aligned}\\]",
    detail: "\\(C\\) — кандидаты, \\(S\\) — выбранные, \\(r_i\\) — релевантность, \\(s_{ij}\\) — попарное сходство в согласованной шкале. В наших примерах первый элемент выбирают по релевантности. Не путать с MRR.",
    href: "#/reference/retrieval-metrics/metrics-mmr-selection"
  },
  evidence: {
    label: "Evidence coverage",
    name: "Покрытие доказательств",
    definition: "Доля обязательных единиц доказательства, поддержанных контекстом.",
    formula: "\\[\\begin{aligned}\\operatorname{EC}(q,C)&amp;=\\frac{\\sum_{e\\in E_q}h(e,C)}{|E_q|},\\\\\\operatorname{Complete}(q,C)&amp;=\\mathbb{1}[\\operatorname{EC}(q,C)=1].\\end{aligned}\\]",
    detail: "\\(E_q\\) — непустой набор требований к доказательствам; \\(h\\) равен единице при достаточной поддержке. Повторы одного доказательства не закрывают другие требования. Complete требует покрытия всех единиц.",
    href: "#/reference/retrieval-metrics/metrics-evidence"
  },
  faithfulness: {
    label: "Faithfulness",
    name: "Подтверждённость контекстом",
    definition: "Доля проверяемых утверждений ответа, подтверждённых фактическим контекстом.",
    formula: "\\[\\operatorname{Faithfulness}(a,C)=\\frac{\\sum_{c\\in A(a)}e(c,C)}{|A(a)|}.\\]",
    detail: "\\(A(a)\\) — уникальные утверждения ответа, \\(e\\) — индикатор достаточной поддержки со всеми условиями. Не измеряет полноту или истинность самого источника. При отсутствии утверждений значение не определено.",
    href: "#/reference/generation-metrics/genm-faithfulness"
  },
  correctness: {
    label: "Answer correctness",
    name: "Полная правильность ответа",
    definition: "В этом конспекте — доля ответов, полностью удовлетворяющих проверенной рубрике задачи.",
    formula: "\\[\\operatorname{Correctness}(Q)=\\frac{1}{|Q|}\\sum_{q\\in Q}z_q.\\]",
    detail: "\\(z_q\\) равен единице, если все обязательные факты покрыты, нет существенных ошибок и выполнены требования. Для неответимых вопросов рубрика задаёт корректный отказ. Это выбранный протокол, не универсальная формула библиотек; \\(Q\\) непусто.",
    href: "#/reference/generation-metrics/genm-correctness"
  },
  factf1: {
    label: "Fact-level F1",
    name: "Фактическая F1",
    definition: "Баланс совпадения утверждений ответа с обязательными фактами эталона.",
    formula: "\\[F_{1,\\mathrm{fact}}=\\frac{2M}{|A(a)|+|G(y)|}.\\]",
    detail: "\\(M\\) — число семантически согласованных пар один к одному, \\(A(a)\\) — уникальные утверждения ответа, \\(G(y)\\) — обязательные факты эталона. При двух пустых множествах значение не определено. Допустимые добавления к эталону оговариваются заранее.",
    href: "#/reference/generation-metrics/genm-correctness"
  },
  citationprecision: {
    label: "Citation precision",
    name: "Точность цитирования",
    definition: "В простом протоколе — доля связей «утверждение — источник», в которых источник сам подтверждает утверждение.",
    formula: "\\[\\operatorname{CitationPrecision}=\\frac{\\sum_{(c,d)\\in L}e(c,d)}{|L|}.\\]",
    detail: "\\(L\\) — уникальные связи с приведёнными источниками, \\(e\\) — индикатор поддержки. Неверный ID считается ошибкой. При отсутствии ссылок значение не определено. Для совместного доказательства нужен более тонкий протокол.",
    href: "#/reference/generation-metrics/genm-citations"
  },
  citationrecall: {
    label: "Citation recall",
    name: "Полнота цитирования",
    definition: "Доля требующих ссылки утверждений, подтверждённых совокупностью своих ссылок.",
    formula: "\\[\\operatorname{CitationRecall}=\\frac{\\sum_{c\\in A_{\\mathrm{cite}}}\\mathbb{1}[S_c\\ne\\varnothing]\\,e(c,S_c)}{|A_{\\mathrm{cite}}|}.\\]",
    detail: "\\(A_{\\mathrm{cite}}\\) — утверждения, требующие ссылки, \\(S_c\\) — процитированные для утверждения источники. Не измеряет полноту ответа относительно вопроса. Если требующих ссылки утверждений нет, значение не определено.",
    href: "#/reference/generation-metrics/genm-citations"
  },
  coverage: {
    label: "Answer coverage",
    name: "Доля содержательных ответов",
    definition: "Доля вопросов, на которые система ответила, а не отказала.",
    formula: "\\[\\operatorname{Coverage}=\\frac{\\sum_{q\\in Q}u_q}{|Q|}.\\]",
    detail: "\\(u_q\\) равен единице при содержательном ответе, нулю при отказе; \\(Q\\) непусто. Показывается вместе с риском и срезами ответимости. Не путать с покрытием доказательств.",
    href: "#/reference/generation-metrics/genm-abstention"
  },
  risk: {
    label: "Selective risk",
    name: "Избирательный риск",
    definition: "Частота ошибок среди выданных содержательных ответов.",
    formula: "\\[\\operatorname{Risk}=\\frac{\\sum_{q\\in Q}u_q\\ell_q}{\\sum_{q\\in Q}u_q}.\\]",
    detail: "\\(u_q\\) — индикатор содержательного ответа, \\(\\ell_q\\) — индикатор ошибки по рубрике. При полном отказе риск не определён. Сравнивать при сопоставимой доле ответов.",
    href: "#/reference/generation-metrics/genm-abstention"
  },
  mrr: {
    label: "MRR",
    name: "Mean Reciprocal Rank",
    definition: "Среднее обратное место первого релевантного результата.",
    formula: "\\[\n      \\operatorname{MRR}\n      =\n      \\frac{1}{|Q|}\n      \\sum_{q\\in Q}\\operatorname{RR}(q),\n      \\qquad\n      \\operatorname{RR}(q)\n      =\n      \\begin{cases}\n        1/r_q, &amp; \\text{если результат найден},\\\\\n        0, &amp; \\text{иначе}.\n      \\end{cases}\n    \\]",
    detail: "Если для запроса релевантный результат не найден, его вклад принимают равным нулю. Результаты после первого релевантного MRR не учитывает.",
    href: "#/reference/retrieval-metrics/metrics-mrr"
  },
  ndcg: {
    label: "nDCG@k",
    name: "Normalized Discounted Cumulative Gain",
    definition: "Нормированная полезность ранжирования с большим весом верхних позиций и поддержкой нескольких степеней релевантности.",
    formula: "\\[\n      \\operatorname{nDCG@}k\n      =\n      \\frac{\\operatorname{DCG@}k}{\\operatorname{IDCG@}k},\n      \\qquad\n      \\operatorname{DCG@}k\n      =\n      \\sum_{i=1}^{k}\n      \\frac{2^{\\mathrm{rel}_i}-1}{\\log_2(i+1)}.\n    \\]",
    detail: "IDCG — DCG идеального порядка всех известных релевантных объектов для запроса. При выбранной конвенции значение лежит от нуля до единицы.",
    href: "#/reference/retrieval-metrics/metrics-ndcg"
  }
});

let glossaryPopup = null;
let glossaryActiveTerm = null;
let glossaryCloseTimer = null;

function ensureGlossaryPopup() {
  if (glossaryPopup) return glossaryPopup;

  glossaryPopup = document.createElement("aside");
  glossaryPopup.id = "glossary-popover";
  glossaryPopup.className = "glossary-popover";
  glossaryPopup.setAttribute("role", "dialog");
  glossaryPopup.setAttribute("aria-modal", "false");
  glossaryPopup.setAttribute("aria-label", "Определение термина");
  glossaryPopup.hidden = true;
  document.body.append(glossaryPopup);

  glossaryPopup.addEventListener("pointerenter", cancelGlossaryClose);
  glossaryPopup.addEventListener("pointerleave", (event) => {
    // при касании pointerleave приходит после каждого жеста; карточку закрывает тап вне неё
    if (event.pointerType !== "touch") scheduleGlossaryClose();
  });
  glossaryPopup.addEventListener("focusin", cancelGlossaryClose);
  glossaryPopup.addEventListener("focusout", (event) => {
    if (!glossaryPopup.contains(event.relatedTarget) && event.relatedTarget !== glossaryActiveTerm) {
      scheduleGlossaryClose();
    }
  });
  return glossaryPopup;
}

function cancelGlossaryClose() {
  if (glossaryCloseTimer) window.clearTimeout(glossaryCloseTimer);
  glossaryCloseTimer = null;
}

function scheduleGlossaryClose() {
  cancelGlossaryClose();
  glossaryCloseTimer = window.setTimeout(() => closeGlossary(), 160);
}

function positionGlossary(term) {
  if (!glossaryPopup || glossaryPopup.hidden) return;

  const margin = 12;
  const gap = 10;
  const anchor = term.getBoundingClientRect();
  const popup = glossaryPopup.getBoundingClientRect();
  const centered = anchor.left + anchor.width / 2 - popup.width / 2;
  const left = Math.max(margin, Math.min(centered, window.innerWidth - popup.width - margin));
  const spaceAbove = anchor.top - margin;
  const spaceBelow = window.innerHeight - anchor.bottom - margin;
  const placement = spaceAbove >= popup.height + gap || spaceAbove >= spaceBelow ? "top" : "bottom";
  const preferredTop = placement === "top" ? anchor.top - popup.height - gap : anchor.bottom + gap;
  const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - popup.height - margin));

  glossaryPopup.dataset.placement = placement;
  glossaryPopup.style.left = Math.round(left) + "px";
  glossaryPopup.style.top = Math.round(top) + "px";
  glossaryPopup.style.setProperty(
    "--glossary-arrow-x",
    Math.round(Math.max(18, Math.min(anchor.left + anchor.width / 2 - left, popup.width - 18))) + "px"
  );
}

// Формула показывается целиком: если она шире доступного места, уменьшаем её кегль
// (SVG MathJax масштабируется вместе с font-size), чтобы не было горизонтальной прокрутки.
function fitGlossaryFormula() {
  const formula = glossaryPopup?.querySelector(".glossary-formula");
  if (!formula) return;
  formula.style.fontSize = "";
  const style = getComputedStyle(glossaryPopup);
  const available = window.innerWidth - 24 -
    parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) -
    parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
  const natural = formula.getBoundingClientRect().width;
  if (natural > available) {
    formula.style.fontSize = (parseFloat(getComputedStyle(formula).fontSize) * available / natural) + "px";
  }
}

function openGlossary(term) {
  const entry = GLOSSARY[term.dataset.term];
  if (!entry) return;
  if (glossaryActiveTerm === term && glossaryPopup && !glossaryPopup.hidden) {
    cancelGlossaryClose();
    return;
  }

  cancelGlossaryClose();
  const popup = ensureGlossaryPopup();
  if (glossaryActiveTerm && glossaryActiveTerm !== term) {
    glossaryActiveTerm.setAttribute("aria-expanded", "false");
  }
  glossaryActiveTerm = term;
  term.setAttribute("aria-expanded", "true");

  if (typeof clearMath === "function") clearMath(popup);
  popup.innerHTML =
    '<div class="glossary-head">' +
      "<strong>" + escapeHtml(entry.label) + "</strong>" +
      "<span>" + escapeHtml(entry.name) + "</span>" +
    "</div>" +
    '<p class="glossary-definition">' + escapeHtml(entry.definition) + "</p>" +
    '<div class="glossary-formula">' + entry.formula + "</div>" +
    '<p class="glossary-detail">' + escapeHtml(entry.detail) + "</p>" +
    '<a class="glossary-more" href="' + entry.href + '">Подробнее в справочнике</a>';
  popup.hidden = false;
  positionGlossary(term);

  if (typeof typesetMath === "function") {
    typesetMath([popup]).then(() => {
      if (glossaryActiveTerm === term && !popup.hidden) {
        fitGlossaryFormula();
        positionGlossary(term);
      }
    });
  }
}

function closeGlossary(options = {}) {
  cancelGlossaryClose();
  if (!glossaryPopup || glossaryPopup.hidden) return;

  const term = glossaryActiveTerm;
  glossaryPopup.hidden = true;
  if (typeof clearMath === "function") clearMath(glossaryPopup);
  glossaryPopup.innerHTML = "";
  if (term) term.setAttribute("aria-expanded", "false");
  glossaryActiveTerm = null;
  if (options.returnFocus && term?.isConnected) term.focus();
}

function mountGlossaryTerms(root) {
  ensureGlossaryPopup();
  root.querySelectorAll("[data-term]").forEach((term) => {
    const entry = GLOSSARY[term.dataset.term];
    if (!entry) {
      console.warn('Нет определения для data-term="' + term.dataset.term + '"');
      return;
    }

    term.setAttribute("aria-haspopup", "dialog");
    term.setAttribute("aria-controls", "glossary-popover");
    term.setAttribute("aria-expanded", "false");
    term.addEventListener("pointerenter", () => openGlossary(term));
    term.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "touch") scheduleGlossaryClose();
    });
    term.addEventListener("focus", () => openGlossary(term));
    term.addEventListener("blur", (event) => {
      if (!glossaryPopup?.contains(event.relatedTarget)) scheduleGlossaryClose();
    });
    term.addEventListener("click", (event) => {
      event.preventDefault();
      openGlossary(term);
    });
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!glossaryPopup || glossaryPopup.hidden) return;
  if (glossaryPopup.contains(event.target) || glossaryActiveTerm?.contains(event.target)) return;
  closeGlossary();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && glossaryPopup && !glossaryPopup.hidden) {
    closeGlossary({ returnFocus: true });
  }
});
document.addEventListener("scroll", (event) => {
  if (glossaryPopup?.contains(event.target)) return;
  closeGlossary();
}, true);
window.addEventListener("resize", () => {
  if (!glossaryActiveTerm) return;
  fitGlossaryFormula();
  positionGlossary(glossaryActiveTerm);
});
