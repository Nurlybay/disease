const fs=require('fs'),vm=require('vm'),assert=require('assert');let count=0;
for(const f of fs.readdirSync('site/characters').filter(f=>f.endsWith('.js')&&!['manifest.js','loader.js'].includes(f))){let b={window:{}};for(const file of ['nlu.js','nlu-en.js','nlu-kk.js','characters/'+f])vm.runInNewContext(fs.readFileSync('site/'+file,'utf8'),b);let c=b.window.CASES[0],h=c.exams.find(e=>e.id==='e.heart');assert(h.result.includes('I тон'));assert(h.result.includes('II тон'));assert(/акцент/i.test(h.result));assert(/ритм/i.test(h.result));
const all=[...c.passport,...c.questions,...c.exams,...c.orders];
for(const q of ['анализ мокроты','общий анализ мокроты','sputum analysis','қақырық талдауы']){let r=b.window.NLU.match(q,all,{cat:'order'});assert.equal(r.id,'o.sput_micro',f+' '+q+' '+JSON.stringify(r));}
for(const q of ['посев мокроты','sputum culture','қақырық себіндісі']){let r=b.window.NLU.match(q,all,{cat:'order'});assert(['o.culture','o.sput_culture'].includes(r.id),f+' '+q+' '+JSON.stringify(r));}
const micro=c.orders.find(o=>o.id==='o.sput_micro');assert.equal(micro.lab.rows.length,14);if(['acs-serikbayev','pericarditis-alimov','chf-baizhanov'].includes(c.id))assert(micro.labExtra.includes('не получена'));
for(const l of ['en','kk']){const d=JSON.parse(fs.readFileSync('site/locales/'+l+'.json','utf8'));assert(d[h.result],f+' '+l+' heart translation');}
count++;}
console.log('OK '+count+' detailed heart findings, sputum microscopy/culture routing in 3 languages, no invented negative test without specimen.');
