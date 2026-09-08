/* Local RU/KK/EN presentation. No runtime translation requests; medical/scoring data stay canonical. */
(function(root){
  'use strict';
  var params=new URLSearchParams(location.search), lang=params.get('lang');
  if(!['ru','kk','en'].includes(lang)){try{lang=localStorage.getItem('vp.language.v1');}catch(e){}}
  lang=['ru','kk','en'].includes(lang)?lang:'ru';
  try{localStorage.setItem('vp.language.v1',lang);}catch(e){}
  var originalTitle=document.title;
  var dictionary={}, keys=[];
  function selectDictionary(){dictionary=(lang==='en'?root.EN_MESSAGES:root.KK_MESSAGES)||{};keys=Object.keys(dictionary).filter(function(k){return k.length>=3;}).sort(function(a,b){return b.length-a.length;});if(cache)cache.clear();}
  selectDictionary();
  var originals=new WeakMap(), attributes=new WeakMap(), observer, cache=new Map();
  function translate(text){
    if(lang==='ru'||typeof text!=='string')return text;
    if(cache.has(text))return cache.get(text);
    var clean=text.replace(/\s+/g,' ').trim();
    if(dictionary[clean])return text.replace(text.trim(),dictionary[clean]);
    // Dynamic labels join complete catalog fragments with names, numbers or punctuation.
    var pieces=[{text:text,done:false}];
    keys.forEach(function(key){
      pieces=pieces.reduce(function(out,p){
        if(p.done||p.text.indexOf(key)<0){out.push(p);return out;}
        var start=0,index,matched=false,letter=/[a-zа-яёәғқңөұүһі]/i;
        while((index=p.text.indexOf(key,start))>=0){
          var end=index+key.length;
          if((letter.test(key[0])&&index>0&&letter.test(p.text[index-1]))||(letter.test(key[key.length-1])&&end<p.text.length&&letter.test(p.text[end]))){start=index+1;continue;}
          if(index)out.push({text:p.text.slice(0,index),done:false});out.push({text:dictionary[key],done:true});
          p={text:p.text.slice(end),done:false};start=0;matched=true;
        }
        if(p.text||!matched)out.push(p);return out;
      },[]);
    });
    var result=pieces.map(function(p){return p.text;}).join('');cache.set(text,result);return result;
  }
  function ignored(el){return !el||el.closest('script,style,textarea,[data-no-translate],code,pre');}
  function render(){
    if(!document.body)return;
    if(observer)observer.disconnect();
    var walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),node;
    while((node=walk.nextNode())){
      if(ignored(node.parentElement))continue;
      var old=originals.get(node),text=node.nodeValue;
      if(!old||text!==old.rendered)old={source:text};
      old.rendered=translate(old.source);if(text!==old.rendered)node.nodeValue=old.rendered;originals.set(node,old);
    }
    document.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(function(el){
      if(el.closest('script,style,[data-no-translate],code,pre'))return;
      var saved=attributes.get(el)||{};
      ['placeholder','title','aria-label','alt'].forEach(function(a){
        if(!el.hasAttribute(a))return;var val=el.getAttribute(a),old=saved[a];
        if(!old||val!==old.rendered)old={source:val};old.rendered=translate(old.source);
        if(val!==old.rendered)el.setAttribute(a,old.rendered);saved[a]=old;
      });attributes.set(el,saved);
    });
    document.querySelectorAll('a[href]').forEach(function(a){
      try{var url=new URL(a.getAttribute('href'),location.href);if(url.origin===location.origin&&(/\.html$/.test(url.pathname)||url.pathname.endsWith('/'))){url.searchParams.set('lang',lang);a.href=url.href;}}catch(e){}
    });
    document.documentElement.lang=lang;
    document.title=translate(originalTitle);
    var picker=document.getElementById('appLanguage');if(picker)picker.value=lang;
    if(observer)observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});
  }
  function setLanguage(value){
    if(!['ru','kk','en'].includes(value))return;
    lang=value;selectDictionary();try{localStorage.setItem('vp.language.v1',lang);}catch(e){}
    var url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);
    render();root.dispatchEvent(new CustomEvent('languagechange',{detail:{language:lang}}));
  }
  root.I18n={language:function(){return lang;},locale:function(){return {ru:'ru-RU',kk:'kk-KZ',en:'en-US'}[lang];},t:translate,setLanguage:setLanguage,
    audio:function(src){return (root.PATIENT_VOICES&&root.PATIENT_VOICES[lang]&&root.PATIENT_VOICES[lang][src])|| (lang==='ru'||(src&&src.indexOf('media/voice/')<0)?src:null);},render:render};
  ['alert','confirm'].forEach(function(name){var original=root[name];root[name]=function(message){return original.call(root,translate(message));};});
  document.addEventListener('DOMContentLoaded',function(){
    var picker=document.createElement('label');picker.className='language-picker';picker.setAttribute('data-no-translate','');
    picker.innerHTML='<span>Тіл / Язык / Language</span> <select id="appLanguage" aria-label="Тіл / Язык / Language"><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select>';
    var header=document.querySelector('header')||document.body;header.appendChild(picker);
    document.getElementById('appLanguage').addEventListener('change',function(){setLanguage(this.value);});
    observer=new MutationObserver(render);render();
  });
})(window);
