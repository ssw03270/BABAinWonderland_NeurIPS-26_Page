const $ = (id) => document.getElementById(id);
document.querySelectorAll("[data-youtube]").forEach((button) => {
  button.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${button.dataset.youtube}?autoplay=1&rel=0&playsinline=1`;
    frame.title = button.getAttribute("aria-label");
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    button.replaceWith(frame);
  });
});
// The page's clips play like GIFs while on screen, from the start each time they come into view; a click pauses or
// resumes one.
const onScreen = new IntersectionObserver((entries) => entries.forEach(({target, isIntersecting}) => {
  if (isIntersecting) { target.currentTime = 0; target.play().catch(() => {}); } else target.pause();
}), {threshold: 0.5});
function watchClip(clip) {
  onScreen.observe(clip);
  clip.addEventListener("click", () => { if (clip.paused) clip.play().catch(() => {}); else clip.pause(); });
}
document.querySelectorAll("video.clip").forEach(watchClip);
$("copy-citation").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("bibtex").textContent);
    $("copy-citation").textContent = "Copied";
  } catch {
    $("copy-citation").textContent = "Select the text to copy";
  }
});

// Mean and standard deviation over 5 runs with GPT-5.4, from the NeurIPS 2026 rebuttal: online runs are evaluated on
// regular levels, fixed-data runs on held-out extra levels. A stat is [all accuracy, balanced accuracy, LLM calls],
// each a [mean, sd] pair (null: not reported); a row has one stat per world.
const BABA = ["Baba Is You words", "Baba in Wonderland words"];
const results = [
  {title: "Online learning (by playing)", worlds: BABA, rows: [
    ["WorldCoder", [[.871, .054], [.727, .160], [61.8, 21.5]], [[.542, .113], [.260, .126], [57.6, 5.5]]],
    ["Alice", [[.988, .008], [.990, .004], [19.8, 6.6]], [[.965, .054], [.951, .068], [94.0, 10.4]]],
  ], extra: [["WorldCoder, 100 calls †", null, [[.819, .052], [.658, .131], [100, 0]]]],
   note: "† WorldCoder kept going until the same 100-call cap as Alice instead of stopping early (a diagnostic run)."},
  {title: "Offline learning (given data, tested on new levels)", worlds: BABA, rows: [
    ["GIF-MCTS", [[.853, .046], [.754, .151], [100, 0]], [[.796, .065], [.716, .061], [100, 0]]],
    ["CWM", [[.964, .047], [.934, .058], [100, 0]], [[.845, .051], [.702, .149], [100, 0]]],
    ["Alice", [[1, 0], [1, 0], [21.4, 1.5]], [[.948, .038], [.920, .047], [91.8, 8.8]]],
  ]},
  {title: "ALFWorld: household tasks, online learning", worlds: ["ALFWorld"], rows: [
    ["WorldCoder", [[.702, .077], null, [100, 0]]],
    ["Alice", [[.962, .024], null, [34.4, 7.9]]],
  ]},
];
// Ablations, Baba in Wonderland, learning by playing: [the paper's name, what it changes in Alice, stat]
const ablations = [
  ["Alice", "", [[.965, .054], [.951, .068], [94.0, 10.4]]],
  ["Single-Class", "all past moves in one group", [[.890, .053], [.829, .073], [84.8, 20.9]]],
  ["Root-Class", "groups never split", [[.940, .052], [.906, .071], [80.0, 12.8]]],
  ["BFS", "breadth-first exploration", [[.901, .071], [.854, .105], [86.8, 18.6]]],
  ["w/o r_h", "exploration without novelty", [[.953, .044], [.924, .053], [83.0, 13.5]]],
  ["w/o r_C", "exploration without the rare-group bonus", [[.929, .050], [.890, .062], [87.0, 20.5]]],
];
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
// One panel per setting: a group of bars per world (its name under it), one bar per method, coloured by the method
// (Alice pink, the others greys), with its mean on top and a line for ± one standard deviation over the 5 runs.
const METHOD_CLASS = {Alice: "alice", WorldCoder: "worldcoder", "GIF-MCTS": "gifmcts", CWM: "cwm"};
const WORLD_LABEL = {"Baba Is You words": "Baba Is You", "Baba in Wonderland words": "Baba in Wonderland", ALFWorld: "ALFWorld"};
function barPanel({title, worlds, rows}) {
  const panel = el("figure", "bar-panel"), plot = el("div", "bar-plot");
  worlds.forEach((world, w) => {
    const group = el("div", "bar-group"), bars = el("div", "bar-row"), names = el("div", "bar-names");
    for (const [name, ...stats] of rows) {
      const [mean, sd] = stats[w][world === "ALFWorld" ? 0 : 1], slot = el("div", "bar-slot");
      const bar = el("div", `bar ${METHOD_CLASS[name]}`), spread = el("i", "spread"), value = el("span", "bar-value", `${Math.round(mean * 100)}%`);
      bar.style.height = `${mean * 100}%`;
      spread.style.bottom = `${Math.max(0, mean - sd) * 100}%`;
      spread.style.height = `${(Math.min(1, mean + sd) - Math.max(0, mean - sd)) * 100}%`;
      value.style.bottom = `${Math.min(1, mean + sd) * 100}%`;
      slot.title = `${name}, ${WORLD_LABEL[world]}: ${(mean * 100).toFixed(1)} ± ${(sd * 100).toFixed(1)}%`;
      slot.append(bar, spread, value);
      bars.append(slot);
      names.append(el("span", name === "Alice" ? "bar-name ours" : "bar-name", name));
    }
    group.append(bars, names, el("span", "bar-world", WORLD_LABEL[world]));
    plot.append(group);
  });
  const caption = el("figcaption");
  if (title.startsWith("ALFWorld")) {
    const house = el("img"), link = el("a", "", "ALFWorld"), clip = el("video", "clip alf-clip");
    Object.assign(house, {src: "assets/story/house.png", alt: "", width: 30, height: 27});
    Object.assign(link, {href: "https://alfworld.github.io/", target: "_blank", rel: "noopener"});
    caption.append(house, link, title.slice("ALFWorld".length));
    Object.assign(clip, {src: "assets/story/alfworld.mp4", poster: "assets/story/alfworld.webp", muted: true, loop: true, playsInline: true, preload: "none"});
    clip.setAttribute("aria-label", "An ALFWorld household: the agent opens the fridge and takes out a tomato.");
    watchClip(clip);
    plot.prepend(clip);
  } else caption.textContent = title;
  panel.append(caption, plot);
  return panel;
}
$("result-bars").replaceChildren(...results.map(barPanel));

// The full numbers, as the paper's tables (the ablations only here): Alice's row first; per column the best accuracy
// in bold.
function statsTable(caption, groups, rows, note) {
  const table = el("table"), head = el("thead"), body = el("tbody");
  const columns = groups.flatMap(({label, cols}) => cols.map((col) => ({label, ...col})));
  table.append(el("caption", "", caption));
  if (groups.some(({label}) => label)) {
    const tr = el("tr");
    tr.append(el("th"));
    for (const {label, cols} of groups) { const th = el("th", "group", label || ""); th.colSpan = cols.length * 2; th.scope = "colgroup"; tr.append(th); }
    head.append(tr);
  }
  const tr = el("tr");
  tr.append(el("th", "", "Method"));
  for (const {name} of columns) { const th = el("th", "", name); th.colSpan = 2; tr.append(th); }
  head.append(tr);
  const best = columns.map(({get, higher}) => {
    const values = rows.map(({cells}) => get(cells)?.[0]).filter((v) => v !== undefined);
    return higher ? Math.max(...values) : null;
  });
  for (const {name, ours, cells} of [...rows.filter((r) => r.ours), ...rows.filter((r) => !r.ours)]) {
    const row = el("tr", ours ? "ours" : ""), method = el("th", "", name);
    method.scope = "row";
    row.append(method);
    columns.forEach(({get, scale}, c) => {
      const value = get(cells), mean = el("td", "mean"), sd = el("td", "sd");
      if (!value) mean.textContent = "–";
      else {
        mean.append(el(value[0] === best[c] ? "strong" : "span", "", (value[0] * scale).toFixed(1)));
        sd.textContent = `±${(value[1] * scale).toFixed(1)}`;
      }
      row.append(mean, sd);
    });
    body.append(row);
  }
  table.append(head, body);
  const figure = el("figure", "stats");
  figure.append(table);
  if (note) figure.append(el("figcaption", "", note));
  return figure;
}
const ACC = [{name: "All acc.", scale: 100, higher: true, k: 0}, {name: "Balanced acc.", scale: 100, higher: true, k: 1}, {name: "LLM calls", scale: 1, higher: false, k: 2}];
const worldCols = (w, keys = [0, 1, 2]) => ACC.filter(({k}) => keys.includes(k)).map(({name, scale, higher, k}) => ({name, scale, higher, get: (cells) => cells[w]?.[k]}));
$("result-tables").replaceChildren(
  ...results.map(({title, worlds, rows, extra = [], note}) => statsTable(title,
    worlds.length > 1 ? worlds.map((label, w) => ({label, cols: worldCols(w)})) : [{label: null, cols: worldCols(0, [0, 2])}],
    [...rows, ...extra].map(([name, ...cells]) => ({name, ours: name === "Alice", cells})), note)),
  statsTable("Ablations: Alice with one part changed (Baba in Wonderland, online learning)", [{label: null, cols: worldCols(0)}],
    ablations.map(([name, change, stat]) => ({name: change ? `${name}: ${change}` : name, ours: name === "Alice", cells: [stat]}))),
);

const canvas = $("game-canvas");
const runtime = new Worker(new URL("runtime/worker.js?v=af75306bd354", document.baseURI), {type:"module"});
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
let game = null, busy = false, codeView = "diff", codeShown = "";
let verdicts = new Map(), showGuess = false;  // showGuess: the picked version's guess on the board when no version is right
let autoRunning = false, autoPaused = false, autoTimer = null;
// Sprites boil like the game's: every sprite is a sheet of its frames (assets/sprites/*/NAME.png, the Wonderland
// words included), and one clock picks the frame for all of them.
const SPRITE = 24, TILE = 48, BOIL_MS = 150, ICON_SHEETS = "game-variants-1";
let boil = 0;
const sheets = new Map();
function sheetFor(object, world, aliases) {
  const alias = world === "wonderland" && object.type === "rule_property" ? aliases[object.word] : null;
  // (the object sheets' version: bump it when they are rebuilt, so no browser keeps an older layout of rows)
  const path = object.type === "world_object" ? `assets/sprites/icon/${object.word.toUpperCase()}.png?v=${ICON_SHEETS}` : `assets/sprites/text/${(alias || object.word).toUpperCase()}.png`;
  if (!sheets.has(path)) {
    const img = new Image();
    img.onload = drawAll;
    img.src = path;
    sheets.set(path, img);
  }
  return sheets.get(path);
}
// A thing's sheet has the game's own variants down its rows (its three boil frames across), by the game's kinds:
// things that join up with their own kind and with the map's edge (16 rows: right 1 + up 2 + left 4 + down 8), things
// drawn facing a way (right, up, left, down), characters (each facing's four walking frames, a frame a cell), things
// animated a frame a turn, and things drawn one way only (one row).
const JOINED = new Set(["wall", "water", "lava", "grass", "hedge", "brick", "ice", "pipe", "bog"]);
const FACING = new Set(["skull", "crab", "bolt"]), CHARACTERS = new Set(["baba", "keke", "robot"]), TURNING = new Set(["cog", "bubble"]);
const FACE_ROW = {"facing right": 0, "facing up": 1, "facing left": 2, "facing down": 3};
// The game's drawing layer for each thing (its editor object list); words are 20, above every thing.
const LAYER = {water: 2, lava: 2, bog: 2, tile: 4, ice: 9, brick: 10, grass: 10, flower: 12, bubble: 12, wall: 14, hedge: 14,
  pipe: 14, algae: 15, door: 15, bolt: 16, cog: 16, key: 16, love: 16, pillar: 16, reed: 16, rock: 16, star: 16, crab: 17,
  flag: 17, jelly: 17, robot: 17, skull: 17, baba: 18, keke: 18};
function spriteRow(object, joins, walk) {
  if (object.type !== "world_object") return 0;
  const {word, direction} = object, face = FACE_ROW[direction] ?? 0;
  if (JOINED.has(word)) return joins ? joins(object) : 0;
  if (FACING.has(word)) return face;
  if (CHARACTERS.has(word)) return face * 4 + (walk ? walk(object) : 0);
  if (TURNING.has(word)) return (game?.steps ?? 0) & 3;
  return 0;
}
// Characters stand at their first walking frame when a map starts and step to the next frame with every cell they
// move, as in the game: the frame of each character, by where it stands.
let walkFrames = new Map();
function stepWalkFrames(before, after) {
  const key = (o) => `${o.word}@${o.position}`, stood = new Set((before?.objects || []).map(key)), next = new Map();
  for (const o of after.objects) {
    if (o.type !== "world_object" || !CHARACTERS.has(o.word)) continue;
    if (stood.has(key(o))) { next.set(key(o), walkFrames.get(key(o)) ?? 0); continue; }
    const [dx, dy] = FACE[o.direction] || [0, 0];
    next.set(key(o), ((walkFrames.get(`${o.word}@${o.position[0] - dx},${o.position[1] - dy}`) ?? 0) + 1) & 3);
  }
  walkFrames = next;
}
const walkFrame = (o) => walkFrames.get(`${o.word}@${o.position}`) ?? 0;
// ``joins(object)``: which neighbours a joining thing connects to on the board it is drawn on; ``walk(object)``: a
// character's walking frame.
function drawObject(ctx, object, x, y, world, aliases, joins = null, walk = null) {
  const img = sheetFor(object, world, aliases);
  if (!img.complete || !img.naturalWidth) return;
  const sx = (boil % (img.naturalWidth / SPRITE)) * SPRITE;
  const sy = Math.min(spriteRow(object, joins, walk), img.naturalHeight / SPRITE - 1) * SPRITE;
  ctx.drawImage(img, sx, sy, SPRITE, SPRITE, x, y, TILE, TILE);
}
const exampleDrawers = [];
function drawAll() {
  if (game) drawBoards();
  exampleDrawers.forEach((draw) => draw());
}
setInterval(() => { boil = (boil + 1) % 3; drawAll(); }, BOIL_MS);
// Effects over a board, as the game shows them: sparkles from what is YOU on a win, a puff where a thing is destroyed;
// the game's board has its own, and so has the stage's little level. They animate frame by frame while any is alive.
const effects = {game: [], hero: []}, EFFECT_MS = {spark: 1300, puff: 560};
let animating = false;
function addEffects(board, kind, cells) {
  const t0 = performance.now();
  for (const [x, y] of cells) effects[board].push({kind, x, y, t0});
  if (animating || !cells.length) return;
  animating = true;
  requestAnimationFrame(function tick() {
    drawAll();
    if (Object.values(effects).some((list) => list.length)) requestAnimationFrame(tick); else animating = false;
  });
}
const effectsOn = (board) => (ctx, cell) => {
  const now = performance.now(), list = effects[board];
  for (let i = list.length - 1; i >= 0; i--) {
    const {kind, x, y, t0} = list[i], p = (now - t0) / EFFECT_MS[kind];
    if (p >= 1) { list.splice(i, 1); continue; }
    const [px, py] = cell(x, y), cx = px + TILE / 2, cy = py + TILE / 2, spark = kind === "spark", n = spark ? 12 : 8;
    ctx.fillStyle = spark ? "#ede285" : "#d6d6dc";
    ctx.globalAlpha = 1 - p * p;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (spark ? p * 1.4 : .3);
      const r = TILE * (spark ? .3 + 1.7 * p : .15 + .55 * p), size = Math.round((spark ? 9 : 10) * (1 - p) + 3);
      ctx.fillRect(Math.round(cx + Math.cos(a) * r - size / 2), Math.round(cy + Math.sin(a) * r - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  }
};
// The things a move destroyed: world objects whose count went down, where they were.
function destroyed(before, after) {
  const byWord = (board) => {
    const m = new Map();
    for (const o of board.objects) if (o.type === "world_object") m.set(o.word, [...(m.get(o.word) || []), o.position.join(",")]);
    return m;
  };
  const was = byWord(before), now = byWord(after), gone = [];
  for (const [word, places] of was) {
    const left = now.get(word) || [];
    let missing = places.length - left.length;
    for (const p of places) if (missing > 0 && !left.includes(p)) { gone.push(p.split(",").map(Number)); missing--; }
  }
  return gone;
}
const youCells = (board) => {
  const you = youWords(board);
  return board.objects.filter((o) => o.type === "world_object" && you.has(o.word)).map((o) => o.position);
};
function drawBoards() {
  if (!game) return;
  const prediction = game.comparison?.[game.world];
  const [width, height] = game.board.grid_size;
  const frame = {x0: 0, y0: 0, x1: width - 1, y1: height - 1, width, height};  // always the whole map
  // The board shows the picked version's prediction (the game itself before a move, or when the code returns
  // nothing); where the prediction is wrong, marks say how the game really is: nothing drawn over anything. When no
  // version gets the move right, it shows the game itself with the same marks, and the guess is one click away.
  const shown = (!realView() && prediction?.board) || game.board, diff = prediction?.board ? predictionDiff(game.board, prediction.board) : null;
  drawBoard(canvas, shown, frame, [], game.world, game.aliases, (ctx, cell) => {
    if (diff) drawDiff(ctx, cell, diff);
    effectsOn("game")(ctx, cell);
  }, walkFrame);
}
// What a prediction gets wrong, thing by thing: of each kind of thing, the places only the game has (things the
// prediction lacks) and the places only the prediction has (things the game does not have); and of the things it puts
// in the right place, those it turns the wrong way (the game turns a pushed thing to face the push).
function predictionDiff(real, predicted) {
  const tally = (board) => {
    const m = new Map();
    for (const o of board.objects) {
      const k = `${o.type}:${o.word}@${o.position}`;
      if (!m.has(k)) m.set(k, {object: o, facing: []});
      m.get(k).facing.push(o.direction);
    }
    return m;
  };
  const was = tally(real), now = tally(predicted), lacks = [], extra = [], turned = [];
  for (const k of new Set([...was.keys(), ...now.keys()])) {
    const a = was.get(k)?.facing || [], b = now.get(k)?.facing || [], {object} = was.get(k) || now.get(k);
    for (let i = a.length; i < b.length; i++) extra.push(object);
    for (let i = b.length; i < a.length; i++) lacks.push(object);
    const left = [...b];
    for (const facing of a.slice(0, b.length)) {
      const j = left.indexOf(facing);
      if (j >= 0) left.splice(j, 1);
      else turned.push({object, facing});
    }
  }
  return {lacks, extra, turned, words: [...new Set([...lacks, ...extra].map((o) => o.word.toUpperCase()))],
          turnedWords: [...new Set(turned.map(({object}) => object.word.toUpperCase()))]};
}
const MISS = "#ff5b8a", FACE = {"facing up": [0, -1], "facing right": [1, 0], "facing down": [0, 1], "facing left": [-1, 0]};
// The marks on a shown prediction, saying how the game really is: a cross on a thing the game does not have; a dashed
// frame where the game has a thing the prediction lacks; a dashed frame with a pointer on a thing the game turns
// another way, the pointer showing the way it really faces.
function drawDiff(ctx, cell, {lacks, extra, turned}) {
  const dashed = ([x, y]) => {
    const [px, py] = cell(x, y);
    ctx.strokeStyle = MISS; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.roundRect(px + 3, py + 3, TILE - 6, TILE - 6, 7); ctx.stroke();
    ctx.setLineDash([]);
  };
  ctx.save();
  for (const {position: [x, y]} of extra) {
    const [px, py] = cell(x, y), m = 9;
    ctx.strokeStyle = MISS; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px + m, py + m); ctx.lineTo(px + TILE - m, py + TILE - m);
    ctx.moveTo(px + TILE - m, py + m); ctx.lineTo(px + m, py + TILE - m); ctx.stroke();
  }
  for (const {position} of lacks) dashed(position);
  for (const {object, facing} of turned) {
    dashed(object.position);
    const [dx, dy] = FACE[facing] || [0, 0], [px, py] = cell(...object.position), [cx, cy] = [px + TILE / 2, py + TILE / 2];
    const [tx, ty] = [cx + dx * TILE * .62, cy + dy * TILE * .62];
    ctx.fillStyle = MISS;
    ctx.beginPath(); ctx.moveTo(tx + dx * 9, ty + dy * 9); ctx.lineTo(tx - dy * 8, ty + dx * 8); ctx.lineTo(tx + dy * 8, ty - dx * 8); ctx.fill();
  }
  ctx.restore();
}

// The map's floor is a shade lighter than the panel, so its edge shows. The game shows the whole map; a story's
// close-up cuts it short, and there the floor fades out rather than end in an edge the map does not have.
const PANEL = "#101012", FLOOR = "#18181e";
// ``overlay(ctx, cell)`` draws on top; ``cell(x, y)`` is a grid cell's top-left pixel. ``width`` and ``height`` are
// the map's.
function drawBoard(canvas, board, {x0, y0, x1, y1, width: mapWidth, height: mapHeight}, differingCells, world = "default", aliases = {}, overlay = null, walk = null) {
  const ctx = canvas.getContext("2d");
  const width = (x1 - x0 + 1) * TILE, height = (y1 - y0 + 1) * TILE;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const cell = (x, y) => [(x - x0) * TILE, (y - y0) * TILE];
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = FLOOR; ctx.fillRect(0, 0, width, height);
  const sides = [[x0 === 0, [0, 0, TILE / 2, 0]], [x1 === mapWidth - 1, [width, 0, width - TILE / 2, 0]], [y0 === 0, [0, 0, 0, TILE / 2]],
    [y1 === mapHeight - 1, [0, height, 0, height - TILE / 2]]];
  for (const [edge, [ax, ay, bx, by]] of sides) {
    if (edge) continue;
    const fade = ctx.createLinearGradient(ax, ay, bx, by);
    fade.addColorStop(0, PANEL); fade.addColorStop(1, "rgba(16, 16, 18, 0)");
    ctx.fillStyle = fade; ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax) || width, Math.abs(by - ay) || height);
  }
  // The game's layers: water lowest, words highest; within a layer, the cell's own order (what arrived last on top).
  // What is YOU goes above the other things, so a wrong prediction that puts it inside a thing still shows it.
  const you = youWords(board);
  const layer = (o) => o.type !== "world_object" ? 20 : you.has(o.word) ? 19 : LAYER[o.word];
  const here = new Set(board.objects.filter((o) => o.type === "world_object").map((o) => `${o.word}@${o.position}`));
  const joins = ({word, position: [x, y]}) => [[1, 0, 1], [0, -1, 2], [-1, 0, 4], [0, 1, 8]].reduce((mask, [dx, dy, bit]) => {
    const [nx, ny] = [x + dx, y + dy];
    return nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight || here.has(`${word}@${nx},${ny}`) ? mask | bit : mask;
  }, 0);
  for (const object of [...board.objects].sort((a, b) => layer(a) - layer(b))) drawObject(ctx, object, ...cell(...object.position), world, aliases, joins, walk);
  overlay?.(ctx, cell);
  ctx.strokeStyle = "#ff5b62"; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
  for (const [x, y] of differingCells) { const [px, py] = cell(x, y); ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  ctx.setLineDash([]);
}

// What is YOU (or another property) on a board: the nouns of the rules "NOUN IS YOU", read across and down as the
// game does.
function youWords(board, property = "you") {
  const text = new Map(board.objects.filter((o) => o.type !== "world_object").map((o) => [o.position.join(","), o.word]));
  const at = (x, y) => text.get(`${x},${y}`);
  const words = new Set();
  for (const [key, word] of text) {
    if (word !== "is") continue;
    const [x, y] = key.split(",").map(Number);
    if (at(x + 1, y) === property && at(x - 1, y)) words.add(at(x - 1, y));
    if (at(x, y + 1) === property && at(x, y - 1)) words.add(at(x, y - 1));
  }
  return words;
}
const STEP = {right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1]};
// The examples' marks: the key pressed (an arrow from what is YOU), what a wrong prediction gets wrong (marked as the
// demo marks it: a cross on what the game does not have, a dashed frame where the game has a thing), and the cells a
// fix got right (green).
const marks = {
  arrow: (board, action) => (ctx, cell) => {
    const [dx, dy] = STEP[action];
    const you = youWords(board);
    ctx.fillStyle = ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (const o of board.objects.filter((o) => o.type === "world_object" && you.has(o.word))) {
      const [px, py] = cell(...o.position), cx = px + TILE / 2, cy = py + TILE / 2;
      const [ax, ay, bx, by] = [cx + dx * TILE * .58, cy + dy * TILE * .58, cx + dx * TILE * 1.2, cy + dy * TILE * 1.2];
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + dx * 12, by + dy * 12); ctx.lineTo(bx - dy * 11, by + dx * 11); ctx.lineTo(bx + dy * 11, by - dx * 11); ctx.fill();
    }
  },
  wrong: (actual, predicted) => (ctx, cell) => drawDiff(ctx, cell, predictionDiff(actual, predicted)),
  right: (cells) => (ctx, cell) => {
    ctx.strokeStyle = "#4fd58a"; ctx.lineWidth = 3;
    for (const [x, y] of cells) { const [px, py] = cell(x, y); ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4); }
  },
};
// Each story steps through one picture: the move pressed, the older version's wrong prediction, the newer version's
// right one; the bar under it shows the step, its line says what the picture shows and the code line behind it.
const STORY_MS = 4200;
const STORIES = {
  wall: [
    {shot: "before", text: "Baba presses ↑ under a wall."},
    {shot: "failed", text: "v002 predicts Baba walks into the wall.", code: "obj['position'] = new_position"},
    {shot: "fixed", text: "v003 predicts Baba stays, as in the game.", code: "if _blocked_by_stop(…): continue"},
  ],
  push: [
    {shot: "before", text: "Baba presses → next to two rocks."},
    {shot: "failed", text: "v002 predicts Baba walks onto the rock.", code: "obj['position'] = new_position"},
    {shot: "fixed", text: "v005 predicts the whole chain moves, as in the game.", code: "_attempt_move(blocker, …)"},
  ],
};
const stories = [];
function showStep(story, k) {
  story.step = k;
  story.since = performance.now();
  const {shot, text, code} = STORIES[story.scene][k], verdict = {failed: "no", fixed: "yes"}[shot];
  story.steps.forEach((step) => step.classList.remove("active"));
  void story.steps[k].offsetWidth;  // (a restart: the bar fills again from empty, the same step clicked again too)
  story.steps[k].classList.add("active");
  story.badge.hidden = !verdict;
  story.badge.className = `story-badge ${verdict || ""}`;
  story.badge.textContent = verdict === "no" ? "✗" : "✓";
  story.caption.replaceChildren(el("span", "", text), ...(code ? [el("code", verdict, code)] : []));
  story.draw();
}
setInterval(() => {
  for (const story of stories) if (performance.now() - story.since >= STORY_MS) showStep(story, (story.step + 1) % 3);
}, 200);
async function renderExamples() {
  try {
    const response = await fetch("data/examples.json?v=60a584330560");
    if (!response.ok) throw new Error("Comparison images could not be loaded.");
    const {examples} = await response.json();
    for (const example of examples) {
      const xs = example.failed.cells.map(cell => cell[0]), ys = example.failed.cells.map(cell => cell[1]);
      const [width, height] = example.before.grid_size;
      // The changed cells and one around them, at least three cells each way.
      const span = (lo, hi, size) => {
        let a = Math.max(0, lo - 1), b = Math.min(size - 1, hi + 1);
        while (b - a < 2) { if (a > 0) a--; else if (b < size - 1) b++; else break; }
        return [a, b];
      };
      const [x0, x1] = span(Math.min(...xs), Math.max(...xs), width), [y0, y1] = span(Math.min(...ys), Math.max(...ys), height);
      const frame = {x0, y0, x1, y1, width, height};
      const shots = {
        before: [example.before, [], marks.arrow(example.before, example.action)],
        failed: [example.failed.board, [], marks.wrong(example.actual, example.failed.board)],
        fixed: [example.fixed.board, [], marks.right(example.failed.cells)],
      };
      const card = document.querySelector(`.story[data-case="${example.scene}"]`), canvas = card.querySelector("canvas");
      const story = {scene: example.scene, badge: card.querySelector(".story-badge"), caption: card.querySelector(".story-caption")};
      story.steps = STORIES[example.scene].map((_, k) => {
        const step = el("li"), button = el("button");
        button.setAttribute("aria-label", `Step ${k + 1}`);
        button.addEventListener("click", () => showStep(story, k));
        step.append(button);
        return step;
      });
      card.querySelector(".story-steps").replaceChildren(...story.steps);
      story.draw = () => {
        const [board, cells, overlay] = shots[STORIES[example.scene][story.step].shot];
        drawBoard(canvas, board, frame, cells, "default", {}, overlay);
      };
      stories.push(story);
      exampleDrawers.push(() => story.draw());
      showStep(story, 0);
    }
    $("failure-examples").hidden = false;
    $("example-status").hidden = true;
  } catch (error) {
    $("example-status").textContent = "The comparison images could not load. Reload to try again.";
  }
}

// The prediction's verdict in a few words: the things it gets wrong; when every thing is in place, the way one faces
// (the game turns a pushed thing to face the push), or the win it misses or predicts (a game here ends only in a win:
// DEFEAT removes what is YOU and play goes on).
function verdictText(prediction) {
  if (!prediction) return "make a move";
  if (prediction.error) return "✗ no prediction";
  if (prediction.match) return "✓ same as the game";
  const {words, turnedWords} = predictionDiff(game.board, prediction.board);
  const list = (w) => `${w.slice(0, 3).join(", ")}${w.length > 3 ? ", …" : ""}`;
  if (words.length) return `✗ gets ${list(words)} wrong`;
  if (turnedWords.length) return `✗ ${list(turnedWords)} ${turnedWords.length === 1 ? "faces" : "face"} the wrong way`;
  if (!prediction.terminationMatch) return prediction.board.step?.terminated ? "✗ predicts a win" : "✗ misses the win";
  return "✗ state differs";
}
// No saved version gets the last move right: the latest is picked, and the board shows the game itself unless its
// guess is asked for.
const unsolved = () => Boolean(game?.comparison?.[game.world]) && verdicts.size > 0 && ![...verdicts.values()].some(Boolean);
const realView = () => unsolved() && !showGuess;
function renderComparison() {
  const prediction = game.comparison?.[game.world];
  $("prediction-result").textContent = verdictText(prediction);
  $("board-name").textContent = prediction?.board && !prediction.match && !realView() ? "Prediction" : "Real game";
  $("prediction-result").dataset.match = prediction ? String(prediction.match) : "pending";
  drawBoards();
}

// Alice's code beside the boards. Above it, every saved version as a square: green if that version predicts the last
// move right, red if not. After a move the version that last fixed it is picked; picking another shows its
// prediction on the right (named by its version) and its code. "What changed" is the picked version's difference
// from the one before it, "Full code" the whole file.
// "What changed", read like a review: the changed lines grouped under the function they sit in (a new function
// marked new), added lines green, removed ones red, with the new file's line numbers.
function diffRows(program) {
  const source = program.source.split("\n"), rows = [], functions = new Map();
  const functionAt = (line) => {
    for (let n = line; n >= 1; n--) { const m = /^def (\w+)/.exec(source[n - 1] || ""); if (m) return m[1]; }
    return "top of the file";
  };
  let line = 0, current = null, added = 0, removed = 0, skipped = false;
  for (const text of program.diff.split("\n")) {
    if (text.startsWith("---") || text.startsWith("+++")) continue;
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(text);
    if (hunk) { line = Number(hunk[1]); skipped = rows.length > 0; continue; }
    const kind = text[0] === "+" ? "added" : text[0] === "-" ? "removed" : "context", body = text.slice(1);
    const opens = kind === "added" ? /^def (\w+)/.exec(body) : null, name = opens ? opens[1] : functionAt(Math.max(1, line));
    if (opens) functions.set(name, "new");
    else if (kind !== "context" && !functions.has(name)) functions.set(name, "changed");
    if (name !== current) rows.push({kind: "function", name});
    else if (skipped) rows.push({text: "⋯", kind: "context"});
    current = name;
    skipped = false;
    rows.push({text: body, kind, line: kind === "removed" ? "–" : line});
    if (kind === "added") added++;
    if (kind === "removed") removed++;
    if (kind !== "removed") line++;
  }
  for (const row of rows) if (row.kind === "function") Object.assign(row, {text: row.name, fresh: functions.get(row.name) === "new"});
  diffRows.changes = {added, removed, functions};
  // a function whose lines only show as context around a change elsewhere is left out
  let shown = true;
  const changed = rows.filter((row) => (shown = row.kind === "function" ? functions.has(row.name) : shown));
  return changed;
}
// The code box's head: beside its tabs, how many lines the picked version added and removed (or, for the full code,
// how long it is); under them, in "What changed", the functions it changed and the ones it added. A function's name
// jumps the code to it, and the one in view is marked as the code scrolls.
function renderChanges() {
  const changes = $("code-changes"), counts = $("code-counts"), program = game.program;
  changes.hidden = codeView !== "diff";
  if (codeView !== "diff") { counts.replaceChildren(`${program.lines} lines`); return; }
  const {added, removed, functions} = diffRows.changes;
  counts.replaceChildren(el("span", "add", `+${added}`), el("span", "del", `−${removed}`));
  const groups = ["changed", "new"].map((how) => {
    const names = [...functions].filter(([, kind]) => kind === how).map(([name]) => name);
    if (!names.length) return null;
    const group = el("div", `fn-group ${how}`), list = el("span", "fns");
    list.append(...names.map((name) => { const chip = el("button", "fn", name); chip.dataset.fn = name; return chip; }));
    group.append(el("span", "fn-label", how), list);
    return group;
  }).filter(Boolean);
  changes.replaceChildren(...groups);
}
function markFunctionInView() {
  const pre = $("program-source").parentElement, top = pre.getBoundingClientRect().top + 24;
  let inView = null;
  for (const row of pre.querySelectorAll(".source-line[data-fn]")) {
    if (inView && row.getBoundingClientRect().top > top) break;
    inView = row.dataset.fn;
  }
  for (const chip of $("code-changes").querySelectorAll("button[data-fn]")) chip.setAttribute("aria-current", String(chip.dataset.fn === inView));
}
function renderCode() {
  const program = game.program;
  codeShown = `${game.world}/${program.version}`;
  const rows = codeView === "diff" ? diffRows(program) : program.source.split("\n").map((text, i) => ({text, line: i + 1}));
  renderChanges();
  $("program-source").replaceChildren(...rows.map(({text, line, kind, name, fresh}) => {
    const span = el("span", kind ? `source-line ${kind}` : "source-line", text || " ");
    if (line) span.dataset.line = line;
    const indent = (text || "").length - (text || "").trimStart().length;  // a wrapped line continues past its own indent
    if (indent) span.style.setProperty("--indent", `${indent}ch`);
    if (kind === "function") { span.dataset.fn = name; if (fresh) span.append(el("b", "", "new")); }
    return span;
  }));
  const pre = $("program-source").parentElement;
  pre.scrollLeft = 0;
  pre.scrollTop = 0;
  markFunctionInView();
  $("copy-program").classList.remove("copied");
}
function renderStrip() {
  const strip = $("versions");
  if (strip.dataset.world !== game.world || strip.children.length !== game.versions.length) {
    strip.dataset.world = game.world;
    strip.dataset.first = game.versions[0];
    strip.dataset.last = game.versions.at(-1);
    strip.replaceChildren(...game.versions.map((version, k) => {
      const button = el("button");
      button.dataset.version = version;
      button.style.setProperty("--at", k / Math.max(game.versions.length - 1, 1));  // its place in the wave, 0 to 1
      return button;
    }));
  }
  // the picked square again, big, right above the code (its version ringed green or red, and its verdict), and on
  // the prediction it makes
  let before;
  const picked = game.program.version;
  for (const button of strip.children) {
    const version = button.dataset.version, verdict = verdicts.get(version);
    // a version that gets the move right right after one that got it wrong: where the code was fixed, named
    const fixed = verdict === true && before === false;
    const state = verdict === undefined ? "" : verdict ? (fixed ? "fixed" : "right") : "wrong";
    button.className = fixed ? "right fixed" : state;
    button.dataset.tag = fixed ? version : "";
    button.title = verdict === undefined ? version : `${version}: ${verdict ? "right" : "wrong"} on this move`;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(version === picked));
    if (version === picked) {
      for (const badge of [$("code-version"), $("predict-version")]) {
        badge.textContent = version;
        badge.dataset.verdict = state || "pending";
      }
      $("code-verdict").textContent = unsolved() ? "no version gets this move right yet" : {fixed: "fixes this move", right: "right on this move", wrong: "wrong on this move"}[state] || "";
    }
    before = verdict;
  }
  // Before and after the fix, one click apart: on the version that fixed this move, a way to the one just before it
  // (wrong); on that one, the way back. Elsewhere nothing.
  const k = game.versions.indexOf(picked), flip = $("fix-flip"), previous = game.versions[k - 1], next = game.versions[k + 1];
  const fixedHere = (v, w) => verdicts.get(v) === true && verdicts.get(w) === false;
  // When no version gets the move right, the same pill turns between the game and the picked version's guess.
  const to = unsolved() ? (showGuess ? "game" : "guess") : fixedHere(picked, previous) ? previous : fixedHere(next, picked) ? next : null;
  flip.hidden = !to;
  if (to && flip.dataset.version !== to) {
    flip.dataset.version = to;
    flip.textContent = {guess: `↷ ${picked}'s guess`, game: "↶ real game"}[to] || (to === previous ? `↶ ${to} before the fix` : `↷ ${to} after the fix`);
  }
  if (!to) delete flip.dataset.version;
}
// The verdicts sweep in as a wave, from the first saved version to the latest (the pick already made); the wave takes
// the same 0.15 s however many versions there are.
function wave() {
  const strip = $("versions");
  strip.classList.remove("wave");
  void strip.offsetWidth;
  strip.classList.add("wave");
}
// The moves so far: one token per move with its arrow, its bar green where the picked version of the code predicted it
// right and red where not; a new pick recolours the whole record.
// A drawn arrow (or a dot for waiting), rotated for the move.
const TURN = {up: 0, right: 90, down: 180, left: 270};
function arrowIcon(action) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", action === "idle" ? "circle" : "path");
  if (action === "idle") { shape.setAttribute("cx", "12"); shape.setAttribute("cy", "12"); shape.setAttribute("r", "3"); }
  else { shape.setAttribute("d", "M12 4 19 12h-4.5v8h-5v-8H5z"); shape.setAttribute("transform", `rotate(${TURN[action]} 12 12)`); }
  svg.append(shape);
  return svg;
}
let trailToken = 0, trailShown = [];
async function refreshTrail() {
  const token = ++trailToken;
  try {
    const {trail} = await runtimeRequest("/trail");
    if (token !== trailToken) return;
    trailShown = trail;
    renderTrail();
  } catch { /* the record stays as it was */ }
}
// One row: the newest moves that fit; older ones leave from the left (again whenever the row's width changes).
function renderTrail() {
  const box = $("trail");
  box.replaceChildren(...trailShown.map(({action, match}, k) => {
    const move = el("li", match ? "right" : "wrong");
    move.append(arrowIcon(action));
    move.title = `Step ${k + 1}: ${action === "idle" ? "stay" : action}, ${match ? "right" : "wrong"} in ${game.program.version}`;
    return move;
  }));
  while (box.children.length > 1 && box.scrollWidth > box.clientWidth) box.firstElementChild.remove();
}
new ResizeObserver(renderTrail).observe($("trail"));
// What the board itself shows instead of instructions: before the first move, a swipe hint on a touch screen, and on
// the maps below the keys they first need (the first map's over the middle of the board); WIN
// when won (and the ways on); the way back (undo, restart) when an attempt has ended.
// The map after this one (the first after the last).
function nextMap() {
  const k = game.maps.findIndex(({id}) => id === game.map);
  return {id: game.maps[(k + 1) % game.maps.length].id, first: k + 1 === game.maps.length};
}
// The keys a map first needs, said before its first move: moving on the first map, and staying where things first move
// on their own (on a touch screen, the map's own words replace the swipe hint).
const START_SIGNS = {
  make_a_way: {middle: true, keys: ["Use your keyboard (arrows or WASD)", "or click the controls below"]},
  lobster_errand: {keys: ["Space or Stay waits a turn while things move"], touch: "Tap Stay to wait a turn while things move"},
};
function renderOverlay() {
  const overlay = $("game-overlay");
  // an end's ways on: buttons that say their key (a click or a tap does what the key does)
  const ways = (pairs) => {
    const row = el("span", "keys");
    for (const [key, label, sign] of pairs) {
      const button = el("button", "sign-key");
      button.dataset.sign = sign;
      button.append(el("kbd", "", key), el("span", "key-label", label));
      row.append(button);
    }
    return row;
  };
  // a win, said in the game's letters: YOU WIN!, each word popping out after the one before, then a burst of pixel
  // sparks from behind them (WIN's yellow, YOU's pink, white)
  const youWin = () => {
    const words = el("span", "you-win"), burst = el("span", "burst");
    for (const word of ["YOU", "WIN", "EXCLAIM"]) {
      const tile = el("i", word === "EXCLAIM" ? "tile bang" : "tile");
      tile.style.backgroundImage = `url(assets/sprites/title/${word}.png)`;
      words.append(tile);
    }
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + (k % 3) * .13, r = 70 + (k * 37) % 70, spark = el("i");
      spark.style.cssText = `--x:${(Math.cos(a) * r * 1.7).toFixed(1)}px;--y:${(Math.sin(a) * r).toFixed(1)}px;--s:${8 + (k % 3) * 3}px;--c:${["#ede285", "#d9396a", "#fff"][k % 3]}`;
      burst.append(spark);
    }
    words.prepend(burst);
    return words;
  };
  // an end's signs on one card over the board, apart from its words and walls
  const card = (...parts) => {
    const box = el("div", "sign-card");
    box.append(...parts);
    return box;
  };
  // The board shows the picked version's prediction, so its win is the one shown (a game here ends only in a win);
  // the way back appears only when the game itself is over.
  const prediction = game.comparison?.[game.world];
  const shownWon = prediction?.board && !realView() ? Boolean(prediction.board.step?.terminated) : game.won;  // the board shown decides
  let state = "", parts = [];
  if (shownWon) {
    state = "won";
    parts = [card(youWin(), ...(game.won ? [ways([["R", "play again", "restart"], ["N", nextMap().first ? "first map" : "next map", "next"]])] : []))];
  } else if (game.ended && !game.won) {
    state = "ended";
    parts = [card(ways([["Z", "undo", "undo"], ["R", "restart", "restart"]]))];
  } else if (game.steps === 0 && !autoRunning) {
    const sign = START_SIGNS[game.map];
    state = sign?.middle ? "intro" : "start";
    parts = [el("span", "swipe-hint", sign?.touch || "Swipe to move")];  // (on a touch screen only)
    if (sign) {  // (elsewhere)
      const hint = el("span", "key-hint");
      hint.append(el("strong", "", sign.keys[0]), ...sign.keys.slice(1).map((line) => el("span", "", line)));
      parts.push(hint);
    }
  }
  overlay.dataset.state = state;
  overlay.replaceChildren(...parts);
}

