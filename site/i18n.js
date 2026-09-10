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
    if(dictionary[clean]){var exact=text.replace(text.trim(),dictionary[clean]);remember(text,exact);return exact;}
    if(!/[а-яё]/i.test(text))return text;
    // Dynamic labels join complete catalog fragments with names, numbers or punctuation.
    var pieces=[{text:text,done:false}];
    keys.forEach(function(key){
      if(text.indexOf(key)<0)return;
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
    var result=pieces.map(function(p){return p.text;}).join('');remember(text,result);return result;
  }
  function remember(source,result){if(cache.size>=5000)cache.delete(cache.keys().next().value);cache.set(source,result);}
  function ignored(el){return !el||el.closest('script,style,textarea,[data-no-translate],code,pre');}
  function textNode(node){
    if(ignored(node.parentElement))return;
    var old=originals.get(node),text=node.nodeValue;
    if(old&&text===old.rendered&&old.language===lang)return;
    if(!old||text!==old.rendered)old={source:text};
    old.rendered=translate(old.source);old.language=lang;
    if(text!==old.rendered)node.nodeValue=old.rendered;originals.set(node,old);
  }
  function element(el){
    if(!el||el.closest('script,style,[data-no-translate],code,pre'))return;
    var saved=attributes.get(el)||{};
    ['placeholder','title','aria-label','alt'].forEach(function(a){
      if(!el.hasAttribute(a))return;var val=el.getAttribute(a),old=saved[a];
      if(old&&val===old.rendered&&old.language===lang)return;
      if(!old||val!==old.rendered)old={source:val};old.rendered=translate(old.source);old.language=lang;
      if(val!==old.rendered)el.setAttribute(a,old.rendered);saved[a]=old;
    });attributes.set(el,saved);
    if(el.tagName==='A'&&el.hasAttribute('href')){
      try{var url=new URL(el.getAttribute('href'),location.href);if(url.origin===location.origin&&(/\.html$/.test(url.pathname)||url.pathname.endsWith('/'))){url.searchParams.set('lang',lang);if(el.href!==url.href)el.href=url.href;}}catch(e){}
    }
  }
  function subtree(rootNode){
    if(rootNode.nodeType===3){textNode(rootNode);return;}
    if(rootNode.nodeType!==1)return;
    element(rootNode);
    if(ignored(rootNode))return;
    var walk=document.createTreeWalker(rootNode,NodeFilter.SHOW_TEXT),node;
    while((node=walk.nextNode()))textNode(node);
    rootNode.querySelectorAll('[placeholder],[title],[aria-label],[alt],a[href]').forEach(element);
  }
  function observe(){if(observer)observer.observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt','href']});}
  function changed(records){
    var roots=[];
    records.forEach(function(r){
      if(r.type==='childList')Array.prototype.forEach.call(r.addedNodes,function(n){roots.push(n);});
      else roots.push(r.target);
    });
    roots=roots.filter(function(n,i){return n.isConnected&&roots.indexOf(n)===i&&!roots.some(function(other,j){return i!==j&&other!==n&&other.nodeType===1&&other.contains(n);});});
    if(!roots.length)return;
    observer.disconnect();
    try{roots.forEach(subtree);}finally{observe();}
  }
  function render(){
    if(!document.body)return;
    if(observer)observer.disconnect();
    try{
      subtree(document.body);
      document.documentElement.lang=lang;document.title=translate(originalTitle);
      var picker=document.getElementById('appLanguage');if(picker)picker.value=lang;
    }finally{observe();}
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
    observer=new MutationObserver(changed);render();
  });
})(window);
