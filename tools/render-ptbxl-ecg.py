"""Render original PTB-XL record 02417 (100 Hz, 16-bit, 12 simultaneous leads), without filtering."""
from pathlib import Path
import struct,sys
record=sys.argv[1] if len(sys.argv)>1 else "02417"
topic=sys.argv[2] if len(sys.argv)>2 else "50"
assert record.isdigit() and topic.isdigit()
root=Path(__file__).resolve().parents[1]
b=(root/f'sources/clinical/ecg/ptbxl-{record}.dat').read_bytes();vals=struct.unpack('<'+'h'*(len(b)//2),b)
assert len(vals)==12000
header=(root/f'sources/clinical/ecg/ptbxl-{record}.hea').read_text().splitlines();assert header[0].split()[1:]==['12','100','1000']
s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1840 1320"><rect width="100%" height="100%" fill="white"/>','<defs><pattern id="g" width="3.2" height="3.2" patternUnits="userSpaceOnUse"><path d="M3.2 0H0V3.2" fill="none" stroke="#e6b3bd" stroke-width=".3"/></pattern><pattern id="G" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="url(#g)"/><path d="M16 0H0V16" fill="none" stroke="#e2a0ad" stroke-width=".5"/></pattern></defs>','<text x="40" y="28" font-family="sans-serif" font-size="19">PTB-XL 02417 · 100 Hz · 10 s simultaneous · 25 mm/s equivalent · 10 mm/mV equivalent</text>']
for c in range(12):
 parts=header[c+1].split();assert parts[1]=='16' and parts[2]=='1000.0(0)/mV';label=parts[-1]
 x=50+910*(c//6);y=65+205*(c%6);base=y+90
 s+=[f'<rect x="{x}" y="{y}" width="800" height="175" fill="url(#G)"/>',f'<text x="{x}" y="{y-8}" font-family="sans-serif" font-size="16">{label}</text>']
 pts=['%.2f,%.2f'%(x+i*.8,base-vals[i*12+c]/1000*32) for i in range(1000)]
 s+=['<polyline fill="none" stroke="#131a21" stroke-width="1.2" points="'+' '.join(pts)+'"/>',f'<path d="M{x+810} {base}v-32h16v32" stroke="black" fill="none"/>']
s+=['<text x="40" y="1310" font-family="sans-serif" font-size="15">Wagner et al., PTB-XL v1.0.3 · CC BY 4.0 · Original samples; no smoothing or resampling. Screen size changes physical scale.</text></svg>']
p=root/f'site/media/clinical/ecg/{topic}.svg';p.write_text('\n'.join(s).replace('PTB-XL 02417', 'PTB-XL '+record))
print(p)
