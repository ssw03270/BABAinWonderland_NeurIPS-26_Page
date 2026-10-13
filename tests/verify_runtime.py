"""Check the bundled runtime against the original simulator's recorded outputs."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime.game import MAP_IDS, PageSandbox, SandboxConfig, create_game

# A map's mechanic shows at a known step of its saved solution: the world-object counts there.
MECHANICS = {
    ("pool_of_tears", 14): {"rock": 0, "water": 23},  # the rock fills the channel
    ("pool_of_tears", 19): {"water": 22},  # the WATER word drowns, and its rule with it
    ("lobster_quadrille", 31): {"crab": 0},  # CRAB IS YOU: crabs that are YOU and DEFEAT destroy themselves
    ("cheshire_cat", 32): {"jelly": 1},  # a melting jelly pushed into the lava
    ("cheshire_cat", 33): {"jelly": 0},
    ("golden_key", 6): {"key": 0, "door": 1},  # the key opens the first door
    ("golden_key", 29): {"door": 0},  # DOOR IS OPEN while SHUT: the last door opens itself
    ("queen_of_hearts", 18): {"skull": 0, "love": 19},  # SKULL IS LOVE turns the prison into hearts
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def verify():
    reference = json.loads((ROOT / "tests/reference.json").read_text())
    game = create_game()
    assert game()["map"] == reference["map"] == "make_a_way"
    checks = 0
    for world in ("default", "wonderland"):
        game("/world", {"world": world})
        state = game("/reset")
        frames = [digest({"board": state["board"], "comparison": state["comparison"]})]
        for step, action in enumerate(state["solution"], 1):
            state = game("/action", {"action": action})
            assert state["comparison"][world]["match"], (world, step)
            if step == 3:
                rocks = sorted(obj["position"] for obj in state["board"]["objects"] if obj["word"] == "rock" and obj["type"] == "world_object")
                assert rocks == [[4, 3], [5, 3]], "Both rocks must move on the first push"
            if step == 14:
                assert any(obj["word"] == "win" and obj["position"] == [9, 5] for obj in state["board"]["objects"])
            assert state["won"] == (step == 17), (world, step)
            frames.append(digest({"board": state["board"], "comparison": state["comparison"]}))
        assert frames == reference["solution"][world], f"Solution differs: {world}"
        assert state["won"] and state["steps"] == 17
        undone = game("/undo")
        assert undone["steps"] == 16 and not undone["won"]
        assert game("/action", {"action": state["solution"][-1]})["won"]
        checks += len(frames)
        for scene, versions in reference["examples"][world].items():
            game("/example", {"example": scene})
            for version, expected in versions.items():
                item = game("/version", {"version": version})
                assert digest({"board": item["board"], "comparison": item["comparison"], "program": item["program"]}) == expected, (world, scene, version)
                checks += 1
    # Reaching the flag is insufficient until the player completes its rule.
    game("/reset")
    for action in ["right"] * 5 + ["down"] * 4 + ["right"] * 6:
        state = game("/action", {"action": action})
    assert not state["ended"] and not state["won"]
    assert any(obj["word"] == "baba" and obj["position"] == [11, 7] for obj in state["board"]["objects"])
    assert any(obj["word"] == "win" and obj["position"] == [9, 6] for obj in state["board"]["objects"])
    game("/world", {"world": "default"})
    for example in json.loads((ROOT / "data/examples.json").read_text())["examples"]:
        state = game("/example", {"example": example["scene"]})
        assert state["board"] == example["actual"]
        for kind in ("failed", "fixed"):
            result = game("/version", {"version": example[kind]["version"]})["comparison"]["default"]
            assert digest(result) == digest({key: value for key, value in example[kind].items() if key != "version"})
            assert result["match"] == (kind == "fixed")
    for map_id, worlds in reference["extra_maps"].items():
        for world, expected in worlds.items():
            state = game("/world", {"world": world})
            game("/version", {"version": state["versions"][-1]})
            state = game("/reset", {"map": map_id})
            assert state["map"] == map_id and state["world"] == world and not state["canUndo"]
            actions = state["solution"]
            frames = [digest({"board": state["board"], "comparison": state["comparison"]})]
            for step, action in enumerate(actions, 1):
                state = game("/action", {"action": action})
                assert state["won"] == (step == len(actions)), (map_id, world, step)
                objects = Counter(obj["word"] for obj in state["board"]["objects"] if obj["type"] == "world_object")
                for word, count in MECHANICS.get((map_id, step), {}).items():
                    assert objects[word] == count, (map_id, world, step, word)
                frames.append(digest({"board": state["board"], "comparison": state["comparison"]}))
            assert frames == expected, (map_id, world)
            undone = game("/undo")
            assert undone["steps"] == len(actions) - 1 and not undone["won"]
            assert game("/action", {"action": actions[-1]})["won"]
            checks += len(frames)
    game("/version", {"version": "v002"})
    state = game("/reset", {"map": "make_a_way"})
    assert state["program"]["version"] == "v002" and state["world"] == "wonderland"
    assert state["steps"] == 0 and state["comparison"] is None and not state["canUndo"]
    assert [entry["id"] for entry in state["maps"]] == list(MAP_IDS)
    try:
        game("/reset", {"map": "../unknown"})
        raise AssertionError("An unknown map must be rejected")
    except ValueError:
        pass
    assert game()["board"] == state["board"] and game()["map"] == state["map"]
    # A move's mark in the record is the picked version's verdict on that move, also for a move made after an undo.
    game("/world", {"world": "default"})
    game("/version", {"version": "v002"})
    game("/reset")
    game("/action", {"action": "right"})
    assert game("/trail")["trail"] == [{"action": "right", "match": True}]
    game("/undo")
    game("/action", {"action": "up"})  # the wall bump v002 gets wrong
    assert game("/trail")["trail"] == [{"action": "up", "match": False}]
    assert {"version": "v002", "match": False} in game("/verdicts")["verdicts"]
    # The time guard stops a runaway program at its next call.
    sandbox = PageSandbox(SandboxConfig(timeout_ms=200))
    runaway = sandbox.compile_source("def step(x):\n    return x + 1\n\ndef predict_next_state(state, action):\n    x = 0\n    while True:\n        x = step(x)\n")
    result = sandbox.execute_predict(runaway.namespace, {}, "idle")
    assert not result.success and result.errors[0].message == "Execution timeout exceeded: over 0.2s"
    provenance = json.loads((ROOT / "runtime/provenance.json").read_text())
    for name, expected in provenance["original_sha256"].items():
        if name.startswith("programs/"):
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
    programs = sum(name.startswith("programs/") for name in provenance["original_sha256"])
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if filename and (module.__name__ == "src" or module.__name__.startswith(("src.", "baba_in_wonderland"))):
            assert Path(filename).resolve().is_relative_to(ROOT / "runtime/vendor"), filename
    return f"PASS: {checks} original-runtime comparisons; {len(MAP_IDS)} puzzles in both worlds; sink, self-destruction, melting, open/shut, and transformation; map switching; static examples; {programs} original program hashes; undo; the record after an undo; the time guard; no sibling imports"


if __name__ == "__main__":
    print(verify())
