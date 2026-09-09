import * as T from 'three';
export function smokeVolume(){
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.BackSide,
  uniforms:{uCam:{value:new T.Vector3()},uTime:{value:0},uDensity:{value:0},uWater:{value:.03},uWaterPlane:{value:new T.Vector4(0,1,0,-.03)}},
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
   uniform vec3 uCam;
   uniform float uTime,uDensity,uWater;
   uniform vec4 uWaterPlane;

   float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
   float noise(vec3 p){
    vec3 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);
   }
   float fbm(vec3 p){
    float v = noise(p);
    v += 0.5 * noise(p * 2.02 + vec3(0.0, uTime * 0.05, 0.0));
    return v / 1.5;
   }

   void main(){
    vec3 d=normalize(vP-uCam);
    vec3 lo=vec3(-.033,.008,-.033),hi=vec3(.033,.225,.033);
    vec3 a=(lo-uCam)/d,b=(hi-uCam)/d;
    vec3 mn=min(a,b),mx=max(a,b);
    float near=max(max(mn.x,mn.y),mn.z),far=min(min(mx.x,mx.y),mx.z);
    if(far<near)discard;

    float optical=0.;
    float stepSize=(far-max(near,0.))/24.;
    vec3 pOffset = vec3(uTime*0.08, -uTime*0.14, sin(uTime*0.2)*0.03);

    for(int j=0;j<24;j++){
     vec3 p=uCam+d*(max(near,0.)+(float(j)+.5)*stepSize);
     float rad=mix(.0312,.012,smoothstep(.145,.215,p.y));
     float edge=1.-smoothstep(rad-.006,rad,length(p.xz));
     float above=smoothstep(.0005,.006,dot(uWaterPlane,vec4(p,1.)));
     float n=fbm(p*48.0 + pOffset);
     n = smoothstep(0.18, 0.92, n);
     optical += edge * above * n * stepSize * uDensity * 32.0;
    }

    float alpha = 1.0 - exp(-optical);
    if(alpha < 0.003) discard;

    // Organic creamy herbal smoke tone with warm ivory/amber core
    vec3 smokeBase = vec3(0.72, 0.73, 0.69);
    vec3 smokeIvory = vec3(0.88, 0.87, 0.82);
    vec3 smokeAmber = vec3(0.92, 0.89, 0.81);
    vec3 col = mix(smokeBase, mix(smokeIvory, smokeAmber, 0.35), clamp(vP.y * 2.8, 0.0, 1.0));

    gl_FragColor = vec4(col, alpha * 0.92);
   }
  `
 });
}
