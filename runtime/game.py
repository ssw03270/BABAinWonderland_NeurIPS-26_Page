"""The project-page demo; shared by browser execution and parity checks."""
import ast
from collections import Counter
from copy import deepcopy
from difflib import unified_diff
from hashlib import sha256
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
MAP_ID = "make_a_way"
sys.path.insert(0, str(ROOT / "runtime/vendor"))
from src.environments import BabaWrapper
from src.program_model.sandbox import ProgramSandbox, SandboxConfig
from src.program_model.predictor import ProgramWorldModelPredictor
from src.program_model.state_codec import normalize_state_payload, states_equivalent


def create_game():
    aliases = json.loads((ROOT / "data/aliases.json").read_text(encoding="utf-8"))
    reverse_aliases = {value: key for key, value in aliases.items()}
    maps = {name: json.loads((ROOT / "data/maps" / f"{name}.json").read_text(encoding="utf-8")) for name in (MAP_ID, "double_crossing", "remote_control")}
    models = {}
    programs = {}
    sandbox = ProgramSandbox(SandboxConfig(timeout_ms=1500, line_budget=1_000_000))
    for world in ("default", "wonderland"):
        models[world], programs[world] = {}, {}
        versions = sorted((ROOT / "programs" / world).glob("v[0-9][0-9][0-9].py"))
        if not versions:
            raise ValueError(f"No saved programs found in programs/{world}.")
        previous_source, previous_version = "", None
        for path in versions:
            source = path.read_text(encoding="utf-8")
            compiled = sandbox.compile_source(source)
            if not compiled.success:
                raise ValueError(f"Cannot compile {world}/{path.name}: {compiled.errors[0].message}")
            model = ProgramWorldModelPredictor(sandbox)
            model.set_compiled_program(source, compiled.namespace)
            models[world][path.stem] = model
            functions = {node.name: node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)}
            focus_name = "_attempt_move" if world == "default" else "_push_world_chain"
            focus = functions.get(focus_name, functions["predict_next_state"])
            programs[world][path.stem] = {
                "version": path.stem, "sha256": sha256(path.read_bytes()).hexdigest(),
                "source": source, "lines": len(source.splitlines()), "previous": previous_version,
                "diff": "\n".join(unified_diff(previous_source.splitlines(), source.splitlines(), fromfile=f"{previous_version or 'empty'}.py", tofile=path.name, lineterm="")),
                "focus": {"name": focus.name, "start": focus.lineno, "source": ast.get_source_segment(source, focus)},
            }
            previous_source, previous_version = source, path.stem

    def reset(session):
        if "env" in session:
            session["env"].close()
        env = BabaWrapper(
            env_name="env/baba_custom_ascii_original", max_steps=300, seed=42,
            env_kwargs={"scenario_type": session["map"]},
        )
        env.reset(seed=42)
        session.update(env=env, history=[env.snapshot()], transitions=[None], example=None)

    def advance(session, action):
        env = session["env"]
        before = deepcopy(env.get_visualization_state())
        env.step({"idle": 0, "up": 1, "right": 2, "down": 3, "left": 4}[action])
        session["history"].append(env.snapshot())
        session["transitions"].append({"before": before, "action": action})

    def show_example(session, example):
        session["map"] = MAP_ID
        reset(session)
        for _ in range(1 if example == "movement" else 3):
            advance(session, "right")
        session["example"] = example

    def payload(session):
        env = session["env"]
        world = session["world"]
        version = session["selected_versions"][world]
        transition = session["transitions"][-1]
        comparison = None
        if transition:
            # Version changes replay the identical pre-action state, never the outcome.
            state = remap_properties(transition["before"], aliases) if world == "wonderland" else transition["before"]
            result = models[world][version].predict(state, transition["action"])
            comparison = {"action": transition["action"], world: compare_prediction(result, env.get_visualization_state(), world)}
        return {
            "board": env.get_visualization_state(), "map": session["map"],
            "maps": [{"id": name, "label": spec["display_name"]} for name, spec in maps.items()],
            "objective": maps[session["map"]]["objective"],
            "aliases": aliases, "steps": len(session["history"]) - 1,
            "canUndo": len(session["history"]) > 1,
            "ended": bool(env.last_terminated or env.last_truncated),
            "won": bool(env.last_terminated and env.last_reward > 0),
            "world": world, "versions": list(programs[world]), "program": programs[world][version],
            "comparison": comparison, "example": session["example"], "solution": maps[session["map"]]["solution"],
        }

    def remap_properties(state, mapping):
        mapped = deepcopy(state)
        for obj in mapped["objects"]:
            if obj["type"] == "rule_property":
                obj["word"] = mapping.get(obj["word"], obj["word"])
        return mapped

    def compare_prediction(result, actual, world):
        if not result.success:
            return {"error": result.error.message, "board": None, "match": False, "cells": []}
        predicted = normalize_state_payload(result.predicted_state_obj)
        expected = remap_properties(actual, aliases) if world == "wonderland" else actual
        display = remap_properties(predicted, reverse_aliases) if world == "wonderland" else predicted
        actual_objects = Counter(json.dumps(obj, sort_keys=True) for obj in actual["objects"])
        predicted_objects = Counter(json.dumps(obj, sort_keys=True) for obj in display["objects"])
        differing = (actual_objects - predicted_objects) + (predicted_objects - actual_objects)
        cells = sorted({tuple(json.loads(obj)["position"]) for obj in differing})
        return {
            "board": display, "match": states_equivalent(expected, predicted),
            "cells": cells, "terminationMatch": expected["step"] == predicted.get("step"),
            "error": None,
        }

    session = {"map": MAP_ID, "world": "default", "selected_versions": {world: next(reversed(versions)) for world, versions in programs.items()}}
    reset(session)

    def dispatch(path="", body=None):
        body = body or {}
        if path == "/reset":
            map_id = body.get("map", session["map"])
            if map_id not in maps:
                raise ValueError("Unknown map.")
            session["map"] = map_id
            reset(session)
        elif path == "/world":
            if body["world"] not in programs:
                raise ValueError("Unknown world.")
            session["world"] = body["world"]
        elif path == "/version":
            if body["version"] not in programs[session["world"]]:
                raise ValueError("Unknown program version for this world.")
            session["selected_versions"][session["world"]] = body["version"]
        elif path == "/action":
            if body["action"] not in ("idle", "up", "right", "down", "left"):
                raise ValueError("Unknown action.")
            env = session["env"]
            if env.last_terminated or env.last_truncated:
                raise ValueError("This attempt has ended. Undo or restart to continue.")
            advance(session, body["action"])
            session["example"] = None
        elif path == "/undo":
            if len(session["history"]) > 1:
                session["history"].pop()
                session["transitions"].pop()
                session["env"].restore(session["history"][-1], refresh_cache=True)
                session["example"] = None
        elif path == "/example":
            if body["example"] not in ("movement", "push"):
                raise ValueError("Unknown example.")
            show_example(session, body["example"])
        elif path:
            raise ValueError("Unknown command.")
        return payload(session)

    return dispatch
