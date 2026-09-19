export async function sampleAtmSunVisibility(page){
 return page.evaluate(()=>{
   const w=window.__game.world,a=w.atmosphere,r=w.renderer,c=a._compositeUniforms;
   const mesh=a._volumeMesh,original=mesh.material,material=original.clone();
   material.uniforms={probeDepth:{value:a.depthTexture},probeSunUV:c.atmosphereSunUV,probeAspect:c.atmosphereSunAspect,probeTan:c.atmosphereTanHalfFov};
   material.fragmentShader=`uniform sampler2D probeDepth;uniform vec2 probeSunUV;uniform float probeAspect;uniform float probeTan;void main(){vec2 radius=vec2(.00465/probeAspect,.00465)/(2.0*probeTan);float sky=0.0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)sky+=step(.999999,texture2D(probeDepth,probeSunUV+vec2(float(x),float(y))*radius*.55).x)/9.0;gl_FragColor=vec4(vec3(sky),1.0);}`;
   const target=new a._volumeTarget.constructor(1,1),oldTarget=r.getRenderTarget(),pixel=new Uint8Array(4);
   const viewport=r.getViewport(a._viewport.clone());
   try{mesh.material=material;r.setRenderTarget(target);r.render(a._volumeScene,a._volumeCamera);r.readRenderTargetPixels(target,0,0,1,1,pixel);return pixel[0]/255;}
   finally{mesh.material=original;r.setRenderTarget(oldTarget);r.setViewport(viewport);material.dispose();target.dispose();}
  });
}