function renderVersions() {
  document.querySelectorAll("[data-world]").forEach(button => button.setAttribute("aria-pressed",String(button.dataset.world === game.world)));
  if (codeShown !== `${game.world}/${game.program.version}`) renderCode();
  renderStrip();
  if ($("map-select").options.length !== game.maps.length) $("map-select").replaceChildren(...game.maps.map((map, i) => new Option(`${i + 1} · ${map.label}`, map.id)));
  $("map-select").value = game.map;
  $("map-objective").textContent = game.objective;
}

function setControls() {
  document.querySelectorAll("[data-action]").forEach((button) => { button.disabled = busy || autoRunning || !game || game.ended; });
  $("undo").disabled = busy || autoRunning || !game?.canUndo;
  $("restart").disabled = busy || autoRunning || !game;
  document.querySelectorAll("[data-world]").forEach(button => { button.disabled = busy || autoRunning || !game; });
  $("map-select").disabled = busy || autoRunning || !game;
  $("auto-play").disabled = !autoRunning && (busy || !game);
  const [icon, label] = autoRunning ? ["■", ` ${game.steps} / ${game.solution.length}`] : autoPaused ? ["▶", " Continue"] : ["▶", " Shortest Solve"];
  $("auto-play").replaceChildren(el("span", "", icon), el("span", "label", label));  // (a phone shows the icon only)
  $("auto-play").title = autoPaused ? "Continue the shortest solution from this step" : "Replay the shortest solution from step 0";
  $("auto-play").setAttribute("aria-pressed", String(autoRunning));
  $("copy-program").disabled = !game;
  $("game-shell").setAttribute("aria-busy", String(busy));
}
function renderGame() {
  $("step-count").textContent = game.steps;
  $("step-unit").textContent = `/ ${game.maxSteps} steps`;
  $("board-message").hidden = true;
  renderVersions(); renderComparison(); renderOverlay(); setControls();
}
// The version that last fixed a move: the first of the latest run of versions that get it right (the one after the
// last version that got it wrong); none if no version gets it right.
function lastFix(judged) {
  let k = judged.findLastIndex(({match}) => match);
  if (k < 0) return null;
  while (k > 0 && judged[k - 1].match) k--;
  return judged[k].version;
}
// One request to the runtime and what follows from it. After a request that leaves a last move to judge (a move, an
// undo, a world switch), every version's verdict on it is fetched and the version that last fixed it is picked (its
// code and its prediction shown) before the strip's wave plays; a picked square only changes the pick.
async function gameRequest(path = "", body) {
  if (busy) return;
  if (!autoRunning && ["/action", "/reset", "/undo"].includes(path)) autoPaused = false;
  busy = true; setControls();
  const before = game;
  try {
    let next = await runtimeRequest(path, body), judged = null;
    if (path !== "/version") {
      judged = next.comparison ? (await runtimeRequest("/verdicts")).verdicts : [];
      const pick = lastFix(judged) || (judged.length ? next.versions.at(-1) : null);  // none right: the latest
      if (pick && pick !== next.program.version) next = await runtimeRequest("/version", {version: pick});
      showGuess = false;
      verdicts = new Map(judged.map(({version, match}) => [version, match]));
    }
    if (["/action", "/undo"].includes(path)) stepWalkFrames(before?.board, next.board);
    else if (path === "/reset" || !before) walkFrames = new Map();  // a new start: everyone stands
    game = next; renderGame();
    if (path === "/action") {
      addEffects("game", "puff", destroyed(before.board, game.board));
      if (game.won && !before.won) addEffects("game", "spark", youCells(game.board));
    }
    if (judged?.length && !autoRunning) wave();
    refreshTrail();
    return true;
  } catch (error) {
    $("board-message").hidden = false;
    $("board-message").textContent = game ? error.message : "The interactive demo could not load. Reload to try again.";
    return false;
  } finally { busy=false; setControls(); }
}

