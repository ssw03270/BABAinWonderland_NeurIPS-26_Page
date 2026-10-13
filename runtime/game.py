"""The project-page demo; shared by browser execution and parity checks."""
import ast
from collections import Counter
from copy import deepcopy
from difflib import unified_diff
from hashlib import sha256
import json
import marshal
import math
from pathlib import Path
import sys
import time
import types

ROOT = Path(__file__).resolve().parents[1]
MAP_ID = "make_a_way"
# The menu order: each map plays the role of an original level, in the original order (README).
MAP_IDS = (MAP_ID, "lovely_garden", "pool_of_tears", "lobster_quadrille", "cheshire_cat", "white_rabbit", "caterpillar",
           "queen_of_hearts", "golden_key", "stolen_tarts", "mock_turtle", "alices_evidence")
MAX_STEPS = 300  # an attempt ends here (the simulator truncates it)
EXAMPLE_MOVES = {"movement": ["right"], "push": ["right"] * 3, "wall": ["up"]}  # fixed comparisons: moves from the first map's start
sys.path.insert(0, str(ROOT / "runtime/vendor"))
from src.environments import BabaWrapper
from src.program_model.sandbox import PreparedSourceResult, ProgramSandbox, SandboxConfig
from src.program_model.predictor import _clone_plain_structure
from src.program_model.state_codec import dump_state_json, normalize_state_payload, states_equivalent


MONITORING = getattr(sys, "monitoring", None)  # Python 3.12+, as in the browser


class PageSandbox(ProgramSandbox):
    """The research sandbox, cheaper in the browser in two ways. Its guard: the time limit is checked whenever the code
    calls a function, not on every line, since a per-line tracer makes every prediction several times slower in the
    browser. A prediction that runs past the limit still stops, at its next call; lines are not counted.
    Where Python has sys.monitoring (3.12+, as in the browser), it runs the check as the programs' own functions start
    or resume, and no other code is watched. A call tracer (older Pythons) runs as often, but under Python 3.12 it also
    slows every line of all code while it is set: the saved programs took about twice as long with it.
    And a program is compiled straight from its source: with static validation off, as here, the research sandbox
    compiles ``ast.parse(source)``, which gives the same code object at about twice the cost."""

    TOOL = 3  # the guard's sys.monitoring tool id, one no standard tool claims (debugger 0, coverage 1, profiler 2, optimizer 5)
    deadline, limit = math.inf, 0.0  # while a prediction runs: the time it must end by, and its limit

    @classmethod
    def check_time(cls, code, offset):  # noqa: ARG003 (a watched function starts or resumes)
        if time.perf_counter() > cls.deadline:
            raise TimeoutError(f"Execution timeout exceeded: over {cls.limit:.1f}s")

    def _prepare_source(self, source):
        try:
            prepared = PreparedSourceResult(success=True, code_obj=compile(source, "<program_model>", "exec", dont_inherit=True))
        except SyntaxError:
            prepared = super()._prepare_source(source)  # (the research sandbox's report of the error)
        if MONITORING and prepared.success:  # watch the program's code and every function, lambda and generator in it
            codes = [prepared.code_obj]
            while codes:
                code = codes.pop()
                MONITORING.set_local_events(self.TOOL, code, MONITORING.events.PY_START | MONITORING.events.PY_RESUME)
                codes.extend(const for const in code.co_consts if isinstance(const, types.CodeType))
        return prepared

    def _run_with_limits(self, fn):
        limit = self.config.timeout_ms / 1000.0
        if MONITORING:
            PageSandbox.limit, PageSandbox.deadline = limit, time.perf_counter() + limit
            try:
                return fn(), 0
            finally:
                PageSandbox.deadline = math.inf
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


if MONITORING:
    if MONITORING.get_tool(PageSandbox.TOOL) != "page time guard":
        MONITORING.use_tool_id(PageSandbox.TOOL, "page time guard")
    for event in (MONITORING.events.PY_START, MONITORING.events.PY_RESUME):
        MONITORING.register_callback(PageSandbox.TOOL, event, PageSandbox.check_time)

# state_schema's canonical token of an object: json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
# builds this C encoder for each call; here it is built once. It skips json.dumps's check for cycles and its error for
# values JSON cannot hold, since every object judged is plain data: the simulator's state, or a prediction the sandbox
# has just serialized whole.
_encode = json.encoder.c_make_encoder(None, None, json.encoder.encode_basestring, None, ":", ",", True, False, True)


def canonical_token(obj):
    return "".join(_encode(obj, 0))


def plain(output):
    """A program's output as the research predictor judges it: its plain copy (_clone_plain_structure), made only when
    it would differ. marshal accepts the built-in types themselves and no subclass of them, so an output it accepts
    already reads exactly as its plain copy would, type for type and value for value."""
    try:
        marshal.dumps(output)
    except ValueError:
        return _clone_plain_structure(output)
    return output


