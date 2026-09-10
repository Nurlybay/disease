/* Reproducible, fixed simulated laboratory data. See CLINICAL-LABS.md. */
const fs=require('fs'),vm=require('vm');
const heartSputum=require('./heart-sputum-data');
const marker='\n/* BEGIN generated clinical panels */';
const profiles={
 'asthma-eszhanova':[132,6.8,260,9,55,8],
 'bronchiectasis-abenov':[128,9.8,310,32,68,2],
 'cf-omarov':[118,12.4,340,28,74,2],
 'chf-baizhanov':[141,7.2,240,12,60,2],
 'af-nurgaliev':[143,7.0,230,10,60,2],
 'chronic-bronchitis-bekova':[132,6.5,250,12,60,2],
 'copd-tulegenov':[148,7.1,245,12,62,120/71],
 'myocarditis-omarova':[130,9.8,275,25,68,2],
 'pericarditis-alimov':[145,10.8,280,28,70,2],
 'acs-serikbayev':[145,9.0,250,12,65,2],
 'angina-iskakov':[145,7.0,250,10,60,2],
 'hypertension-saparov':[145,7.0,250,10,60,2]
};
const normalSkin='Кожа обычной окраски, умеренно влажная, тёплая. Видимых высыпаний и кровоизлияний нет, тургор сохранён.';
const general={
 'asthma-eszhanova':'Сознание ясное, положение активное. Контакт сохранён, отвечает на вопросы.',
 'bronchiectasis-abenov':'Сознание ясное, положение активное. Контакт сохранён, периодически кашляет.',
 'cf-omarov':'Сознание ясное, контакт сохранён. Пониженного питания, периодически кашляет.',
 'chf-baizhanov':'Сознание ясное, контакт сохранён. Предпочитает положение сидя из-за одышки.',
 'acs-serikbayev':'В сознании, тревожен. Продолжает испытывать боль.',
 'myocarditis-omarova':'Сознание ясное, выраженная утомляемость. Говорит полными предложениями.'
};
const skin={
 'acs-serikbayev':'Кожа бледная, влажная, холодный пот. Видимых высыпаний и кровоизлияний нет.',
 'myocarditis-omarova':'Кожа обычной окраски, тёплая, холодного пота нет. Видимых высыпаний и кровоизлияний нет, тургор сохранён.'
};
function num(n,d=1){return Number(n.toFixed(d));}
function panels(p,female){
 const [hb,wbc,plt,esr,neut,eos]=p,rbc=num(hb/30,2),mcv=90,hct=num(rbc*mcv/10),mono=7,baso=.5,lymph=100-neut-eos-mono-baso;
 const rows=[];const add=(name,value,unit,ref)=>rows.push({name,value:String(value),unit,ref});
 add('Гемоглобин (Hb)',hb,'г/л',female?'120–155':'135–175');
 add('Эритроциты (RBC)',rbc,'×10¹²/л',female?'3.9–5.2':'4.3–5.7');
 add('Гематокрит (Hct)',hct,'%',female?'35–47':'39–50');
 add('MCV',mcv,'фл','80–100');add('MCH',num(hb/rbc),'пг','27–33');add('MCHC',num(hb/hct*100,0),'г/л','320–360');
 add('RDW-CV',13.2,'%','11.5–14.5');add('Лейкоциты (WBC)',wbc,'×10⁹/л','4.0–10.0');
 for(const [name,val] of [['Нейтрофилы',neut],['Лимфоциты',lymph],['Моноциты',mono],['Эозинофилы',eos],['Базофилы',baso]]){
 const refs={'Нейтрофилы':['40–75','1.5–7.5'],'Лимфоциты':['20–45','1.0–4.0'],'Моноциты':['2–10','0.2–1.0'],'Эозинофилы':['0–5','0–0.5'],'Базофилы':['0–1','0–0.1']}[name];
 add(name,num(val,2),'%',refs[0]);add(name,num(wbc*val/100,3),'×10⁹/л',refs[1]);
 }
 add('Тромбоциты (PLT)',plt,'×10⁹/л','150–400');add('MPV',10,'фл','7–12');add('СОЭ',esr,'мм/ч',female?'2–20':'2–15');
 const ua=[];const u=(name,value,unit,ref)=>ua.push({name,value,unit,ref});
 u('Цвет','Соломенно-жёлтый','','Соломенно-жёлтый');u('Прозрачность','Прозрачная','','Прозрачная');
 u('Относительная плотность','1.018','','1.005–1.030');u('pH','6.0','','4.5–8.0');
 for(const name of ['Белок','Глюкоза','Кетоновые тела','Билирубин','Нитриты','Лейкоцитарная эстераза','Кровь (тест-полоска)'])u(name,'Отрицательно','','Отрицательно');
 u('Уробилиноген','3.2','мкмоль/л','0–17');u('Эритроциты (микроскопия)','0–1','в поле зрения','0–2');u('Лейкоциты (микроскопия)','1–2','в поле зрения','0–5');u('Плоский эпителий','0–2','в поле зрения','0–5');
 for(const name of ['Цилиндры','Бактерии','Дрожжевые грибы','Кристаллы'])u(name,'Не обнаружены','','Не обнаружены');
 return [{title:'Общий анализ крови с лейкоцитарной формулой и СОЭ',rows},{title:'Общий анализ мочи',rows:ua}];
}
function summary(lab){return lab.title+'. '+lab.rows.map(r=>r.name+': '+r.value+' '+r.unit+' ('+r.ref+')').join('; ')+'.';}
for(const [id,p] of Object.entries(profiles)){
 const file='site/characters/'+id+'.js',base=fs.readFileSync(file,'utf8').split(marker)[0];let box={window:{}};vm.runInNewContext(base,box);const c=box.window.CASES[0];
 const edits={exams:[],orders:[],questions:[]};
 const aliases={
 'q.smoking':['вы курите','курите ли вы','есть привычка курить','do you smoke','темекі шегесіз бе'],
 'q.sputum':['что откашливаете','какого цвета мокрота','мокрота какого цвета','что выходит при кашле','what colour is your sputum','қақырықтың түсі қандай'],
 'q.meds':['какие таблетки вы пили','что принимаете из лекарств','чем лечились','what medicines do you take','қандай дәрі ішесіз'],
 'q.cough':['расскажите о кашле','как вы кашляете','кашель сухой или с мокротой','tell me about your cough']
 };
 c.questions.forEach(q=>{let a=(aliases[q.id]||[]).slice();if(q.id==='q.cough' && /мокрота/.test(q.label))a=a.concat(aliases['q.sputum']);if(a.length)edits.questions.push({...q,aliases:a});});
 let g=c.exams.find(e=>e.id==='e.general');
 edits.exams.push({...g,id:'e.general',cat:'exam',label:'Оценить общее состояние',title:'Общее состояние',need:[['общее состояние','общий осмотр','сознани','general condition','general appearance','жалпы жағдай']],w:g?.w||2,weight:g?.weight||0,result:general[id]||(g?.result.replace('Сознание ясное, кожа обычной окраски, холодного пота нет.', 'Сознание ясное.')||'Сознание ясное, контакт сохранён.'),findAbnormal:g?.findAbnormal||false});
 let s=c.exams.find(e=>e.id==='e.skin');
 edits.exams.push({...s,id:'e.skin',cat:'exam',label:'Осмотреть кожу',title:s?.title||'Кожа',need:[['кожа','кожу','кожи','кожные','кожных','цианоз','сыпь','высып','skin','тері']],w:s?.w||2,weight:s?.weight||0,result:s?.result||skin[id]||normalSkin,findAbnormal:s?.findAbnormal||id==='acs-serikbayev'});
 const [cbc,ua]=panels(p,c.patient.gender==='female');
 let existing=c.orders.find(o=>['o.cbc','o.oak','o.labs'].includes(o.id)||(id==='pericarditis-alimov'&&o.id==='o.crp'));
 let extra=existing&&!['o.cbc','o.oak'].includes(existing.id)?existing.result:'';
 edits.orders.push({...existing,id:existing?.id||'o.cbc',cat:'order',label:existing?.label||'Общий анализ крови',need:[...((existing?.need)||[]).map(a=>a.filter(x=>x!=='кров')).filter(a=>a.length)],w:existing?.w||2,weight:existing?.weight||0,role:existing?.role||'available',lab:cbc,result:(extra?extra+' ':'')+summary(cbc),labExtra:extra});
 // One OR group: tests are synonyms, not prerequisites. Keep existing combined panel aliases.
 const o=edits.orders[0];o.need=[Array.from(new Set(o.need.flat().concat(['оак','общий анализ крови','клинический анализ крови','гемограмм','гемограм','cbc','complete blood count','жқа','жалпы қан талдауы'])))];
 edits.orders.push({id:'o.ua',cat:'order',label:'Общий анализ мочи',need:[['оам','общий анализ мочи','анализ мочи','urinalysis','urine test','зжа','жалпы зәр талдауы']],w:4,weight:0,role:'available',lab:ua,result:summary(ua),hint:'Доступное исследование. Необходимость назначения обоснуйте клинической задачей.'});
 // Albumin/creatinine is a different investigation; do not let the root "моч" hijack OAM.
 const acr=c.orders.find(o=>o.id==='o.urine');if(acr)edits.orders.push({...acr,need:[['альбумин','акр','acr','albumin','альбумин креатинин']]});
 const additional=heartSputum(c);edits.exams.push(...additional.exams);edits.orders.push(...additional.orders);
 const payload=JSON.stringify(edits,null,2);
 fs.writeFileSync(file,base+marker+'\n(function(c,patch){\n  ["exams","orders","questions"].forEach(function(key){patch[key].forEach(function(item){var i=c[key].findIndex(function(old){return old.id===item.id;});if(i<0)c[key].push(item);else c[key][i]=item;});});\n})(window.CASES[window.CASES.length-1],'+payload+');\n');
}

heartSputum.saveLocales();
