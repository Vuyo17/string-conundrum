import json
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
    print(f"\n== {name} ==")
    seen = set()
    for _ in range(300):
        q = generate(tier=5)
        t = q["type"]
        if t in seen:
            continue
        seen.add(t)
        if t in ("mcq", "fill_blank"):
            sub = {"answer": (q.get("options") or ["x"])[0]}
        elif t == "select_all":
            sub = {"answers": (q.get("options") or [])[:1]}
        elif t in ("build_slice", "build_index"):
            sub = {"slice": {"start": "", "stop": "", "step": ""}}
        elif t == "write_code":
            sub = {"code": "print('x')"}
        else:
            sub = {"answer": "x"}
        r = grade(q["token"], sub)
        print(t, sorted(r.keys()), "correct_answer_type", type(r.get("correct_answer")).__name__)
        if len(seen) >= 5:
            break
