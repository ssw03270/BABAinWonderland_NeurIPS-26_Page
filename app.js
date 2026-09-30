const $ = (id) => document.getElementById(id);
const dialog = $("figure-dialog");
document.querySelectorAll("[data-figure]").forEach((button) => {
  button.addEventListener("click", () => {
    $("expanded-figure").src = button.dataset.figure;
    $("expanded-figure").alt = button.querySelector("img").alt;
    dialog.showModal();
  });
});
$("close-figure").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
$("copy-citation").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("bibtex").textContent);
    $("copy-citation").textContent = "Copied";
  } catch {
    $("copy-citation").textContent = "Select the text to copy";
  }
});

// Tables 1 and 2 of the supplied paper. Accuracies are fractions, not win rates.
const results = {
  online: {default: [["WorldCoder", .920, .862, 97], ["Alice", .993, .992, 26]], wonderland: [["WorldCoder", .568, .198, 57], ["Alice", .982, .973, 100]]},
  offline: {default: [["GIF-MCTS", .866, .799, 100], ["CWM", .962, .928, 100], ["Alice", 1, 1, 22]], wonderland: [["GIF-MCTS", .704, .628, 100], ["CWM", .826, .734, 100], ["Alice", .956, .932, 100]]},
};
let evaluation = "online";
function renderResults() {
  const world = $("result-world").value;
  $("result-rows").replaceChildren(...results[evaluation][world].map(([name, all, balanced, calls]) => {
    const tr = document.createElement("tr");
    if (name === "Alice") tr.className = "ours";
    [name, `${(all * 100).toFixed(1)}%`, `${(balanced * 100).toFixed(1)}%`, calls].forEach((value) => {
      const td = document.createElement("td"); td.textContent = value; tr.append(td);
    });
    if (name === "Alice") { const badge = document.createElement("span"); badge.textContent = "OURS"; tr.firstChild.append(badge); }
    return tr;
  }));
  $("result-context").textContent = evaluation === "online" ? "Online interaction on 32 regular levels · evaluated on regular-level solution transitions" : "Fixed-data training on regular levels · evaluated on 8 held-out extra levels · no Explorer";
  $("result-note").textContent = evaluation === "online" && world === "wonderland" ? "WorldCoder stopped at 57 calls after exhausting the per-update retry budget. The methods share a call cap, but these runs did not use equal call counts." : evaluation === "offline" ? "All methods learn from the same fixed training transitions. Extra-level transitions are used only for evaluation." : "Both methods learn from online interaction. Calls reports the number of LLM calls consumed during learning.";
  $("results-caption").textContent = `${evaluation === "online" ? "Online learning" : "Held-out generalization"} in ${world === "wonderland" ? "Baba in Wonderland" : "Default World"}`;
}
document.querySelectorAll("[data-evaluation]").forEach((button) => button.addEventListener("click", () => {
  evaluation = button.dataset.evaluation;
  document.querySelectorAll("[data-evaluation]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
  renderResults();
}));
$("result-world").addEventListener("change", renderResults);
renderResults();

const canvas = $("game-canvas");
const predictionCanvas = $("prediction-canvas");
const runtime = new Worker(new URL("runtime/worker.js?v=5a4c9677dd45", document.baseURI), {type:"module"});
const pendingRequests = new Map();
let requestId = 0, runtimeError = null;
runtime.addEventListener("message", ({data}) => {
  if (data.status) { if (!game) $("board-message").textContent = data.status; return; }
  const pending = pendingRequests.get(data.id);
  if (!pending) return;
  pendingRequests.delete(data.id);
  if (data.error) pending.reject(new Error(data.error));
  else pending.resolve(data.result);
});
runtime.addEventListener("error", () => {
  runtimeError = new Error("The interactive demo could not load. Reload to try again.");
  for (const pending of pendingRequests.values()) pending.reject(runtimeError);
  pendingRequests.clear();
});
function runtimeRequest(path, body) {
  if (runtimeError) return Promise.reject(runtimeError);
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pendingRequests.set(id, {resolve, reject});
    runtime.postMessage({id, path, body});
  });
}
let game = null, busy = false, codeView = "focus", renderedVersion = null;
let autoRunning = false, autoPaused = false, autoTimer = null;
const sprites = new Map();
const colors = {baba:"#e88aa4",flag:"#e5ce67",rock:"#b59b68",wall:"#809980",you:"#e88aa4",win:"#e5ce67",stop:"#899d68",push:"#b59b68",sink:"#6790bc",water:"#6790bc",hot:"#d98259",melt:"#a0c4de",defeat:"#c97b77"};

