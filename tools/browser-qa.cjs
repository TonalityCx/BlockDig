const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const root=path.resolve(__dirname,'..'),reportDir=path.resolve(root,process.env.BLOCKDIG_QA_REPORT_DIR||'docs/validation'),out=path.join(reportDir,'screenshots');fs.mkdirSync(out,{recursive:true});
const target=new URL(process.env.BLOCKDIG_QA_URL||'http://localhost:4173/');target.searchParams.set('qa','1');
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,channel:'chrome',args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],failedRequests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failedRequests.push(r.status()+' '+r.url());});
 const state=()=>page.evaluate(()=>window.__BLOCKDIG__.state());
 const click=async id=>{const button=(await state()).buttons[id];assert(button,'Missing button '+id);await page.touchscreen.tap(button.x,button.y);};
 const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
 const mark=message=>{checks.push(message);console.log('PASS '+message);};
 try{
  await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__BLOCKDIG__?.state().page==='home');await shot('01-home');
  await click('start');assert.equal((await state()).page,'tutorial');await shot('02-tutorial');await click('tutorial-done');
  assert((await state()).countdown>0);await page.waitForTimeout(3250);assert.equal((await state()).countdown,0);await shot('03-game');mark('first-run tutorial and countdown');
  await page.evaluate(()=>{const m=window.__BLOCKDIG__.model();m.active={kind:'T',rotation:0,x:4,y:2};m.revision++;});
  const cdp=await context.newCDPSession(page),left=(await state()).buttons.left;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x,y:left.y,id:1}]});
  await page.waitForTimeout(340);let after=await state();assert(after.active.x<=2,'Held movement did not repeat');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:left.x+150,y:left.y-80,id:1}]});
  const stopped=(await state()).active.x;await page.waitForTimeout(250);assert.equal((await state()).active.x,stopped,'Move-out left a stuck input');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});mark('held movement and slide-out cancellation');
  await page.evaluate(()=>{const m=window.__BLOCKDIG__.model();m.active={kind:'T',rotation:0,x:4,y:2};m.revision++;});
  const rotate=(await state()).buttons.rotate;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x,y:left.y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:left.x,y:left.y,id:1},{x:rotate.x,y:rotate.y,id:2}]});
  assert.equal((await state()).active.rotation,1);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});mark('two-finger move and rotate');
  await click('hold');assert.equal((await state()).canHold,false);const held=(await state()).held;await click('hold');assert.equal((await state()).held,held);mark('touch hold limited once per piece');
  const drop=(await state()).buttons.drop,before=(await state()).pieces;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:drop.x,y:drop.y,id:4}]});await page.waitForTimeout(450);
  assert.equal((await state()).pieces,before+1,'Held hard drop consumed multiple pieces');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});mark('hard drop requires a new press');
  await click('pause');assert.equal((await state()).paused,true);const pausedTime=(await state()).elapsed;await page.waitForTimeout(350);assert.equal((await state()).elapsed,pausedTime);await shot('04-pause');
  await click('restart');await click('cancel');assert.equal((await state()).paused,true);assert.equal((await state()).pieces,before+1);
  for(const id of ['restart','back-home']){
    await click(id);assert((await state()).buttons.confirm,'Missing confirmation');
    const snapshot=await state();await page.keyboard.press('Escape');
    const cancelled=await state();assert.equal(cancelled.paused,true,'Escape resumed from '+id+' confirmation');
    assert.equal(cancelled.countdown,snapshot.countdown,'Escape started a resume countdown');
    assert(!cancelled.buttons.confirm,'Escape did not dismiss confirmation');assert(cancelled.buttons.resume,'Missing pause menu after Escape');
    await page.waitForTimeout(250);assert.equal((await state()).elapsed,snapshot.elapsed);assert.equal((await state()).pieces,snapshot.pieces);
  }
  await shot('13-confirm-cancelled');mark('Escape cancels restart and home confirmations while remaining paused');
  await page.keyboard.press('Escape');assert((await state()).countdown>0);await page.waitForTimeout(3200);assert.equal((await state()).paused,false);mark('pause, restart cancellation and resume countdown');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).paused,true);mark('background blur pauses play');
  await click('pause-settings');await click('toggle-sound');await click('toggle-motion');await shot('05-settings');await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__BLOCKDIG__?.state().page==='home');assert.equal((await state()).prefs.sound,false);assert.equal((await state()).prefs.reducedMotion,true);mark('settings persist across reload');
  const witness=JSON.parse(fs.readFileSync(path.join(root,'docs/validation/first-mine-witness.json'),'utf8'));
  await page.evaluate(w=>{const qa=window.__BLOCKDIG__;qa.start(w.seed);for(const move of w.moves){for(const action of move.actions)qa.action(action);if(qa.model().phase==='clearing')qa.advance(200);}},witness);
  assert.equal((await state()).page,'result');assert.equal((await state()).phase,'won');assert.equal((await state()).depth,30);await shot('06-complete');mark('full legal witness reaches the win screen');
  await click('result-home');assert.equal((await state()).records.depth,30);assert((await state()).records.bestMs>0);mark('win updates local records');
  await page.evaluate(()=>{const qa=window.__BLOCKDIG__;qa.start(42);const m=qa.model();m.board[0].cells[0]='rock';qa.action('drop');if(m.phase==='clearing')qa.advance(200);});
  assert.equal((await state()).phase,'lost');assert.equal((await state()).page,'result');await shot('07-failed');mark('failure reaches result screen');
  for(const [width,height]of [[320,568],[360,640],[390,844],[430,932]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);await page.evaluate(()=>window.__BLOCKDIG__.start(42));await page.waitForTimeout(100);
    const s=await state();for(const [id,b]of Object.entries(s.buttons)){assert(b.width>=44&&b.height>=44,'Small touch target '+id);assert(b.x-b.width/2>=0&&b.x+b.width/2<=width,'Horizontal overflow '+id);assert(b.y-b.height/2>=0&&b.y+b.height/2<=height,'Vertical overflow '+id);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    await shot(`08-game-${width}x${height}`);mark(`viewport ${width}x${height}, touch targets and page overflow`);
    if(width===320||width===360){
      await page.evaluate(w=>{const qa=window.__BLOCKDIG__;qa.start(w.seed);for(const move of w.moves){for(const action of move.actions)qa.action(action);if(qa.model().phase==='clearing')qa.advance(200);}},witness);
      await shot(`09-complete-${width}x${height}`);await click('result-home');await shot(`10-home-${width}x${height}`);
    }
  }
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(300);assert.equal((await state()).paused,true);const orientationTime=(await state()).elapsed;await page.waitForTimeout(200);assert.equal((await state()).elapsed,orientationTime);await shot('11-orientation');mark('landscape pauses and waits for portrait');
  const desktop=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1}),desktopPage=await desktop.newPage();desktopPage.on('pageerror',e=>errors.push(e.message));desktopPage.on('response',r=>{if(r.status()>=400)failedRequests.push(r.status()+' '+r.url());});
  await desktopPage.goto(target.href,{waitUntil:'domcontentloaded',timeout:60000});await desktopPage.waitForSelector('#blockdig-desktop-frame');
  await desktopPage.waitForFunction(()=>document.querySelector('#blockdig-desktop-frame')?.contentWindow?.__BLOCKDIG__?.state().page==='home',null,{timeout:60000});
  const frame=desktopPage.frames().find(f=>f.url().includes('play-frame=1'));assert(frame,'Desktop portrait frame is missing');await frame.waitForFunction(()=>window.__BLOCKDIG__?.state().page==='home');
  const desktopClick=async id=>{const b=await frame.evaluate(id=>window.__BLOCKDIG__.state().buttons[id],id),box=await desktopPage.locator('#blockdig-desktop-frame').boundingBox();await desktopPage.mouse.click(box.x+b.x,box.y+b.y);};
  await desktopClick('start');await desktopClick('tutorial-done');await frame.waitForFunction(()=>window.__BLOCKDIG__.state().countdown===0&&!window.__BLOCKDIG__.state().paused);
  const prior=await frame.evaluate(()=>window.__BLOCKDIG__.state().active.x);await desktopPage.keyboard.press('ArrowRight');assert.equal(await frame.evaluate(()=>window.__BLOCKDIG__.state().active.x),prior+1);
  await desktopPage.screenshot({path:path.join(out,'12-desktop.png')});await desktop.close();mark('desktop portrait frame, mouse and keyboard');
  assert.equal(errors.length,0,'Runtime errors: '+errors.join('; '));assert.equal(failedRequests.length,0,'Failed assets: '+failedRequests.join('; '));mark('no browser exceptions or failed asset requests');
  const report={version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,date:new Date().toISOString(),baseUrl:target.href,browser:'Chrome headless mobile emulation and desktop',checks,errors,failedRequests,limits:'Emulated touch, layout and blur. Physical Android/iPhone performance, actual safe areas and audio output still require human device acceptance.'};
  fs.writeFileSync(path.join(reportDir,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){await shot('ERROR');console.error(JSON.stringify({state:await state().catch(()=>null),errors,failedRequests},null,2));throw error;}
 finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
