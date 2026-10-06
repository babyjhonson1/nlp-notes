/* Иллюстрация раздела rag/what-is-rag: два контура RAG. */

function mountRagPipeline(box){
  const steps = [
    {
      active: ["sources"],
      text: "Индексация начинается с источников. Важно сохранить версию документа, права доступа и координаты будущей цитаты — одного текста недостаточно."
    },
    {
      active: ["parse"],
      text: "Парсер восстанавливает структуру, а chunker создаёт единицы поиска. Ошибка здесь попадёт и в embedding, и в показываемую пользователю цитату."
    },
    {
      active: ["index", "store"],
      text: "Для каждого чанка вычисляются поисковые признаки. Индекс хранит их вместе с текстом и метаданными; это граница между офлайн- и онлайн-контуром."
    },
    {
      active: ["query"],
      text: "Онлайн-контур начинается с запроса. Его можно нормализовать, дополнить историей диалога или разложить на несколько подзапросов."
    },
    {
      active: ["retrieve", "store"],
      text: "Retriever обращается к индексу и возвращает кандидатов. Здесь возникает первая измеримая потеря: нужный фрагмент может не попасть в top-\\(k'\\) кандидатов."
    },
    {
      active: ["answer"],
      text: "Кандидаты реранжируются и укладываются в бюджет контекста. Генератор получает запрос, доказательства и идентификаторы источников, затем строит ответ со ссылками."
    }
  ];

  box.innerHTML = `
    <div class="fig-stage rag-stage">
      <div class="rag-lane">
        <div class="rag-lane-label">Индексация<br>заранее</div>
        <div class="rag-flow">
          <div class="rag-node" data-rag-node="sources"><b>Источники</b><span>PDF, HTML, базы данных</span></div>
          <div class="rag-arrow" data-rag-edge="1">→</div>
          <div class="rag-node" data-rag-node="parse"><b>Парсинг и чанкинг</b><span>текст, структура, metadata</span></div>
          <div class="rag-arrow" data-rag-edge="2">→</div>
          <div class="rag-node" data-rag-node="index"><b>Признаки и индекс</b><span>BM25, embeddings, ACL</span></div>
        </div>
      </div>
      <div class="rag-store" data-rag-node="store"><b>Внешняя память:</b> чанк + поисковое представление + источник + версия + права доступа</div>
      <div class="rag-lane">
        <div class="rag-lane-label">Запрос<br>онлайн</div>
        <div class="rag-flow">
          <div class="rag-node" data-rag-node="query"><b>Запрос</b><span>вопрос и история диалога</span></div>
          <div class="rag-arrow" data-rag-edge="4">→</div>
          <div class="rag-node" data-rag-node="retrieve"><b>Поиск и отбор</b><span>retrieve, filter, rerank</span></div>
          <div class="rag-arrow" data-rag-edge="5">→</div>
          <div class="rag-node" data-rag-node="answer"><b>Контекст и ответ</b><span>generate, abstain, cite</span></div>
        </div>
      </div>
    </div>
    <div class="fig-row">
      <button class="fig-btn icon" type="button" data-act="prev" aria-label="Предыдущий шаг">${ICON.prev}</button>
      <button class="fig-btn icon" type="button" data-act="next" aria-label="Следующий шаг">${ICON.next}</button>
      <input class="fig-scrub" type="range" min="0" max="${steps.length - 1}" value="0" aria-label="Шаг конвейера">
      <span class="fig-status"></span>
    </div>
    <p class="fig-say"></p>
    <div class="fig-legend">
      <span><i class="rag-key active"></i>текущий шаг</span>
      <span><i class="rag-key done"></i>уже пройдено</span>
    </div>`;

  let step = 0;
  const nodes = [...box.querySelectorAll("[data-rag-node]")];
  const edges = [...box.querySelectorAll("[data-rag-edge]")];
  const scrub = box.querySelector(".fig-scrub");
  const status = box.querySelector(".fig-status");
  const say = box.querySelector(".fig-say");
  const prev = box.querySelector('[data-act="prev"]');
  const next = box.querySelector('[data-act="next"]');

  function draw(){
    const active = new Set(steps[step].active);
    nodes.forEach((node) => {
      const name = node.dataset.ragNode;
      const order = ["sources", "parse", "index", "store", "query", "retrieve", "answer"].indexOf(name);
      const passed = order >= 0 && order < [0, 1, 2, 4, 5, 6][step];
      node.classList.toggle("active", active.has(name));
      node.classList.toggle("done", passed && !active.has(name));
    });
    edges.forEach((edge) => {
      const n = Number(edge.dataset.ragEdge);
      edge.classList.toggle("done", n <= step);
      edge.classList.toggle("active", n === step);
    });
    scrub.value = step;
    status.textContent = `${step + 1} / ${steps.length}`;
    say.innerHTML = steps[step].text;
    prev.disabled = step === 0;
    next.disabled = step === steps.length - 1;
  }

  prev.addEventListener("click", () => { step = Math.max(0, step - 1); draw(); });
  next.addEventListener("click", () => { step = Math.min(steps.length - 1, step + 1); draw(); });
  scrub.addEventListener("input", () => { step = Number(scrub.value); draw(); });
  draw();
}

Object.assign(FIGURES, {
  "rag-pipeline": mountRagPipeline
});
