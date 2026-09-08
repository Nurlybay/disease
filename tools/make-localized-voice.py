"""Generate local KK voices and corrected Russian cough-family pronunciation.
Inputs: extraction manifest and reviewed locales/kk.json. Originals remain untouched.
"""
import asyncio,json,re,hashlib,subprocess,tempfile,sys
from pathlib import Path
import edge_tts
ROOT=Path(__file__).resolve().parents[1]
def spoken_ru(text):return re.sub(r'(про|по|от)кашл(я[а-яё]*)',lambda m:m[1]+'ка\u0301шл'+m[2],text,flags=re.I)
async def main():
 lang=sys.argv[1] if len(sys.argv)>1 else 'kk'; rows=json.loads((ROOT/'site/locales/spoken-source.json').read_text())
 catalog=json.loads((ROOT/'site/locales/kk.json').read_text()) if lang=='kk' else {}
 path=ROOT/'site/locales/voice-map.json'; mapping=json.loads(path.read_text()) if path.exists() else {'ru':{},'kk':{}}
 sem=asyncio.Semaphore(3)
 async def line(row):
  text=row['text'];text=catalog.get(' '.join(text.split()),text) if lang=='kk' else spoken_ru(text)
  if lang=='ru' and text==row['text']:return
  if lang=='kk' and ' '.join(row['text'].split()) not in catalog:raise ValueError('Missing translation: '+row['text'])
  voice=('kk-KZ-AigulNeural' if row['gender']=='female' else 'kk-KZ-DauletNeural') if lang=='kk' else ('ru-RU-SvetlanaNeural' if row['gender']=='female' else 'ru-RU-DmitryNeural')
  key=hashlib.sha256((voice+text).encode()).hexdigest()[:20]; relative='media/voice/'+lang+'/'+key+'.mp3';out=ROOT/'site'/relative;out.parent.mkdir(parents=True,exist_ok=True)
  async with sem:
   if not out.exists():
    for attempt in range(3):
     try:
      with tempfile.TemporaryDirectory(prefix='vp-voice-') as tmp:
       raw=Path(tmp)/'raw.mp3';await asyncio.wait_for(edge_tts.Communicate(text,voice,rate='-5%').save(str(raw)),45)
       subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af','loudnorm=I=-16:TP=-1.5:LRA=11','-ar','24000','-ac','1','-b:a','64k',str(out)],check=True)
       duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(out)]))
       if duration<max(.3,len(text)/55):out.unlink();raise ValueError('Truncated voice')
      break
     except Exception:
      if attempt==2:raise
   mapping[lang][row['source']]=relative
   path.write_text(json.dumps(mapping,ensure_ascii=False,indent=2));(ROOT/'site/locales/voices.js').write_text('window.PATIENT_VOICES = '+json.dumps(mapping,ensure_ascii=False)+';\n')
   print(lang,len(mapping[lang]),row['caseId'],flush=True)
 # Avoid duplicate generation for identical original URLs.
 unique={r['source']:r for r in rows}
 await asyncio.gather(*(line(r) for r in unique.values()))
asyncio.run(main())
