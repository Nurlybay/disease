import json,re
from html.parser import HTMLParser
from pathlib import Path
texts=set()
class P(HTMLParser):
 def handle_data(self,s):
  s=' '.join(s.split())
  if re.search('[а-яё]',s,re.I): texts.add(s)
 def handle_starttag(self,t,attrs):
  for k,v in attrs:
   if k in ('title','placeholder','aria-label','alt') and v and re.search('[а-яё]',v,re.I):texts.add(' '.join(v.split()))
for s in json.load(open('/tmp/disease-locale-raw.json')):
 if '<' in s and '>' in s:
  P().feed(s)
 else:texts.add(s)
for p in Path('site').glob('*.html'):
 s=re.sub(r'<!--.*?-->','',p.read_text(),flags=re.S);P().feed(s)
texts={s for s in texts if len(s)>1 and not s.startswith('/*')}
Path('site/locales/ru-source.json').write_text(json.dumps(sorted(texts),ensure_ascii=False,indent=2))
print(len(texts),'strings',sum(map(len,texts)),'chars')
