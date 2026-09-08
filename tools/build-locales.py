"""Compile the reviewed local catalog; fail if any source string is missing."""
import json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'site/locales'
language=sys.argv[1] if len(sys.argv)>1 else 'kk'
assert language in ('kk','en')
c=json.loads((root/(language+'.json')).read_text());c.update(json.loads((root/(language+'-overrides.json')).read_text()))
missing=[s for s in json.loads((root/'ru-source.json').read_text()) if s not in c]
if missing:raise ValueError('Missing translations: '+repr(missing[:8]))
(root/(language+'.json')).write_text(json.dumps(c,ensure_ascii=False,indent=2));(root/(language+'.js')).write_text('window.'+language.upper()+'_MESSAGES = '+json.dumps(c,ensure_ascii=False)+';\n')
print('Compiled',len(c),'local translations')
