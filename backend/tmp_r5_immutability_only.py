import json
import os

from tmp_r5_all_modules import ENGINES, run_module


def main():
    qpm = int(os.getenv("R5_QPM", "200"))
    # Keep module-local run independent from the all-module loop.
    import tmp_r5_all_modules as r5
    r5.QUESTIONS_PER_MODULE = qpm

    generate, grade = ENGINES["immutability"]
    out = run_module("immutability", generate, grade)
    print(json.dumps({
        "questions_per_module": qpm,
        "module": "immutability",
        "result": out,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
