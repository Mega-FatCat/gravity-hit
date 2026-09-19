const ULTRA_GPU = /(RTX\s*(4090|4080|50(?:80|90))|RX\s*7900|APPLE\s*M[4-9].*MAX)/i;
const HIGH_GPU = /(RTX\s*(3090|4070|5070)|RX\s*(7800|6950|6900)|APPLE\s*M[2-9].*MAX)/i;
const MEASURED_HIGH_GPU = /(RTX\s*(3070|3080)|RX\s*6800)/i;
const MID_HIGH_GPU = /(RTX\s*(20\d{2}|30\d{2}|40(?:50|60)|5060)|GTX\s*(1070|1080|16\d{2})|RX\s*(480|5[67]\d0|6\d{3}|7[67]\d{2})|VEGA\s*(56|64)|ARC\s*A[5-9]\d{2}|APPLE\s*M[1-9])/i;
const MEDIUM_GPU = /(GTX\s*(970|980|1060)|RX\s*(470|570)|QUADRO\s*(P|T)\d{3,4}|IRIS\s*XE|RADEON\s*(TM\s*)?GRAPHICS)/i;
const LOW_GPU = /(INTEL.*(HD|UHD)|GT\s*\d{3}|GTX\s*(7[0-6]0|9[0-6]0|1050)|MALI|ADRENO|POWERVR)/i;

export function inspectGraphics(renderer, nav=globalThis.navigator??{}) {
 const gl=renderer?.getContext?.();
 let gpu='Unknown GPU';
 try{
  const debug=gl?.getExtension?.('WEBGL_debug_renderer_info');
  gpu=String(gl?.getParameter?.(debug?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)??gpu);
 }catch{}
 const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 const dpr=Math.min(2,Math.max(1,number(globalThis.devicePixelRatio,1)));
 const viewportWidth=Math.max(1,number(globalThis.innerWidth,1920)),viewportHeight=Math.max(1,number(globalThis.innerHeight,1080));
 return {
  gpu,
  deviceMemory:number(nav.deviceMemory,0),
  hardwareConcurrency:number(nav.hardwareConcurrency,0),
  maxTextureSize:number(gl?.getParameter?.(gl.MAX_TEXTURE_SIZE),0),
  maxRenderbufferSize:number(gl?.getParameter?.(gl.MAX_RENDERBUFFER_SIZE),0),
  displayPixels:viewportWidth*viewportHeight*dpr*dpr,
 };
}

export function chooseAutomaticQuality(caps={}) {
 const gpu=String(caps.gpu??'');
 // Conservative project-specific estimates, anchored to real 1920x1080
 // captures rather than generic GPU marketing tiers.
 let expectedHighFps=15,confidence='fallback';
 if(ULTRA_GPU.test(gpu)){expectedHighFps=48;confidence='model';}
 else if(HIGH_GPU.test(gpu)){expectedHighFps=36;confidence='model';}
 else if(MEASURED_HIGH_GPU.test(gpu)){expectedHighFps=29.5;confidence='measured-model';}
 else if(MID_HIGH_GPU.test(gpu)){expectedHighFps=15;confidence='model';}
 else if(MEDIUM_GPU.test(gpu)){expectedHighFps=11;confidence='model';}
 else if(LOW_GPU.test(gpu)){expectedHighFps=5.5;confidence='model';}

 const memory=Number(caps.deviceMemory)||0,cores=Number(caps.hardwareConcurrency)||0;
 if(memory>=16)expectedHighFps*=1.07;else if(memory&&memory<=4)expectedHighFps*=.82;
 if(cores>=12)expectedHighFps*=1.05;else if(cores&&cores<=4)expectedHighFps*=.82;
 if((Number(caps.maxRenderbufferSize)||0)&&caps.maxRenderbufferSize<8192)expectedHighFps*=.82;
 const pixels=Number(caps.displayPixels)||1920*1080;
 expectedHighFps*=Math.min(1.35,Math.max(.48,Math.sqrt((1920*1080)/pixels)));

 const expectedMediumFps=expectedHighFps*1.8;
 const quality=expectedHighFps>=28?'high':expectedMediumFps>=24?'medium':'low';
 return {quality,expectedHighFps:Number(expectedHighFps.toFixed(1)),expectedMediumFps:Number(expectedMediumFps.toFixed(1)),confidence,caps:{...caps}};
}

export function resolveQuality(requested,renderer,nav=globalThis.navigator??{}) {
 const caps=inspectGraphics(renderer,nav),automatic=chooseAutomaticQuality(caps);
 if(['low','medium','high'].includes(requested))return {mode:requested,quality:requested,automatic,caps};
 return {mode:'auto',quality:automatic.quality,automatic,caps};
}
