import * as T from 'three';
export function flameMaterial(){
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{time:{value:0}},
  vertexShader:`
   varying vec2 uv0;
   void main(){
    uv0=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
   }
  `,
  fragmentShader:`
   varying vec2 uv0;
   uniform float time;
   void main(){
    float y=uv0.y;
    // Multi-harmonic turbulent flame sway with buoyant upward convection
    float sway = sin(y*11.0 - time*22.0)*0.032*y
               + sin(time*39.0 + y*27.0)*0.018*pow(y, 1.4)
               + cos(time*15.0 - y*18.0)*0.012*y;
    
    // Slender burner anchor expanding into natural teardrop and licking tip
    float width = (0.24 * pow(1.0 - y, 0.55) + 0.06) * smoothstep(0.0, 0.15, y) + 0.015;
    float r = abs(uv0.x - 0.5 - sway) / max(0.001, width);
    if(r > 1.4) discard;

    // Dual-stage combustion anatomy:
    // 1. Outer sheath: Rich oxygen blue base (y < 0.28) transitioning to warm luminous orange/amber
    vec3 blueBase = vec3(0.10, 0.42, 1.15);
    vec3 amberMid = vec3(1.0, 0.38, 0.03);
    vec3 outer = mix(blueBase, amberMid, smoothstep(0.08, 0.32, y));

    // 2. Incandescent core: Bright cyan-white reaction zone rising into incandescent white-yellow
    vec3 cyanCore = vec3(0.35, 0.78, 1.1);
    vec3 whiteYellow = vec3(1.0, 0.96, 0.72);
    vec3 core = mix(cyanCore, whiteYellow, smoothstep(0.06, 0.25, y));

    // Core intensity concentrated along central spine
    float coreWeight = pow(max(0.0, 1.0 - r * 1.35), 2.2);
    vec3 color = mix(outer, core * 1.35, coreWeight);

    // Alpha envelope with smooth feathered boundary and natural tip feathering
    float edgeAlpha = pow(max(0.0, 1.0 - r), 1.35);
    float verticalFade = smoothstep(0.0, 0.04, y) * pow(1.0 - y, 0.38);
    float alpha = edgeAlpha * verticalFade * 0.95;

    gl_FragColor = vec4(color * 1.5, alpha);
   }
  `
 });
}
