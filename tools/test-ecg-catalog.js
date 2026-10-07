'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),box={window:{}};vm.createContext(box);vm.runInContext(fs.readFileSync(root+'/site/clinical-media.js','utf8'),box);
const all=box.window.CLINICAL_MEDIA,topics=all.filter(r=>r.number);
const wanted=[1,2,3,4,5,6,7,8,9,10,11,12,13,24,25,26,27,28,29,30,31,37,38,39,40,41,42,43,44,49,50,51,52,64];
assert.deepEqual(Array.from(topics,r=>r.number).sort((a,b)=>a-b),wanted);assert.equal(new Set(all.map(r=>r.id)).size,all.length);
for(const r of topics){assert(r.findings.length&&r.limit&&r.source&&r.license&&r.author);const b=fs.readFileSync(path.join(root,'site',r.file));if(r.sha256)assert.equal(crypto.createHash('sha256').update(b).digest('hex'),r.sha256);assert(!/BY-NC|BY-ND/i.test(r.license));}
for(const n of [5,28,38,44]){const r=topics.find(r=>r.number===n);assert.equal(r.material,'schematic');assert(fs.readFileSync(root+'/site/'+r.file,'utf8').includes('NOT A PATIENT RECORD'));}
for(const [n,id,code] of [[50,'02417','RVH'],[51,'06685','LAO/LAE'],[52,'08177','RAO/RAE']]){const d=JSON.parse(fs.readFileSync(root+'/sources/clinical/ecg/ptbxl-'+id+'.json'));assert.equal(d.scp_codes[code],100);assert(topics.find(r=>r.number===n).file.endsWith('.svg'));for(const ext of ['dat','hea'])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'/sources/clinical/ecg/ptbxl-'+id+'.'+ext)).digest('hex'),d.files[ext].sha256);}
assert(topics.find(r=>r.number===41).limit.includes('не отдельная'));assert(topics.find(r=>r.number===44).limit.includes('не устанавливает'));assert(topics.find(r=>r.number===64).limit.includes('не подтверждает'));assert(topics.find(r=>r.number===27).limit.includes('нельзя'));
console.log('OK: all 34 requested topics, unique IDs, local assets and hashes, source licenses, schematic labels, PTB-XL provenance and interpretation limits.');
