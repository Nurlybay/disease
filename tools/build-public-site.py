"""Build Pages without protected case/teacher/workshop scripts."""
import json,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'.public-site'
if out.exists():shutil.rmtree(out)
shutil.copytree(root/'site',out)
for rel,source in json.loads((root/'supabase/functions/learning-content/content.json').read_text()).items():
 if (root/'site'/rel).read_text()!=source:raise SystemExit('Regenerate and deploy learning-content before publishing: '+rel)
 p=out/rel
 if p.exists():p.unlink()
print('Public site built; protected scripts are served by learning-content.')