class NextState:
    """A move's actual next state, as one world's code sees it, ready to judge every version's prediction of it.
    matches(prediction, text) is states_equivalent(state, prediction), which compares the states' object lists as
    multisets of the objects' canonical JSON. Here the state's own side of that is computed once, not once per
    prediction, and a prediction whose canonical JSON (``text``, which the sandbox writes anyway) is the state's has
    the same objects in the same order, so its side is not needed either (over half the right predictions)."""

    def __init__(self, state):
        self.state = state
        self.text = dump_state_json(state)
        objects = state.get("objects")
        unordered = type(objects) is list and all(isinstance(obj, dict) for obj in objects)
        self.tokens = Counter(map(canonical_token, objects)) if unordered else None

    def matches(self, predicted, text):
        state = self.state
        if type(predicted) is not dict or predicted.keys() != state.keys():
            return False
        for key, value in state.items():
            guess = predicted[key]
            if key == "objects" and self.tokens is not None and type(guess) is list and all(isinstance(obj, dict) for obj in guess):
                if text != self.text and (len(guess) != len(value) or Counter(map(canonical_token, guess)) != self.tokens):
                    return False
            elif not states_equivalent(value, guess, path=f"$.{key}"):
                return False
        return True


class Move:
    """One move of an attempt: the state before it, its action and the state after it, with what judging it takes,
    worked out once: each world's view of it and each version's verdict on it."""

    __slots__ = ("before", "action", "after", "views", "verdicts")

    def __init__(self, before, action, after):
        self.before, self.action, self.after = before, action, after
        self.views, self.verdicts = {}, {}


