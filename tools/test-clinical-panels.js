const fs=require('fs'),vm=require('vm'),assert=require('assert');
let count=0;
for(const f of fs.readdirSync('site/characters').filter(f=>f.endsWith('.js')&&!['manifest.js','loader.js'].includes(f))){
 const b={window:{}};for(const file of ['site/nlu-en.js','site/nlu-kk.js','site/nlu.js','site/characters/'+f,'site/passport-questions.js','site/lab-results.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),b);
 const c=b.window.CASES[0],all=[...c.passport,...c.questions,...c.vitals,...c.exams,...c.orders,...c.treatment,...c.diagnosis.options];
 const match=(q,cat)=>b.window.NLU.match(q,all,{cat,label:id=>all.find(o=>o.id===id)?.label});
 for(const q of ['кожа','осмотреть кожу','inspect skin','теріні қарау'])assert.equal(match(q,'exam').id,'e.skin',f+' '+q+' '+JSON.stringify(match(q,'exam')));
 for(const q of ['общее состояние','оценить общее состояние','general condition','жалпы жағдай'])assert.equal(match(q,'exam').id,'e.general',f+' '+q);
 for(const q of ['ОАМ','оам','общий анализ мочи','анализ мочи','urinalysis','жалпы зәр талдауы'])assert.equal(match(q,'order').id,'o.ua',f+' '+q+' '+JSON.stringify(match(q,'order')));
 const cbc=c.orders.find(o=>o.lab&&o.lab.title.startsWith('Общий анализ крови'));
 for(const q of ['ОАК','общий анализ крови','клинический анализ крови','complete blood count','жалпы қан талдауы'])assert.equal(match(q,'order').id,cbc.id,f+' '+q+' '+JSON.stringify(match(q,'order')));
 assert.equal(cbc.lab.rows.length,21);assert.equal(c.orders.find(o=>o.id==='o.ua').lab.rows.length,19);
 const get=(n,u)=>Number(cbc.lab.rows.find(r=>r.name===n&&(!u||r.unit===u)).value);
 assert(Math.abs(['Нейтрофилы','Лимфоциты','Моноциты','Эозинофилы','Базофилы'].reduce((s,n)=>s+get(n,'%'),0)-100)<.02);
 assert(Math.abs(get('Гемоглобин (Hb)')/get('Эритроциты (RBC)')-get('MCH'))<.06);
 for(const q of ['фио','возраст']){const id=b.window.PassportQuestions.direct(q);assert(c.passport.find(p=>p.id===id));}
 const html=b.window.LabResults.render(cbc.lab);assert(html.includes('<table'));assert(!html.includes('is-abn'));
 const bad=b.window.LabResults.render({title:'<script>',rows:[{name:'<img>',value:'<svg onload=x>',unit:'',ref:''}]});assert(!bad.includes('<svg'));assert(bad.includes('&lt;script&gt;'));
 count++;
}
console.log('OK '+count+' cases: distinct exams, CBC/UA RU/KK/EN routing, coherent full panels, identity IDs, escaped neutral tables.');
// Fixed original clinical findings must survive enrichment.
const checks={'af-nurgaliev':{'Гемоглобин (Hb)':143,'Тромбоциты (PLT)':230},'asthma-eszhanova':{'Гемоглобин (Hb)':132,'Лейкоциты (WBC)':6.8,'Эозинофилы':8,'СОЭ':9},'bronchiectasis-abenov':{'Гемоглобин (Hb)':128,'Лейкоциты (WBC)':9.8,'Нейтрофилы':68,'СОЭ':32},'cf-omarov':{'Гемоглобин (Hb)':118,'Лейкоциты (WBC)':12.4,'Нейтрофилы':74,'СОЭ':28},'chf-baizhanov':{'Гемоглобин (Hb)':141,'Лейкоциты (WBC)':7.2,'СОЭ':12},'copd-tulegenov':{'Гемоглобин (Hb)':148,'Лейкоциты (WBC)':7.1},'chronic-bronchitis-bekova':{'Гемоглобин (Hb)':132,'Лейкоциты (WBC)':6.5},'myocarditis-omarova':{'Лейкоциты (WBC)':9.8},'pericarditis-alimov':{'Лейкоциты (WBC)':10.8}};
for(const [id,expected] of Object.entries(checks)){
 const b={window:{}};for(const file of ['site/characters/'+id+'.js','site/score.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),b);
 const c=b.window.CASES[0],lab=c.orders.find(o=>o.lab&&o.lab.title.startsWith('Общий анализ крови')).lab;
 for(const [name,value] of Object.entries(expected))assert.equal(Number(lab.rows.find(r=>r.name===name).value),value,id+' '+name);
 const session={done:{},heard:{},log:[]};const before=b.window.Score.compute(c,session).total;session.done['o.ua']=true;assert.equal(b.window.Score.compute(c,session).total,before,'Optional UA must not affect grade');
 if(id==='copd-tulegenov')assert.equal(lab.rows.find(r=>r.name==='Эозинофилы'&&r.unit==='×10⁹/л').value,'0.12');
}
