import * as T from 'three';
export function smokeVolume(){
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.BackSide,
  uniforms:{
   uCam:{value:new T.Vector3()},
   uLightDir:{value:new T.Vector3(0.35,0.78,-0.45).normalize()},
   uTime:{value:0},
   uDensity:{value:0},
   uWater:{value:.03},
   uWaterPlane:{value:new T.Vector4(0,1,0,-.03)}
  },
  vertexShader:`
   varying vec3 vP;
   void main(){
    vP=position;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
   }
  `,
  fragmentShader:`
   precision highp float;
   varying vec3 vP;
   uniform vec3 uCam,uLightDir;
   uniform float uTime,uDensity,uWater;
   uniform vec4 uWaterPlane;

   float hash(vec3 p){
    p=fract(p*.3183099+vec3(.1,.2,.3));
    p*=17.;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
   }
   float noise(vec3 p){
    vec3 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
   }
   float fbm(vec3 p){
    float v=0.52*noise(p);
    v+=0.26*noise(p*2.03+vec3(0.0,uTime*0.04,0.0));
    v+=0.13*noise(p*4.07-vec3(uTime*0.02,0.0,uTime*0.03));
    return v*1.1;
   }

   void main(){
    if(uDensity<=0.001)discard;
    vec3 d=normalize(vP-uCam);
    vec3 lo=vec3(-.033,.008,-.033),hi=vec3(.033,.225,.033);
    vec3 a=(lo-uCam)/d,b=(hi-uCam)/d;
    vec3 mn=min(a,b),mx=max(a,b);
    float near=max(max(mn.x,mn.y),mn.z),far=min(min(mx.x,mx.y),mx.z);
    if(far<near)discard;

    float tStart=max(near,0.);
    float tEnd=far;
    if(tEnd<=tStart)discard;

    float stepSize=(tEnd-tStart)/28.;
    vec3 pOffset=vec3(uTime*0.025,-uTime*0.055,sin(uTime*0.12)*0.02);
    vec3 lightDir=normalize(length(uLightDir)>0.01?uLightDir:vec3(0.35,0.78,-0.45));

    // Refined extinction progression:
    // ~25% smoke: clearly readable, graceful curling tendrils (core alpha ~0.38)
    // ~50% smoke: rolling milky cloud with clear 3D volume (core alpha ~0.65)
    // ~75% smoke: rich, dense, authentic gravity hit chamber (core alpha ~0.82)
    // ~95% smoke: fully charged thick smoke with rich light/shadow contours (core alpha ~0.93)
    float extinctionScale=uDensity*mix(95.0,165.0,uDensity);

    // Natural herbal smoke palette: soft organic cream body, amber warmth, cool ambient shadow
    vec3 sunHighlight = vec3(0.94, 0.92, 0.88);
    vec3 smokeCream   = vec3(0.81, 0.80, 0.76);
    vec3 smokeAmber   = vec3(0.87, 0.83, 0.74);
    vec3 shadowForest = vec3(0.44, 0.48, 0.45);

    vec3 accumCol=vec3(0.);
    float accumAlpha=0.;

    for(int j=0;j<28;j++){
     vec3 p=uCam+d*(tStart+(float(j)+.5)*stepSize);

     // Headspace water boundary: crisp 4mm layer strictly above water plane
     float waterDist=dot(uWaterPlane,vec4(p,1.));
     float aboveWater=smoothstep(0.001,0.005,waterDist);
     if(aboveWater<=0.001)continue;

     // Bottle wall boundary: soft 5mm margin preserves transparent PET reflections & edge
     float rad=mix(.0312,.012,smoothstep(.145,.215,p.y));
     float wallDist=rad-length(p.xz);
     float wallFade=smoothstep(0.001,0.006,wallDist);
     if(wallFade<=0.001)continue;

     // Large-scale vortex domain warp creates rolling fluid plumes rather than static noise
     vec3 warp=vec3(
      noise(p*14.0+vec3(0.0,uTime*0.03,0.0)),
      noise(p*14.0+vec3(4.3,-uTime*0.04,1.7)),
      noise(p*14.0+vec3(1.2,0.8,uTime*0.025))
     );
     float n=fbm(p*26.0+(warp-0.5)*0.62+pOffset);

     // Dynamic density shaping preserving billow valleys and swirl contours
     float threshold=mix(0.34,0.13,uDensity);
     float density=smoothstep(threshold,0.85,n)*wallFade*aboveWater;

     if(density>0.003){
      // Directional light sample towards the sun: detects billow crests vs shadowed crevices
      vec3 pLight=p+lightDir*0.010;
      float radL=mix(.0312,.012,smoothstep(.145,.215,pLight.y));
      float wallFadeL=smoothstep(0.001,0.006,radL-length(pLight.xz));
      float aboveWaterL=smoothstep(0.001,0.005,dot(uWaterPlane,vec4(pLight,1.)));
      vec3 warpL=vec3(
       noise(pLight*14.0+vec3(0.0,uTime*0.03,0.0)),
       noise(pLight*14.0+vec3(4.3,-uTime*0.04,1.7)),
       noise(pLight*14.0+vec3(1.2,0.8,uTime*0.025))
      );
      float nL=fbm(pLight*26.0+(warpL-0.5)*0.62+pOffset);
      float densityL=smoothstep(threshold,0.85,nL)*wallFadeL*aboveWaterL;

      // Lighting contrast: sunlit face is brightened; shadowed face receives forest ambient
      float lightDiff=clamp((densityL-density)*3.0,-0.6,1.0);
      float directLight=clamp(0.55-0.45*lightDiff,0.18,1.0);

      // Phase function: forward scattering creates gentle rim translucency
      float cosTheta=dot(d,lightDir);
      float phase=0.5+0.5*(1.0+0.30*cosTheta);

      // Subtle warm amber core in denser upper regions
      float heightFrac=clamp((p.y-0.03)*4.2,0.0,1.0);
      vec3 coreCol=mix(smokeCream,smokeAmber,heightFrac*0.35);

      // Final volumetric shaded color: 3D billow relief eliminates flat white/milky blob
      vec3 litCol=mix(coreCol,sunHighlight,directLight*phase*0.35);
      vec3 stepCol=mix(shadowForest,litCol,directLight*0.75+0.25);

      float stepExtinction=density*extinctionScale;
      float stepAlpha=1.0-exp(-stepExtinction*stepSize);

      accumCol+=(1.0-accumAlpha)*stepAlpha*stepCol;
      accumAlpha+=(1.0-accumAlpha)*stepAlpha;

      if(accumAlpha>0.985)break;
     }
    }

    if(accumAlpha<0.003)discard;
    gl_FragColor=vec4(accumCol/max(0.001,accumAlpha),accumAlpha);
   }
  `
 });
}
