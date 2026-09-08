'use strict';
const fs=require('fs'),vm=require('vm');const texts=new Set(),spoken=[];
function add(s){if(typeof s==='string'&&/[а-яё]/i.test(s)&&!s.includes('media/')&&!s.includes('http'))texts.add(s.replace(/\s+/g,' ').trim());}
const skip=new Set(['id','need','no','also','not','audio','img','file','src','url','ref','gender','kind','cat','correct','done']);
function walk(o){if(typeof o==='string')return add(o);if(Array.isArray(o))return o.forEach(walk);if(o&&typeof o==='object')for(const[k,v]of Object.entries(o)){if(skip.has(k))continue;if(typeof v==='string')add(v);else walk(v);}}
let box={window:{}};vm.createContext(box);vm.runInContext(fs.readFileSync('site/characters/manifest.js','utf8'),box);walk(box.window.CHARACTER_MANIFEST);
for(const m of box.window.CHARACTER_MANIFEST){box.window.CASES=[];vm.runInContext(fs.readFileSync('site/characters/'+m.file,'utf8'),box);const c=box.window.CASES[0];walk(c);function speech(o){if(!o||typeof o!=='object')return;if(o.audio&&o.text)spoken.push({caseId:c.id,gender:c.patient.gender,source:o.audio,text:o.text});Object.values(o).forEach(v=>{if(typeof v==='object')speech(v)});}speech(c);}
// Parse JavaScript syntax, including strings in HTML templates and dynamic labels.
const acorn=require('./localization/node_modules/acorn');
function astWalk(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='Literal'&&typeof node.value==='string')add(node.value);
 if(node.type==='TemplateElement')add(node.value.cooked);
 for(const [key,value]of Object.entries(node)){if(key==='value'&&node.type==='Literal')continue;if(Array.isArray(value))value.forEach(astWalk);else if(value&&typeof value==='object')astWalk(value);}
}
for(const f of fs.readdirSync('site').filter(f=>f.endsWith('.js')&&!['i18n.js','nlu-kk.js','pronunciation.js','nlu.js'].includes(f))){
 astWalk(acorn.parse(fs.readFileSync('site/'+f,'utf8'),{ecmaVersion:'latest',sourceType:'script'}));
}
fs.mkdirSync('site/locales',{recursive:true});fs.writeFileSync('/tmp/disease-locale-raw.json',JSON.stringify([...texts]));fs.writeFileSync('site/locales/spoken-source.json',JSON.stringify(spoken));console.log(texts.size+' raw strings, '+spoken.length+' spoken lines');
