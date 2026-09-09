// Resolve visible physical surfaces to one logical object, in depth order.
export function visibleSurface(object){
 for(let p=object;p;p=p.parent)if(!p.visible)return false;
 if((object.userData?.noPick||object.userData?.pickable===false))return false;
 const materials=Array.isArray(object.material)?object.material:[object.material];
 return materials.some(m=>m&&m.visible!==false&&(!m.transparent||m.opacity>.02));
}
export function resolveLogicalHit(hits,mapObject,blockedAt=Infinity){
 const seen=new Set();
 for(const hit of [...hits].sort((a,b)=>a.distance-b.distance)){
  if(hit.distance>blockedAt+.001)break;
  if(!visibleSurface(hit.object))continue;
  const id=mapObject(hit.object);
  if(!id||seen.has(id))continue;
  seen.add(id);
  return id;
 }
 return null;
}
