const fs=require('fs'),vm=require('vm'),assert=require('assert');
let now=100000,timer,played=[],paused=0,allowed=true,store={};
const box={window:{},Audio:function(){this.pause=()=>paused++;this.play=()=>{played.push(this.src);return Promise.resolve();};},Date:{now:()=>now},Math,localStorage:{getItem:k=>store[k],setItem:(k,v)=>store[k]=v},setTimeout:f=>(timer=f,1),clearTimeout:()=>timer=null};
vm.runInNewContext(fs.readFileSync('site/patient-sounds.js','utf8'),box);
function make(caseId,gender='male'){return box.window.PatientSounds.create({caseId,gender,canPlay:()=>allowed});}
function tick(){if(timer){const f=timer;timer=null;f();}}
let s=make('copd-tulegenov');s.afterReply();s.afterReply();tick();assert.equal(played.length,0);s.afterReply();tick();assert(played[0].endsWith('cough-9.mp3'));
for(let i=0;i<10;i++)s.afterReply();tick();assert.equal(played.length,1);
now+=46000;s.afterReply();s.stop();tick();assert.equal(played.length,1);
s.afterReply();allowed=false;tick();assert.equal(played.length,1);allowed=true;
s.setEnabled(false);now+=46000;s.afterReply();tick();assert.equal(played.length,1);assert.equal(make('copd-tulegenov').enabled(),false);
s.setEnabled(true);s.reset();s.afterReply();s.afterReply();tick();assert.equal(played.length,1);
for(const id of ['hypertension-saparov','pericarditis-alimov','chronic-bronchitis-bekova','unknown'])assert(!make(id).available);
assert(!make('asthma-eszhanova','male').available);assert(make('asthma-eszhanova','female').available);
for(const n of [6,8,9])assert(fs.statSync(`site/media/patient-sounds/cough-${n}.mp3`).size>1000);
console.log('OK case/gender mapping, frequency, cooldown, cancellation, busy guard, persisted mute and assets.');
