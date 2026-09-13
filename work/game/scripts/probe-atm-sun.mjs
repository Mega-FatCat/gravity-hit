import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,tutorial:false});g.setView(.9273,.8);});
 await page.waitForTimeout(2000);
 const samples=await page.evaluate(async()=>{
  const g=window.__game,w=g.world,T=g.THREE,r=w.renderer,rt=new T.WebGLRenderTarget(1,1,{depthBuffer:false});
  const scene=new T.Scene(),cam=new T.Camera(),uv=new T.Vector2(),radius=new T.Vector2();
  const m=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{depth:{value:null},sunUV:{value:uv},radius:{value:radius}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D depth;uniform vec2 sunUV;uniform vec2 radius;void main(){float visible=0.;for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){vec2 p=sunUV+vec2(float(x),float(y))*.5*radius;visible+=step(.99999,texture2D(depth,p).r);}gl_FragColor=vec4(visible/25.,step(.99999,texture2D(depth,sunUV).r),0.,1.);}'});
  const mesh=new T.Mesh(new T.PlaneGeometry(2,2),m);scene.add(mesh);const bytes=new Uint8Array(4),out=[];
  try{
   for(const z of [2.65,1,-1,4])for(let x=-4;x<=4;x+=.5){
    const y=Math.max(.98,w.ground(x,z)+.98);w.baseCam.set(x,y,z);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    w.render();m.uniforms.depth.value=w.stream.userData.atmosphereDepth??w.atmosphere.depthTexture;
    if(!m.uniforms.depth.value)throw Error('Missing exposed atmosphere opaque depth');
    const dir=w.sun.getWorldPosition(new T.Vector3()).sub(w.sun.target.getWorldPosition(new T.Vector3())).normalize();
    const p=w.camera.position.clone().addScaledVector(dir,100).project(w.camera);uv.set(p.x*.5+.5,p.y*.5+.5);
    radius.set(.00465/(Math.tan(w.camera.fov*Math.PI/360)*w.camera.aspect)*.5,.00465/Math.tan(w.camera.fov*Math.PI/360)*.5);
    const target=r.getRenderTarget();r.setRenderTarget(rt);r.render(scene,cam);r.readRenderTargetPixels(rt,0,0,1,1,bytes);r.setRenderTarget(target);
    out.push({camera:[x,y,z],visible:bytes[0]/255,center:bytes[1]/255,sunUV:uv.toArray()});
   }
  }finally{rt.dispose();m.dispose();mesh.geometry.dispose();w.baseCam.set(0,.98,2.65);}
  return out;
 });
 await fs.mkdir(path.resolve('qa/atm-01'),{recursive:true});await fs.writeFile(path.resolve('qa/atm-01/sun-probes.json'),JSON.stringify(samples,null,2));
 console.log(JSON.stringify(samples));
}finally{await app.close();}
