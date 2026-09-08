#!/usr/bin/env python3
"""Generate prerecorded fictional patient voices from source text (no duplicated scripts).
Run: tools/.venv/bin/python tools/make-cardiology-voice.py
Requires edge-tts, Node and ffmpeg. Network only during generation.
Successful files are cached by voice settings + text; case audio paths updated only after success.
"""
import asyncio, hashlib, json, pathlib, re, subprocess, tempfile, sys
import edge_tts
ROOT=pathlib.Path(__file__).resolve().parents[1]
PROFILES={'hypertension-saparov':('-5%','-5Hz'),'angina-iskakov':('-8%','-12Hz'),'af-nurgaliev':('-12%','-25Hz'),'pericarditis-alimov':('+0%','+10Hz')}
PROFILES.update({'copd-tulegenov':('-10%','-15Hz'),'chronic-bronchitis-bekova':('-3%','-5Hz'),'acs-serikbayev':('-5%','-10Hz'),'myocarditis-omarova':('-3%','+0Hz')})
async def main():
 for cid,(rate,pitch) in PROFILES.items():
  if sys.argv[1:] and cid not in sys.argv[1:]: continue
  voice='ru-RU-SvetlanaNeural' if cid in ('chronic-bronchitis-bekova','myocarditis-omarova') else 'ru-RU-DmitryNeural'
  source=ROOT/'site/characters'/f'{cid}.js'
  js="const f=require('fs'),v=require('vm'),b={window:{}};v.runInNewContext(f.readFileSync(process.argv[1],'utf8'),b);console.log(JSON.stringify(b.window.CASES[0]));"
  case=json.loads(subprocess.check_output(['node','-e',js,str(source)]))
  texts=[]
  def visit(o):
   if isinstance(o,dict):
    if isinstance(o.get('text'),str) and ('cat' not in o or o['cat']=='ask') and not o.get('id','').startswith('a.'):
     if o['text'] not in texts:texts.append(o['text'])
    for k,v in o.items():
     if k not in ('algorithm','debrief','chip'):visit(v)
   elif isinstance(o,list):
    for v in o:visit(v)
  visit(case)
  folder=ROOT/'site/media/voice'/cid;folder.mkdir(parents=True,exist_ok=True)
  rawsource=source.read_text()
  for text in texts:
   key=hashlib.sha256((voice+rate+pitch+text).encode()).hexdigest()[:16]
   out=folder/(key+'.mp3')
   if not out.exists():
    for attempt in range(3):
     try:
      with tempfile.TemporaryDirectory(prefix='disease-tts-') as tmp:
       raw=pathlib.Path(tmp)/'voice.mp3'
       await asyncio.wait_for(edge_tts.Communicate(text,voice,rate=rate,pitch=pitch).save(str(raw)),45)
       subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af','highpass=f=85,lowpass=f=8200,loudnorm=I=-16:TP=-1.5:LRA=11','-ar','44100','-ac','1','-b:a','128k',str(out)],check=True)
       duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(out)]))
       if duration<max(.3,len(text)/45):
        out.unlink();raise ValueError('Truncated speech')
      break
     except Exception as e:
      print(cid,key,'retry',attempt+1,type(e).__name__,flush=True)
      if attempt==2:raise
   encoded=json.dumps(text,ensure_ascii=False)
   needle='"text": '+encoded
   audio=json.dumps('media/voice/'+cid+'/'+key+'.mp3')
   # New cases use JSON-style fields; avoid duplicating fields on reruns.
   pattern = r'(?:"audio":\s*"[^"]*",\s*)?' + re.escape(needle)
   rawsource=re.sub(pattern,lambda m: '"audio": '+audio+',\n      '+needle,rawsource)
   print(cid,key,'OK',flush=True)
  source.write_text(rawsource)
 print('Selected patient voices generated and linked.',flush=True)
if __name__=='__main__':asyncio.run(main())
