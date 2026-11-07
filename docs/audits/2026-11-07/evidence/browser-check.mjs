import { chromium, devices } from '/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
for(const [name,options] of [['android',devices['Pixel 7']],['iphone-chromium',devices['iPhone 13']],['desktop',{viewport:{width:1440,height:900}}]]){
 const context=await browser.newContext(options);const page=await context.newPage();const errors=[];const failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()}));
 await page.goto('https://www.myblackgold.app/',{waitUntil:'load'});
 await page.screenshot({path:'/tmp/blackgold-audit/'+name+'.png'});
 const data=await page.evaluate(()=>({url:location.href,viewport:[innerWidth,innerHeight],ua:navigator.userAgent,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),resources:performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.transferSize})),timing:performance.getEntriesByType('navigation').map(n=>({domReady:n.domContentLoadedEventEnd,load:n.loadEventEnd})),buttons:[...document.querySelectorAll('.hero a[href]')].map(a=>({text:a.textContent.trim(),href:a.href,box:a.getBoundingClientRect().toJSON()}))}));
 if(name!=='desktop'){await page.locator('.menu').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');data.menuNextFocus=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent.trim().slice(0,40)}));await page.keyboard.press('Escape');}
 await page.emulateMedia({reducedMotion:'reduce'});data.reduced=await page.evaluate(()=>({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,paused:document.documentElement.classList.contains('motion-paused')}));
 for(const id of ['seller-app','our-promises','pickup-process']){const el=page.locator('#'+id);if(await el.count())await el.scrollIntoViewIfNeeded();}
 data.afterScroll=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)}));
 data.cookies=(await context.cookies()).map(c=>({name:c.name,secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite}));results.push({name,...data,errors,failed});await context.close();
}
const context=await browser.newContext(devices['Pixel 7']);const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular3g'});
await page.addInitScript(()=>{window.auditCLS=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.auditCLS+=e.value}).observe({type:'layout-shift',buffered:true});});
await page.goto('https://myblackgold.app/',{waitUntil:'load',timeout:90000});await page.locator('.hero [data-app-download="apk"]').waitFor({state:'visible'});results.push({name:'slow-mobile-1.6Mbps-150ms',...await page.evaluate(()=>({viewport:[innerWidth,innerHeight],timing:performance.getEntriesByType('navigation').map(n=>({domReady:n.domContentLoadedEventEnd,load:n.loadEventEnd})),paint:performance.getEntriesByType('paint').map(p=>({name:p.name,ms:p.startTime})),cls:window.auditCLS,ctaObservedVisibleAtMs:performance.now()}))});
writeFileSync('/tmp/blackgold-audit/browser-results.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify(results,null,2));
