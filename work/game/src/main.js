import './style.css';
import {Simulation,clamp} from './simulation.js';
import {World} from './world.js';
import {Soundscape} from './audio.js';
import * as THREE from 'three';
import * as budModule from './bud.js';
import {renderBudSpriteDataUrl} from './bud.js';

const $=id=>document.getElementById(id);
const icons={bottle:'<path d="M9 2h6v4l3 5v16H6V11l3-5zM6 15h12M6 20h12"/>',pipe:'<path d="M9 2h6v5l-2 4v16h-2V11L9 7z"/>',lighter:'<rect x="7" y="8" width="12" height="20" rx="4"/><path d="M8 8V3h9v5M12 3V1M7 13h12"/>',bag:'<path d="M4 7h20v19H4zM4 10h20M10 17l3-3 3 3-2 6z"/>',stream:'<path d="M3 10q5-5 10 0t11 0M3 16q5-5 10 0t11 0M3 22q5-5 10 0t11 0"/>'};
const labels={pipe:'Glass pipe',lighter:'Lighter',bottle:'Bottle',bag:'Weed bag',stream:'Stream'};
const defaults={master:.65,birds:.7,engines:.3,windSound:.65,waterSound:.6,wind:.5,weather:'clear',quality:'medium',motion:true,showFps:false,autoSeal:false,guide:true};
let saved=null;try{saved=window.desktop?await window.desktop.load():JSON.parse(localStorage.getItem('stillwater-save')||'null');}catch{}
let sim=new Simulation(saved?.game);let settings={...defaults,...saved?.settings};const sound=new Soundscape();
let started=false,paused=false,menuTab='ambience',photo=false,photoLoading=false,uiHidden=false;const input={x:innerWidth*.52,y:innerHeight*.5,fire:false,left:false,right:false,seal:false,aim:0};let dragLook=false,dragNug=false,pendingPick=null;
$('app').innerHTML=`<canvas id="scene"></canvas><div class="vignette"></div>
<div class="topbar"><div class="brand">ZNICZ<small>A FOREST RITUAL</small></div><div class="top-right"><span id="weather-tag" class="weather-tag">PINE HOLLOW · LATE AFTERNOON</span><button class="pill" id="guide-toggle" title="Toggle guide (T)">Guide on</button><button class="iconbtn" id="settings-open" title="Settings (Esc)">☷</button></div></div>
<div class="welcome" id="welcome"><div class="eyebrow">NO RUSH. NOWHERE TO BE.</div><h1>A little out<br>of the world.</h1><p>A hidden clearing, a cold stream, and the afternoon to yourself. Settle in. Find your rhythm.</p><div id="loading" class="loading-line"><span id="load-progress"></span></div><button class="primary" id="begin" disabled>Entering the forest…</button><span class="sub">HEADPHONES ON. THE FOREST IS ALREADY HERE.</span></div>
<div id="hud" class="hud hidden"><div class="session"><div><b id="day">01</b><small>DAY</small></div><div><b id="supply">10</b><small>CHARGES</small></div><div><b id="hits">00</b><small>HITS</small></div><div><b id="lost">00</b><small>SPILLED</small></div></div>
<div class="guide" id="guide"><div class="step" id="guide-step"></div><h2 id="guide-title"></h2><p id="guide-text"></p></div>
<div class="controls"><span><i class="key">RMB</i>Look</span><span><i class="key">LMB</i>Interact</span><span><i class="key">T</i>Guide</span><span><i class="key">Esc</i>Pause</span></div>
<div class="inventory">${['pipe','lighter','bottle','bag','stream'].map((id,i)=>`<button data-item="${id}" class="slot" id="slot-${id}"><kbd>${i+1}</kbd><svg viewBox="0 0 28 30">${icons[id]}</svg><span>${labels[id]}</span></button>`).join('')}</div>
<div id="right-panel" class="right-panel"><div class="readout"><header><span>WATER</span><span id="water-value">0%</span></header><div class="track water"><span class="sweet" title="In-game target range"></span><i id="water-bar"></i></div></div><div class="readout"><header><span>SMOKE</span><span id="smoke-value">Clear</span></header><div class="track smoke"><i id="smoke-bar"></i></div></div><div class="readout"><header><span>PIPE</span><span id="bud-value">Empty</span></header><div class="track"><i id="bud-bar"></i></div></div><div class="seal-status"><span id="cap-status">CAP ON</span><span id="seal-status">OUTLET CLOSED</span></div><button id="take-hit" class="ghost hidden">Take the hit · SPACE</button><button id="leave-mode" class="ghost hidden">Set down · E</button></div>
<div id="toast" class="toast hidden"></div><div id="target" class="reticle hidden"></div>
<div class="mini-status hidden" id="mini"><p id="mini-label">HEAT</p><div class="track"><i id="mini-bar"></i></div><div id="angle" class="angle"></div></div>
<div id="object-labels">${Object.entries(labels).map(([id,text])=>`<button class="object-label" data-item="${id}" id="label-${id}">${text}</button>`).join('')}</div>
<div id="packing" class="packing hidden"><span class="packhint">DRAG ONE CHARGE TO THE OPEN PIPE</span><div class="nug" id="nug" role="button" tabindex="0" aria-label="Drag a charge into the pipe"></div></div>
<div class="fps hidden" id="fps"></div></div>
<div class="fade" id="fade"><h2 id="fade-title"></h2><p id="fade-sub"></p></div><div id="modal" class="modal-backdrop hidden"></div><button id="photo-label" class="photo-label hidden">Path tracing · preparing light paths… · Esc to return</button>`;

