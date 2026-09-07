/* Real, independently sourced teaching examples. Never presented as this fictional patient's recording.
   Author labels checked 2026-09-07; not independently adjudicated by a local clinical instructor.
   SHA-256, provenance and transformations: sources/clinical/manifest.json. */
window.CLINICAL_MEDIA = [
  { id:'ecg01', kind:'ecg', file:'media/clinical/ecg-01.jpg', title:'ЭКГ 01',
    prompt:'Оцените регулярность RR и предсердную активность. Какие признаки поддерживают вашу гипотезу?',
    diagnosis:'Фибрилляция предсердий',
    findings:['На длинных ритмограммах интервалы RR неодинаковы.','Нет последовательных одинаковых зубцов P перед каждым QRS; базовая линия имеет колебания.','Размеченные полосы II и V1 помогают проверить ритм на длинном фрагменте.'],
    limit:'Пример из ECGpedia; не запись Нургалиева. Не переносите частоту этой записи в показатели вымышленного случая. Для расчёта ЧСС сначала подтвердите скорость записи.',
    author:'CardioNetworks / ECGpedia', source:'https://commons.wikimedia.org/wiki/File:Afib_ecg_(CardioNetworks_ECGpedia).jpg', license:'CC BY-SA 3.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/', changes:'Без изменений изображения.',
    marks:[{x:3,y:53,w:93,h:13,label:'1 · длинная V1'},{x:3,y:69,w:93,h:13,label:'2 · длинная II'}] },
  { id:'heart01', kind:'audio', file:'media/clinical/heart-01.mp3', title:'Аудио 01',
    prompt:'Выслушайте запись в наушниках. Опишите регулярность, основные тоны и наличие дополнительных звуков.',
    diagnosis:'Нормальные тоны сердца — референсная запись',
    findings:['По исходной разметке автора: нормальные тоны при частоте около 70/мин.','Сравните повторение пары тонов и длительность пауз с другой аудиозаписью.'],
    limit:'Точка выслушивания в источнике не указана. Это образец для сравнения, а не полный нормальный осмотр и не запись одного из виртуальных пациентов.',
    author:'James Heilman, MD',source:'https://commons.wikimedia.org/wiki/File:HROgg.ogg',license:'CC0 1.0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',changes:'OGG перекодирован в MP3; темп, высота и структура не изменены.' },
  { id:'ecg02', kind:'ecg', file:'media/clinical/ecg-02.jpg', title:'ЭКГ 02',
    prompt:'Опишите изменения ST в разных отведениях. Достаточно ли одной ЭКГ для окончательного диагноза?',
    diagnosis:'ЭКГ из случая острого перикардита',
    findings:['В исходном описании отмечен небольшой подъём ST во многих отведениях.','Сопоставьте отмеченные области II и V5 с остальными отведениями.','Одна ЭКГ не устанавливает причину боли: нужны анамнез, осмотр и дополнительные исследования.'],
    limit:'Исходный пример James Heilman; не запись Алимова. Разметка показывает области для обсуждения, не измеряет амплитуду и не служит самостоятельным диагностическим критерием.',
    author:'James Heilman, MD', source:'https://commons.wikimedia.org/wiki/File:Acute_pericarditis.jpg',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',changes:'Исходная фотография без изменений; учебные рамки накладываются интерфейсом.',
    marks:[{x:1,y:29,w:23,h:14,label:'1 · II'},{x:74,y:29,w:24,h:14,label:'2 · V5'}] },
  { id:'heart02', kind:'audio', file:'media/clinical/heart-02.mp3', title:'Аудио 02',
    prompt:'Опишите последовательность сокращений. Какое исследование нужно для подтверждения предполагаемого нарушения ритма?',
    diagnosis:'Нерегулярный ритм: запись при тахисистолической ФП',
    findings:['Исходная разметка автора: rapid atrial fibrillation.','Слушайте изменчивость пауз между сокращениями, сравните с аудио 01.','Аускультация обнаруживает нерегулярность; тип аритмии подтверждается ЭКГ.'],
    limit:'В источнике нет синхронной ЭКГ и точной ЧСС. Это отдельная запись; она не синхронизирована с ЭКГ 01 и не воспроизводит заданные 124/мин виртуального пациента.',
    author:'James Heilman, MD',source:'https://commons.wikimedia.org/wiki/File:AfibO.ogg',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',changes:'OGG перекодирован в MP3; темп, высота и структура не изменены.' }
];
