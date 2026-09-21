from app.services import (
    comparison_engine,
    formatting_engine,
    immutability_engine,
    indexing_engine,
    intro_engine,
    looping_engine,
    methods_engine,
    slicing_engine,
)

engines = {
    "intro": (intro_engine.generate, intro_engine.grade),
    "indexing": (indexing_engine.generate, indexing_engine.grade),
    "slicing": (slicing_engine.generate, slicing_engine.grade),
    "looping": (looping_engine.generate, looping_engine.grade),
    "comparison": (comparison_engine.generate, comparison_engine.grade),
    "methods": (methods_engine.generate, methods_engine.grade),
    "immutability": (immutability_engine.generate, immutability_engine.grade),
    "formatting": (formatting_engine.generate, formatting_engine.grade),
}

for name, (generate, grade) in engines.items():
    question = generate(tier=3)
    qtype = question.get("type")
    print(f"\n== {name} ==")
    print(f"type={qtype} kind={question.get('kind')} has_options={bool(question.get('options'))}")

    if qtype in ("mcq", "fill_blank"):
        answer = question["options"][0] if question.get("options") else "x"
        result = grade(question["token"], {"answer": answer})
    elif qtype == "select_all":
        result = grade(question["token"], {"answers": (question.get("options") or [])[:1]})
    elif qtype in ("build_slice", "build_index"):
        result = grade(question["token"], {"slice": {"start": "", "stop": "", "step": ""}})
    elif qtype == "write_code":
        result = grade(question["token"], {"code": 'print("x")'})
    else:
        result = {"ok": None}

    print(f"grade_ok={result.get('ok')} has_correct={'correct' in result}")
