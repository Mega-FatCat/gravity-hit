// Numerical core only; Three.js geometry/material adapter is specified in the plan.
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class BottleSurface {
 constructor(samples){
  if(samples.length<8||samples.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))throw Error('Invalid cavity samples');
  this.samples=samples;this.h=new Float64Array(samples.length);
  this.sx=0;this.sz=0;this.vx=0;this.vz=0;
  this.normal=[0,1,0];this.localPlane=[0,1,0,0];this.offset=0;
 }
 reset(){this.sx=this.sz=this.vx=this.vz=0;}
 update(dt,amount,m,ax=0,az=0){
  // m: column-major bottle.matrixWorld.elements. ax/az: filtered WORLD acceleration.
  if(!Number.isFinite(dt)||dt<0||!Number.isFinite(amount))throw Error('Invalid time/amount');
  if(m.length!==16||!Number.isFinite(ax)||!Number.isFinite(az))throw Error('Invalid transform/acceleration');
  if(dt>.12){this.reset();dt=0;}
  dt=Math.min(dt,.05);amount=clamp(amount);
  // A strongly damped response keeps the free surface physical without the
  // large overshoot that used to make held/pouring water whip around.
  const k=52,c=14.5;let remaining=dt;
  while(remaining>1e-9){
   const h=Math.min(remaining,1/120);remaining-=h;
   const tx=clamp(ax/9.81,-.12,.12),tz=clamp(az/9.81,-.12,.12);
   this.vx+=(k*(tx-this.sx)-c*this.vx)*h;
   this.vz+=(k*(tz-this.sz)-c*this.vz)*h;
   this.sx+=this.vx*h;this.sz+=this.vz*h;
  }
  const envelope=Math.sin(Math.PI*amount);
  let nx=this.sx*envelope,ny=1,nz=this.sz*envelope;
  const inv=1/Math.hypot(nx,ny,nz);nx*=inv;ny*=inv;nz*=inv;
  this.normal[0]=nx;this.normal[1]=ny;this.normal[2]=nz;
  const lx=nx*m[0]+ny*m[1]+nz*m[2];
  const ly=nx*m[4]+ny*m[5]+nz*m[6];
  const lz=nx*m[8]+ny*m[9]+nz*m[10];
  for(let i=0;i<this.samples.length;i++){
   const p=this.samples[i];this.h[i]=lx*p[0]+ly*p[1]+lz*p[2];
  }
  this.h.sort();
  const q=amount*(this.h.length-1),i=Math.floor(q);
  const localD=this.h[i]+(this.h[Math.min(i+1,this.h.length-1)]-this.h[i])*(q-i);
  const translation=nx*m[12]+ny*m[13]+nz*m[14];
  this.offset=localD+translation;
  this.localPlane[0]=lx;this.localPlane[1]=ly;this.localPlane[2]=lz;this.localPlane[3]=-localD;
  return this;
 }
 heightAt(x,z){return (this.offset-this.normal[0]*x-this.normal[2]*z)/this.normal[1];}
}
export function advanceLegacyFlow(sim,dt,inputSeal=false){
 // Only the ordinary draining branch. Returns volume increment, does not mutate sim.
 // The caller preserves original phase gates, inhale/day-2 branches and ordering.
 dt=Number.isFinite(dt)?clamp(dt,0,.05):0;
 if(sim.outlet&&!(inputSeal||sim.seal)&&sim.mode!=='fill'&&sim.water>.072){
  return Math.min(sim.water-.072,dt*.15*Math.sqrt(sim.water-.072));
 }
 return 0;
}
export function outletHead(surface,outletWorld){
 return Math.max(0,surface.heightAt(outletWorld[0],outletWorld[2])-outletWorld[1]);
}
export function writeJetCenters(buffer,start,direction,speed,duration){
 if(buffer.length<6||buffer.length%3)throw Error('Need at least 2 xyz vertices');
 // direction is a WORLD unit vector. Caller computes normalized outlet direction.
 const n=buffer.length/3;
 for(let i=0;i<n;i++){
  const t=duration*i/(n-1),j=i*3;
  buffer[j]=start[0]+direction[0]*speed*t;
  buffer[j+1]=start[1]+direction[1]*speed*t-4.905*t*t;
  buffer[j+2]=start[2]+direction[2]*speed*t;
 }
 return buffer;
}
