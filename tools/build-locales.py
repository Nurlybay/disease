"""Compile the reviewed local catalog; fail if any source string is missing."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'site/locales'
c=json.loads((root/'kk.json').read_text());c.update(json.loads((root/'kk-overrides.json').read_text()))
missing=[s for s in json.loads((root/'ru-source.json').read_text()) if s not in c]
if missing:raise ValueError('Missing translations: '+repr(missing[:8]))
(root/'kk.json').write_text(json.dumps(c,ensure_ascii=False,indent=2));(root/'kk.js').write_text('window.KK_MESSAGES = '+json.dumps(c,ensure_ascii=False)+';\n')
print('Compiled',len(c),'local translations')
