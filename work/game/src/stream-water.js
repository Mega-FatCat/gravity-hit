import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';

// GH-38: keep the existing channel and picking mesh. The optical surface owns
// its animation and compositing; no streambed material or geometry is changed.
export function createStreamWater(world, geometry, normalTexture, level) {
 const profile=world.profile;
 const water=new Water(geometry,{textureWidth:profile.waterReflectionSize,textureHeight:profile.waterReflectionSize,
  waterNormals:normalTexture,sunDirection:world.sun.position.clone().normalize(),
  sunColor:0xffeed0,waterColor:0x52604a,alpha:1,distortionScale:.07,fog:true});
 water.rotation.x=-Math.PI/2;water.position.y=level;water.name='stream';
 water.renderOrder=-1;water.material.transparent=true;water.material.depthWrite=false;
 water.receiveShadow=true;
 const m=water.material;
 const transmission=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:profile.waterMsaaSamples});
 transmission.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const composite=transmission.clone();
 // GH-39: the copy is resolved, but the water drawn AFTER it still needs MSAA.
 composite.samples=profile.waterMsaaSamples;
 composite.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 Object.assign(m.uniforms,{
  bedColor:{value:transmission.texture},bedDepth:{value:transmission.depthTexture},
  resolution:{value:new T.Vector2()},cameraRange:{value:new T.Vector2()},
 });
 const waves=`
  // Short gravity-capillary waves travel downstream (+Z). Their wavelengths stay
  // in the 10–25 cm range so the surface never reads as a slow rolling sheet.
  float surfaceHeight(vec2 p) {
   return .0023*sin(p.y*34.0-p.x*6.0-time*18.0+sin(p.x*5.0+p.y*3.0)*.65)
        + .00124*sin(p.y*58.0+p.x*17.0-time*27.0)
        + .00050*sin(p.y*92.0-p.x*31.0-time*41.0);
  }
 `;
 // Water's addon shader has no <begin_vertex>. Patching that include silently
 // left the old bank/world varyings unassigned. Patch its actual main instead.
 m.vertexShader=m.vertexShader.replace('void main() {',`${waves}
  void main() {
   vec3 surfacePosition=position;
   vec2 wp=(modelMatrix*vec4(position,1.0)).xz;
   surfacePosition.z+=surfaceHeight(wp);
 `).replaceAll('vec4( position, 1.0 )','vec4( surfacePosition, 1.0 )');
 m.fragmentShader=`
  uniform sampler2D bedColor;
  uniform sampler2D bedDepth;
  uniform vec2 resolution;
  uniform vec2 cameraRange;
 `+m.fragmentShader;
 const main=m.fragmentShader.indexOf('\t\t\t\tvoid main()');
 if(main<0)throw Error('Unexpected Water shader layout');
 m.fragmentShader=m.fragmentShader.slice(0,main)+waves+`
  float sceneDistance(vec2 uv) {
   return -perspectiveDepthToViewZ(texture2D(bedDepth,uv).x,cameraRange.x,cameraRange.y);
  }
  void main() {
   vec2 p=worldPosition.xz;
   vec2 screenUV=gl_FragCoord.xy/resolution;
   float surfaceDistance=-perspectiveDepthToViewZ(gl_FragCoord.z,cameraRange.x,cameraRange.y);
   float pathLength=max(0.0,sceneDistance(screenUV)-surfaceDistance);
   vec3 toEye=normalize(eye-worldPosition.xyz);
   float depth=pathLength*max(.12,toEye.y);
   // Refracted foreground rejection and a soft physical waterline, not a UV fade.
   float contact=1.0-smoothstep(.006,.055,depth);
   float h=surfaceHeight(p);
   vec2 slope=vec2(surfaceHeight(p+vec2(.009,0.0))-h,surfaceHeight(p+vec2(0.0,.009))-h)/.009;
   // Two tighter normal octaves make the visible streaks small and fast while
   // retaining a coherent downstream direction.
   vec2 flow=p-vec2(0.0,time*.85);
   vec2 fine=(texture2D(normalSampler,flow*vec2(3.8,6.2)).rg*2.0-1.0)*.17;
   fine+=(texture2D(normalSampler,flow*vec2(7.4,10.5)+vec2(.3,-time*.22)).rg*2.0-1.0)*.052;
   fine*=clamp(distortionScale/.07,.7,1.3);
   // Depth gradients turn flow around real protruding rocks and banks.
   vec2 pixel=1.5/resolution;
   vec2 edge=vec2(sceneDistance(screenUV+vec2(pixel.x,0.0))-sceneDistance(screenUV-vec2(pixel.x,0.0)),
                  sceneDistance(screenUV+vec2(0.0,pixel.y))-sceneDistance(screenUV-vec2(0.0,pixel.y)));
   edge=clamp(edge,vec2(-.07),vec2(.07));
   vec3 edgeWorld=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0])*edge.x
                 +vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1])*edge.y;
   float wake=sin(depth*190.0-time*5.0+p.y*5.0)*contact;
   vec3 normal=normalize(vec3(-slope.x+fine.x+edgeWorld.x*wake*.65,1.0,-slope.y+fine.y+edgeWorld.z*wake*.65));
   vec3 viewNormal=mat3(viewMatrix)*normal;
   vec2 offset=viewNormal.xy*.012*smoothstep(.0,.14,pathLength);
   vec2 refractedUV=clamp(screenUV+offset,vec2(.002),vec2(.998));
   if(sceneDistance(refractedUV)<surfaceDistance+.002)refractedUV=screenUV;
   vec3 bottom=texture2D(bedColor,refractedUV).rgb;
    // Beer-Lambert attenuation with shallow-creek clarity. At the same vertical
    // depth an oblique camera ray is much longer; the old high extinction then
    // erased every bed mineral family into one green body color. Keep the deeper
    // water coefficients unchanged, but use lower physically-plausible turbidity
    // only for the shallow streambed so the actual rock albedo can survive.
    float shallowClarity=1.0-smoothstep(.14,.52,depth);
    // image(6) is a very clear shallow woodland creek: even at an oblique
    // camera angle the mineral colours remain legible through several tens of
    // centimetres of water.  Use genuinely low suspended-turbidity extinction
    // in that shallow band; only deeper water converges on the older body.
    vec3 extinction=mix(vec3(2.8,2.1,3.1),vec3(.82,.67,.94),shallowClarity*.92);
   vec3 transmittance=exp(-extinction*min(pathLength,2.0));
   float illumination=.50+.50*getShadowMask();
    vec3 body=vec3(.080,.105,.074)*illumination;
   vec3 transmitted=bottom*transmittance+body*(1.0-transmittance);
   float theta=clamp(dot(normal,toEye),0.0,1.0);
   float fresnel=.0204+.9796*pow(1.0-theta,5.0);
   vec2 reflectionUV=mirrorCoord.xy/mirrorCoord.w+normal.xz*.032;
   // Finite roughness footprint softens reflected trees, keeping ripple facets.
   vec2 blur=vec2(.0018);
   vec3 reflection=texture2D(mirrorSampler,reflectionUV).rgb*.4;
   reflection+=texture2D(mirrorSampler,reflectionUV+vec2(blur.x,0.0)).rgb*.15;
   reflection+=texture2D(mirrorSampler,reflectionUV-vec2(blur.x,0.0)).rgb*.15;
   reflection+=texture2D(mirrorSampler,reflectionUV+vec2(0.0,blur.y)).rgb*.15;
   reflection+=texture2D(mirrorSampler,reflectionUV-vec2(0.0,blur.y)).rgb*.15;
   float reflectedWeight=min(.78,.16+fresnel*.84);
   vec3 outgoingLight=mix(transmitted,reflection,reflectedWeight);
   vec3 halfDirection=normalize(toEye+sunDirection);
   vec3 normalDx=dFdx(normal),normalDy=dFdy(normal);
   float variance=.125*(dot(normalDx,normalDx)+dot(normalDy,normalDy));
   float exponent=2.0/(2.0/182.0+min(.04,variance))-2.0;
   float spec=pow(max(dot(normal,halfDirection),0.0),exponent)*(exponent+2.0)/182.0;
   outgoingLight+=sunColor*spec*.32*getShadowMask();
   // A restrained moving meniscus catches diffuse sky at rock contact.
   outgoingLight+=vec3(.018,.024,.021)*contact*(.45+.55*max(wake,0.0));
   float coverage=smoothstep(.0,.008,pathLength);
   gl_FragColor=vec4(outgoingLight,coverage);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #include <fog_fragment>
  }
 `;
 const reflect=water.onBeforeRender;
 const size=new T.Vector2(),viewport=new T.Vector4(),scissor=new T.Vector4();
 // Reuse the opaque scene as refraction input instead of drawing the dense bed
 // twice. Copy its color AND depth, then draw water and the original glass/effects.
 const copyScene=new T.Scene(),copyCamera=new T.Camera();
 const copyMaterial=new T.ShaderMaterial({
  uniforms:{color:{value:transmission.texture},depth:{value:transmission.depthTexture}},
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`uniform sampler2D color; uniform sampler2D depth; varying vec2 vUv;
   void main(){gl_FragColor=texture2D(color,vUv);gl_FragDepth=texture2D(depth,vUv).x;
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`,depthWrite:true,depthTest:true,depthFunc:T.AlwaysDepth,
 });
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),copyMaterial);quad.frustumCulled=false;copyScene.add(quad);
 const finalMaterial=copyMaterial.clone();
 finalMaterial.uniforms.color.value=composite.texture;finalMaterial.uniforms.depth.value=composite.depthTexture;
 const finalQuad=new T.Mesh(quad.geometry,finalMaterial);finalQuad.frustumCulled=false;finalQuad.renderOrder=-1000;
 finalQuad.name='Water composite background';
 world.atmosphere?.attachCompositeMaterial(finalMaterial);
 // Reflection is prepared before opaque objects are hidden for the final pass.
 water.onBeforeRender=()=>{};
 const frustum=new T.Frustum(),clipMatrix=new T.Matrix4(),bounds=new T.Box3();
 geometry.computeBoundingBox();
 water.userData.renderScene=function(renderer,scene,camera){
  scene.updateMatrixWorld();camera.updateMatrixWorld();
  clipMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 frustum.setFromProjectionMatrix(clipMatrix);
  bounds.copy(geometry.boundingBox).expandByScalar(.012).applyMatrix4(water.matrixWorld);
  const waterInFrustum=water.visible&&frustum.intersectsBox(bounds);
  const atmosphereActive=world.atmosphere?.needsDepth?.()??false;
  if(!waterInFrustum&&!atmosphereActive){
   water.userData.atmosphereDepth=null;
   renderer.render(scene,camera);return;
  }
  const target=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate;
  const scissorTest=renderer.getScissorTest(),xr=renderer.xr.enabled;
  const autoClear=renderer.autoClear,autoReset=renderer.info.autoReset;
  renderer.getViewport(viewport);renderer.getScissor(scissor);
  const transparent=[],opaque=[],layers=new Map();
  try {
   renderer.info.autoReset=false;renderer.info.reset();
   // The mirror does not need glass props, smoke or pollen. Leaving them active
   // made Three run a nested transmission prepass which redrew the entire
   // opaque forest just to produce the small, blurred stream reflection.
   const reflectionHidden=[];
   if(waterInFrustum){
    scene.traverse(o=>{if(o!==water&&o.visible&&(o.isMesh||o.isPoints||o.isLine)){
     const materials=Array.isArray(o.material)?o.material:[o.material];
     const name=o.name||'';
     const detail=world.profile?.reflectionDetail??'full';
     const transparent=materials.some(x=>x?.transparent||x?.transmission>0);
     const micro=/^Forest floor|^Streambed Class (?:2b.*Far|3|3b|4|5)|attached leaf shoots|Individual forest dust/i.test(name);
     const undergrowth=/(?:fern|grass|understory|sapling|heath|bush|thicket|seedhead)/i.test(name);
     const omit=transparent||(detail==='balanced'&&micro)||(detail==='essential'&&(micro||undergrowth))||(detail==='minimal'&&(micro||undergrowth||/curved broadleaf leaves/i.test(name)));
     if(omit){reflectionHidden.push([o,o.layers.mask]);o.layers.mask=0;}
    }});
    try{reflect.call(water,renderer,scene,camera);}finally{for(const [o,mask]of reflectionHidden)o.layers.mask=mask;}
   }
   renderer.getDrawingBufferSize(size);
   m.uniforms.cameraRange.value.set(camera.near,camera.far);
   const scale=world.profile?.waterSceneScale??1,w=Math.max(1,Math.floor(size.x*scale)),h=Math.max(1,Math.floor(size.y*scale));
   m.uniforms.resolution.value.set(w,h);
   if(transmission.width!==w||transmission.height!==h){transmission.setSize(w,h);composite.setSize(w,h);}
   scene.traverse(o=>{if(o.visible&&(o.isMesh||o.isPoints||o.isLine)){
    layers.set(o,o.layers.mask);
    const materials=Array.isArray(o.material)?o.material:[o.material];
    if(o===water||materials.some(x=>x.transparent||x.transmission>0))transparent.push(o);else opaque.push(o);
   }});
   for(const o of transparent)o.layers.mask=0;
   renderer.xr.enabled=false;
   renderer.setRenderTarget(transmission);renderer.setScissorTest(false);renderer.clear();
   renderer.render(scene,camera);
   renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
   renderer.setRenderTarget(composite);
   renderer.render(copyScene,copyCamera);
   // Expose the existing opaque depth target for QA and for ATM-01. The
   // atmosphere pass consumes it read-only, so no additional forest depth
   // prepass is needed.
   water.userData.atmosphereDepth=transmission.depthTexture;
   world.atmosphere?.prepare(renderer,camera,{depthTexture:transmission.depthTexture});
   for(const o of opaque)o.layers.mask=0;
   water.layers.mask=waterInFrustum?(layers.get(water)??0):0;
   renderer.autoClear=false;
   // Water joins the opaque background before Three's glass transmission pass.
   // The full-screen color/depth mesh also seeds that pass, preserving PET/pipe.
   const background=scene.background;scene.background=null;
   try{
    renderer.render(scene,camera);
    water.layers.mask=0;
    for(const o of transparent)if(o!==water)o.layers.mask=layers.get(o);
    scene.add(finalQuad);renderer.setRenderTarget(target);renderer.setViewport(viewport);
    renderer.autoClear=true;renderer.render(scene,camera);
   }finally{scene.background=background;scene.remove(finalQuad);}
  } finally {
   for(const [o,mask]of layers)o.layers.mask=mask;
   renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
   renderer.xr.enabled=xr;renderer.shadowMap.autoUpdate=shadow;
   renderer.autoClear=autoClear;renderer.info.autoReset=autoReset;
  }
 };
 water.userData.disposeOptics=()=>{transmission.dispose();transmission.depthTexture.dispose();composite.dispose();composite.depthTexture.dispose();m.uniforms.mirrorSampler.value.dispose();normalTexture.dispose();quad.geometry.dispose();copyMaterial.dispose();finalMaterial.dispose();};
 return water;
}