let world;
try{world=new World($('scene'),v=>{$('load-progress').style.width=`${v*100}%`;});}catch(e){$('app').innerHTML+=`<div class="error">The graphics renderer could not start.<br>${String(e.message)}<br>Please try restarting the game.</div>`;throw e;}
await world.ready;world.setQuality(settings.quality);
try{
 const budSprite=renderBudSpriteDataUrl(world.renderer);
 if($('nug'))$('nug').style.backgroundImage=`url("${budSprite}")`;
}catch(e){console.warn('Bud sprite render',e);}
$('begin').disabled=false;$('begin').textContent=saved?'Return to the clearing →':'Enter the clearing →';$('loading').classList.add('hidden');

function begin(){started=true;$('welcome').classList.add('hidden');$('hud').classList.remove('hidden');sound.start();}
$('begin').onclick=begin;
function act(id){if(!started||paused||photo)return;sound.effect(id==='stream'?'water':id==='bottle'?'screw':'glass');input.fire=false;sim.action(id);save();}
document.querySelectorAll('[data-item]').forEach(e=>e.onclick=event=>{event.stopPropagation();act(e.dataset.item);});
function guideToggle(){sim.tutorial=!sim.tutorial;settings.guide=sim.tutorial;save();}
$('guide-toggle').onclick=guideToggle;$('settings-open').onclick=()=>openMenu();$('leave-mode').onclick=()=>sim.cancel();$('take-hit').onclick=()=>act('hit');
function tutorial(){
 const cap=sim.cap;
 if(sim.phase==='collect')return ['01 / PREPARATION','Start with the small things.','Pick up the glass pipe and the lighter. Click the objects, or use the item bar below.'];
 if(sim.phase==='heat')return ['02 / PREPARATION','A steady little flame.',sim.mode==='heat'?'Move the lighter to the marked lower tip. Hold LMB to strike and burn. A / D changes the tilt; around 45° gives a steady flame.':'Select the pipe, then the lighter. Both pieces stay in your hands while you work.'];
 if(sim.phase==='press')return ['03 / PREPARATION','Make the first connection.',sim.mode==='press'?'Aim at the cap and hold LMB to press the warm pipe through it.':'Pick up the empty bottle to fit the warmed pipe into its cap.'];
 if(sim.phase==='unscrew')return ['04 / PREPARATION','Give it a turn.',sim.mode==='unscrew'?'Hold A to unscrew the cap. D turns it back the other way. The bottle will then turn over.':'Select the bottle, then hold A to unscrew its cap.'];
 if(sim.phase==='hole')return ['05 / PREPARATION','One small opening.',sim.mode==='hole'?'The base faces you. Bring the flame to the marked spot and hold LMB. A / D adjusts the flame.':'Keep the bottle in hand, then select the lighter. The base turns toward you for the small opening.'];
 if(sim.phase==='inhale')return ['BREATHE','Let the moment settle.','The remaining water drains as the camera lifts. Your pipe will darken with use.'];
 if(sim.phase==='sleep')return ['END OF THE AFTERNOON','The forest grows quiet.','A new morning is on its way.'];
 if(sim.mode==='pack')return ['01 / THE RITUAL','A little goes a long way.','Drag the charge from the bag to the pipe opening. Release it carefully: a missed charge is lost.'];
 if(sim.mode==='fill')return ['02 / THE RITUAL','Borrow from the stream.','Hold LMB over the marked bottle opening to collect water. Keep SPACE held as you finish, to seal the outlet. E returns to the clearing.'];
 if(sim.mode==='screw'||sim.mode==='uncap')return ['03 / THE RITUAL',cap?'Open the bottle.':'Close the loop.','D screws the cap on. A screws it off. Keep SPACE held if you want to retain the water.'];
 if(sim.mode==='ignite'||sim.mode==='auto')return ['04 / THE RITUAL','Find the balance.',sim.upgraded?'The rhythm is familiar now. The flame, draw, and final pause happen automatically.':'Hold LMB and aim at the loaded pipe. A / D tilts the lighter. Release SPACE to draw water out and smoke in; hold it again at 10–20% water.'];
 if(sim.smoke>.015&&!cap)return ['05 / THE RITUAL','Take your time.','Tap SPACE once to take the hit before the smoke escapes.'];
 if(sim.smoke>.05)return ['05 / THE RITUAL','Keep a little water.','Seal the outlet with SPACE, then click the bottle and hold A to unscrew. 10–20% remaining water gives a gentler in-game result.'];
 if(!sim.bud)return ['01 / THE RITUAL',sim.upgraded?'A familiar morning.':'Back to the beginning.',cap?'Click the bottle and unscrew the cap with A, then select the bag to load the pipe.':'Click the bag to load the pipe. You can refill first, too — just keep the outlet sealed.'];
 if(sim.water<.1)return ['02 / THE RITUAL','Cold, clear water.',cap?'Unscrew the cap before refilling.':'Pick up the bottle, then click the stream to fill it. Hold SPACE to seal the outlet.'];
 if(!cap)return ['03 / THE RITUAL','Everything in its place.','Keep SPACE held. Select the bottle and hold D to attach the cap and loaded pipe.'];
 return ['04 / THE RITUAL','Ready when you are.','Select the lighter. Aim the flame into the pipe, then release SPACE to begin the draw.'];
}
function drawUI(){
 $('day').textContent=String(sim.day).padStart(2,'0');$('supply').textContent=sim.stock.toLocaleString();$('hits').textContent=String(sim.hits).padStart(2,'0');$('lost').textContent=String(sim.lost).padStart(2,'0');
 $('guide-toggle').textContent=sim.tutorial?'Guide on':'Guide off';$('guide').classList.toggle('hidden',!sim.tutorial);const g=tutorial();$('guide-step').textContent=g[0];$('guide-title').textContent=g[1];$('guide-text').textContent=g[2];
 $('water-value').textContent=`${Math.round(sim.water*100)}%`;$('water-bar').style.width=`${sim.water*100}%`;$('smoke-value').textContent=sim.smoke>.01?`${Math.round(sim.smokeDensity*100)}%`:'Clear';$('smoke-bar').style.width=`${sim.smokeDensity*100}%`;$('bud-value').textContent=sim.bud>.01?(sim.embers>.1?'Ember':'Loaded'):'Empty';$('bud-bar').style.width=`${sim.bud*100}%`;
 $('cap-status').textContent=sim.cap?'CAP ON':'CAP OFF';$('seal-status').textContent=!sim.outlet?'OUTLET CLOSED':(input.seal||sim.seal)?'● SEALED':'○ OPEN';
 $('take-hit').classList.toggle('hidden',sim.cap||sim.smoke<.015||sim.phase!=='free');$('leave-mode').classList.toggle('hidden',(!sim.held&&!sim.supporting)||['sleep','inhale'].includes(sim.phase));
 $('toast').classList.toggle('hidden',sim.noticeTimer<=0);$('toast').textContent=sim.notice;
 const mini=['heat','press','unscrew','hole','screw','uncap','ignite','fill'].includes(sim.mode);$('mini').classList.toggle('hidden',!mini);$('mini-label').textContent={heat:'WARMING THE GLASS',press:'FITTING THE PIPE',unscrew:'UNSCREWING',hole:'OPENING THE OUTLET',screw:'ATTACHING THE CAP',uncap:'OPENING THE CAP',ignite:'FLAME CONTACT',fill:'FILLING'}[sim.mode]||'';
 const progress=sim.phase==='heat'?sim.heat:sim.mode==='ignite'?sim.embers:sim.mode==='fill'?sim.water:sim.progress;$('mini-bar').style.width=`${progress*100}%`;$('angle').textContent=['heat','hole','ignite'].includes(sim.mode)?`${Math.round(sim.angle)}° tilt  ·  A / D  ·  LMB flame`:['screw','uncap','unscrew'].includes(sim.mode)?'A unscrew  ·  D screw':sim.mode==='fill'?'LMB collect  ·  SPACE seal the outlet':'Hold LMB to press';
 $('packing').classList.toggle('hidden',sim.mode!=='pack');
 const selected=[sim.held,sim.supporting];for(const id of Object.keys(labels))$(`slot-${id}`).classList.toggle('selected',selected.includes(id));
 $('right-panel').classList.toggle('hidden',sim.prep<2);$('fps').classList.toggle('hidden',!settings.showFps);$('weather-tag').textContent=`PINE HOLLOW · ${settings.weather==='rain'?'PASSING RAIN':settings.weather==='mist'?'LOW MIST':sim.upgraded?'EARLY MORNING':'LATE AFTERNOON'}`;
 let fade=0;if(sim.phase==='sleep'){fade=clamp(sim.transition/2);$('fade-title').textContent=sim.transition<3?'The day drifts away.':'A familiar place. A new morning.';$('fade-sub').textContent=sim.transition<3?'THE FOREST KEEPS ITS OWN TIME':'LEVEL 02 · A LITTLE MORE AT EASE';}else{$('fade-title').textContent='';$('fade-sub').textContent='';if(sim.phase==='inhale'&&settings.motion)fade=sim.cough*.44*Math.sin(clamp(sim.transition/4)*Math.PI);}$('fade').style.opacity=fade;
}
function clearInput(){input.fire=input.left=input.right=input.seal=false;dragLook=false;pendingPick=null;}
window.addEventListener('blur',()=>{clearInput();if(started&&!photo)openMenu();});
window.addEventListener('contextmenu',e=>e.preventDefault());
$('scene').addEventListener('pointerdown',e=>{
 if(!started||paused||photo)return;
 input.x=e.clientX;input.y=e.clientY;
 if(e.button===2){dragLook=true;$('scene').setPointerCapture(e.pointerId);return;}
 if(e.button===0){
  const lighterAlone=sim.held==='lighter'&&!sim.supporting;
  if(lighterAlone){
   pendingPick={x:e.clientX,y:e.clientY};
   input.fire=true;
  }else if(['idle','pack'].includes(sim.mode)){
   pendingPick={x:e.clientX,y:e.clientY};
   input.fire=false;
  }else input.fire=true;
  sound.effect('click');
 }
});
window.addEventListener('pointermove',e=>{input.x=e.clientX;input.y=e.clientY;if(dragLook&&!paused&&!photo)world.look(e.movementX,e.movementY);if(dragNug){$('nug').style.left=`${e.clientX-19}px`;$('nug').style.top=`${e.clientY-19}px`;}});
window.addEventListener('pointerup',e=>{if(e.button===2){dragLook=false;if($('scene').hasPointerCapture(e.pointerId))$('scene').releasePointerCapture(e.pointerId);}if(e.button===0)input.fire=false;if(dragNug){world.prepareFrame(0,sim,input,settings);const p=world.aimScreen;const success=Math.hypot(e.clientX-p.x,e.clientY-p.y)<27;sim.pack(success);sound.effect(success?'glass':'click');dragNug=false;resetNug();save();}});
function resetNug(){$('nug').style.left='32%';$('nug').style.top='53%';}
$('nug').addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();e.stopPropagation();dragNug=true;$('nug').setPointerCapture(e.pointerId);});
window.addEventListener('keydown',e=>{
 if(['Space','KeyA','KeyD','Escape','KeyT','KeyE','KeyP','KeyH','F11'].includes(e.code))e.preventDefault();if(e.repeat&&['Escape','KeyT','KeyP','KeyE'].includes(e.code))return;
 if(e.code==='Escape'){if(photo||photoLoading){leavePhoto();return;}if(started)paused?closeMenu():openMenu();return;}
 if(e.code==='F11'){window.desktop?.fullscreen();return;}
 if(!started||paused||photo)return;
 if(e.code==='KeyT')guideToggle();if(e.code==='KeyE')sim.cancel();if(e.code==='KeyP')enterPhoto();if(e.code==='KeyH'){uiHidden=!uiHidden;$('hud').classList.toggle('hidden',uiHidden);}
 if(e.code==='KeyA')input.left=true;if(e.code==='KeyD')input.right=true;
 if(e.code==='Space'){if(settings.autoSeal){if(!e.repeat)sim.seal=!sim.seal;input.seal=false;}else input.seal=true;if(!e.repeat&&sim.phase==='free'&&!sim.cap&&sim.smoke>.015&&sim.mode!=='fill')act('hit');}
 const index=['Digit1','Digit2','Digit3','Digit4','Digit5'].indexOf(e.code);if(index>=0&&!e.repeat)act(['pipe','lighter','bottle','bag','stream'][index]);
});
window.addEventListener('keyup',e=>{if(e.code==='KeyA')input.left=false;if(e.code==='KeyD')input.right=false;if(e.code==='Space')input.seal=false;});
window.addEventListener('resize',()=>world.resize());

