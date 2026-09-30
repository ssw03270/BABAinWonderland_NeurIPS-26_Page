"""Check the bundled runtime against the original simulator's recorded outputs."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime.game import create_game


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
                assert state["comparison"][world]["match"], (map_id, world, step)
                assert state["won"] == (step == len(actions)), (map_id, world, step)
                objects = {word: [obj["position"] for obj in state["board"]["objects"] if obj["type"] == "world_object" and obj["word"] == word] for word in ("baba", "rock", "water", "key", "door")}
                if map_id == "double_crossing" and step in (5, 20):
                    assert len(objects["rock"]) == (1 if step == 5 else 0)
                    assert len(objects["water"]) == (9 if step == 5 else 8)
                if map_id == "remote_control" and step == 9:
                    assert objects["baba"] == [[3, 4]] and objects["rock"] == [[10, 7]], "Control must transfer to the remote rock"
                if map_id == "remote_control" and step == 16:
                    assert not objects["key"] and not objects["door"], "OPEN/SHUT must consume both objects"
                frames.append(digest({"board": state["board"], "comparison": state["comparison"]}))
            assert frames == expected, (map_id, world)
            undone = game("/undo")
            assert undone["steps"] == len(actions) - 1 and not undone["won"]
            assert game("/action", {"action": actions[-1]})["won"]
            checks += len(frames)
    # One sacrificed rock clears only half the river; entering the second cell loses Baba.
    game("/reset", {"map": "double_crossing"})
    for _ in range(7):
        state = game("/action", {"action": "right"})
    assert not state["won"] and not any(obj["word"] == "baba" and obj["type"] == "world_object" for obj in state["board"]["objects"])
    game("/version", {"version": "v002"})
    state = game("/reset", {"map": "make_a_way"})
    assert state["program"]["version"] == "v002" and state["world"] == "wonderland"
    assert state["steps"] == 0 and state["comparison"] is None and not state["canUndo"]
    assert len(state["maps"]) == 3
    try:
        game("/reset", {"map": "../unknown"})
        raise AssertionError("An unknown map must be rejected")
    except ValueError:
        pass
    assert game()["board"] == state["board"] and game()["map"] == state["map"]
    provenance = json.loads((ROOT / "runtime/provenance.json").read_text())
    for name, expected in provenance["original_sha256"].items():
        if name.startswith("programs/"):
            assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
    for module in tuple(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if filename and (module.__name__ == "src" or module.__name__.startswith(("src.", "baba_in_wonderland"))):
            assert Path(filename).resolve().is_relative_to(ROOT / "runtime/vendor"), filename
    return f"PASS: {checks} original-runtime comparisons; 3 puzzles in both worlds; sink, control transfer, and open/shut; map switching; static examples; 73 original program hashes; undo; no sibling imports"


if __name__ == "__main__":
    print(verify())
