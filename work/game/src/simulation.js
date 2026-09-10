export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export class Simulation {
 constructor(saved){Object.assign(this,{version:3,phase:'collect',mode:'idle',held:null,supporting:null,picked:[],prep:0,heat:0,progress:0,cap:true,outlet:false,water:0,bud:0,embers:0,smoke:0,stock:10,lost:0,hits:0,day:1,residue:0,lastQuality:0,cough:0,seal:false,tutorial:true,firstHit:true,angle:0,time:0,transition:0,notice:'',noticeTimer:0,busy:0},saved||{});this.version=3;this.mode='idle';this.busy=0;this.flow=0;this.flameQuality=0;if(this.phase==='inhale'){this.water=this.bud=this.embers=this.smoke=0;this.cap=false;this.firstHit=false;this.tutorial=false;this.seal=false;this.transition=0;this.phase=this.stock?'free':'sleep';}if(!['collect','heat','press','unscrew','hole','free','sleep'].includes(this.phase))this.phase='collect';if(this.held&&!['bottle','pipe','lighter','bag'].includes(this.held))this.held=null;this.assert();}
 say(message){this.notice=message;this.noticeTimer=5;return false;}
 get upgraded(){return this.day>1;}
 get ready(){return this.phase==='free';}
 get burning(){return this.embers>.08&&this.bud>0;}
 get smokeDensity(){return clamp(this.smoke/Math.max(.08,1-this.water));}
 isHeld(id){return this.held===id||this.supporting===id;}
 // A selection retains an already-owned companion when the current action can
 // physically use the pair. Exchanging tools puts anything else on the slab.
 select(id,allowedCompanions=null){
  if(!['bottle','pipe','lighter','bag'].includes(id))return false;
  const companions=allowedCompanions??(id==='pipe'?['bag','bottle']:id==='bottle'||id==='bag'?['pipe']:['bottle','pipe']);
  const support=companions.find(item=>item!==id&&this.isHeld(item)&&!(item==='pipe'&&this.cap&&this.prep>0));
  this.held=id;this.supporting=support||null;this.mode='idle';
  if(!this.picked.includes(id))this.picked.push(id);
  return true;
 }
 action(target){
  const id=target==='ignite'?'lighter':target==='fill'?'stream':target;
  if(this.busy>0||['inhale','sleep'].includes(this.phase))return false;
  // Repeated clicks during a turn/press cannot restart it or exchange its tools.
  if(['press','unscrew','screw','uncap'].includes(this.mode))return false;
  if(this.phase==='collect'||this.phase==='heat'){
   if(!['pipe','lighter'].includes(id))return this.say('Select the glass pipe and lighter first.');
   this.select(id,['pipe','lighter']);
   if(this.isHeld('pipe')&&this.isHeld('lighter')){this.phase='heat';this.held='lighter';this.supporting='pipe';}
   if(this.phase==='heat'&&this.held==='lighter'&&this.supporting==='pipe'){this.mode='heat';this.say('Both pieces are in hand. Bring the flame to the lower glass tip.');}
   else if(this.phase==='heat')this.say('Keep the pipe in hand, then select the lighter.');
   return true;
  }
  if(this.phase==='press'){
   if(!['pipe','bottle'].includes(id))return this.say('Hold the warm pipe, then select the bottle.');
   this.select(id,['pipe','bottle']);
   if(!this.isHeld('pipe')||!this.isHeld('bottle'))return this.say('Select the warm pipe, then the bottle to fit its cap.');
   this.held='bottle';this.supporting='pipe';this.mode='press';return true;
  }
  if(this.phase==='unscrew'){
   if(id!=='bottle')return this.say('Select the bottle and hold A to unscrew the cap.');
   this.select('bottle');this.mode='unscrew';return true;
  }
  if(this.phase==='hole'){
   if(!['bottle','lighter'].includes(id))return this.say('Hold the bottle, then select the lighter for the lower opening.');
   this.select(id,['bottle','lighter']);
   if(this.isHeld('lighter')&&this.isHeld('bottle')){this.held='lighter';this.supporting='bottle';this.mode='hole';}
   else this.say('Keep the bottle in hand, then select the lighter.');
   return true;
  }
  if(this.phase!=='free')return false;
  if(id==='bag'||id==='pack'||id==='pipe'){
   if(this.prep<2||!this.outlet)return this.say('Finish preparing the bottle before starting the ritual.');
   if(id==='pipe'&&this.cap)return this.say('The pipe is attached. Unscrew the cap with A first.');
   if(id==='pipe'&&this.isHeld('bottle')&&!this.cap&&this.prep>0){
    this.held='bottle';this.supporting='pipe';this.mode='screw';this.progress=0;
    if(!this.picked.includes('pipe'))this.picked.push('pipe');
    if(!this.picked.includes('bottle'))this.picked.push('bottle');
    this.say('Hold LMB or D to screw the cap onto the bottle.');
    if(this.upgraded)this.setCap(true);
    return true;
   }
   const selectTarget=id==='pack'?'bag':id;
   this.select(selectTarget,['pipe','bag']);
   if(this.cap)return this.say('Unscrew the cap before loading the pipe.');
   if(this.bud>0)return this.say('The pipe is already loaded.');
   if(this.stock<=0)return this.say('The bag is empty.');
   // Clicking the pipe alone does not auto-start weed loading; clicking the
   // bag (or pipe while already holding bag) begins the pack interaction.
   if(id==='pipe'&&!this.isHeld('bag')&&!this.upgraded)return this.say('Open the bag to load the pipe.');
   this.mode='pack';if(this.upgraded)this.pack(true);return true;
  }
  if(id==='stream'){
   if(this.prep<2||!this.outlet)return this.say('Finish preparing the bottle before collecting water.');
   if(!this.isHeld('bottle'))return this.say('Pick up the bottle first, then target the stream.');
   if(this.cap)return this.say('Unscrew the cap before refilling.');
   this.mode='fill';this.progress=0;
   if(this.upgraded){this.water=1;this.smoke=0;this.mode='idle';this.seal=true;this.say('Filled and sealed. Fit the cap when you are ready.');}
   return true;
  }
  if(id==='bottle'){
   if(this.prep<2||!this.outlet)return this.say('Finish preparing the bottle before turning the cap.');
   const wasPipe=this.held==='pipe',selected=this.held==='bottle';this.select('bottle');
   if(!selected){
    if(wasPipe&&!this.cap&&this.prep>0){
     this.mode='screw';this.progress=0;
     if(!this.picked.includes('pipe'))this.picked.push('pipe');
     if(!this.picked.includes('bottle'))this.picked.push('bottle');
     this.say('Hold LMB or D to screw the cap onto the bottle.');
     if(this.upgraded)this.setCap(true);
    }
    return true;
   }
   this.mode=this.cap?'uncap':'screw';this.progress=this.cap?1:0;
   this.say(this.cap?'Hold LMB or A to unscrew the cap.':'Hold LMB or D to screw the cap on.');
   if(this.upgraded)this.setCap(!this.cap);
   return true;
  }
  if(id==='lighter'){
   if(this.prep<2||!this.outlet){this.select('lighter');return this.say('Finish preparing the bottle before heating it.');}
   this.select('lighter');
   if(!this.cap)return this.say('Attach the cap and pipe to the bottle first.');
   if(this.water<=.072)return this.say('No water remains above the outlet. Refill at the stream.');
   this.mode='ignite';
   if(!this.bud)this.say('The pipe is empty. Water can drain, but no smoke will form.');
   if(this.upgraded&&this.bud&&this.isHeld('bottle')){this.seal=false;this.mode='auto';}
   return true;
  }
  if(id==='hit'){
   if(!this.isHeld('bottle'))return this.say('Pick up the bottle before taking the hit.');
   if(this.cap)return this.say('Unscrew the cap first.');
   if(!this.outlet)return this.say('Form the lower outlet before taking the hit.');
   if(this.smoke<.015)return this.say('There is no trapped smoke to take.');
   if(this.mode==='fill')return this.say('Finish collecting water before taking the hit.');
   this.lastQuality=clamp(this.smoke*1.7)*(this.water>=.1&&this.water<=.22?1:.72);
   this.cough=(this.water<.1?1:.28)*(this.upgraded?.35:1);
   this.phase='inhale';this.transition=0;this.mode='idle';this.hits++;this.residue=clamp(this.residue+.015);this.busy=.3;return true;
  }
  return false;
 }
 setCap(attached){
  this.cap=attached;
  // Attachment consumes the pipe into the bottle assembly. An explicit uncap
  // operation places the detached assembly in the free hand.
  if(attached){if(this.supporting==='pipe')this.supporting=null;if(this.held==='pipe')this.held=null;}
  else if(this.held==='bottle'&&this.prep>0)this.supporting='pipe';
  this.mode='idle';
  this.say(attached?'Cap secured. Select the lighter.':this.smoke>.015?'Cap off. Tap SPACE to take the hit.':'Cap off. You can load the pipe or refill.');
 }
 pack(success){
  // A delayed pointer-up after cancel or tool exchange cannot consume a charge.
  if(this.phase!=='free'||this.mode!=='pack'||this.prep<2||!this.outlet||!['pipe','bag'].includes(this.held)||this.stock<=0||this.bud>0||this.cap)return false;
  this.stock--;if(success){this.bud=1;this.say('Pipe loaded. One charge used.');}else{this.lost++;this.say('Missed. That charge is lost.');}
  this.mode='idle';return true;
 }
 cancel(){
  if(['inhale','sleep'].includes(this.phase))return false;
  this.mode='idle';this.held=this.supporting=null;this.flow=this.flameQuality=0;return true;
 }
 step(dt,input={}){
  dt=Number.isFinite(dt)?clamp(dt,0,.05):0;this.flow=0;this.time+=dt;this.noticeTimer=Math.max(0,this.noticeTimer-dt);this.busy=Math.max(0,this.busy-dt);
  const tilt=(input.right?1:0)-(input.left?1:0);if(['heat','hole','ignite'].includes(this.mode))this.angle=clamp(this.angle+tilt*dt*70,-100,100);
  const aim=Number.isFinite(input.aim)?clamp(input.aim):0;
  this.flameQuality=input.fire&&this.held==='lighter'&&['heat','hole','ignite'].includes(this.mode)?clamp(1-Math.abs(this.angle-45)/110)*aim:0;
  if(this.angle>85||this.angle<-75)this.flameQuality=0;
  if(this.phase==='heat'&&this.mode==='heat'&&this.supporting==='pipe'){
   this.heat=clamp(this.heat+(this.flameQuality*.34-.035)*dt);
   if(this.heat>=1){this.phase='press';this.mode='idle';this.progress=0;this.say('The tip is ready. Pick up the bottle.');}
  }else if(this.phase==='press'&&this.mode==='press'&&this.held==='bottle'&&this.supporting==='pipe'){
   this.progress=clamp(this.progress+(input.fire?aim*dt*.45:-dt*.03));
   if(this.progress>=1){this.prep=1;this.supporting=null;this.phase='unscrew';this.mode='unscrew';this.held='bottle';this.progress=1;this.say('The cap now holds the pipe. Hold A to unscrew it.');}
  }else if(this.phase==='unscrew'&&this.mode==='unscrew'&&this.held==='bottle'){
   const turn=tilt!==0?tilt:(input.fire?-1:0);
   this.progress=clamp(this.progress+turn*dt*.5);
   if(this.progress<=0){this.setCap(false);this.phase='hole';this.progress=0;this.say('Keep the bottle in hand. Select the lighter to form the lower opening.');}
  }else if(this.phase==='hole'&&this.mode==='hole'&&this.supporting==='bottle'){
   this.progress=clamp(this.progress+this.flameQuality*dt*.32);
   if(this.progress>=1){this.prep=2;this.outlet=true;this.phase='free';this.mode='idle';this.heat=0;this.say('Preparation complete. Load the pipe, then fill the bottle.');}
  }else if(this.phase==='free'){
   if(this.mode==='fill'&&this.isHeld('bottle')&&!this.cap){
    this.water=clamp(this.water+(input.fire?dt*.3*aim:0));
    if(this.water>=.995){this.mode='idle';this.say('Full. Hold SPACE to seal the outlet.');}
   }
   if(this.held==='bottle'&&this.mode==='idle'&&!this.upgraded){
    if(tilt<0&&this.cap){this.mode='uncap';this.progress=1;}
    else if(tilt>0&&!this.cap){this.mode='screw';this.progress=0;}
   }
   if((this.mode==='screw'||this.mode==='uncap')&&this.held==='bottle'){
    const turn=tilt!==0?tilt:(input.fire?(this.mode==='screw'?1:-1):0);
    this.progress=clamp(this.progress+turn*dt*.55);
    if(this.progress>=1&&!this.cap)this.setCap(true);
    else if(this.progress<=0&&this.cap)this.setCap(false);
   }
   const sealed=!!(input.seal||this.seal);
   this.flow=0;
   if(this.outlet&&!sealed&&this.water>.072&&this.mode!=='fill'){
    this.flow=Math.min(this.water-.072,dt*.15*Math.sqrt(this.water-.072));this.water-=this.flow;
   }
   const automatic=this.mode==='auto'&&this.held==='lighter'&&this.isHeld('bottle')&&this.cap&&this.bud>0;
   const lighting=automatic?1:this.mode==='ignite'&&this.cap?this.flameQuality:0;
   const draft=dt>0?this.flow/dt:0;
   const flameRate=lighting>0&&this.bud>0?lighting*.9*(1.1-this.embers*.3):0;
   const stokeRate=(draft>0&&this.embers>.08&&this.bud>0)?draft*2.5*this.embers*(1-this.embers*.2):0;
   const coolRate=(lighting>0?.06:(draft>0?.08:.22))*this.embers;
   this.embers=clamp(this.embers+(flameRate+stokeRate-coolRate)*dt);
   if(this.bud<=0)this.embers=0;
   if(this.outlet&&!sealed&&this.flow>0&&this.cap&&this.bud>0&&this.embers>.08){
    const embNorm=Math.max(0,(this.embers-.08)/.92);
    const headspace=1-this.water;
    const availableHeadspace=Math.max(0,.928-this.smoke);
    const midPeak=.55+.55*Math.sin(Math.min(Math.PI,headspace/.928*Math.PI));
    const headroomFactor=Math.min(1,availableHeadspace/.18+.1);
    const yieldFactor=midPeak*Math.pow(embNorm,1.2)*headroomFactor;
    const burned=Math.min(this.bud,this.flow*(.6+.4*this.embers));
    this.bud-=burned;
    const smokeGen=Math.min(this.flow*yieldFactor*.95,burned);
    this.smoke=clamp(this.smoke+smokeGen,0,1-this.water);
    this.residue=clamp(this.residue+burned*.085);
   }
   if(lighting>0&&this.bud>0)this.bud=Math.max(0,this.bud-lighting*dt*.002);
   if(!this.cap){this.smoke=Math.max(0,this.smoke-dt*.035);this.embers=Math.max(0,this.embers-dt*.3);}
   else this.smoke=Math.max(0,this.smoke-dt*.0015);
   if(automatic&&this.water<=.16){this.seal=true;this.setCap(false);this.action('hit');}
   if(input.hit)this.action('hit');
   if(this.phase==='free'&&!this.stock&&this.bud<.01&&this.smoke<.015){this.phase='sleep';this.transition=0;this.mode='idle';this.held=this.supporting=null;this.seal=false;}
  }else if(this.phase==='inhale'){
   this.transition+=dt;this.flow=Math.min(this.water,dt*.4);this.water-=this.flow;this.smoke=Math.max(0,this.smoke-dt*.65);
   if(this.transition>4){this.bud=0;this.embers=0;this.water=0;this.smoke=0;this.cap=false;this.seal=false;this.phase=this.stock<=0?'sleep':'free';if(this.phase==='sleep')this.held=this.supporting=null;this.transition=0;if(this.firstHit){this.firstHit=false;this.tutorial=false;this.say('You have the rhythm. Guide hidden — press T whenever you want it back.');}}
  }else if(this.phase==='sleep'){
   this.transition+=dt;if(this.transition>7){this.day++;this.stock=1000;this.cap=false;this.water=0;this.bud=0;this.smoke=0;this.embers=0;this.seal=false;this.held=this.supporting=null;this.phase='free';this.mode='idle';this.transition=0;this.say('A new morning. Actions are automatic. Your supply has grown.');}
  }
  this.assert();
 }
 assert(){
  for(const k of ['water','bud','embers','smoke','heat','progress','residue','lastQuality','cough'])this[k]=clamp(Number.isFinite(this[k])?this[k]:0);
  this.smoke=Math.min(this.smoke,1-this.water);
  for(const k of ['stock','lost','hits','day','prep'])this[k]=Math.max(k==='day'?1:0,Math.floor(Number.isFinite(this[k])?this[k]:k==='stock'?10:0));
  for(const k of ['time','transition','noticeTimer'])this[k]=Math.max(0,Number.isFinite(this[k])?this[k]:0);
  this.angle=clamp(Number.isFinite(this.angle)?this.angle:0,-100,100);
  this.picked=Array.isArray(this.picked)?[...new Set(this.picked.filter(id=>['bottle','pipe','lighter','bag'].includes(id)))]:[];
  if(!['bottle','pipe','lighter','bag'].includes(this.held))this.held=null;
  if(!['bottle','pipe','bag'].includes(this.supporting)||this.supporting===this.held)this.supporting=null;
  if(this.cap&&this.prep>0){if(this.held==='pipe')this.held=null;if(this.supporting==='pipe')this.supporting=null;}
 }
 snapshot(){
  const s={};
  for(const k of ['version','phase','picked','prep','heat','progress','cap','outlet','water','bud','embers','smoke','stock','lost','hits','day','residue','lastQuality','tutorial','firstHit','time','held','supporting','seal','angle','transition'])s[k]=k==='picked'?[...this.picked]:this[k];
  return s;
 }
}
