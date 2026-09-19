import * as T from 'three';
export function smokeVolume(){
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.BackSide,
  uniforms:{
   uCam:{value:new T.Vector3()},
   uLightDir:{value:new T.Vector3(0.35,0.78,-0.45).normalize()},
   uTime:{value:0},
   uDensity:{value:0},
   uLoad:{value:0},
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
   uniform float uTime,uDensity,uLoad,uWater;
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
    v+=0.065*noise(p*8.13+vec3(uTime*0.015,0.0,-uTime*0.018));
    return v*1.035;
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
    vec3 pOffset=vec3(uTime*0.018,-uTime*0.035,sin(uTime*0.12)*0.018);
    vec3 lightDir=normalize(length(uLightDir)>0.01?uLightDir:vec3(0.35,0.78,-0.45));

    // Smoke load controls how many billows exist; concentration controls how
    // optically dense those billows are inside the currently available air.
    // Keeping those concepts separate makes early wisps grow smoothly while
    // still allowing 50% of a charge to compress into 25% headspace.
    float load=smoothstep(0.0,1.0,uLoad);
    float extinctionScale=uDensity*mix(38.0,108.0,sqrt(uDensity));

    // Natural herbal smoke: warm lit curls, neutral body, cool forest shadow.
    vec3 sunHighlight = vec3(0.93, 0.91, 0.86);
    vec3 smokeCream   = vec3(0.73, 0.74, 0.70);
    vec3 smokeAmber   = vec3(0.82, 0.78, 0.67);
    vec3 shadowForest = vec3(0.29, 0.34, 0.32);

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

     // Two-scale domain warp creates connected rolling plumes and fine curls.
     vec3 warp=vec3(
      noise(p*12.0+vec3(0.0,uTime*0.025,0.0)),
      noise(p*12.0+vec3(4.3,-uTime*0.032,1.7)),
      noise(p*12.0+vec3(1.2,0.8,uTime*0.020))
     );
     float n=fbm(p*24.0+(warp-0.5)*0.72+pOffset);
     float curl=noise(p*58.0+(warp.yzx-0.5)*.55-pOffset*.7);

     // Sparse tendrils at first, then connected billows as the bowl burns.
     float threshold=mix(0.57,0.20,sqrt(load));
     float density=smoothstep(threshold,0.88,n*.84+curl*.16)*wallFade*aboveWater;

     if(density>0.003){
      // Directional light sample towards the sun: detects billow crests vs shadowed crevices
      vec3 pLight=p+lightDir*0.010;
      float radL=mix(.0312,.012,smoothstep(.145,.215,pLight.y));
      float wallFadeL=smoothstep(0.001,0.006,radL-length(pLight.xz));
      float aboveWaterL=smoothstep(0.001,0.005,dot(uWaterPlane,vec4(pLight,1.)));
      vec3 warpL=vec3(
       noise(pLight*12.0+vec3(0.0,uTime*0.025,0.0)),
       noise(pLight*12.0+vec3(4.3,-uTime*0.032,1.7)),
       noise(pLight*12.0+vec3(1.2,0.8,uTime*0.020))
      );
      float nL=fbm(pLight*24.0+(warpL-0.5)*0.72+pOffset);
      float curlL=noise(pLight*58.0+(warpL.yzx-0.5)*.55-pOffset*.7);
      float densityL=smoothstep(threshold,0.88,nL*.84+curlL*.16)*wallFadeL*aboveWaterL;

      // Lighting contrast: sunlit face is brightened; shadowed face receives forest ambient
      float lightDiff=clamp((densityL-density)*3.4,-0.7,1.0);
      float directLight=clamp(0.58-0.46*lightDiff,0.16,1.0);

      // Phase function: forward scattering creates gentle rim translucency
      float cosTheta=dot(d,lightDir);
      float phase=.72+.28*(.5+.5*cosTheta);

      // Subtle warm amber core in denser upper regions
      float heightFrac=clamp((p.y-0.03)*4.2,0.0,1.0);
      vec3 coreCol=mix(smokeCream,smokeAmber,heightFrac*0.35);

      // Final volumetric shaded color: 3D billow relief eliminates flat white/milky blob
      vec3 litCol=mix(coreCol,sunHighlight,directLight*phase*.32);
      vec3 stepCol=mix(shadowForest,litCol,directLight*.78+.18);

      float stepExtinction=density*extinctionScale;
      float stepAlpha=1.0-exp(-stepExtinction*stepSize);

      accumCol+=(1.0-accumAlpha)*stepAlpha*stepCol;
      accumAlpha+=(1.0-accumAlpha)*stepAlpha;

      if(accumAlpha>0.965)break;
     }
    }

    if(accumAlpha<0.003)discard;
    gl_FragColor=vec4(accumCol/max(0.001,accumAlpha),accumAlpha);
   }
  `
 });
}