function stopAuto() {
  autoRunning = false; autoPaused = false;
  clearTimeout(autoTimer); autoTimer = null;
  setControls();
  if (game) renderOverlay();
}
function scheduleAuto() {
  if (!autoRunning) return;
  if (game.ended || game.steps >= game.solution.length) { stopAuto(); return; }
  autoTimer = setTimeout(async () => {
    autoTimer = null;
    if (!autoRunning) return;
    if (!await gameRequest("/action", {action:game.solution[game.steps]})) { stopAuto(); return; }
    if (!autoRunning) return;
    if (!game.ended && !game.comparison[game.world].match) {  // no saved version explains this move: a pause on it
      autoRunning = false; autoPaused = true;
      renderGame();
      wave();
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
// A changed menu lets go of the keys at once, so the next arrow key moves Baba instead of the menu's choice.
$("fix-flip").addEventListener("click", () => {
  const to = $("fix-flip").dataset.version;
  $("fix-flip").blur();
  if (to === "guess" || to === "game") { showGuess = to === "guess"; renderStrip(); renderComparison(); renderOverlay(); }
  else gameRequest("/version", {version: to});
});
$("versions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-version]");
  if (button) { button.blur(); gameRequest("/version", {version: button.dataset.version}); }
});
$("code-changes").addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-fn]");
  if (!chip) return;
  chip.blur();
  const pre = $("program-source").parentElement, row = pre.querySelector(`.source-line[data-fn="${chip.dataset.fn}"]`);
  pre.scrollTo({top: pre.scrollTop + row.getBoundingClientRect().top - pre.getBoundingClientRect().top - 8, behavior: "smooth"});
});
$("program-source").parentElement.addEventListener("scroll", markFunctionInView, {passive: true});
$("map-select").addEventListener("change", () => { $("map-select").blur(); gameRequest("/reset",{map:$("map-select").value}); });
document.querySelectorAll("[data-code-view]").forEach(button => button.addEventListener("click", () => {
  codeView = button.dataset.codeView;
  document.querySelectorAll("[data-code-view]").forEach(other => other.setAttribute("aria-pressed",String(other===button)));
  renderCode();
}));
$("copy-program").addEventListener("click", async () => {
  const button = $("copy-program");
  button.blur();
  try {
    await navigator.clipboard.writeText(game.program.source);
    button.classList.add("copied");  // (a tick for a moment)
    setTimeout(() => button.classList.remove("copied"), 1400);
  } catch { button.title = "Copying failed: open Full code and copy it by hand"; }
});
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  button.blur();
  gameRequest("/action",{action:button.dataset.action});
}));
$("undo").addEventListener("click", () => gameRequest("/undo",{}));
$("game-overlay").addEventListener("click", (event) => {
  const sign = event.target.closest("[data-sign]")?.dataset.sign;
  if (!sign || busy || autoRunning) return;
  gameRequest(...{undo: ["/undo", {}], restart: ["/reset", {map: game.map}], next: ["/reset", {map: nextMap().id}]}[sign]);
});
$("restart").addEventListener("click", () => gameRequest("/reset",{map:game.map}));
// The keys play the game while the pointer is on it, or after a click (or Tab) into it until one elsewhere; they then
// never scroll the page or move between its controls.
// On a touch screen the board itself takes moves: a swipe moves Baba that way.
let swipeFrom = null;
canvas.addEventListener("pointerdown", (event) => { swipeFrom = event.pointerType === "mouse" ? null : [event.clientX, event.clientY]; });
canvas.addEventListener("pointercancel", () => { swipeFrom = null; });
canvas.addEventListener("pointerup", (event) => {
  if (!swipeFrom) return;
  const dx = event.clientX - swipeFrom[0], dy = event.clientY - swipeFrom[1];
  swipeFrom = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24 || busy || autoRunning || !game || game.ended) return;
  gameRequest("/action", {action: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")});
});
const shell = $("game-shell");
let pointerOn = false, clickedIn = false;
const keysOn = () => pointerOn || clickedIn;
const showKeys = () => shell.classList.toggle("keys-on", keysOn());
shell.addEventListener("pointerenter", () => { pointerOn = true; showKeys(); });
shell.addEventListener("pointerleave", () => { pointerOn = false; showKeys(); });
document.addEventListener("pointerdown", (event) => { clickedIn = shell.contains(event.target); showKeys(); });
shell.addEventListener("focusin", () => { clickedIn = true; showKeys(); });
const ACTIONS = {arrowup:"up",w:"up",arrowright:"right",d:"right",arrowdown:"down",s:"down",arrowleft:"left",a:"left"," ":"idle"};
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!keysOn() || !game || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.("select")) return;
  if (!ACTIONS[key] && !["r", "z", "n"].includes(key)) return;
  event.preventDefault();
  if (shell.contains(document.activeElement)) document.activeElement.blur();
  if (event.repeat || busy || autoRunning) return;
  if (key === "z" && game.canUndo) gameRequest("/undo",{});
  else if (key === "r") gameRequest("/reset",{map:game.map});
  else if (key === "n" && game.won) gameRequest("/reset",{map:nextMap().id});
  else if (ACTIONS[key] && !game.ended) gameRequest("/action",{action:ACTIONS[key]});
});
// The stage's little level, played as the game plays it: Baba pushes FLAG IS against WIN (the rule lights up with a
// pop); then the board goes to Wonderland: YOU and WIN tremble and pop into their new words (STRANGE, SHRINK), and
// Baba, the same game under new words, steps down and walks to the flag, one tile a step with a hop; on the flag, the
// win's sparkles and happy hops; then it starts over in the original words. The canvas has a tile of room around the
// level for the sparkles.
(function heroLevel() {
  const canvas = $("hero-walk"), ctx = canvas.getContext("2d");
  const LEVEL = [
    {type: "world_object", word: "baba", position: [0, 0]}, {type: "rule_noun", word: "flag", position: [1, 0]},
    {type: "rule_operator", word: "is", position: [2, 0]}, {type: "rule_property", word: "win", position: [4, 0]},
    {type: "world_object", word: "flag", position: [8, 1]}, {type: "rule_noun", word: "baba", position: [6, 0]},
    {type: "rule_operator", word: "is", position: [7, 0]}, {type: "rule_property", word: "you", position: [8, 0]},
  ];
  const BABA = 0, MADE = [1, 2, 3], FLAG = 4, ALWAYS = [5, 6, 7], NEW_WORDS = [3, 7];  // (indices into LEVEL)
  const MOVES = ["right", "down", "right", "right", "right", "right", "right", "right", "right"];
  const STEP_MS = 240, SLIDE_MS = 110, START_MS = 450, RULE_MS = 350, TREMBLE_MS = 500, POP_MS = 250;
  const WIN_MS = 1000, FADE_MS = 300;
  let aliases = null;  // the Wonderland words (data/aliases.json); until they load, the level stays in the original ones
  fetch("data/aliases.json").then((r) => r.json()).then((a) => { aliases = a; }).catch(() => {});
  // every state, one per move: Baba moves a tile, pushing the words in front of it (a flag is not pushed)
  const states = [LEVEL];
  for (const move of MOVES) {
    const now = states.at(-1).map((o) => ({...o, position: [...o.position]})), [dx, dy] = STEP[move];
    const at = (x, y) => now.find((o) => o.type !== "world_object" && o.position[0] === x && o.position[1] === y);
    const baba = now[BABA], chain = [];
    for (let x = baba.position[0] + dx, y = baba.position[1] + dy, o; (o = at(x, y)); x += dx, y += dy) chain.push(o);
    for (const o of [baba, ...chain]) o.position = [o.position[0] + dx, o.position[1] + dy];
    states.push(now);
  }
  // the moves' start times: after the first (the push), a pause as the rule lights up, then the trip to Wonderland
  const tremble = START_MS + STEP_MS + RULE_MS, pop = tremble + TREMBLE_MS;
  const begin = MOVES.map((_, k) => START_MS + k * STEP_MS + (k > 0 ? RULE_MS + TREMBLE_MS + POP_MS : 0));
  const won = begin.at(-1) + SLIDE_MS, CYCLE = begin.at(-1) + STEP_MS + WIN_MS + FADE_MS;
  const cell = (x, y) => [(x + 1) * TILE, (y + 1) * TILE];
  const t0 = performance.now();
  let shown = true, cycle = -1, popped = false, sparked = false;
  new IntersectionObserver(([entry]) => { shown = entry.isIntersecting; }).observe(canvas);
  requestAnimationFrame(function frame(now) {
    requestAnimationFrame(frame);
    if (!shown) return;
    const elapsed = now - t0, t = elapsed % CYCLE;
    if (Math.floor(elapsed / CYCLE) !== cycle) { cycle = Math.floor(elapsed / CYCLE); popped = sparked = false; }
    const k = begin.findLastIndex((b) => t >= b), u = k < 0 ? 0 : Math.min(1, (t - begin[k]) / SLIDE_MS);
    const from = states[k < 0 ? 0 : k], to = states[k < 0 ? 0 : k + 1], e = 1 - (1 - u) ** 3;
    const lit = t >= begin[0] + SLIDE_MS;
    const litPop = lit ? .18 * Math.sin(Math.PI * Math.min(1, (t - begin[0] - SLIDE_MS) / 260)) : 0;
    const wonder = Boolean(aliases) && t >= pop, shaking = aliases && t >= tremble && t < pop;
    const wonderPop = wonder ? .35 * Math.sin(Math.PI * Math.min(1, (t - pop) / POP_MS)) : 0;
    if (wonder && !popped) { popped = true; addEffects("hero", "puff", NEW_WORDS.map((j) => to[j].position)); }
    if (t >= won && !sparked) { sparked = true; addEffects("hero", "spark", [to[BABA].position]); }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1 - Math.min(1, Math.max(0, t - (CYCLE - FADE_MS)) / FADE_MS);
    const place = (j) => {
      const a = from[j].position, b = to[j].position;
      return cell(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e);
    };
    // the flag and the words (dim until they form a rule, as the game shows them; the words that change tremble,
    // harder as it nears, then pop), then Baba: a hop each step, a squash as it lands, and on the flag happy hops
    for (const j of [FLAG, ...MADE, ...ALWAYS]) {
      let [x, y] = place(j), grow = MADE.includes(j) ? litPop : 0;
      if (NEW_WORDS.includes(j)) {
        if (shaking) {
          const s = 1 + 3 * (t - tremble) / TREMBLE_MS;
          x += s * Math.sin(t * .11 + j); y += s * Math.sin(t * .17 + 2 * j);
        }
        grow += wonderPop;
      }
      ctx.save();
      if (MADE.includes(j) && !lit) ctx.globalAlpha *= .45;
      ctx.translate(x + TILE / 2, y + TILE / 2);
      ctx.scale(1 + grow, 1 + grow);
      drawObject(ctx, to[j], -TILE / 2, -TILE / 2, wonder ? "wonderland" : "default", aliases || {});
      ctx.restore();
    }
    const landed = k < 0 ? 1 : (t - begin[k] - SLIDE_MS) / 90, happy = t >= won ? (t - won) / 480 : 0;
    const lift = k >= 0 && u < 1 ? 7 * Math.sin(Math.PI * u) : happy > 0 && happy < 2 ? 12 * Math.abs(Math.sin(Math.PI * happy)) : 0;
    const squash = landed > 0 && landed < 1 ? .1 * Math.sin(Math.PI * landed) : 0;
    const [bx, by] = place(BABA);
    ctx.save();
    ctx.translate(bx + TILE / 2, by + TILE - lift);
    ctx.scale(1 + squash, 1 - squash);
    drawObject(ctx, to[BABA], -TILE / 2, -TILE, "default", {}, null, () => (k + 1) & 3);  // a walking frame a step
    ctx.restore();
    effectsOn("hero")(ctx, cell);
    ctx.globalAlpha = 1;
  });
})();
gameRequest();
renderExamples();