function spriteFor(object) {
  const group = object.type === "world_object" ? "icon" : "text";
  const path = `assets/sprites/${group}/${object.word.toUpperCase()}.gif`;
  if (!sprites.has(path)) {
    const img = new Image();
    img.onload = () => { if (game) drawBoards(); };
    img.src = path; sprites.set(path, img);
  }
  return sprites.get(path);
}

function drawBoards() {
  if (!game) return;
  const prediction = game.comparison?.[game.world];
  const objects = [...game.board.objects, ...(prediction?.board?.objects || [])];
  const [width, height] = game.board.grid_size;
  // Both views use the same camera, so a difference never moves the frame.
  const xs = objects.map((o) => o.position[0]), ys = objects.map((o) => o.position[1]);
  const x0 = objects.length ? Math.max(0, Math.min(...xs) - 2) : 0;
  const y0 = objects.length ? Math.max(0, Math.min(...ys) - 2) : 0;
  const x1 = objects.length ? Math.min(width - 1, Math.max(...xs) + 2) : width - 1;
  const y1 = objects.length ? Math.min(height - 1, Math.max(...ys) + 2) : height - 1;
  const frame = {x0,y0,x1,y1};
  drawBoard(canvas, game.board, frame, prediction?.cells || [], game.world, game.aliases);
  drawBoard(predictionCanvas, prediction?.board || {objects:[]}, frame, prediction?.cells || [], game.world, game.aliases);
}

function drawBoard(canvas, board, {x0,y0,x1,y1}, differingCells, world = "default", aliases = {}) {
  const ctx = canvas.getContext("2d");
  const {objects} = board;
  const tile = 48;
  canvas.width = (x1 - x0 + 1) * tile; canvas.height = (y1 - y0 + 1) * tile;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#101012"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#19191d"; ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += tile) for (let x = 0; x < canvas.width; x += tile) ctx.strokeRect(x+.5,y+.5,tile,tile);
  const ordered = [...objects].sort((a,b) => (a.word === "tile" ? -1 : a.type === "world_object" ? 0 : 1) - (b.word === "tile" ? -1 : b.type === "world_object" ? 0 : 1));
  for (const object of ordered) {
    const x = (object.position[0] - x0) * tile, y = (object.position[1] - y0) * tile;
    const alias = world === "wonderland" && object.type === "rule_property" ? aliases[object.word] : null;
    const img = spriteFor(object);
    if (alias) {
      ctx.fillStyle = colors[object.word] || "#c7b5d6";
      ctx.fillRect(x + 3,y + 4,tile - 6,tile - 8);
      ctx.fillStyle = "#101012"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "bold 16px monospace";
      if (alias.length > 4) {
        const split = Math.ceil(alias.length / 2);
        ctx.fillText(alias.slice(0,split).toUpperCase(),x+tile/2,y+17);
        ctx.fillText(alias.slice(split).toUpperCase(),x+tile/2,y+32);
      } else ctx.fillText(alias.toUpperCase(),x+tile/2,y+tile/2);
    } else if (img.complete && img.naturalWidth) {
      ctx.save();
      // Sprite artwork faces right; horizontal orientation is shown when present.
      if (object.type === "world_object" && object.direction === "facing left") { ctx.translate(x+tile,y); ctx.scale(-1,1); ctx.drawImage(img,3,3,tile-6,tile-6); }
      else ctx.drawImage(img,x+3,y+3,tile-6,tile-6);
      ctx.restore();
    }
  }
  ctx.strokeStyle = "#ff5b62"; ctx.lineWidth = 3; ctx.setLineDash([6,4]);
  for (const [x,y] of differingCells) ctx.strokeRect((x-x0)*tile+2,(y-y0)*tile+2,tile-4,tile-4);
  ctx.setLineDash([]);
}

async function renderExamples() {
  try {
    const response = await fetch("data/examples.json?v=97a6021e9be5");
    if (!response.ok) throw new Error("Comparison images could not be loaded.");
    const {examples} = await response.json();
    const objects = examples.flatMap(example => [example.before, example.failed.board, example.fixed.board].flatMap(board => board.objects));
    await Promise.all([...new Set(objects.map(spriteFor))].map(image => image.decode()));
    for (const example of examples) {
      const xs = example.failed.cells.map(cell => cell[0]), ys = example.failed.cells.map(cell => cell[1]);
      const [width, height] = example.before.grid_size;
      const frame = {x0:Math.max(0,Math.min(...xs)-2),y0:Math.max(0,Math.min(...ys)-2),x1:Math.min(width-1,Math.max(...xs)+2),y1:Math.min(height-1,Math.max(...ys)+2)};
      for (const shot of ["before", "failed", "fixed"]) {
        const still = document.createElement("canvas");
        drawBoard(still, shot === "before" ? example.before : example[shot].board, frame, shot === "failed" ? example.failed.cells : []);
        const image = document.querySelector(`[data-case="${example.scene}"] [data-shot="${shot}"]`);
        image.src = still.toDataURL("image/png");
        image.width = still.width; image.height = still.height;
      }
    }
    $("failure-examples").hidden = false;
    $("example-status").hidden = true;
  } catch (error) {
    $("example-status").textContent = "The comparison images could not load. Reload to try again.";
  }
}

