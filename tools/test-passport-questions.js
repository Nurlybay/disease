const fs=require('fs'),vm=require('vm'),assert=require('assert');
const box={window:{}};vm.runInNewContext(fs.readFileSync('site/passport-questions.js','utf8'),box);const ids=q=>Array.from(box.window.PassportQuestions.ids(q,'Ответ пациента.'));
assert.deepEqual(ids('Как вас зовут? Сколько вам лет? Где работаете? Есть ли аллергии?'),['p.name','p.age','p.allergy','p.job']);
assert.deepEqual(ids('What is your name? How old are you? What is your job? Any allergies?'),['p.name','p.age','p.allergy','p.job']);
assert.deepEqual(ids('Атыңыз кім? Жасыңыз нешеде? Қайда жұмыс істейсіз? Аллергия бар ма?'),['p.name','p.age','p.allergy','p.job']);
assert.deepEqual(ids('Сколько лет кашляете? Как называется лекарство?'),[]);
assert.deepEqual(ids('Назначить аллерготест'),[]);
assert.deepEqual(Array.from(box.window.PassportQuestions.ids('Сколько вам лет?','Не скажу.')),[]);
console.log('OK compound passport questions RU/KK/EN; symptom duration, tests and refused answers excluded.');