def create_game():
    aliases = json.loads((ROOT / "data/aliases.json").read_text(encoding="utf-8"))
    reverse_aliases = {value: key for key, value in aliases.items()}
    maps = {name: json.loads((ROOT / "data/maps" / f"{name}.json").read_text(encoding="utf-8")) for name in MAP_IDS}
    # The saved programs, by world and version. Each is compiled, and its code view made, when first needed; the worker
    # prepares the rest while it is idle (prepare, below), so the first board waits for none of them.
    paths = {world: {path.stem: path for path in sorted((ROOT / "programs" / world).glob("v[0-9][0-9][0-9].py"))}
             for world in ("default", "wonderland")}
    for world, versions in paths.items():
        if not versions:
            raise ValueError(f"No saved programs found in programs/{world}.")
    models, programs = {world: {} for world in paths}, {world: {} for world in paths}
    sandbox = PageSandbox(SandboxConfig(timeout_ms=1500))

    def model(world, version):
        """The version's program, compiled: its namespace in the research sandbox."""
        if version not in models[world]:
            source = paths[world][version].read_text(encoding="utf-8")
            compiled = sandbox.compile_source(source)
            if not compiled.success:
                raise ValueError(f"Cannot compile {world}/{version}.py: {compiled.errors[0].message}")
            models[world][version] = compiled.namespace
        return models[world][version]

    def program(world, version):
        """The version as the code view shows it: its source, its diff against the previous saved version, and the
        function the view starts at."""
        if version not in programs[world]:
            versions = list(paths[world])
            k = versions.index(version)
            previous = versions[k - 1] if k else None
            path = paths[world][version]
            source = path.read_text(encoding="utf-8")
            previous_source = paths[world][previous].read_text(encoding="utf-8") if previous else ""
            functions = {node.name: node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef)}
            focus_name = "_attempt_move" if world == "default" else "_push_world_chain"
            focus = functions.get(focus_name, functions["predict_next_state"])
            programs[world][version] = {
                "version": version, "sha256": sha256(path.read_bytes()).hexdigest(),
                "source": source, "lines": len(source.splitlines()), "previous": previous,
                "diff": "\n".join(unified_diff(previous_source.splitlines(), source.splitlines(), fromfile=f"{previous or 'empty'}.py", tofile=path.name, lineterm="")),
                "focus": {"name": focus.name, "start": focus.lineno, "source": ast.get_source_segment(source, focus)},
            }
        return programs[world][version]

    # The worker's idle-time work, in the order the page needs it: the opening world's programs (the first move's
    # verdicts) and code views (the version a move picks), then Wonderland's.
    unprepared = ((make, world, version) for world in paths for make in (model, program) for version in paths[world])

    def prepare():
        """Compiles or describes the next saved program not yet ready; False once none is left."""
        step = next(unprepared, None)
        if step:
            make, world, version = step
            make(world, version)
        return step is not None

    def reset(session):
        if "env" in session:
            session["env"].close()
        env = BabaWrapper(
            env_name="env/baba_custom_ascii_original", max_steps=MAX_STEPS, seed=42,
            env_kwargs={"scenario_type": session["map"]},
        )
        env.reset(seed=42)
        session.update(env=env, history=[env.snapshot()], transitions=[None], example=None)

    def advance(session, action):
        env = session["env"]
        before = env.get_visualization_state()  # (a new copy on every call)
        env.step({"idle": 0, "up": 1, "right": 2, "down": 3, "left": 4}[action])
        session["history"].append(env.snapshot())
        session["transitions"].append(Move(before, action, env.get_visualization_state()))

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
        move = session["transitions"][-1]
        comparison = None
        if move:
            # Version changes replay the identical pre-action state, never the outcome.
            comparison = {"action": move.action, world: compare_prediction(move, world, version)}
        return {
            "board": env.get_visualization_state(), "map": session["map"],
            "maps": [{"id": name, "label": spec["display_name"]} for name, spec in maps.items()],
            "objective": maps[session["map"]]["objective"],
            "aliases": aliases, "steps": len(session["history"]) - 1,
            "canUndo": len(session["history"]) > 1,
            "ended": bool(env.last_terminated or env.last_truncated),
            "won": bool(env.last_terminated and env.last_reward > 0), "maxSteps": MAX_STEPS,
            "world": world, "versions": list(paths[world]), "program": program(world, version),
            "comparison": comparison, "example": session["example"], "solution": maps[session["map"]]["solution"],
            "before": move.before if move else None,
        }

    def trail(session):
        """Every move so far: its action, and whether the selected version of the code predicted it right. A move keeps
        its verdicts, so a version is run only on moves it has not judged yet."""
        world = session["world"]
        version = session["selected_versions"][world]
        return [{"action": move.action, "match": verdict(move, world, version)} for move in session["transitions"][1:]]

    def verdicts(session):
        """For the last move, whether each saved version of the current world's code predicts it right."""
        move = session["transitions"][-1]
        if not move:
            return []
        world = session["world"]
        return [{"version": version, "match": verdict(move, world, version)} for version in paths[world]]

    def as_seen(state, world):
        """A state as the world's code sees it: in Wonderland, its property words renamed."""
        return remap_properties(state, aliases) if world == "wonderland" else state

    def view(move, world):
        """The move as a world's code sees it: the state before, marshalled, and the state after, ready to judge. The
        state before is a new tree of dicts, lists, strings, integers and booleans, so each copy marshal makes of it
        for a version is the plain copy the research predictor gives the code (_clone_plain_structure), made in C."""
        if world not in move.views:
            move.views[world] = marshal.dumps(as_seen(move.before, world)), NextState(as_seen(move.after, world))
        return move.views[world]

    def run(move, world, version):
        """A version's code on the move, on its own copy of the state before, in the research sandbox."""
        return sandbox.execute_predict(model(world, version), marshal.loads(view(move, world)[0]), move.action)

    def verdict(move, world, version):
        """Whether a version predicts a move right: its comparison's verdict alone, without its cells or display."""
        key = world, version
        if key not in move.verdicts:
            executed = run(move, world, version)
            move.verdicts[key] = executed.success and view(move, world)[1].matches(
                normalize_state_payload(plain(executed.output_state)), executed.output_state_json)
        return move.verdicts[key]

    def remap_properties(state, mapping):
        mapped = deepcopy(state)
        for obj in mapped["objects"]:
            if obj["type"] == "rule_property":
                obj["word"] = mapping.get(obj["word"], obj["word"])
        return mapped

    def compare_prediction(move, world, version):
        executed = run(move, world, version)
        if not executed.success:
            move.verdicts[world, version] = False
            return {"error": executed.errors[0].message, "board": None, "match": False, "cells": []}
        predicted = normalize_state_payload(_clone_plain_structure(executed.output_state))
        after = view(move, world)[1]
        match = move.verdicts[world, version] = after.matches(predicted, executed.output_state_json)
        display = remap_properties(predicted, reverse_aliases) if world == "wonderland" else predicted
        actual_objects = Counter(json.dumps(obj, sort_keys=True) for obj in move.after["objects"])
        predicted_objects = Counter(json.dumps(obj, sort_keys=True) for obj in display["objects"])
        differing = (actual_objects - predicted_objects) + (predicted_objects - actual_objects)
        cells = sorted({tuple(json.loads(obj)["position"]) for obj in differing})
        return {
            "board": display, "match": match,
            "cells": cells, "terminationMatch": after.state["step"] == predicted.get("step"),
            "error": None,
        }

    session = {"map": MAP_ID, "world": "default", "selected_versions": {world: next(reversed(versions)) for world, versions in paths.items()}}
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
            if body["world"] not in paths:
                raise ValueError("Unknown world.")
            session["world"] = body["world"]
        elif path == "/version":
            if body["version"] not in paths[session["world"]]:
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

    dispatch.prepare = prepare  # (the worker calls it while idle)
    return dispatch
