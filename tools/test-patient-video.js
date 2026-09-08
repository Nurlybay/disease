'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('site/app.js','utf8');
const fn=src.slice(src.indexOf('  function switchVideo(which) {'),src.indexOf('\n  /* ===',src.indexOf('  function switchVideo(which) {')));
function element(){return {hidden:false,playing:false,classList:{add(){},remove(){}},pause(){this.playing=false},play(){this.playing=true;return Promise.resolve()}};}
const els={videoIdle:element(),videoThroat:element(),patientPortrait:element(),videoBadge:element()};
const ctx={CASE:{patient:{portrait:'portrait.png',idleVideo:'idle.mp4',coughVideo:'cough.mp4'}},motionEnabled:true,$:id=>els[id]};vm.createContext(ctx);vm.runInContext(fn,ctx);
ctx.switchVideo('idle');assert(els.videoIdle.playing);assert(els.patientPortrait.hidden);
ctx.switchVideo('cough');assert.equal(els.videoThroat.src,'cough.mp4');assert(els.videoThroat.playing);assert(!els.videoIdle.playing);
ctx.switchVideo('idle');assert(!els.videoThroat.playing);assert(els.videoThroat.hidden);assert(els.videoIdle.playing);
ctx.motionEnabled=false;ctx.switchVideo('idle');assert(!els.videoIdle.playing);
ctx.CASE.patient={portrait:'portrait.png'};ctx.switchVideo('throat');assert(!els.patientPortrait.hidden);assert(els.videoIdle.hidden);
ctx.CASE.patient={idleVideo:'legacy.mp4',throatVideo:'throat.mp4'};ctx.switchVideo('throat');assert.equal(els.videoThroat.src,'throat.mp4');assert(els.videoThroat.playing);
console.log('OK video idle, cough, return, pause, portrait fallback and legacy throat.');
