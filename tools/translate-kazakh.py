"""Build a cached draft KK catalog from public fictional training copy, with explicit owner consent.
No translation service is called by the deployed application. Review medical terminology before release.
"""
import concurrent.futures,json,re,time,urllib.request,urllib.parse
from pathlib import Path
root=Path(__file__).resolve().parents[1];target=root/'site/locales/kk.json'
source=json.loads((root/'site/locales/ru-source.json').read_text());cache=json.loads(target.read_text()) if target.exists() else {}
pending=[s for s in source if s not in cache];batches=[];batch=[];size=0
for s in pending:
 if size+len(s)>2300 and batch:batches.append(batch);batch=[];size=0
 batch.append(s);size+=len(s)
if batch:batches.append(batch)
def translate(batch):
 q='\n'.join('ZXQ'+str(i)+'ZX '+s for i,s in enumerate(batch))
 u='https://translate.googleapis.com/translate_a/single?'+urllib.parse.urlencode({'client':'gtx','sl':'ru','tl':'kk','dt':'t','q':q})
 for attempt in range(4):
  try:
   d=json.load(urllib.request.urlopen(u,timeout=35));txt=''.join(x[0] for x in d[0]);parts=re.split(r'ZXQ\s*(\d+)\s*ZX\s*',txt)
   found={int(parts[i]):parts[i+1].strip() for i in range(1,len(parts)-1,2)}
   if set(found)!=set(range(len(batch))):raise ValueError('Batch markers lost')
   return dict((s,found[i]) for i,s in enumerate(batch))
  except Exception:
   if attempt==3:raise
   time.sleep(2+attempt)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for f in concurrent.futures.as_completed([pool.submit(translate,b) for b in batches]):
  cache.update(f.result());target.write_text(json.dumps(cache,ensure_ascii=False,indent=2));print(len(cache),'/',len(source),flush=True)
