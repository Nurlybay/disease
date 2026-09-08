/* Scenario-matched, nonverbal coughs. See media/patient-sounds/README.md. */
(function(root){
 'use strict';
 var profiles={
  'asthma-eszhanova':{gender:'female',src:'media/patient-sounds/cough-6.mp3'},
  'bronchiectasis-abenov':{gender:'male',src:'media/patient-sounds/cough-8.mp3'},
  'cf-omarov':{gender:'male',src:'media/patient-sounds/cough-8.mp3'},
  'copd-tulegenov':{gender:'male',src:'media/patient-sounds/cough-9.mp3'}
 };
 root.PatientSounds={create:function(options){
  var profile=profiles[options.caseId],audio=new Audio(),enabled=true,turns=0,next=3,last=0,timer=null;
  if(profile && profile.gender!==options.gender)profile=null;
  audio.volume=.5;audio.preload='none';
  try{enabled=localStorage.getItem('vp.patient-sounds.v1')!=='off';}catch(e){}
  function stop(){if(timer!==null)clearTimeout(timer);timer=null;audio.pause();}
  return {
   available:!!profile, enabled:function(){return enabled;}, stop:stop,
   reset:function(){stop();turns=0;next=3;last=0;},
   setEnabled:function(value){enabled=!!value;stop();try{localStorage.setItem('vp.patient-sounds.v1',enabled?'on':'off');}catch(e){}},
   afterReply:function(){
    if(!profile||!enabled)return;
    turns++;
    if(turns<next || (last && Date.now()-last<45000))return;
    stop();
    timer=setTimeout(function(){
     timer=null;
     if(!enabled||!options.canPlay())return;
     audio.src=profile.src;audio.currentTime=0;
     last=Date.now();next=turns+3+Math.floor(Math.random()*3);
     audio.play().catch(function(){});
    },500);
   }
  };
 }};
})(window);
