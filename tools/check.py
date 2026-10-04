#!/usr/bin/env python3
"""Проверка структуры и стиля конспектов.

Запуск из корня репозитория:  python3 tools/check.py
Скрипт ничего не меняет, только сообщает о нарушениях правил из AGENTS.md.
Код выхода 0 — всё в порядке, 1 — есть ошибки. Тот же скрипт запускается
на GitHub при каждом изменении; с ошибками сайт не публикуется.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []


def err(where, msg):
    errors.append(f"{where}: {msg}")


ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
STATUSES = {"empty", "draft", "done"}
# Математические символы, которые должны жить только внутри LaTeX
MATH_CHARS = "ℝ‖⟨⟩∈∉⊂⊆≈≤≥≠≫≪Σ∑√⁄θπτσαβλεμγδφωΔ∞⌊⌋∩∪∝"
# Курсив из 1–3 латинских букв — это переменная, набранная HTML-ом вместо LaTeX
HTML_VAR_RE = re.compile(r"<i>\s*[A-Za-z]{1,3}\s*</i>")


def strip_latex(text):
    text = re.sub(r"\\\(.*?\\\)", " ", text, flags=re.S)
    text = re.sub(r"\\\[.*?\\\]", " ", text, flags=re.S)
    return text


def strip_code(text):
    text = re.sub(r"<pre\b.*?</pre>", " ", text, flags=re.S)
    text = re.sub(r"<code\b.*?</code>", " ", text, flags=re.S)
    return text


def line_of(text, pos):
    return text.count("\n", 0, pos) + 1


# ---------- оглавление ----------
outline_path = ROOT / "outline.json"
try:
    outline = json.loads(outline_path.read_text(encoding="utf-8"))
except Exception as e:  # noqa: BLE001
    print(f"outline.json: не читается как JSON: {e}")
    sys.exit(1)

expected_files = {}
chapter_ids, colors = set(), set()
if not isinstance(outline.get("chapters"), list):
    err("outline.json", "нет списка chapters")
for ch in outline.get("chapters", []):
    cid = ch.get("id", "")
    where = f"outline.json, глава {cid or '?'}"
    if not ID_RE.match(cid):
        err(where, "id главы должен быть латиницей в kebab-case")
    if cid in chapter_ids:
        err(where, "id главы повторяется")
    chapter_ids.add(cid)
    if not ch.get("title"):
        err(where, "нет title")
    color = ch.get("color", "")
    if not COLOR_RE.match(color):
        err(where, "color должен быть вида #RRGGBB")
    elif color.upper() in colors:
        err(where, f"цвет {color} уже занят другой главой")
    colors.add(color.upper())
    section_ids = set()
    for sec in ch.get("sections", []):
        sid = sec.get("id", "")
        swhere = f"outline.json, раздел {cid}/{sid or '?'}"
        if not ID_RE.match(sid):
            err(swhere, "id раздела должен быть латиницей в kebab-case")
        if sid in section_ids:
            err(swhere, "id раздела повторяется в главе")
        section_ids.add(sid)
        if not sec.get("title"):
            err(swhere, "нет title")
        status = sec.get("status")
        if status not in STATUSES:
            err(swhere, f"status должен быть одним из {sorted(STATUSES)}")
        summary = sec.get("summary", "")
        if not isinstance(summary, str) or len(summary.strip()) < 30:
            err(swhere, "summary пустая или слишком короткая (нужно 1–3 предложения)")
        concepts = sec.get("concepts")
        if not isinstance(concepts, list) or not (3 <= len(concepts) <= 10) or not all(isinstance(c, str) and c.strip() for c in concepts):
            err(swhere, "concepts должен быть списком из 3–10 понятий")
        expected_files[f"{cid}/{sid}"] = status

# ---------- реестр иллюстраций ----------
registered = set()
fig_js = sorted((ROOT / "figures").glob("*.js"))
for f in fig_js:
    src = f.read_text(encoding="utf-8")
    for block in re.findall(r"Object\.assign\(FIGURES,\s*\{(.*?)\}\);", src, flags=re.S):
        registered.update(k.strip('"\'') for k in re.findall(r"([\"']?[\w-]+[\"']?)\s*:", block))

# ---------- тексты разделов ----------
h2_ids_global = {}
glossary_path = ROOT / "assets" / "glossary.js"
glossary_src = glossary_path.read_text(encoding="utf-8") if glossary_path.exists() else ""
glossary_keys = set(re.findall(r"^\s{2}([a-z][a-z0-9-]*):\s*\{", glossary_src, flags=re.M))
sections_dir = ROOT / "sections"
existing = {str(p.relative_to(sections_dir))[:-5]: p for p in sections_dir.rglob("*.html")} if sections_dir.exists() else {}

for key in existing:
    if key not in expected_files:
        err(f"sections/{key}.html", "файла нет в outline.json (лишний или неверный путь)")

for key, status in expected_files.items():
    path = existing.get(key)
    where = f"sections/{key}.html"
    text = path.read_text(encoding="utf-8") if path else ""
    if status == "empty":
        if text.strip():
            err(where, "в оглавлении status \"empty\", а текст есть: обновите status, summary и concepts")
        continue
    if not text.strip():
        err(where, f"в оглавлении status \"{status}\", а файла с текстом нет")
        continue

    if re.search(r"<h1\b", text):
        err(where, "не пишите <h1>: заголовок раздела берётся из оглавления")
    if re.search(r"<h[4-6]\b", text):
        err(where, "заголовки глубже <h3> не используются")
    if not re.match(r"\s*<p class=\"lead\">", text):
        err(where, "раздел должен начинаться с вводного абзаца <p class=\"lead\">")

    toc = re.search(r"<nav class=\"toc\".*?</nav>", text, flags=re.S)
    h2 = re.findall(r"<h2(?:\s+id=\"([^\"]*)\")?[^>]*>(.*?)</h2>", text, flags=re.S)
    if not toc:
        err(where, "нет содержания раздела <nav class=\"toc\">")
    jumps = re.findall(r"data-jump=\"([^\"]+)\"", toc.group(0)) if toc else []
    ids_in_file = set(re.findall(r"\sid=\"([^\"]+)\"", text))
    for j in jumps:
        if j not in ids_in_file:
            err(where, f"ссылка содержания data-jump=\"{j}\" ведёт в никуда")
    prefixes = set()
    for hid, htext in h2:
        if not hid:
            err(where, f"у <h2>{htext.strip()[:40]}</h2> нет id")
            continue
        prefixes.add(hid.split("-")[0])
        if hid not in jumps:
            err(where, f"<h2 id=\"{hid}\"> не указан в содержании раздела")
        if hid in h2_ids_global and h2_ids_global[hid] != key:
            err(where, f"id \"{hid}\" уже используется в sections/{h2_ids_global[hid]}.html")
        h2_ids_global[hid] = key
    if len(prefixes) > 1:
        err(where, f"у заголовков h2 разные префиксы id: {sorted(prefixes)} (нужен один префикс раздела)")
    if h2 and re.sub(r"<[^>]+>", "", h2[-1][1]).strip() != "Ключевые статьи":
        err(where, "последний <h2> должен называться «Ключевые статьи»")

    # формулы: только LaTeX
    if text.count("\\(") != text.count("\\)"):
        err(where, "непарные \\( и \\) в формулах")
    if text.count("\\[") != text.count("\\]"):
        err(where, "непарные \\[ и \\] в формулах")
    for m in re.finditer(r"<p class=\"formula\">(.*?)</p>", text, flags=re.S):
        if not re.fullmatch(r"\s*\\\[.*\\\]\s*", m.group(1), flags=re.S):
            err(f"{where}:{line_of(text, m.start())}", "в <p class=\"formula\"> должна быть одна выносная формула \\[ ... \\]")
    plain = strip_code(strip_latex(text))
    for m in re.finditer(r"<su[bp]>", plain):
        err(f"{where}:{line_of(plain, m.start())}", "индекс через <sub>/<sup>: формулы только в LaTeX")
    for m in HTML_VAR_RE.finditer(plain):
        err(f"{where}:{line_of(plain, m.start())}", f"переменная {m.group(0)} набрана HTML-ом: нужно \\( ... \\)")
    for m in re.finditer(f"[{MATH_CHARS}]", plain):
        ctx = plain[max(0, m.start() - 25):m.start() + 15].replace("\n", " ")
        err(f"{where}:{line_of(plain, m.start())}", f"символ «{m.group(0)}» вне LaTeX: …{ctx}…")

    # иллюстрации
    for m in re.finditer(r"<figure\b[^>]*data-figure=\"([^\"]+)\"[^>]*>(.*?)</figure>", text, flags=re.S):
        name, inner = m.group(1), m.group(2)
        if "data-mount" in inner and name not in registered:
            err(where, f"иллюстрация data-figure=\"{name}\" не зарегистрирована в FIGURES (figures/*.js)")
        if "<figcaption" not in inner:
            err(where, f"у иллюстрации {name} нет <figcaption>")

    # всплывающие определения
    for m in re.finditer(r"<([a-z]+)\b[^>]*\bdata-term=\"([^\"]+)\"[^>]*>", text):
        tag, term = m.group(1), m.group(2)
        if tag != "button":
            err(where, f"термин data-term=\"{term}\" должен быть размечен кнопкой")
        if term not in glossary_keys:
            err(where, f"для data-term=\"{term}\" нет записи в assets/glossary.js")

# ---------- код иллюстраций ----------
index_html = (ROOT / "index.html").read_text(encoding="utf-8")
if 'src="assets/glossary.js"' not in index_html:
    err("index.html", "не подключён assets/glossary.js")
if 'href="assets/glossary.css"' not in index_html:
    err("index.html", "не подключён assets/glossary.css")
for f in fig_js:
    rel = f"figures/{f.name}"
    if f'src="{rel}"' not in index_html:
        err("index.html", f"не подключён {rel}")
    src = f.read_text(encoding="utf-8")
    # управление не должно стоять под текстом пояснения fig-say
    for m in re.finditer(r"class=\"fig-say\"", src):
        tail = src[m.end():]
        end = tail.find("`")
        segment = tail[:end if end >= 0 else len(tail)]
        if re.search(r"class=\"fig-row|vlControls\(|data-act=|type=\"range\"", segment):
            err(f"{rel}:{line_of(src, m.start())}", "элементы управления стоят под fig-say: перенесите их выше текста пояснения")
    # формулы в текстах иллюстраций: только LaTeX (внутри SVG-элементов <text> допустимы простые подписи)
    code = re.sub(r"<text\b[^>]*>.*?</text>", " ", src)
    code = re.sub(r"/\*.*?\*/", " ", code, flags=re.S)
    code = re.sub(r"//[^\n]*", " ", code)
    code = strip_code(code)
    for m in HTML_VAR_RE.finditer(code):
        err(f"{rel}:{line_of(code, m.start())}", f"переменная {m.group(0)} в тексте иллюстрации: нужно \\\\( ... \\\\)")
    for m in re.finditer(r"<su[bp]>", code):
        err(f"{rel}:{line_of(code, m.start())}", "индекс через <sub>/<sup> в тексте иллюстрации: нужен LaTeX")
for f in sorted((ROOT / "figures").glob("*.css")):
    if f'href="figures/{f.name}"' not in index_html:
        err("index.html", f"не подключён figures/{f.name}")

# ---------- итог ----------
if errors:
    print(f"Найдено нарушений: {len(errors)}\n")
    for e in errors:
        print(" -", e)
    sys.exit(1)
n_sections = sum(len(ch.get("sections", [])) for ch in outline.get("chapters", []))
print(f"Всё в порядке: глав {len(outline.get('chapters', []))}, разделов {n_sections}, иллюстраций в реестре {len(registered)}.")
