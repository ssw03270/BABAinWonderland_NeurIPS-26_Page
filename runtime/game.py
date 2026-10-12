"""The project-page demo; shared by browser execution and parity checks."""
import ast
from collections import Counter
from copy import deepcopy
from difflib import unified_diff
from hashlib import sha256
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
MAP_ID = "make_a_way"
MAX_STEPS = 300  # an attempt ends here (the simulator truncates it)
EXAMPLE_MOVES = {"movement": ["right"], "push": ["right"] * 3, "wall": ["up"]}  # fixed comparisons: moves from the first map's start
sys.path.insert(0, str(ROOT / "runtime/vendor"))
from src.environments import BabaWrapper
from src.program_model.sandbox import ProgramSandbox, SandboxConfig
from src.program_model.predictor import ProgramWorldModelPredictor
from src.program_model.state_codec import normalize_state_payload, states_equivalent


class PageSandbox(ProgramSandbox):
    """The research sandbox with a cheaper guard: its time limit is checked whenever the code calls a function, not on
    every line, since a per-line tracer makes every prediction several times slower in the browser. A prediction that
    runs past the limit still stops, at its next call; lines are not counted."""

    def _run_with_limits(self, fn):
        limit = self.config.timeout_ms / 1000.0
        start = time.perf_counter()

        def guard(frame, event, arg):  # noqa: ANN001, ANN202 (a call: no tracer for its lines)
            if time.perf_counter() - start > limit:
                raise TimeoutError(f"Execution timeout exceeded: over {limit:.1f}s")

        previous = sys.gettrace()
        sys.settrace(guard)
        try:
            return fn(), 0
        finally:
            sys.settrace(previous)


def create_game():
    aliases = json.loads((ROOT / "data/aliases.json").read_text(encoding="utf-8"))
    reverse_aliases = {value: key for key, value in aliases.items()}
    maps = {name: json.loads((ROOT / "data/maps" / f"{name}.json").read_text(encoding="utf-8")) for name in (MAP_ID, "double_crossing", "remote_control")}
    models = {}
    programs = {}
    sandbox = PageSandbox(SandboxConfig(timeout_ms=1500))
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
            env_name="env/baba_custom_ascii_original", max_steps=MAX_STEPS, seed=42,
            env_kwargs={"scenario_type": session["map"]},
        )
        env.reset(seed=42)
        session.update(env=env, history=[env.snapshot()], transitions=[None], example=None, trail={})

    def advance(session, action):
        env = session["env"]
        before = deepcopy(env.get_visualization_state())
        env.step({"idle": 0, "up": 1, "right": 2, "down": 3, "left": 4}[action])
        session["history"].append(env.snapshot())
        session["transitions"].append({"before": before, "action": action})

    def show_example(session, example):
        session["map"] = MAP_ID
        reset(session)
        for action in EXAMPLE_MOVES[example]:
            advance(session, action)
        session["example"] = example

    def payload(session):
        env = session["env"]
        world = session["world"]
        version = session["selected_versions"][world]
        transition = session["transitions"][-1]
        comparison = None
        if transition:
            # Version changes replay the identical pre-action state, never the outcome.
            result = models[world][version].predict(as_seen(transition["before"], world), transition["action"])
            comparison = {"action": transition["action"], world: compare_prediction(result, env.get_visualization_state(), world)}
        return {
            "board": env.get_visualization_state(), "map": session["map"],
            "maps": [{"id": name, "label": spec["display_name"]} for name, spec in maps.items()],
            "objective": maps[session["map"]]["objective"],
            "aliases": aliases, "steps": len(session["history"]) - 1,
            "canUndo": len(session["history"]) > 1,
            "ended": bool(env.last_terminated or env.last_truncated),
            "won": bool(env.last_terminated and env.last_reward > 0), "maxSteps": MAX_STEPS,
            "world": world, "versions": list(programs[world]), "program": programs[world][version],
            "comparison": comparison, "example": session["example"], "solution": maps[session["map"]]["solution"],
            "before": transition["before"] if transition else None,
        }

    def trail(session):
        """Every move so far: its action, and whether the selected version of the code predicted it right. A move's
        verdict never changes, so each version's are kept and only new moves are predicted (undone ones are dropped)."""
        world = session["world"]
        moves = session["transitions"][1:]
        known = session["trail"].setdefault((world, session["selected_versions"][world]), [])
        del known[len(moves):]
        model = models[world][session["selected_versions"][world]]
        for k in range(len(known), len(moves)):
            after = moves[k + 1]["before"] if k + 1 < len(moves) else session["env"].get_visualization_state()
            known.append(predicts_right(model, as_seen(moves[k]["before"], world), moves[k]["action"], as_seen(after, world)))
        return [{"action": move["action"], "match": match} for move, match in zip(moves, known)]

    def verdicts(session):
        """For the last move, whether each saved version of the current world's code predicts it right."""
        transition = session["transitions"][-1]
        if not transition:
            return []
        world = session["world"]
        state, expected = as_seen(transition["before"], world), as_seen(session["env"].get_visualization_state(), world)
        return [{"version": version, "match": predicts_right(model, state, transition["action"], expected)}
                for version, model in models[world].items()]

    def as_seen(state, world):
        """A state as the world's code sees it: in Wonderland, its property words renamed."""
        return remap_properties(state, aliases) if world == "wonderland" else state

    def predicts_right(model, state, action, expected):
        """Whether ``model`` predicts the move right: the comparison's verdict alone, without its cells or display."""
        result = model.predict(state, action)
        return result.success and states_equivalent(expected, normalize_state_payload(result.predicted_state_obj))

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
        expected = as_seen(actual, world)
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
        elif path == "/trail":
            return {"trail": trail(session)}
        elif path == "/verdicts":
            return {"verdicts": verdicts(session)}
        elif path == "/example":
            if body["example"] not in EXAMPLE_MOVES:
                raise ValueError("Unknown example.")
            show_example(session, body["example"])
        elif path:
            raise ValueError("Unknown command.")
        return payload(session)

    return dispatch
