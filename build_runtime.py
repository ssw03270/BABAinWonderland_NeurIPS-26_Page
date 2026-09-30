"""Build the deterministic browser bundle using only files in this repository."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from hashlib import sha256
import re

ROOT = Path(__file__).resolve().parent
files = [ROOT / "runtime/game.py", ROOT / "runtime/provenance.json"]
for folder, pattern in (("runtime/vendor", "*.py"), ("runtime/wheels", "*.whl"), ("programs", "*.py"), ("data", "*"), ("tests", "*")):
    files.extend(path for path in (ROOT / folder).rglob(pattern) if path.is_file() and "__pycache__" not in path.parts and path.suffix not in (".html", ".js"))
with ZipFile(ROOT / "runtime/bundle.zip", "w", compression=ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in sorted(files):
        info = ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        bundle.writestr(info, path.read_bytes())
# Update dependencies first so a new page cannot reuse an older cached runtime.
for target, reference, asset in (
    ("runtime/worker.js", "./bundle.zip", "runtime/bundle.zip"),
    ("app.js", "runtime/worker.js", "runtime/worker.js"),
    ("app.js", "data/examples.json", "data/examples.json"),
    ("tests/browser.html", "../runtime/worker.js", "runtime/worker.js"),
    ("index.html", "styles.css", "styles.css"),
    ("index.html", "app.js", "app.js"),
):
    path = ROOT / target
    version = sha256((ROOT / asset).read_bytes()).hexdigest()[:12]
    pattern = re.escape(reference.encode()) + rb"(?:\?v=[a-f0-9]+)?(?=[\"'])"
    content, count = re.subn(pattern, f"{reference}?v={version}".encode(), path.read_bytes())
    if count != 1:
        raise ValueError(f"Expected one {reference} reference in {target}; found {count}")
    path.write_bytes(content)
print(f"Bundled {len(files)} files ({(ROOT / 'runtime/bundle.zip').stat().st_size:,} bytes)")
