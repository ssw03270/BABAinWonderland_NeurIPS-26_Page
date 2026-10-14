// The original Python engine and programs run in this tab's private worker.
const ready = (async () => {
  // Python with NumPy (the only package the game needs) and the game files download side by side.
  const [pyodide, bundle] = await Promise.all([
    import("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs").then(({loadPyodide}) => loadPyodide({packages:["numpy"]})),
    fetch(new URL("./bundle.zip?v=f29db3a83d82", import.meta.url)).then((response) => {
      if (!response.ok) throw new Error("The game files could not be downloaded.");
      return response.arrayBuffer();
    }),
  ]);
  self.postMessage({status:"Preparing the game and saved programs…"});
  pyodide.unpackArchive(bundle, "zip", {extractDir:"/app"});
  pyodide.runPython(`
import json, sys, zipfile
from pathlib import Path
for wheel in Path('/app/runtime/wheels').glob('*.whl'):
    with zipfile.ZipFile(wheel) as archive:
        archive.extractall('/app/site-packages')
sys.path[:0] = ['/app', '/app/site-packages']
from runtime.game import create_game
dispatch = create_game()
def handle(request):
    request = json.loads(request)
    return json.dumps(dispatch(request['path'], request.get('body')))
`);
  return {pyodide, handle:pyodide.globals.get("handle"), prepare:pyodide.globals.get("dispatch").prepare};
})();
// While the worker is idle, it compiles the saved programs one per task, so a request waits for one at most (a request
// that needs a program sooner compiles it itself). A message channel starts each next task: unlike a timer, it is not
// slowed down in a background tab.
ready.then(({prepare}) => {
  const {port1, port2} = new MessageChannel();
  port1.onmessage = () => { if (prepare()) port2.postMessage(null); };
  port2.postMessage(null);
}, () => {});  // (each request reports a failed start)

self.onmessage = async ({data}) => {
  try {
    const {pyodide, handle} = await ready;
    const result = data.path === "/verify"
      ? pyodide.runPython("import runpy; runpy.run_path('/app/tests/verify_runtime.py')['verify']()")
      : JSON.parse(handle(JSON.stringify(data)));
    self.postMessage({id:data.id, result});
  } catch (error) {
    self.postMessage({id:data.id, error:error.message});
  }
};
