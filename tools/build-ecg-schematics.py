"""Original teaching diagrams, explicitly NOT patient recordings. No raster/AI ECG generation."""
from pathlib import Path
import math
out=Path('site/media/clinical/ecg');out.mkdir(parents=True,exist_ok=True)
def bump(t,c,a,w):return a*math.exp(-((t-c)/w)**2)
def wave(t,ps,qs,st=0):
 v=sum(bump(t,p,.12,.035) for p in ps)
 for q in qs:
  v+=bump(t,q-.02,-.12,.009)+bump(t,q,1,.012)+bump(t,q+.026,-.25,.012)+bump(t,q+.28,.25,.065)
  if q+.065<t<q+.23:v+=st
 return v

def strip(n,ps,qs):
 w,h=1000,230;s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 230">','<rect width="100%" height="100%" fill="white"/>','<defs><pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#efb8be" stroke-width=".5"/></pattern></defs>','<rect x="45" y="45" width="900" height="140" fill="url(#grid)"/>','<text x="45" y="25" font-family="sans-serif" font-size="16">SCHEMATIC — NOT A PATIENT RECORD · II · 10 s · 1 mV = 36 units</text>']
 points=['%.2f,%.2f'%(45+t*90,140-wave(t,ps,qs)*36) for t in (i/500 for i in range(5001))];s+=['<polyline points="'+' '.join(points)+'" fill="none" stroke="#17212a" stroke-width="1.6"/>','<path d="M48 180v-36h18v36" fill="none" stroke="black"/>','<text x="45" y="216" font-family="sans-serif" font-size="14">Timing is illustrative; this diagram cannot establish a clinical diagnosis.</text></svg>'];(out/f'{n:02}.svg').write_text('\n'.join(s))
strip(5,[.3,1.3,2.3,5.8,6.8,7.8,8.8],[p+.16 for p in [.3,1.3,2.3,5.8,6.8,7.8,8.8]])
ps=[.25+.8*i for i in range(12)];strip(28,ps,[p+.18 for i,p in enumerate(ps) if i%3==0])
def multi(n,elevated,depressed):
 s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 960"><rect width="100%" height="100%" fill="white"/>','<defs><pattern id="g" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#f0c4ca" stroke-width=".35"/></pattern></defs>','<text x="35" y="28" font-family="sans-serif" font-size="17">SCHEMATIC — NOT A PATIENT RECORD · simultaneous 4 s strips</text>']
 for i,label in enumerate(['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6']):
  x=40+(i//6)*490;y=70+(i%6)*142;base=y+85;st=.22 if label in elevated else -.16 if label in depressed else 0
  s+= [f'<rect x="{x}" y="{y}" width="400" height="120" fill="url(#g)"/>',f'<text x="{x}" y="{y-7}" font-family="sans-serif" font-size="15">{label}</text>']
  pts=[]
  for j in range(1601):
   t=j/400;v=wave(t,[.2+k for k in range(4)],[.36+k for k in range(4)],st)
   if label=='aVR':v=-v
   pts.append(f'{x+t*100:.2f},{base-v*40:.2f}')
  s.append('<polyline fill="none" stroke="#17212a" stroke-width="1.3" points="'+' '.join(pts)+'"/>')
 s+=['<text x="35" y="945" font-family="sans-serif" font-size="14">Teaching model of ST distribution only. 1 mV = 40 units; 1 s = 100 units.</text></svg>'];(out/f'{n:02}.svg').write_text('\n'.join(s))
multi(38,['V1','V2','V3','V4'],[])
multi(44,[],['I','II','V4','V5','V6'])
print('4 original diagrams generated: 5, 28, 38, 44. All labelled schematic.')
