// GH-39: filter lighting at its source, without filtering the finished image.
// Three r180 accounts for geometric curvature, but not normal-map variance.
export function specularAntialiasing(material) {
 const compile=material.onBeforeCompile;
 const key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
   vec3 edgeDx=dFdx(normal), edgeDy=dFdy(normal);
   float edgeVariance=min(0.04,0.125*(dot(edgeDx,edgeDx)+dot(edgeDy,edgeDy)));
   material.roughness=min(1.0,pow(pow(material.roughness,4.0)+edgeVariance,0.25));
   #ifdef USE_CLEARCOAT
    vec3 coatDx=dFdx(clearcoatNormal), coatDy=dFdy(clearcoatNormal);
    float coatVariance=min(0.04,0.125*(dot(coatDx,coatDx)+dot(coatDy,coatDy)));
    material.clearcoatRoughness=min(1.0,pow(pow(material.clearcoatRoughness,4.0)+coatVariance,0.25));
   #endif
  `);
 };
 material.customProgramCacheKey=()=>`${key}:gh39-specular-variance-1`;
 return material;
}

// LatheGeometry r180 leaves its last profile normal unnormalized. That changes
// interpolation across the final strip even though the fragment normal is unit length.
export function normalizeLatheNormals(geometry,closedProfile=false) {
 const n=geometry.attributes.normal;
 geometry.normalizeNormals();
 if(closedProfile){
  const stride=geometry.parameters.points.length;
  for(let i=0;i<n.count;i+=stride){
   const j=i+stride-1;
   const x=n.getX(i)+n.getX(j),y=n.getY(i)+n.getY(j),z=n.getZ(i)+n.getZ(j);
   const length=Math.hypot(x,y,z);
   if(length>1e-8){n.setXYZ(i,x/length,y/length,z/length);n.setXYZ(j,x/length,y/length,z/length);}
  }
 }
 n.needsUpdate=true;
 return geometry;
}