const range=(key,name,sub='')=>`<div class="setting"><label for="set-${key}">${name}<span>${sub}</span></label><input id="set-${key}" data-setting="${key}" type="range" min="0" max="1" step=".01" value="${settings[key]}"></div>`;
const toggle=(key,name,sub='')=>`<div class="setting"><label for="set-${key}">${name}<span>${sub}</span></label><input id="set-${key}" data-setting="${key}" type="checkbox" ${settings[key]?'checked':''}></div>`;
function menuContent(){
 if(menuTab==='ambience')return range('master','Overall volume')+range('birds','Birdsong')+range('windSound','Wind through the trees')+range('waterSound','Running water')+range('engines','Distant engines','An occasional vehicle beyond the forest.');
 if(menuTab==='world')return `<div class="setting"><label>Weather<span>Changes the light, air, foliage, and sound.</span></label><select data-setting="weather"><option value="clear">Clear afternoon</option><option value="mist">Forest mist</option><option value="rain">Passing rain</option></select></div>`+range('wind','Wind strength')+`<div class="setting"><label>Graphics quality<span>Medium uses 1× render scale and real-time shadows.</span></label><select data-setting="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div class="setting"><label>Ray-traced photograph<span>GPU path tracing with reflected and refracted light. Pauses the simulation while the image converges.</span></label><button id="start-photo" class="ghost">Photo mode · P</button></div>`+toggle('showFps','Performance counter');
 if(menuTab==='play')return toggle('motion','Camera motion','Subtle breathing and in-game cough response.')+toggle('autoSeal','Hold the outlet automatically','Accessibility option. Toggle SPACE to release the seal while lighting.')+`<div class="setting"><label>Step-by-step guide<span>Preparation and your first hit are guided by default.</span></label><input id="tutorial-check" type="checkbox" ${sim.tutorial?'checked':''}></div><div class="setting"><label>Start a new afternoon<span>Resets this game’s local progress.</span></label><button id="new-game" class="ghost">New game</button></div>`;
 if(menuTab==='controls')return `<div class="help-grid"><p><b>Look around</b><br>Hold right mouse and move. Your viewpoint stays in the clearing.</p><p><b>Pick up & set down</b><br>Click an object or press 1–5. E sets down the current interaction.</p><p><b>Use the lighter</b><br>Move the mouse to aim, hold LMB to burn. A / D changes the tilt.</p><p><b>Cap threads</b><br>A unscrews. D screws it back on. Keep holding until the turn is complete.</p><p><b>Outlet & hit</b><br>Hold SPACE to keep water in. With the cap removed and smoke present, tap SPACE to inhale.</p><p><b>Other controls</b><br>T guide · P photo mode · H hide HUD · F11 fullscreen · Esc pause.</p></div>`;
 return `<div class="credits"><b>ZNICZ</b> · Version 1.0<br>A first-person forest ritual simulation.<br><br><b>Dominik Zieliński</b> — Creative Director / Product Owner / QA Lead<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Concept, prompting, testing, feedback, and overall project direction.</small><b>GPT-6 Astra</b> — Lead Developer / Software Architect<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Core game systems, technical foundation, and key architecture.</small><b>Claude 4.6 Opus</b> — Solutions Architect / Technical Consultant<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Critique, problem analysis, and solution proposals.</small><b>GPT-5.6 Sol</b> — Technical Advisor / Code Reviewer<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Technical consulting and code analysis.</small><b>Gemini 3.8 Flash</b> — Primary Implementation Developer<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Main implementation work, including most later-stage features and fixes.</small><b>GPT-5.6 Luna</b> — Software Developer / Git & Release Manager<br><small style="display:block;margin-bottom:8px;color:#8f9f89;">Implementation support, Git management, commits, and change descriptions.</small><b>Muse Spark 1.3 Free</b> — Supporting Developer<br><small style="display:block;margin-bottom:12px;color:#8f9f89;">Additional implementation of smaller features and fixes.</small><div style="border-top:1px solid #aac49023;padding-top:10px;margin-top:4px;">Forest scans & environment lighting: Poly Haven, CC0.<br>Fern 02 · Pine Tree 01 · Forest Slope · Leaves Forest Ground · Bark Brown 02 · Rock Boulder Dry.<br><br>Graphics: Three.js, three-gpu-pathtracer, three-mesh-bvh.<br>Windows runtime: Electron. All assets included locally. Works offline.</div></div>`;
}
function openMenu(){paused=true;clearInput();$('modal').classList.remove('hidden');renderMenu();}
function renderMenu(){$('modal').innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="Settings"><div class="modal-head"><div><small>MAKE YOURSELF AT HOME</small><h2>A moment of quiet.</h2></div><button id="settings-close" class="iconbtn" aria-label="Close settings">×</button></div><div class="tabs">${[['ambience','Sound'],['world','World'],['play','Play'],['controls','Controls'],['credits','Credits']].map(([id,l])=>`<button class="tab ${menuTab===id?'active':''}" data-tab="${id}">${l}</button>`).join('')}</div><div>${menuContent()}</div><footer><p>Progress is saved on this device.</p><button id="resume" class="primary">Return to the forest →</button></footer></div>`;
 document.querySelectorAll('[data-tab]').forEach(e=>e.onclick=()=>{menuTab=e.dataset.tab;renderMenu();});$('settings-close').onclick=$('resume').onclick=closeMenu;
 document.querySelectorAll('[data-setting]').forEach(e=>{const key=e.dataset.setting;if(e.tagName==='SELECT')e.value=settings[key];e.oninput=()=>{settings[key]=e.type==='checkbox'?e.checked:e.type==='range'?Number(e.value):e.value;if(key==='quality')world.setQuality(settings.quality);if(key==='autoSeal')sim.seal=e.checked;save();};});
 if($('tutorial-check'))$('tutorial-check').onchange=e=>{sim.tutorial=e.target.checked;save();};if($('start-photo'))$('start-photo').onclick=()=>{closeMenu();enterPhoto();};
 if($('new-game'))$('new-game').onclick=()=>{$('new-game').textContent='Reset progress? Click again';$('new-game').onclick=()=>{sim=new Simulation();sim.tutorial=true;settings.autoSeal=false;closeMenu();begin();save();};};
}
function closeMenu(){paused=false;$('modal').classList.add('hidden');sound.start();}
let photoToken=0;
async function enterPhoto(){if(photo||photoLoading)return;const token=++photoToken;photoLoading=true;clearInput();$('hud').classList.add('hidden');$('photo-label').classList.remove('hidden');$('photo-label').textContent='Path tracing · preparing light paths… · Esc to return';try{await world.enablePathTracing();if(token!==photoToken){world.disablePathTracing();return;}photo=true;}catch(e){sim.say(`Photo mode could not start: ${e.message}`);world.disablePathTracing();$('hud').classList.remove('hidden');$('photo-label').classList.add('hidden');console.error(e);}finally{photoLoading=false;}}
function leavePhoto(){photoToken++;photo=false;photoLoading=false;world.disablePathTracing();$('photo-label').classList.add('hidden');$('hud').classList.toggle('hidden',!started||uiHidden);}
$('photo-label').onclick=leavePhoto;
let savePending=null,saveWork=null;
function save(){
 savePending={game:sim.snapshot(),settings:{...settings}};
 if(!saveWork)saveWork=(async()=>{
  while(savePending){const data=savePending;savePending=null;
   try{if(window.desktop)await window.desktop.save(data);else localStorage.setItem('stillwater-save',JSON.stringify(data));}
   catch(e){sim.say('Save unavailable. Check that the game folder is writable.');}
  }
 })().finally(()=>{saveWork=null;});
 return saveWork;
}

setInterval(()=>{if(started&&!photo)save();},5000);window.addEventListener('beforeunload',()=>{localStorage.setItem('stillwater-save',JSON.stringify({game:sim.snapshot(),settings}));});
let last=null,uiTime=0,frameTimes=[],lastPhase=sim.phase,coughPlayed=false;
function frame(now){requestAnimationFrame(frame);const elapsed=last===null?0:Math.max(0,(now-last)/1000);last=now;const dt=Math.min(.05,elapsed);if(elapsed>0)frameTimes.push(elapsed*1000);if(frameTimes.length>300)frameTimes.shift();
 if(photo){world.pathTracer?.renderSample();$('photo-label').textContent=`Ray-traced photograph · ${Math.floor(world.pathTracer?.samples||0)} samples · Esc to return`;return;}
 if(photoLoading)return;
 world.prepareFrame(paused?0:dt,sim,input,settings);
 if(pendingPick){
  const pick=pendingPick;pendingPick=null;const id=world.hitTest(pick.x,pick.y,sim);
  if(id){
   const lighterAlone=sim.held==='lighter'&&!sim.supporting;
   if(!(lighterAlone&&id==='lighter'))act(id);
  }
  world.prepareFrame(0,sim,input,settings);
 }
 if(started&&!paused){input.aim=world.interactionAim(sim,input);sim.step(dt,input);}
 if(lastPhase!==sim.phase){save();if(sim.phase==='inhale'){sound.effect('water');coughPlayed=false;}lastPhase=sim.phase;}
 if(sim.phase==='inhale'&&sim.transition>1.8&&!coughPlayed){sound.effect('cough');coughPlayed=true;}
 function updateTracking(){
  const aiming=['heat','hole','ignite','press','fill','pack'].includes(sim.mode);
  $('target').classList.toggle('hidden',!aiming);
  if(world.aimScreen){
    $('target').style.left=`${world.aimScreen.x}px`;
    $('target').style.top=`${world.aimScreen.y}px`;
    $('target').classList.toggle('good',input.aim>.65);
  }
  const isIdle=sim.mode==='idle'&&started&&!paused;
  for(const id of Object.keys(labels)){
    const e=$(`label-${id}`),p=world.projected[id];
    const visible=isIdle&&!(id==='pipe'&&sim.cap&&sim.prep>0)&&p?.visible&&p.x>25&&p.x<innerWidth-25&&p.y>120&&p.y<innerHeight-120;
    e.classList.toggle('hidden',!visible);
    if(visible&&p){
      e.style.left=`${p.x}px`;
      e.style.top=`${p.y-14}px`;
    }
  }
 }
 world.update(paused?0:dt,sim,input,settings,true);world.render();sound.update(dt,sim,settings,paused);
 updateTracking();
 if(now-uiTime>80){drawUI();$('fps').textContent=`${Math.round(1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length))} FPS · ${world.renderer.info.render.triangles.toLocaleString()} triangles`;uiTime=now;}
}
requestAnimationFrame(frame);
// A bounded inspection interface for the development and visual-review harness.
if(new URLSearchParams(location.search).has('qa'))window.__game={get sim(){return sim},world,settings,input,begin,act,save,openMenu,closeMenu,enterPhoto,leavePhoto,THREE,bud:budModule,setView(yaw,pitch){world.yaw=yaw;world.pitch=pitch;},setState(state){Object.assign(sim,state);},metrics(){const sorted=[...frameTimes].sort((a,b)=>a-b);return{fps:1000/(frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length),p95ms:sorted[Math.floor(sorted.length*.95)],triangles:world.renderer.info.render.triangles,calls:world.renderer.info.render.calls,assets:world.assetErrors,renderer:world.renderer.getContext().getParameter(world.renderer.getContext().getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||world.renderer.getContext().RENDERER)};}};
