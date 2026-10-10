"""Проверки поведения решений студента; сеть и модели не используются."""

import json
from copy import deepcopy

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage

from lab01_support import (
    CONSTRAINTS, OFFERS, TOOL_REGISTRY, LoopingModel, ScriptedModel,
    agent_input, assert_complete_history, call_message, happy_script, workflow_input,
)


def check_filter(select):
    cases = [({}, ["A"]), ({"max_total": 1250}, []),
             ({"max_total": 1550}, ["A", "B"]),
             ({"language": "en"}, ["C"]),
             ({"deadline": "2026-10-08"}, []),
             ({"title": "Другая книга"}, []), ({"format": "ebook"}, [])]
    for changes, expected in cases:
        offers, constraints = deepcopy(OFFERS), {**CONSTRAINTS, **changes}
        before = deepcopy((offers, constraints))
        result = select(offers, constraints)
        assert sorted(x["id"] for x in result) == expected, changes
        assert (offers, constraints) == before, "Функция изменила входные данные"
    print("✓ Фильтр: полная стоимость, граница бюджета, срок, язык, формат, название")


def check_workflow(build):
    app = build()
    assert hasattr(app, "get_graph"), "Нужен скомпилированный граф LangGraph"
    for changes, expected, status in [({}, ["A"], "completed"),
                                     ({"max_total": 1250}, [], "no_match"),
                                     ({"title": "Нет такой книги"}, [], "no_match")]:
        initial = workflow_input(**changes)
        before = deepcopy(initial)
        result = app.invoke(initial)
        assert sorted(x["id"] for x in result["eligible"]) == expected
        assert result["status"] == status
        assert isinstance(result["answer"], str) and result["answer"].strip()
        assert initial == before, "Не изменяй переданный начальный словарь"
    print("✓ Workflow: найден вариант, превышение бюджета и пустой каталог")


def check_executor(execute):
    batch = call_message(("get_offer_details", {"offer_id": "A"}, "first"),
                         ("get_offer_details", {"offer_id": "C"}, "second"))
    before = batch.model_copy(deep=True)
    result = execute(batch, TOOL_REGISTRY)
    assert batch == before, "Не редактируй сообщение модели"
    assert len(result) == 2 and all(isinstance(x, ToolMessage) for x in result)
    assert [x.tool_call_id for x in result] == ["first", "second"]
    payloads = [json.loads(x.content) for x in result]
    assert all(x["ok"] for x in payloads)
    assert [x["data"]["id"] for x in payloads] == ["A", "C"]
    for name, args, error in [
        ("missing_tool", {}, "unknown_tool"),
        ("get_offer_details", {}, "invalid_arguments"),
        ("get_offer_details", {"offer_id": "Z"}, "tool_error"),
    ]:
        response = execute(call_message((name, args, "bad")), TOOL_REGISTRY)
        assert len(response) == 1 and response[0].tool_call_id == "bad"
        payload = json.loads(response[0].content)
        assert payload["ok"] is False and payload["error"] == error
    assert execute(AIMessage(content="Готово"), TOOL_REGISTRY) == []
    print("✓ Исполнитель: пакет вызовов, соответствие id и три вида ошибок")


def check_agent(build):
    model = ScriptedModel(happy_script())
    app = build(model, max_steps=5)
    initial = agent_input()
    before = deepcopy(initial)
    result = app.invoke(initial, config={"recursion_limit": 30})
    assert result["status"] == "completed" and result["steps"] == 3
    assert "1300" in result["answer"] and initial == before
    assert len(model.seen) == 3
    assert all(isinstance(m[0], SystemMessage) for m in model.seen)
    assert_complete_history(result["messages"])
    outputs = [json.loads(x.content) for x in result["messages"] if isinstance(x, ToolMessage)]
    assert len(outputs) == 4 and all(x["ok"] for x in outputs)
    assert outputs[0]["data"][0]["id"] == "A"
    assert {x["data"]["id"] for x in outputs[1:]} == {"A", "B", "C"}
    observed = [x for x in model.seen[2] if isinstance(x, ToolMessage)]
    assert len(observed) == 4, "Модель должна получить все результаты, а не только последний"

    immediate = ScriptedModel([AIMessage(content="Уточни название книги.")])
    result = build(immediate, max_steps=2).invoke(agent_input())
    assert result["steps"] == 1 and result["status"] == "completed"
    assert not any(isinstance(x, ToolMessage) for x in result["messages"])

    repair = ScriptedModel([
        call_message(("get_offer_details", {"offer_id": "Z"}, "bad")),
        call_message(("get_offer_details", {"offer_id": "A"}, "fixed")),
        AIMessage(content="A стоит 1300 рублей с доставкой."),
    ])
    result = build(repair, max_steps=3).invoke(agent_input())
    responses = [json.loads(x.content) for x in result["messages"] if isinstance(x, ToolMessage)]
    assert [x["ok"] for x in responses] == [False, True]
    assert result["status"] == "completed" and result["steps"] == 3

    looping = LoopingModel()
    result = build(looping, max_steps=2).invoke(agent_input())
    assert result["status"] == "step_limit" and result["steps"] == 2
    assert len(looping.seen) == 2 and result["answer"].strip()
    assert_complete_history(result["messages"])
    for invalid in (0, -1, True, 1.5):
        try:
            build(LoopingModel(), max_steps=invalid)
        except ValueError:
            pass
        else:
            raise AssertionError(f"Недопустимый max_steps: {invalid}")
    print("✓ Агент: последовательность, несколько вызовов за ход, ответ, исправление, предел")
