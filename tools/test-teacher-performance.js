const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage(),errors=[],requested=[],fail=new Set();let active=0,peak=0;
 page.on('pageerror',e=>errors.push(e.message));
 let html=fs.readFileSync(root+'/site/teacher.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace('class="access-pending"','');
 await page.route('https://teacher.test/**',async route=>{
   const file=new URL(route.request().url()).pathname.slice(1);
   if(!file){await route.fulfill({contentType:'text/html',body:html});return;}
   if(file.startsWith('characters/')&&!file.endsWith('manifest.js')){
     requested.push(file);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,40));active--;
     if(fail.delete(file)){await route.fulfill({status:503,body:'Unavailable'});return;}
   }
   if(['constructor.js','media-studio.js'].includes(file)){
     requested.push(file);await route.fulfill({contentType:'text/javascript',body:'window.loadedTools=(window.loadedTools||[]).concat('+JSON.stringify(file)+');'});return;
   }
   const full=path.join(root,'site',file);
   if(fs.existsSync(full)&&fs.statSync(full).isFile())await route.fulfill({path:full});else await route.fulfill({status:404,body:''});
 });
 await page.goto('https://teacher.test/');
 await page.evaluate(()=>{
   window.LearningAccess={loadScript:async function(src){const r=await fetch(src);if(!r.ok)throw Error('load_failed');const text=await r.text();const s=document.createElement('script');s.textContent=text;document.head.append(s);}};
 });
 for(const file of ['score.js','teacher-loader.js','characters/manifest.js','teacher.js'])await page.addScriptTag({path:root+'/site/'+file});
 await page.locator('#methodBody .m-head').waitFor();
 assert.equal(requested.filter(x=>x.startsWith('characters/')).length,1,'Initial manual must fetch only one case');
 assert(!requested.includes('constructor.js'),'Constructor must stay deferred');
 assert.equal(await page.locator('#methodBody details[open]').count(),1,'Only introduction expanded');
 await page.locator('#casePicker > summary').click();
 await page.locator('#caseSearch').fill('zzzz-no-case');
 assert.equal(await page.locator('#charTabs button').count(),0);
 assert.equal(requested.length,1,'Search does not fetch cases');
 await page.locator('#caseSearch').fill('');
 assert.equal(await page.locator('#charTabs button').count(),12);
 const second=await page.evaluate(()=>window.CHARACTER_MANIFEST[1].file);
 fail.add('characters/'+second);await page.locator('#charTabs button').nth(1).click();
 await page.getByRole('button',{name:'Повторить загрузку'}).waitFor();
 await page.getByRole('button',{name:'Повторить загрузку'}).click();await page.locator('#methodBody .m-head').waitFor();
 const calls=requested.length;await page.locator('#casePicker > summary').click();await page.locator('#charTabs button').nth(0).click();await page.locator('#methodBody .m-head').waitFor();assert.equal(requested.length,calls,'Cached case does not fetch again');
 // Rapid selection must leave the last selected case visible.
 await page.locator('#casePicker > summary').click();await page.locator('#charTabs button').nth(2).click();await page.locator('#casePicker > summary').click();await page.locator('#charTabs button').nth(3).click();
 await page.waitForFunction(()=>document.querySelector('#methodBody h2')?.textContent===window.CASES.find(c=>c.id===window.CHARACTER_MANIFEST[3].file.replace('.js',''))?.title);
 await page.locator('[data-tab="journal"]').click();await page.waitForFunction(()=>!document.querySelector('#tab-journal').classList.contains('teacher-waiting'));
 assert.equal(await page.evaluate(()=>window.CASES.length),12);assert(peak<=3,'Journal concurrency limit');
 await page.locator('[data-tab="constructor"]').click();await page.waitForFunction(()=>!document.querySelector('#tab-constructor').classList.contains('teacher-waiting'));
 assert.deepEqual(await page.evaluate(()=>window.loadedTools),['constructor.js','media-studio.js']);
 await page.locator('[data-tab="method"]').click();await page.locator('[data-tab="constructor"]').click();assert.equal(requested.filter(x=>x==='constructor.js').length,1);
 // Incremental translation: mutating one node must not scan the whole document.
 await page.addScriptTag({path:root+'/site/locales/en.js'});await page.addScriptTag({path:root+'/site/locales/kk.js'});
 await page.addScriptTag({path:root+'/site/i18n.js'});
 await page.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await page.evaluate(()=>{
   window.walkRoots=[];const original=document.createTreeWalker.bind(document);
   document.createTreeWalker=function(node,...rest){walkRoots.push(node===document.body?'body':node.nodeName);return original(node,...rest);};
   const el=document.createElement('span');el.id='perf-clock';el.textContent='00:00';document.body.append(el);
 });
 await page.waitForTimeout(30);await page.evaluate(()=>{walkRoots=[];document.getElementById('perf-clock').firstChild.nodeValue='00:01';});await page.waitForTimeout(30);
 assert(!(await page.evaluate(()=>walkRoots)).includes('body'),'One timer tick must not scan the body');
 await page.evaluate(()=>I18n.setLanguage('kk'));assert.equal(await page.locator('html').getAttribute('lang'),'kk');
 await page.evaluate(()=>{const el=document.createElement('textarea');el.id='perf-input';el.placeholder='Осмотреть';document.body.append(el);});await page.waitForTimeout(30);
 assert.equal(await page.locator('#perf-input').getAttribute('placeholder'),'Қарап тексеру');
 await page.evaluate(()=>I18n.setLanguage('ru'));assert.equal(await page.locator('#perf-input').getAttribute('placeholder'),'Осмотреть');
 await page.locator('[data-tab="method"]').click();
 assert.equal(await page.locator('#ttabs .is-on').count(),1);
 const fold=page.locator('#methodBody .teacher-fold').nth(1);
 await fold.locator('summary').focus();await page.keyboard.press('Enter');
 assert(await fold.evaluate(el=>el.open),'Sections open with keyboard');
 await page.keyboard.press('Enter');
 await page.setViewportSize({width:1440,height:1000});
 await page.waitForTimeout(200);
 await page.screenshot({path:'/tmp/teacher-simple.png'});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on mobile');
 assert.deepEqual(errors,[]);
 console.log('OK browser: initial 1/12 case request, retry, cached navigation, rapid selection, journal concurrency <=3, deferred tools once, incremental translation and textarea RU/KK round trip.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
