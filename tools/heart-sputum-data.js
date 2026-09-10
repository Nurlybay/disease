/* Additional fixed fictional findings; no live model supplies examination results. */
const fs=require('fs');
const dictionaries={};for(const l of ['en','kk'])dictionaries[l]=JSON.parse(fs.readFileSync('site/locales/'+l+'.json','utf8'));
function tr(ru,en,kk){dictionaries.en[ru]=en;dictionaries.kk[ru]=kk;return ru;}
const rhythm=tr('Ритм правильный.','Regular rhythm.','Ырғақ дұрыс.');
const normalTones=tr('I тон на верхушке и II тон на основании сердца отчётливые. Акцента II тона над аортой и лёгочной артерией нет. Патологического расщепления тонов нет.','S1 at the apex and S2 at the base are distinct. No accentuation of A2 or P2. No pathological splitting.','Жүрек ұшында I тон, негізінде II тон анық. Аорта мен өкпе артериясында II тон акценті жоқ. Тондардың патологиялық ажырауы жоқ.');
const normalExtra=tr('III и IV тоны не выслушиваются. Систолических и диастолических шумов, шума трения перикарда нет.','S3 and S4 are not audible. No systolic or diastolic murmurs or pericardial friction rub.','III және IV тондар естілмейді. Систолалық, диастолалық шу және перикард үйкеліс шуы жоқ.');
const special={
'af-nurgaliev':[
tr('Ритм абсолютно нерегулярный, ЧСС при аускультации 124/мин. Частота пульса на лучевой артерии 110/мин, дефицит пульса 14/мин.','Completely irregular rhythm; auscultated heart rate 124/min, radial pulse 110/min, pulse deficit 14/min.','Ырғақ толық ретсіз; аускультациядағы ЖСЖ 124/мин, кәрі жілік артериясындағы пульс 110/мин, пульс тапшылығы 14/мин.'),
tr('I тон на верхушке меняется по звучности от цикла к циклу. II тон без акцента над аортой и лёгочной артерией; патологического расщепления нет.','S1 intensity at the apex varies between beats. S2 has no aortic or pulmonary accentuation or pathological splitting.','Жүрек ұшындағы I тонның күші әр соққыда өзгереді. II тонның аортада және өкпе артериясында акценті, патологиялық ажырауы жоқ.'),normalExtra],
'chf-baizhanov':[
tr('Ритм правильный, ЧСС 98/мин.','Regular rhythm, heart rate 98/min.','Ырғақ дұрыс, ЖСЖ 98/мин.'),
tr('I тон на верхушке ослаблен, II тон приглушён, явного акцента над аортой и лёгочной артерией нет. Патологического расщепления II тона нет.','S1 at the apex is reduced; S2 is muffled, without clear A2/P2 accentuation or pathological splitting.','Жүрек ұшындағы I тон әлсіреген, II тон бәсең, аортада және өкпе артериясында айқын акцент жоқ. II тонның патологиялық ажырауы жоқ.'),
tr('На верхушке выслушивается III тон в начале диастолы — трёхчленный ритм галопа. IV тон не определяется. Отчётливых клапанных шумов и шума трения перикарда нет. Верхушечный толчок смещён влево и вниз, разлитой.','An early diastolic S3 is heard at the apex, producing a gallop rhythm. No S4, distinct valvular murmur or pericardial rub. The apical impulse is displaced down and left and diffuse.','Жүрек ұшында диастола басында III тон естіледі — үш мүшелі шоқырақ ырғағы. IV тон анықталмайды. Айқын қақпақшалық шу және перикард үйкеліс шуы жоқ. Жүрек ұшы түрткісі солға және төмен ығысқан, жайылған.')],
'myocarditis-omarova':[
tr('Ритм частый, ЧСС около 112/мин, с отдельными преждевременными сокращениями и последующими паузами.','Rapid rhythm, heart rate about 112/min, with occasional premature beats followed by pauses.','Ырғақ жиі, ЖСЖ шамамен 112/мин; жекелеген мерзімінен бұрын жиырылулар және кейінгі үзілістер бар.'),
tr('I тон на верхушке несколько ослаблен; при преждевременных сокращениях звучность меняется. II тон без явного акцента и патологического расщепления.','S1 at the apex is slightly reduced and varies with premature beats. S2 has no clear accentuation or pathological splitting.','Жүрек ұшындағы I тон сәл әлсіреген, мерзімінен бұрын жиырылуларда күші өзгереді. II тонның айқын акценті және патологиялық ажырауы жоқ.'),normalExtra],
'pericarditis-alimov':[rhythm,normalTones,
tr('III и IV тоны не выслушиваются, клапанных систолических и диастолических шумов нет. У левого края грудины — поверхностный скребущий шум трения перикарда, лучше слышен сидя с наклоном вперёд; сохраняется при задержке дыхания.','No S3/S4 or systolic/diastolic valvular murmurs. A superficial scratchy pericardial friction rub is heard at the left sternal border, clearer sitting forward and persisting during breath-holding.','III және IV тондар, систолалық және диастолалық қақпақшалық шулар естілмейді. Төстің сол жиегінде беткей қырнағандай перикард үйкеліс шуы бар; алға еңкейіп отырғанда жақсы естіледі, тынысты ұстағанда сақталады.')],
'hypertension-saparov':[rhythm,
tr('I тон на верхушке сохранён. II тон акцентирован над аортой; над лёгочной артерией акцента нет. Патологического расщепления нет.','S1 at the apex is preserved. A2 is accentuated, without P2 accentuation or pathological splitting.','Жүрек ұшындағы I тон сақталған. Аортада II тон акценті бар; өкпе артериясында акцент жоқ. Патологиялық ажырау жоқ.'),normalExtra]
};
const names={
 'Материал':['Specimen','Материал'],'Мокрота':['Sputum','Қақырық'],'Объём образца':['Specimen volume','Үлгі көлемі'],'мл':['mL','мл'],'Цвет':['Colour','Түсі'],'Характер':['Character','Сипаты'],'Консистенция':['Consistency','Консистенциясы'],'Запах':['Odour','Иісі'],'Без резкого запаха':['No strong odour','Өткір иіссіз'],'Примесь крови':['Visible blood','Қан қоспасы'],'Не видна':['Not visible','Көрінбейді'],'Нейтрофилы':['Neutrophils','Нейтрофилдер'],'Эозинофилы':['Eosinophils','Эозинофилдер'],'Плоский эпителий':['Squamous epithelium','Жалпақ эпителий'],'Альвеолярные макрофаги':['Alveolar macrophages','Альвеолалық макрофагтар'],'Спирали Куршмана':['Curschmann spirals','Куршман шиыршықтары'],'Кристаллы Шарко—Лейдена':['Charcot–Leyden crystals','Шарко–Лейден кристалдары'],'Эластические волокна':['Elastic fibres','Эластикалық талшықтар'],'Обнаружены':['Detected','Анықталды'],'Не обнаружены':['Not detected','Анықталмады'],'Единичные':['Occasional','Бірен-саран'],'В большом количестве':['Numerous','Көп мөлшерде'],'Слизистая':['Mucoid','Шырышты'],'Слизисто-гнойная':['Mucopurulent','Шырышты-іріңді'],'Вязкая':['Viscous','Тұтқыр'],'Светлая':['Light-coloured','Ашық түсті'],'Жёлто-зелёная':['Yellow-green','Сары-жасыл'],'Зависит от метода':['Method dependent','Әдіске байланысты'],'Не исследовано':['Not examined','Зерттелмеген'],'Материал не получен':['No specimen obtained','Материал алынбаған'],'Результат посева':['Culture result','Себінді нәтижесі'],'Чувствительность':['Susceptibility','Сезімталдық'],'S — чувствителен':['S — susceptible','S — сезімтал'],'R — устойчив':['R — resistant','R — төзімді'],'Рост патогенной флоры не выявлен':['No pathogenic growth detected','Патогенді флораның өсуі анықталмады']
};Object.entries(names).forEach(([r,[e,k]])=>tr(r,e,k));
const noSample=tr('В этом приёме мокрота не получена. Анализ не выполнен: отсутствие материала не является нормальным или отрицательным результатом.','No sputum specimen obtained at this consultation. The test was not performed; absence of a specimen is not a normal or negative result.','Осы қабылдауда қақырық алынбаған. Талдау орындалмады: материалдың болмауы қалыпты немесе теріс нәтиже емес.');
const microTitle=tr('Общий анализ мокроты: макроскопия и микроскопия','Sputum examination: macroscopic and microscopic findings','Қақырықтың жалпы талдауы: макроскопия және микроскопия');
const cultureTitle=tr('Бактериологический посев мокроты','Sputum bacterial culture','Қақырықтың бактериологиялық себіндісі');
const extraHint=tr('Результат относится к указанному образцу. Посев и исследование на КУБ назначаются отдельно.','Results refer to the specified specimen. Culture and AFB testing are separate orders.','Нәтиже көрсетілген үлгіге қатысты. Себінді және ҚТБ зерттеуі бөлек тағайындалады.');
function summary(l){return l.title+'. '+l.rows.map(r=>r.name+': '+r.value+(r.unit?' '+r.unit:'')).join('; ')+'.';}
function registerResult(l,result){for(const lang of ['en','kk']){const t=x=>dictionaries[lang][x]||x;dictionaries[lang][result]=t(l.title)+'. '+l.rows.map(r=>t(r.name)+': '+t(r.value)+(r.unit?' '+t(r.unit):'')).join('; ')+'.';}}
function make(c){
 const h=c.exams.find(e=>e.id==='e.heart');let parts=special[c.id]||[rhythm,normalTones,normalExtra];
 if(c.id==='acs-serikbayev')parts=[tr('Ритм правильный, частый, ЧСС 104/мин.','Regular rapid rhythm, heart rate 104/min.','Ырғақ дұрыс, жиі, ЖСЖ 104/мин.'),normalTones,normalExtra];
 if(c.id==='cf-omarov')parts=[tr('Ритм правильный, ЧСС 92/мин.','Regular rhythm, heart rate 92/min.','Ырғақ дұрыс, ЖСЖ 92/мин.'),normalTones,normalExtra];
 const result=parts.join(' ');tr(result,parts.map(p=>dictionaries.en[p]).join(' '),parts.map(p=>dictionaries.kk[p]).join(' '));
 const exams=[{...h,result,findAbnormal:h.findAbnormal||c.id==='hypertension-saparov'}],orders=[];
 const productive=['asthma-eszhanova','bronchiectasis-abenov','cf-omarov','copd-tulegenov','chronic-bronchitis-bekova'].includes(c.id);
 let rows=[];function row(name,value,unit='',ref='—'){rows.push({name,value,unit,ref});}
 row('Материал',productive?'Мокрота':'Материал не получен');
 const asthma=c.id==='asthma-eszhanova',purulent=['cf-omarov','bronchiectasis-abenov'].includes(c.id);
 row('Объём образца',productive?(asthma?'1':'3'):'Не исследовано','мл');row('Цвет',productive?(purulent?'Жёлто-зелёная':'Светлая'):'Не исследовано');row('Характер',productive?(purulent?'Слизисто-гнойная':'Слизистая'):'Не исследовано');row('Консистенция',productive?'Вязкая':'Не исследовано');row('Запах',productive?'Без резкого запаха':'Не исследовано');row('Примесь крови',productive?'Не видна':'Не исследовано');
 row('Нейтрофилы',!productive?'Не исследовано':asthma?'Не обнаружены':purulent?'В большом количестве':'Единичные');row('Эозинофилы',!productive?'Не исследовано':asthma?'В большом количестве':'Не обнаружены');row('Плоский эпителий',productive?'Единичные':'Не исследовано');row('Альвеолярные макрофаги',productive?'Единичные':'Не исследовано');
 for(const n of ['Спирали Куршмана','Кристаллы Шарко—Лейдена'])row(n,!productive?'Не исследовано':asthma?'Обнаружены':'Не обнаружены');row('Эластические волокна',productive?'Не обнаружены':'Не исследовано');
 let lab={title:microTitle,rows},o=c.orders.find(o=>o.id==='o.sput_micro');let res=summary(lab);registerResult(lab,res);
 orders.push({...o,id:o?.id||'o.sput_micro',cat:'order',label:microTitle,need:[['мокрот','sputum','қақырық']],no:['посев','культур','бактериолог','куб','кислотоуст','микобактер','afb','culture','себінді','қтб'],w:1,weight:o?.weight||0,role:o?.role||'available',result:res,lab,labExtra:productive?'':noSample,hint:extraHint});
 const culture=c.orders.find(o=>['o.sput_culture','o.culture'].includes(o.id));
 rows=[];row('Материал',productive?'Мокрота':'Материал не получен');
 let available=productive&&c.id!=='chronic-bronchitis-bekova';
 if(!available)row('Результат посева','Не исследовано');
 else if(c.id==='bronchiectasis-abenov'){
 row('Результат посева','Haemophilus influenzae, 10⁷ КОЕ/мл');row('Амоксициллин/клавуланат','S — чувствителен');row('Ампициллин','R — устойчив');
 }else if(c.id==='cf-omarov'){
 row('Результат посева','Pseudomonas aeruginosa, 10⁷ КОЕ/мл');row('Фенотип','Мукоидный');for(const drug of ['Ципрофлоксацин','Цефтазидим','Тобрамицин'])row(drug,'S — чувствителен');
 }else row('Результат посева','Рост патогенной флоры не выявлен');
 lab={title:cultureTitle,rows};res=summary(lab);registerResult(lab,res);
 orders.push({...culture,id:culture?.id||'o.sput_culture',cat:'order',label:cultureTitle,need:[['посев','культур','бактериолог','culture','себінді']],no:['моч','urine','зәр'],w:2,weight:culture?.weight||0,role:culture?.role||'available',result:res,lab,labExtra:!productive?noSample:culture?.result||'',hint:culture?.hint||extraHint});
 return {exams,orders};
}
make.saveLocales=function(){for(const l of ['en','kk']){fs.writeFileSync('site/locales/'+l+'.json',JSON.stringify(dictionaries[l],null,2)+'\n');fs.writeFileSync('site/locales/'+l+'.js','window.'+l.toUpperCase()+'_MESSAGES = '+JSON.stringify(dictionaries[l])+';\n');}};
module.exports=make;
