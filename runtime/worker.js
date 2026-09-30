// The original Python engine and programs run in this tab's private worker.
const ready = (async () => {
  const { loadPyodide } = await import("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs");
  const pyodide = await loadPyodide();
  self.postMessage({status:"Preparing the game and saved programs…"});
  const [response] = await Promise.all([
    fetch(new URL("./bundle.zip?v=1b3d5b90a6d4", import.meta.url)),
    pyodide.loadPackage(["numpy", "pyyaml", "opencv-python"]),
  ]);
  if (!response.ok) throw new Error("The game files could not be downloaded.");
  pyodide.unpackArchive(await response.arrayBuffer(), "zip", {extractDir:"/app"});
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
  return {pyodide, handle:pyodide.globals.get("handle")};
})();

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
