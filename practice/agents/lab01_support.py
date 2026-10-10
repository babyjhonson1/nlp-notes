"""Данные, подстановка модели и HF-адаптер. Решений заданий здесь нет."""

import json
from copy import deepcopy
from typing import Annotated, TypedDict

from langchain_core.messages import (
    AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolMessage,
    convert_to_openai_messages,
)
from langchain_core.tools import tool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langgraph.graph.message import add_messages


# Условный эпизод из конспекта: разговор 2026-10-08, пятница 2026-10-09.
OFFERS = [
    dict(id="A", shop="Лист", title="Маленький принц", language="ru",
         format="paper", book_price=950, delivery_price=350, arrives_on="2026-10-09"),
    dict(id="B", shop="Полка", title="Маленький принц", language="ru",
         format="paper", book_price=900, delivery_price=650, arrives_on="2026-10-09"),
    dict(id="C", shop="Том", title="Маленький принц", language="en",
         format="paper", book_price=800, delivery_price=200, arrives_on="2026-10-08"),
]
CONSTRAINTS = dict(title="Маленький принц", language="ru", format="paper",
                   max_total=1500, deadline="2026-10-09")


@tool
def search_books(title: str) -> list[dict]:
    """Найти предложения по точному названию. Возвращает id, язык, формат,
    магазин и цену книги. Доставки в результате нет: её читает get_offer_details.
    """
    return [{k: v for k, v in item.items() if k not in ("delivery_price", "arrives_on")}
            for item in OFFERS if item["title"].casefold() == title.strip().casefold()]


@tool
def get_offer_details(offer_id: str) -> dict:
    """Прочитать полные условия предложения по id из search_books:
    цену книги, стоимость доставки и обещанную дату получения.
    """
    for item in OFFERS:
        if item["id"] == offer_id:
            return deepcopy(item)
    raise ValueError(f"Предложение {offer_id!r} не найдено")


TOOLS = [search_books, get_offer_details]
TOOL_REGISTRY = {item.name: item for item in TOOLS}
SYSTEM = """Ты помогаешь выбрать книгу. Условия пользователя обязательны.
Бюджет включает доставку. Дата получения должна быть не позднее срока.
Читай реальные условия через доступные инструменты; не придумывай цену и срок.
Независимые проверки предложений можно запросить в одном ответе.
При ошибке исправь вызов или объясни, каких данных не хватает.
Когда проверки закончены, ответь по-русски, назови id и полную стоимость
подходящего предложения или объясни отсутствие подходящих вариантов.
Заказ оформлять нельзя: в этой работе есть только чтение данных."""


class WorkflowState(TypedDict):
    constraints: dict
    offers: list[dict]
    eligible: list[dict]
    answer: str
    status: str


class AgentState(TypedDict):
    # add_messages добавляет сообщения, а при совпадении id обновляет запись.
    messages: Annotated[list[AnyMessage], add_messages]
    steps: int
    answer: str
    status: str


def workflow_input(**changes):
    return dict(constraints={**CONSTRAINTS, **changes}, offers=[], eligible=[],
                answer="", status="running")


def agent_input(**changes):
    constraints = {**CONSTRAINTS, **changes}
    question = "Подбери книгу по условиям: " + json.dumps(constraints, ensure_ascii=False)
    return dict(messages=[HumanMessage(content=question, id="user-1")], steps=0,
                answer="", status="running")


def call_message(*calls):
    """calls: тройки (имя функции, аргументы, id вызова)."""
    return AIMessage(content="", tool_calls=[
        dict(name=name, args=args, id=call_id) for name, args, call_id in calls
    ])


def happy_script():
    return [
        call_message(("search_books", {"title": "Маленький принц"}, "s1")),
        call_message(*[("get_offer_details", {"offer_id": i}, f"d{i}")
                       for i in ("A", "B", "C")]),
        AIMessage(content="A: 1300 рублей с доставкой, получение 9 октября. "
                          "B превышает бюджет, C на английском."),
    ]


def assert_complete_history(messages):
    """Каждый предложенный вызов должен получить ответ до следующего хода LLM."""
    pending = set()
    seen_ids = set()
    for message in messages:
        if isinstance(message, AIMessage):
            assert not pending, f"Нет результатов для {pending}"
            for call in message.tool_calls:
                assert call["id"] not in seen_ids, "Повторный id вызова"
                pending.add(call["id"])
                seen_ids.add(call["id"])
        elif isinstance(message, ToolMessage):
            assert message.tool_call_id in pending, "Результат без ожидающего вызова"
            pending.remove(message.tool_call_id)
        else:
            assert not pending, "Новый ход появился до результатов инструментов"
    assert not pending, f"В конце остались вызовы без результата: {pending}"


class ScriptedModel:
    """Подстановка, не LLM: возвращает заранее заданные решения, не учится."""

    def __init__(self, replies):
        self.replies = deepcopy(replies)
        self.seen = []

    def invoke(self, messages):
        assert_complete_history(messages)
        if len(self.seen) >= len(self.replies):
            raise AssertionError("Граф вызвал модель после конца сценария")
        self.seen.append(deepcopy(messages))
        return deepcopy(self.replies[len(self.seen) - 1])


class LoopingModel:
    """Проверяет остановку: при каждом решении снова запрашивает поиск."""

    def __init__(self):
        self.seen = []

    def invoke(self, messages):
        assert_complete_history(messages)
        self.seen.append(deepcopy(messages))
        return call_message(("search_books", {"title": "Маленький принц"},
                             f"loop-{len(self.seen)}"))


def print_history(messages):
    """Текстовый просмотр; не отправляет журнал во внешние сервисы."""
    for message in messages:
        if isinstance(message, AIMessage) and message.tool_calls:
            print("assistant calls:", message.tool_calls)
        elif isinstance(message, ToolMessage):
            print(f"tool [{message.tool_call_id}]:", message.content)
        else:
            print(f"{message.type}:", message.content)


class HFModel:
    """Удалённая модель Hugging Face с интерфейсом invoke для учебного графа.

    Конструктор не делает запросов. Сеть используется только в invoke.
    client можно подставить при проверке адаптера без модели.
    """

    def __init__(self, model_id, token=None, provider="auto", client=None):
        if not model_id.strip():
            raise ValueError("Задай HF_MODEL: id модели с поддержкой tool calling")
        if client is None:
            from huggingface_hub import InferenceClient
            client = InferenceClient(provider=provider, api_key=token, timeout=60)
        self.client = client
        self.model_id = model_id
        self.usage = []

    def invoke(self, messages):
        assert_complete_history(messages)
        response = self.client.chat_completion(
            model=self.model_id,
            messages=convert_to_openai_messages(messages),
            tools=[convert_to_openai_tool(item) for item in TOOLS],
            tool_choice="auto", max_tokens=1024,
        )
        choice = response.choices[0]
        self.usage.append(response.usage)
        if choice.finish_reason not in ("stop", "tool_calls"):
            raise ValueError(f"Незавершённый ответ модели: {choice.finish_reason}")
        message = choice.message
        calls = []
        for call in message.tool_calls or []:
            args = call.function.arguments
            if isinstance(args, str):
                args = json.loads(args)
            if not isinstance(args, dict) or not call.id:
                raise ValueError("Вызову нужны объект аргументов и id")
            calls.append(dict(name=call.function.name, args=args, id=call.id))
        if not calls and not (message.content or "").strip():
            raise ValueError("Пустой ответ модели без вызова")
        return AIMessage(content=message.content or "", tool_calls=calls)
