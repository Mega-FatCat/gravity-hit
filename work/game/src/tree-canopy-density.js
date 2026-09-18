import * as T from 'three';
import {foliageDepthMaterial} from './foliage-rendering.js';

// Leaf-only additions. Recording a branch never samples the tree generator's
// RNG and never changes its vertices. Replaying a private hash stream lets us
// count exact GPU allocations before filling them, without huge object arrays.
export class TreeCanopyDensity {
 constructor(world,trees,geometries,material,distant=false){
  Object.assign(this,{world,trees,geometries,material,distant});
  this.twigs=[];this.boughs=[];this.shoots=[];
  this.crowns=trees.map(tree=>({tree,twigs:[],boughs:[],cloudLeaves:[]}));
 }
 twig(treeIndex,root,mid,tip,size,top){
  this.twigs.push({treeIndex,root:root.clone(),mid:mid.clone(),tip:tip.clone(),size,top});
  const crown=this.crowns[treeIndex];
  crown.twigs.push(this.twigs[this.twigs.length-1]);

 }
 bough(start,mid,end,treeIndex){const path=[start.clone(),mid.clone(),end.clone()];this.boughs.push(path);this.crowns[treeIndex].boughs.push(path);}
 shoot(start,end,radius=.005){if(start.distanceToSquared(end)>1e-10)this.shoots.push([start.clone(),end.clone(),radius]);}
 cloudLeaf(treeIndex,placement){this.crowns[treeIndex].cloudLeaves.push(placement);}
 build(){
  const {world,trees,geometries,material,distant,crowns,twigs,boughs}=this;
  const seed=distant?327913:327901,golden=2.399963229728653;
  const rand=(key,channel)=>{
   let v=(seed+Math.imul(key,0x9e3779b1)+Math.imul(channel+1,0x85ebca6b))|0;
   v^=v>>>16;v=Math.imul(v,0x7feb352d);v^=v>>>15;v=Math.imul(v,0x846ca68b);v^=v>>>16;
   return(v>>>0)/4294967296;
  };
  // Preserve real woody support while allowing foliage to occupy crown depth.
  for(const crown of crowns){
   const {tree}=crown,h=tree.treeHeight??14;
   // Some original lobe roots were offset from their parent bough. Close
   // that physical gap before attaching the foliage's smaller side shoots.
   for(const twig of crown.twigs){
    let best=Infinity,base=null;
    for(const path of crown.boughs)for(let part=0;part<2;part++){
     const a=path[part],b=path[part+1],delta=b.clone().sub(a);
     const t=T.MathUtils.clamp(twig.root.clone().sub(a).dot(delta)/(delta.lengthSq()||1),0,1),p=a.clone().addScaledVector(delta,t),d=p.distanceToSquared(twig.root);
     if(d<best){best=d;base=p;}
    }
    if(base)this.shoot(base,twig.root,.009);
   }
   // Retain the cloud volume, with a short physical supporting shoot from
   // the closest twig to each blade base. Cap excessive unsupported reach.
   for(const leaf of crown.cloudLeaves){
    let best=Infinity,bx=leaf.x,by=leaf.y,bz=leaf.z;
    for(const twig of crown.twigs)for(let part=0;part<2;part++){
     const a=part?twig.mid:twig.root,b=part?twig.tip:twig.mid,dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
     const t=T.MathUtils.clamp(((leaf.x-a.x)*dx+(leaf.y-a.y)*dy+(leaf.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);
     const x=a.x+dx*t,y=a.y+dy*t,z=a.z+dz*t,d=(x-leaf.x)**2+(y-leaf.y)**2+(z-leaf.z)**2;
     if(d<best){best=d;bx=x;by=y;bz=z;}
    }
    const base=new T.Vector3(bx,by,bz),blade=new T.Vector3(leaf.x,leaf.y,leaf.z);
    const delta=blade.clone().sub(base),reach=Math.min(.65,delta.length());
    blade.copy(base).addScaledVector(delta.normalize(),reach);
    this.shoot(base,blade);
    leaf.x=blade.x;leaf.y=blade.y;leaf.z=blade.z;
   }
   // Same physical leaves on tall trees need proportionally more coverage.
   crown.count=Math.round(T.MathUtils.clamp(h*h*(distant?130:110),distant?35000:29000,distant?67000:54000));

  }
  const pos=new T.Vector3(),axis=new T.Vector3(),side=new T.Vector3(),across=new T.Vector3(),radial=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0);
  const orient=(dx,dy,dz)=>{
   axis.set(dx,dy,dz).normalize();side.crossVectors(axis,up);
   if(side.lengthSq()<1e-6)side.set(1,0,0);else side.normalize();
   across.crossVectors(axis,side).normalize();
  };
  const generate=(emit)=>{
   for(let ti=0;ti<crowns.length;ti++){
    const c=crowns[ti];
    for(let i=0;i<c.count;i++){
     const key=ti*131072+i,cluster=Math.floor(i/40),clusterKey=0x30000000+ti*8192+cluster;
     const twig=c.twigs[Math.floor(rand(clusterKey,0)*c.twigs.length)];
     if(!twig)continue;
     const t=.06+rand(clusterKey,1)*.91;
     orient(twig.tip.x-twig.root.x,twig.tip.y-twig.root.y,twig.tip.z-twig.root.z);
     const phi=rand(clusterKey,2)*Math.PI*2;
     radial.copy(side).multiplyScalar(Math.cos(phi)).addScaledVector(across,Math.sin(phi));
     const root=t<.5?twig.root.clone().lerp(twig.mid,t*2):twig.mid.clone().lerp(twig.tip,t*2-1);
     const reach=Math.min(.72,twig.size*(.20+rand(clusterKey,3)*.26));
     const end=root.clone().addScaledVector(radial,reach).addScaledVector(axis,reach*.30);
     const along=.18+.82*rand(key,11),start=root.clone().lerp(end,along);
     const leafPhi=rand(key,2)*Math.PI*2,spread=.06+.16*Math.sqrt(rand(key,3));
     pos.copy(start).addScaledVector(side,Math.cos(leafPhi)*spread).addScaledVector(across,Math.sin(leafPhi)*spread).addScaledVector(axis,(rand(key,4)-.5)*spread);
     direction.copy(radial).multiplyScalar(.35).addScaledVector(side,Math.cos(leafPhi)*.65).addScaledVector(across,Math.sin(leafPhi)*.65).addScaledVector(up,.2).normalize();
     if(i%40===0&&emit.recordShoots)this.shoot(root,end);
     // Branching sprays occupy volume; short petioles connect every blade
     // without long naked rays or forty leaves packed onto one straight line.
     emit(key,pos,direction,rand(key,5)*Math.PI*2,start);
    }
   }
   // Every exposed upper twig needs continuous foliage up to its endpoint.
   // Limiting this to lobes tagged 'top' left other upward-facing twigs with
   // a terminal rosette separated from the crown by a subpixel bare stem.
   for(let ai=0;ai<twigs.length;ai++){
    const a=twigs[ai],tree=trees[a.treeIndex];
    if(!a.top&&Math.max(a.root.y,a.mid.y,a.tip.y)<tree.y+(tree.treeHeight??14)*.72)continue;
    const count=a.top?(distant?160:220):Math.min(160,Math.ceil((a.root.distanceTo(a.mid)+a.mid.distanceTo(a.tip))/.05));
    orient(a.tip.x-a.root.x,a.tip.y-a.root.y,a.tip.z-a.root.z);
    for(let i=0;i<count;i++){
     const key=0x10000000+ai*2048+i,t=i/(count-1),phi=i*golden+rand(key,1)*1.5;
     radial.copy(side).multiplyScalar(Math.cos(phi)).addScaledVector(across,Math.sin(phi));
     const radius=.003*Math.sqrt(rand(key,2));
     if(t<.5)pos.copy(a.root).lerp(a.mid,t*2);
     else pos.copy(a.mid).lerp(a.tip,t*2-1);
     pos.addScaledVector(radial,radius);
     direction.copy(axis).multiplyScalar(.40).addScaledVector(radial,.60).addScaledVector(up,.18).normalize();
     emit(key,pos,direction,phi);
    }
   }
   // Living boughs carry overlapping leaf groups, with depth variation so
   // projecting one leaf across another cannot make coplanar z-fighting.
   for(let bi=0;bi<boughs.length;bi++)for(let part=0;part<2;part++){
    const a=boughs[bi][part],b=boughs[bi][part+1],length=a.distanceTo(b),steps=Math.ceil(length/.26);
    orient(b.x-a.x,b.y-a.y,b.z-a.z);
    for(let i=0;i<steps;i++){
     const shootKey=0x20000000+bi*8192+part*4096+i*24,phi=i*golden+rand(shootKey,1);
     radial.copy(side).multiplyScalar(Math.cos(phi)).addScaledVector(across,Math.sin(phi));
     const start=a.clone().lerp(b,(i+.5)/steps),reach=.22+rand(shootKey,2)*.38;
     const end=start.clone().addScaledVector(radial,reach).addScaledVector(axis,reach*.35);
     if(emit.recordShoots)this.shoot(start,end);
     for(let leaf=0;leaf<24;leaf++){
      const key=shootKey+leaf;
      pos.copy(start).lerp(end,(leaf+.5)/24);
      direction.copy(radial).multiplyScalar(.3).addScaledVector(side,Math.cos(leaf*golden)*.6).addScaledVector(across,Math.sin(leaf*golden)*.6).addScaledVector(up,.25).normalize();
      emit(key,pos,direction,phi+leaf*golden);
     }
    }
   }
  };
  const buckets=new Map(),tile=p=>Math.floor(p.x/8)*1024+Math.floor(p.z/8)+524800;
  const countLeaves=(key,p)=>{
   const id=tile(p);let bucket=buckets.get(id);
   if(!bucket){bucket={x:Math.floor(p.x/8),z:Math.floor(p.z/8),counts:[0,0,0,0],meshes:[],shadow:false};buckets.set(id,bucket);}
   bucket.counts[key&3]++;
   bucket.shadow ||= !distant&&Math.hypot(p.x,p.z-.8)<12;
  };
  countLeaves.recordShoots=true;generate(countLeaves);
  const connectedMaterial=material.clone(),oldCompile=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);
  const attachShader=shader=>{shader.vertexShader='attribute vec3 leafAnchor;\nattribute float leafRoot;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += leafAnchor * leafRoot;');};
  connectedMaterial.onBeforeCompile=function(shader,...args){oldCompile.call(this,shader,...args);attachShader(shader);};
  connectedMaterial.customProgramCacheKey=()=>oldKey()+':connected-leaf-roots-v1';
  const depth=!distant?foliageDepthMaterial(connectedMaterial,world):null;
  if(depth){const compile=depth.onBeforeCompile,key=depth.customProgramCacheKey.bind(depth);depth.onBeforeCompile=function(shader,...args){compile.call(this,shader,...args);attachShader(shader);};depth.customProgramCacheKey=()=>key()+':connected-leaf-roots-v1';}
  for(const bucket of buckets.values())for(let v=0;v<4;v++){
   if(!bucket.counts[v])continue;
   const geometry=geometries[v].clone();geometry.setAttribute('leafAnchor',new T.InstancedBufferAttribute(new Float32Array(bucket.counts[v]*3),3));
   const mesh=new T.InstancedMesh(geometry,connectedMaterial,bucket.counts[v]);
   mesh.name=`${distant?'Distant':'Mature'} dense tree leaves v${v+1}:${bucket.x},${bucket.z}`;
   mesh.castShadow=bucket.shadow;mesh.receiveShadow=true;
   if(mesh.castShadow)mesh.customDepthMaterial=depth;
   bucket.meshes[v]={mesh,index:0};
  }
  const object=new T.Object3D(),roll=new T.Quaternion(),color=new T.Color();
  generate((key,p,dir,angle,anchor)=>{
   const entry=buckets.get(tile(p)).meshes[key&3],size=(distant?.105:.088)+rand(key,6)*(distant?.05:.064);
   object.position.copy(p);object.quaternion.setFromUnitVectors(up,dir);roll.setFromAxisAngle(dir,angle);object.quaternion.premultiply(roll);
   object.scale.set(size*(1.10+rand(key,7)*.12),size,size);object.updateMatrix();
   const tint=(distant?.65:.68)+rand(key,8)*.08;
   color.setRGB(tint,tint*(.92+rand(key,9)*.055),tint*(.70+rand(key,10)*.075));
   if(anchor){const local=anchor.clone().sub(p).applyQuaternion(object.quaternion.clone().invert()).divide(object.scale);entry.mesh.geometry.attributes.leafAnchor.setXYZ(entry.index,local.x,local.y,local.z);}
   entry.mesh.setMatrixAt(entry.index,object.matrix);entry.mesh.setColorAt(entry.index++,color);
  });
  if(this.shoots.length){
   // Open ends sit inside the parent twig/blade. Spatial batches avoid
   // transforming every supporting shoot in the forest for every view.
   const geometry=new T.CylinderGeometry(.0025,.005,1,3,1,true),stemMaterial=new T.MeshStandardMaterial({color:0x494d28,roughness:.96});
   const stemBuckets=new Map(),stemKey=a=>Math.floor(a.x/12)*1024+Math.floor(a.z/12)+524800;
   for(const [a] of this.shoots){const key=stemKey(a),bucket=stemBuckets.get(key)??{count:0,index:0};bucket.count++;stemBuckets.set(key,bucket);}
   for(const [key,bucket] of stemBuckets){bucket.mesh=new T.InstancedMesh(geometry,stemMaterial,bucket.count);bucket.mesh.name=`${distant?'Distant':'Mature'} attached leaf shoots:${key}`;}
   for(const [a,b,radius] of this.shoots){
    const bucket=stemBuckets.get(stemKey(a));object.position.copy(a).lerp(b,.5);direction.subVectors(b,a);object.quaternion.setFromUnitVectors(up,direction.clone().normalize());object.scale.set(radius/.005,direction.length(),radius/.005);object.updateMatrix();bucket.mesh.setMatrixAt(bucket.index++,object.matrix);
   }
   for(const {mesh} of stemBuckets.values()){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();world.scene.add(mesh);}
  }
  let leaves=0;
  for(const bucket of buckets.values())for(const entry of bucket.meshes)if(entry){
   const mesh=entry.mesh;leaves+=mesh.count;
   mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.boundingBox.expandByScalar(.30);mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.30;world.scene.add(mesh);
  }
  world.environmentCounts??={};world.environmentCounts[distant?'Added distant tree leaves':'Added mature tree leaves']=leaves;
 }
}
