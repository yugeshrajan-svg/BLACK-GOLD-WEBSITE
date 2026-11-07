// Local-only browser regression checks. No production forms or external navigation.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const base=new URL(process.env.BLACKGOLD_TEST_URL || 'http://127.0.0.1:4300/');
if(base.protocol!=='http:' || base.hostname!=='127.0.0.1' || base.username || base.password || base.search || base.hash || base.pathname!=='/') throw new Error('Browser checks only accept an explicit loopback HTTP root.');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({channel:'chrome',headless:true});
const screenshots=process.env.BLACKGOLD_SCREENSHOTS ? resolve(process.env.BLACKGOLD_SCREENSHOTS) : null;
if(screenshots)mkdirSync(screenshots,{recursive:true});
let checked=0;
try {
for(const [name,width,height] of [['phone',390,844],['android-sized',412,839],['desktop',1440,900]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[];const unexpected=[];const policies=[];
 await context.route('**/*',route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin!==base.origin || !['GET','HEAD'].includes(request.method())){unexpected.push(request.method()+' '+u.origin+u.pathname);return route.abort();}
   return route.continue();
 });
 page.on('pageerror',error=>errors.push(error.message));
 await page.exposeFunction('recordPolicy',directive=>policies.push(directive));
 await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordPolicy(e.effectiveDirective)));
 for(const file of ['index.html','about.html','collect.html','industry.html','faq.html','seller-app.html']){
   const response=await page.goto(new URL(file,base).href,{waitUntil:'networkidle'});
   assert.equal(response.status(),200);
   assert.equal(response.headers()['x-content-type-options'],'nosniff');
   assert.equal(response.headers()['x-frame-options'],'DENY');
   assert.ok(response.headers()['content-security-policy'],'Run preview with --csp-enforce');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' '+file+' horizontal overflow');
   assert.equal(await page.locator('h1').count(),1);
   if(width<1025){
     await page.locator('.menu').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');
     assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'index.html','Menu -> Tab must enter Home');
     await page.keyboard.press('Escape');
     assert.equal(await page.locator('.menu').getAttribute('aria-expanded'),'false');
     assert.equal(await page.locator('.menu').evaluate(e=>e===document.activeElement),true);
   }
   await page.locator('.footer [data-app]').click();
   await page.locator('#app-dialog [data-download-enquiry]').click();
   assert.equal(await page.locator('dialog[open]').count(),1,'Only one modal should remain');
   assert.equal(await page.locator('#pickup-dialog').evaluate(e=>e.open),true);
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.documentElement.classList.contains('menu-locked'));
   checked++;
 }
 await page.goto(base.href,{waitUntil:'networkidle'});
 await page.locator('.hero [data-download-enquiry]').click();
 await page.locator('#pickup-form button[type=submit]').click();
 assert.equal(await page.locator('#pickup-form .field.invalid').count(),4);
 await page.locator('[name=business]').fill('QA synthetic workshop');
 await page.locator('[name=phone]').fill('12345');
 await page.locator('[name=area]').selectOption('Guindy');
 await page.locator('[name=quantity]').fill('49');
 await page.locator('#pickup-form button[type=submit]').click();
 assert.equal(await page.locator('[name=phone]').getAttribute('aria-invalid'),'true');
 assert.equal(await page.locator('[name=quantity]').getAttribute('aria-invalid'),'true');
 await page.locator('[name=phone]').fill('9876543210');
 await page.locator('[name=quantity]').fill('50');
 await page.locator('#pickup-form button[type=submit]').click();
 const draft=await page.locator('#enquiry-text').textContent();
 assert.match(draft,/no pickup has been booked/);
 const wa=new URL(await page.locator('#whatsapp-enquiry').getAttribute('href'));
 assert.equal(wa.searchParams.get('text'),draft); // Inspect only: never navigate/send.
 await page.locator('#edit-enquiry').click();
 await page.locator('[name=quantity]').fill('75');
 await page.locator('#pickup-form button[type=submit]').click();
 assert.match(await page.locator('#enquiry-text').textContent(),/75 Litres/);
 await page.keyboard.press('Escape');
 if(width<1025){
   await page.locator('.menu').click();await page.setViewportSize({width:1280,height:900});
   assert.equal(await page.locator('.menu').getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('main').evaluate(e=>e.inert),false);
   await page.setViewportSize({width,height});
 }
 await page.goto(new URL('faq.html',base).href,{waitUntil:'networkidle'});
 await page.locator('#faq-search').fill('fleet');
 assert.equal(await page.locator('#faq-fleet').isVisible(),true);
 await page.locator('#faq-fleet summary').click();
 assert.match(await page.locator('#faq-fleet').textContent(),/confirm fleet or depot eligibility/);
 if(screenshots){await page.goto(base.href,{waitUntil:'networkidle'});await page.screenshot({path:resolve(screenshots,name+'.png'),fullPage:false});}
 assert.deepEqual(errors,[],name+' page errors');
 assert.deepEqual(unexpected,[],name+' unexpected network writes/destinations');
 assert.deepEqual(policies,[],name+' CSP violations');
 await context.close();
}
console.log('PASS: '+checked+' page/viewport combinations; keyboard menu, modal handoff, synthetic draft validation, edits, fleet FAQ, no external requests and no enforced-CSP violations.');
} finally {await browser.close();}
