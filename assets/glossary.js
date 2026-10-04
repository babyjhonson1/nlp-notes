/* Краткие определения для выбранных терминов.
   Полные объяснения живут в главе «Справочник», а этот реестр питает всплывающие карточки. */

const GLOSSARY = Object.freeze({
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
  glossaryPopup.addEventListener("pointerleave", scheduleGlossaryClose);
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
      if (glossaryActiveTerm === term && !popup.hidden) positionGlossary(term);
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
    term.addEventListener("pointerleave", scheduleGlossaryClose);
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
document.addEventListener("scroll", () => closeGlossary(), true);
window.addEventListener("resize", () => {
  if (glossaryActiveTerm) positionGlossary(glossaryActiveTerm);
});