function renderComparison() {
  const prediction = game.comparison?.[game.world];
  $("model-version").textContent = `${game.world === "default" ? "Default World" : "Wonderland"} · ${game.program.version}`;
  $("model-version").title = `Program SHA-256: ${game.program.sha256}`;
  $("prediction-message").hidden = Boolean(prediction?.board);
  $("prediction-message").textContent = prediction?.error ? game.program.version === "v000" ? "The initial program returns no state." : "Prediction unavailable for this move." : "Make a move to see a prediction.";
  $("actual-terminal").textContent = game.board.step.terminated ? "Terminal" : "";
  $("predicted-terminal").textContent = prediction?.board?.step?.terminated ? "Terminal" : "";
  $("prediction-result").textContent = !prediction ? "Make a move to compare." : `${game.comparison.action.toUpperCase()} · ${prediction.error ? "Prediction error" : prediction.match ? "Exact match" : "States differ"}`;
  $("prediction-result").dataset.match = prediction ? String(prediction.match) : "pending";
  $("comparison-detail").textContent = !prediction ? "Make a move, then compare program versions." : prediction.error ? prediction.error : prediction.match ? "Objects, attributes, and terminal flag agree." : `${prediction.cells.length} differing ${prediction.cells.length === 1 ? "cell" : "cells"}${prediction.terminationMatch ? "" : " · Terminal flag differs"}.`;
  drawBoards();
}

function renderCode() {
  if (!game) return;
  const program = game.program;
  const source = codeView === "focus" ? program.focus.source : codeView === "diff" ? program.diff : program.source;
  const start = codeView === "focus" ? program.focus.start : 1;
  $("program-filename").textContent = `${game.world}/${program.version}.py`;
  $("program-size").textContent = `${program.lines} lines`;
  $("code-context").textContent = codeView === "focus" ? `${program.focus.name} · excerpt from the original source` : codeView === "diff" ? `${program.previous || "Empty file"} → ${program.version} · + added / − removed` : "Complete, unmodified program";
  $("program-source").replaceChildren(...source.split("\n").map((text, i) => {
    const line = document.createElement("span");
    line.className = "source-line";
    if (codeView === "diff") line.classList.add(text.startsWith("+") ? "added" : text.startsWith("-") ? "removed" : text.startsWith("@@") ? "diff-heading" : "context-line");
    else line.dataset.line = start + i;
    line.textContent = text || " ";
    return line;
  }));
  $("program-source").parentElement.scrollTop = 0;
  $("program-source").parentElement.scrollLeft = 0;
  $("copy-program").textContent = "Copy code";
}

