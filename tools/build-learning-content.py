import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
files=[p for p in (root/'site/characters').glob('*.js') if p.name not in ('manifest.js','loader.js')]
files += [root/'site'/f for f in ['teacher.js','constructor.js','media-studio.js','clinical-media.js','media-lab.js']]
data={str(p.relative_to(root/'site')):p.read_text() for p in files}
(root/'supabase/functions/learning-content/content.json').write_text(json.dumps(data,ensure_ascii=False))