function renderVersions() {
  const version = game.program.version;
  const isDefault = game.world === "default";
  const latestVersion = game.versions.at(-1);
  document.querySelectorAll("[data-world]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.world === game.world)));
  $("world-label").textContent = isDefault ? "DEFAULT WORLD" : "BABA IN WONDERLAND";
  $("world-question").textContent = isDefault ? "What if the words stopped helping?" : "The words change. The rules don't.";
  $("world-explanation").textContent = isDefault ? "YOU identifies what you control, PUSH what you can push, and WIN the goal. Start here, then switch to Wonderland to keep the scene and change the vocabulary." : "YOU → STRANGE · PUSH → GROW · WIN → SHRINK. The dynamics stay the same. This world's program had to discover their meaning from interaction, without a dictionary.";
  if ($("version-select").options.length !== game.versions.length) $("version-select").replaceChildren(...game.versions.map(v => new Option(v === latestVersion ? `${v} · Latest` : v,v)));
  $("version-select").value = version;
  if ($("map-select").options.length !== game.maps.length) $("map-select").replaceChildren(...game.maps.map((map, i) => new Option(`${i + 1} · ${map.label}`, map.id)));
  $("map-select").value = game.map;
  $("map-objective").textContent = `${game.objective} Auto replays a solution and pauses if a prediction differs.`;
  const programKey = `${game.world}/${version}`;
  if (renderedVersion !== programKey) { renderCode(); renderedVersion = programKey; }
}

function setControls() {
  document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = busy || autoRunning || !game || game.ended; });
  $("undo").disabled = busy || autoRunning || !game?.canUndo;
  $("restart").disabled = busy || autoRunning || !game;
  document.querySelectorAll("[data-world]").forEach(button => { button.disabled = busy || autoRunning || !game; });
  $("version-select").disabled = busy || autoRunning || !game;
  $("map-select").disabled = busy || autoRunning || !game;
  $("auto-play").disabled = !autoRunning && (busy || !game);
  $("auto-play").textContent = autoRunning ? "■ Stop" : autoPaused ? "▶ Continue" : "▶ Auto";
  $("auto-play").title = autoPaused ? "Continue the saved solution from this step" : "Replay the saved solution from step 0";
  $("auto-play").setAttribute("aria-pressed", String(autoRunning));
  $("auto-progress").textContent = game ? `${autoPaused ? "Paused" : "Saved solution"} · ${autoRunning || autoPaused ? `${game.steps} / ` : ""}${game.solution.length} steps` : "Saved solution · starts at step 0";
  $("copy-program").disabled = !game;
  $("game-shell").setAttribute("aria-busy", String(busy));
}
function renderGame() {
  $("step-count").textContent = game.steps;
  $("game-status").textContent = game.won ? "You found a winning state!" : game.ended ? "This attempt has ended. Undo or restart to explore again." : "Discover what the words do.";
  if (autoPaused) $("game-status").textContent = game.comparison?.[game.world]?.match ? "Prediction now matches. Continue when ready." : "Prediction differs. Inspect it, then Continue when ready.";
  $("board-message").hidden = true;
  renderVersions(); renderComparison(); setControls();
}
async function gameRequest(path = "", body) {
  if (busy) return;
  if (!autoRunning && ["/action", "/reset", "/undo"].includes(path)) autoPaused = false;
  busy = true; setControls();
  try {
    game = await runtimeRequest(path, body); renderGame();
    return true;
  } catch (error) {
    if (!game) { $("board-message").hidden=false; $("board-message").textContent="The interactive demo could not load. Reload to try again."; }
    $("game-status").textContent = error.message;
    return false;
  } finally { busy=false; setControls(); }
}

function stopAuto() {
  autoRunning = false; autoPaused = false;
  clearTimeout(autoTimer); autoTimer = null;
  setControls();
}
function scheduleAuto() {
  if (!autoRunning) return;
  if (game.ended || game.steps >= game.solution.length) { stopAuto(); return; }
  autoTimer = setTimeout(async () => {
    autoTimer = null;
    if (!autoRunning) return;
    if (!await gameRequest("/action", {action:game.solution[game.steps]})) { stopAuto(); return; }
    if (!autoRunning) return;
    if (!game.ended && !game.comparison[game.world].match) {
      autoRunning = false; autoPaused = true;
      renderGame();
      return;
    }
    scheduleAuto();
  }, 250);
}
$("auto-play").addEventListener("click", async () => {
  if (autoRunning) { stopAuto(); return; }
  if (busy || !game) return;
  const resume = autoPaused;
  autoPaused = false; autoRunning = true; setControls();
  if (!resume && !await gameRequest("/reset", {map:game.map})) { stopAuto(); return; }
  scheduleAuto();
});
document.querySelectorAll("[data-world]").forEach(button => button.addEventListener("click", () => gameRequest("/world",{world:button.dataset.world})));
$("version-select").addEventListener("change", () => gameRequest("/version",{version:$("version-select").value}));
$("map-select").addEventListener("change", () => gameRequest("/reset",{map:$("map-select").value}));
document.querySelectorAll("[data-code-view]").forEach(button => button.addEventListener("click", () => {
  codeView = button.dataset.codeView;
  document.querySelectorAll("[data-code-view]").forEach(other => other.setAttribute("aria-pressed",String(other===button)));
  renderCode();
}));
$("copy-program").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(game.program.source); $("copy-program").textContent = "Copied"; }
  catch { $("copy-program").textContent = "Select Full code to copy"; }
});
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
  await gameRequest("/action",{action:button.dataset.action}); canvas.focus({preventScroll:true});
}));
$("undo").addEventListener("click", () => gameRequest("/undo",{}));
$("restart").addEventListener("click", () => gameRequest("/reset",{map:game.map}));
canvas.addEventListener("keydown", (event) => {
  const key=event.key.toLowerCase();
  const actions={arrowup:"up",w:"up",arrowright:"right",d:"right",arrowdown:"down",s:"down",arrowleft:"left",a:"left"," ":"idle"};
  if (!game || event.ctrlKey || event.metaKey || event.altKey) return;
  if (actions[key] || key==="r" || key==="z") event.preventDefault();
  if (event.repeat || busy || autoRunning) return;
  if (key==="z" && game.canUndo) gameRequest("/undo",{});
  else if (key==="r") gameRequest("/reset",{map:game.map});
  else if (actions[key] && !game.ended) gameRequest("/action",{action:actions[key]});
});
gameRequest();
renderExamples();
