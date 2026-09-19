"""Gravity Hit asset candidates. Blender 4.5+, NEW background process.
Run: blender --background --python generate_gravity_props.py -- --out ./out
All lengths metres. Engine (x,y,z) -> Blender (x,-z,y).
Not a finished PBR asset pack: follow the accompanying bake/integration plan.
"""
import math, json, random, argparse, sys
from pathlib import Path

OUTER=[(.0005,.007),(.0025,.0068),(.006,.0055),(.011,.0042),(.017,.0022),
 (.022,.0008),(.0255,.0002),(.0285,.0022),(.0308,.0075),(.032,.0155),
 (.0324,.0235),(.0326,.032),(.0326,.0365),(.0312,.0385),(.0298,.0405),
 (.0314,.0425),(.0326,.0445),(.0312,.0465),(.0298,.0485),(.0314,.0505),
 (.0326,.0525),(.0312,.0545),(.030,.0565),(.0326,.059),(.03205,.0605),
 (.032,.075),(.03185,.0895),(.032,.104),(.03205,.1185),(.0326,.1205),
 (.0312,.1225),(.0297,.1245),(.0313,.1265),(.0326,.1285),(.0312,.1305),
 (.0296,.1325),(.0313,.1345),(.0326,.1365),(.0312,.1385),(.0297,.1405),
 (.0313,.1425),(.0325,.1445),(.0314,.1465),(.0302,.1485),(.0324,.151),
 (.0315,.155),(.0295,.159),(.0308,.161),(.0296,.166),(.027,.171),
 (.0284,.173),(.0262,.179),(.0232,.186),(.0196,.193),(.0158,.200),
 (.0135,.205),(.0134,.2068),(.0168,.2075),(.0168,.209),(.0134,.2096),
 (.0134,.2105),(.0145,.2115),(.0133,.2125),(.0132,.214),(.0132,.222),
 (.0131,.2245),(.0128,.226)]
PIPE=[(.00345,-.049),(.00388,-.0487),(.00405,-.0478),(.00405,-.0462),
 (.00366,-.0448),(.00334,-.0427),(.00265,-.038),(.00334,-.034),(.00335,-.010),
 (.00336,.015),(.00340,.022),(.00356,.025),(.00390,.028),(.00435,.032),
 (.00485,.036),(.00525,.040),(.00545,.043),(.00546,.045),(.00530,.0465),
 (.00505,.0475),(.00466,.047),(.00435,.0457),(.00405,.0435),(.00365,.040),
 (.00320,.036),(.00295,.032),(.00275,.029),(.00275,.024),(.00272,.017),
 (.00272,-.010),(.00272,-.033),(.00195,-.038),(.00274,-.043),(.003,-.049)]

def eng(p):return (p[0],p[2],-p[1])
def blend(p):return (p[0],-p[2],p[1])
def clamp(x,a=0.,b=1.):return max(a,min(b,x))
def smooth(a,b,x):
 t=clamp((x-a)/(b-a));return t*t*(3-2*t)
def distort(r,y,a):
 if r<.004:return r,y
 foot=max(0,1-y/.024);petal=math.cos(a*5);dr=petal*.002*foot
 if y<.020:y+=max(0,-petal)*.006*foot
 dr+=abs(math.sin(a))**60*.00028*(y<.206)
 if .155<=y<=.198:
  dr+=(.5+.5*math.cos(a*8))**2.5*.00042*math.sin((y-.155)/.043*math.pi)
 for angle,cy,sy,sa,depth in [(.8,.105,.025,.55,.00085),(-2.15,.138,.022,.60,.00065)]:
  da=math.atan2(math.sin(a-angle),math.cos(a-angle))
  dr-=depth*math.exp(-((y-cy)/sy)**2-(da/sa)**2)
 return max(.00001,r+dr),y

def main():
 import bpy,bmesh
 from mathutils import Vector
 from mathutils.bvhtree import BVHTree
 argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 ap=argparse.ArgumentParser();ap.add_argument('--out',required=True)
 ap.add_argument('--pipe-length-mm',type=float,default=80.)
 ap.add_argument('--samples',type=int,default=8192)
 args=ap.parse_args(argv);out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
 if bpy.app.version<(4,5,0):raise RuntimeError('Blender 4.5+ required; verify exporter API')
 if not 70<=args.pipe_length_mm<=100:raise ValueError('Unsupported art preset')
 if args.samples<1024:raise ValueError('At least 1024 samples required')
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 report={};roots={}
 def material(name,color,rough,trans=0,ior=1.5):
  m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
  p.inputs['Base Color'].default_value=(*color,1.0)
  p.inputs['Roughness'].default_value=rough
  p.inputs['Metallic'].default_value=0.0
  if 'Transmission Weight' in p.inputs:
   p.inputs['Transmission Weight'].default_value=trans
  elif 'Transmission' in p.inputs:
   p.inputs['Transmission'].default_value=trans
  if 'IOR' in p.inputs:
   p.inputs['IOR'].default_value=ior
  return m
 glass=material('Glass_Clean',(.975,.99,.98),.04,1,1.474)
 pet=material('PET_Clear',(.985,.995,.99),.09,1,1.57)
 capmat=material('Cap_Green',(.018,.08,.037),.38)
 filmat=material('LDPE_Film',(.985,.99,.985),.23,1,1.46)
 residue=material('Residue_Amber_Placeholder',(.18,.065,.014),.40)
 green=[material('Bud_Olive_'+str(i),(.065+i*.015,.10+i*.016,.022+i*.006),.84) for i in range(4)]
 hairmat=material('Stigma_Russet',(.29,.095,.024),.72)
 stemmat=material('Stem_Dry',(.24,.17,.07),.87)
 def root(name):
  o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);roots[name]=o;return o
 def mesh(name,verts,faces,mat,parent):
  me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
  ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=parent
  if mat:me.materials.append(mat)
  bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
  for f in me.polygons:f.use_smooth=True
  return ob
 def lathe(name,profile,mat,parent,n=96,closed=False,deform=False):
  vv=[];rings=[]
  for r,y in profile:
   ids=[]
   for i in range(1 if r==0 else n):
    a=i*math.tau/n;rr,yy=distort(r,y,a) if deform else (r,y)
    ids.append(len(vv));vv.append(blend((rr*math.cos(a),yy,rr*math.sin(a))))
   rings.append(ids)
  ff=[]
  for j in range(len(rings) if closed else len(rings)-1):
   aa,bb=rings[j],rings[(j+1)%len(rings)]
   for i in range(n):
    k=(i+1)%n
    if len(aa)==len(bb)==1:break
    if len(aa)==1:ff.append((aa[0],bb[k],bb[i]))
    elif len(bb)==1:ff.append((aa[i],aa[k],bb[0]))
    else:ff.append((aa[i],aa[k],bb[k],bb[i]))
  ob=mesh(name,vv,ff,mat,parent);uv=ob.data.uv_layers.new(name='UVMap')
  lo=min(p[1] for p in profile);span=max(p[1] for p in profile)-lo or 1
  for f in ob.data.polygons:
   us=[]
   for li in f.loop_indices:
    x,y,z=eng(ob.data.vertices[ob.data.loops[li].vertex_index].co)
    us.append((math.atan2(z,x)/math.tau)%1)
   wrap=max(us)-min(us)>.5
   for li,u in zip(f.loop_indices,us):
    p=eng(ob.data.vertices[ob.data.loops[li].vertex_index].co)
    uv.data[li].uv=(u+1 if wrap and u<.5 else u,(p[1]-lo)/span)
  return ob
 def anchor(name,p,parent):
  o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=blend(p)
  o.empty_display_size=.004;o['role']='anchor';return o
 def tube(name,points,r,mat,parent):
  c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2
  c.bevel_depth=r;c.bevel_resolution=2;c.use_fill_caps=True
  s=c.splines.new('POLY');s.points.add(len(points)-1)
  for p,q in zip(s.points,points):p.co=(*blend(q),1)
  o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=parent;c.materials.append(mat)
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.convert(target='MESH');return bpy.context.object
 def copyobj(ob,name):
  o=ob.copy();o.data=ob.data.copy();o.name=name;scene.collection.objects.link(o);return o
 def cut(ob,center,r,depth,axis=(1,0,0)):
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=depth,location=blend(center))
  cutter=bpy.context.object;cutter.rotation_mode='QUATERNION'
  cutter.rotation_quaternion=Vector((0,0,1)).rotation_difference(Vector(blend(axis)))
  mod=ob.modifiers.new('Authored_aperture','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.data.objects.remove(cutter,do_unlink=True)
 def manifold(ob):
  bm=bmesh.new();bm.from_mesh(ob.data);bad=sum(not e.is_manifold for e in bm.edges)
  volume=abs(bm.calc_volume(signed=True));bm.free()
  if bad:raise RuntimeError(f'{ob.name}: {bad} non-manifold edges')
  if not math.isfinite(volume) or volume<=0:raise RuntimeError(f'{ob.name}: invalid volume')
  return volume
 bottle=root('BottleRoot')
 inner=[(0,.0075)]+[((.0118 if y>.205 else max(.00001,r-.00035)),y+(.00035 if y<.012 else 0)) for r,y in OUTER[1:]]
 skin=[(0,.007)]+OUTER[1:]+list(reversed(inner))
 intact=lathe('BottleShell_Intact',skin,pet,bottle,deform=True)
 opened=copyobj(intact,'BottleShell_Open');cut(opened,(.0326,.032,0),.0025,.012)
 manifold(intact);manifold(opened)
 intact['state']='outlet_false';opened['state']='outlet_true'
 # Do not hide variants before export. Adapter sets initial visibility.
 labelmat=material('Label_Preserve_Runtime_Canvas',(.72,.77,.67),.25)
 label=lathe('BottleLabel',[(.03215,.060),(.03215,.1185)],labelmat,bottle)
 label['runtimeTexture']='props.js:bottleLabel; preserve STILLWATER and UV orientation'
 pts=[(.01348*math.sin(t*math.tau*2.2),.2135+t*.0095,.01348*math.cos(t*math.tau*2.2)) for t in [i/144 for i in range(145)]]
 tube('NeckThread',pts,.00045,pet,bottle)
 for name,p in [('BottleMouth',(0,.226,0)),('Outlet',(.0326,.032,0)),('Grip',(0,.095,0))]:anchor(name,p,bottle)
 pts=[]
 for i in range(65):
  a=i*math.tau/64;r=.0026*(1+.05*math.sin(3*a)+.035*math.cos(7*a))
  pts.append((.03265+.00012*math.sin(5*a),.032+r*math.sin(a),r*math.cos(a)))
 rim=tube('OutletRim',pts,.00027,pet,bottle);rim['state']='outlet_true'
 physics=root('PhysicsRoot');cavity=lathe('BottleCavity',inner+[(0,.226)],None,physics,deform=True)
 volume=manifold(cavity)
 def cap_profile(hole):
  return [(hole,.0055),(.0134,.0055),(.0152,.0042),(.01535,.003),(.01535,-.0105),(.0146,-.0112),(.0142,-.0135),(.0135,-.009),(.0135,.0035),(hole,.0035)]
 spare=root('SpareCapRoot');fullcap=lathe('Cap_Intact',cap_profile(0),capmat,spare,closed=True)
 pipe=root('PipeRoot');drilled=lathe('Cap_Drilled',cap_profile(.00370),capmat,pipe,closed=True)
 manifold(fullcap);manifold(drilled)
 for par in [spare,pipe]:
  for i in range(48):
   a=i*math.tau/48
   tube('CapGrip_'+par.name+'_'+str(i),[(.01538*math.cos(a),y,.01538*math.sin(a)) for y in [-.009,.002]],.00017,capmat,par)
 scale=args.pipe_length_mm/96.5
 glassob=lathe('PipeGlass',[(r,y*scale) for r,y in PIPE],glass,pipe,closed=True);manifold(glassob)
 res=lathe('PipeResidue',[(r-.00008,y*scale) for r,y in PIPE[20:]],residue,pipe,n=64)
 res['runtimeMask']='sim.residue; replace placeholder opaque material'
 for name,p in [('PipeTip',(0,-.049*scale,0)),('BowlTarget',(0,.045*scale,0)),('BudSeat',(0,.040*scale,0)),('CapSeat',(0,0,0))]:anchor(name,p,pipe)
 collar=lathe('CapCollar',[(.0034,.0045),(.0045,.0045),(.0045,.0065),(.0034,.0065)],capmat,pipe,closed=True)
 collar['state']='prep_positive'
 bag=root('BagRoot');nx=32;ny=40;vv=[];ff=[]
 for side in [-1,1]:
  for j in range(ny+1):
   v=j/ny;y=.132*v
   for i in range(nx+1):
    u=2*i/nx-1;x=.046*u
    envelope=max(0,math.sin(math.pi*v))**.7*max(0,1-u*u)
    z=side*(.00010+.0178*envelope)
    wrinkle=(math.sin(u*16+v*27)+.35*math.sin(u*41-v*19))*.00042*envelope
    vv.append(blend((x,y,z+side*wrinkle)))
 stride=(nx+1)*(ny+1)
 for side in range(2):
  off=side*stride
  for j in range(ny):
   for i in range(nx):
    a=off+j*(nx+1)+i;f=(a,a+1,a+nx+2,a+nx+1);ff.append(f if side else tuple(reversed(f)))
 for i in range(nx):ff.append((i,i+1,stride+i+1,stride+i))
 for j in range(ny):
  a=j*(nx+1);b=(j+1)*(nx+1);ff.append((a,b,stride+b,stride+a))
  a+=nx;b+=nx;ff.append((a,stride+a,stride+b,b))
 film=mesh('BagFilm',vv,ff,filmat,bag);film.shape_key_add(name='Basis')
 uv=film.data.uv_layers.new(name='UVMap')
 for f in film.data.polygons:
  for li in f.loop_indices:
   x,y,z=eng(film.data.vertices[film.data.loops[li].vertex_index].co)
   uv.data[li].uv=(x/.092+.5,y/.132)
 empty=film.shape_key_add(name='Empty');op=film.shape_key_add(name='Open')
 for i,v in enumerate(film.data.vertices):
  x,y,z=eng(v.co);empty.data[i].co=blend((x,y,z*.12));sign=-1 if i<stride else 1
  op.data[i].co=blend((x,y,z+sign*.008*smooth(.098,.129,y)*max(0,1-(x/.046)**2)))
 for side in [-1,1]:
  rail=tube('ZipRail_'+str(side),[(x,.1255,side*.0021) for x in [-.046+i*.092/32 for i in range(33)]],.00045,filmat,bag)
  rail.shape_key_add(name='Basis');k=rail.shape_key_add(name='Open')
  for i,v in enumerate(rail.data.vertices):
   x,y,z=eng(v.co);k.data[i].co=blend((x,y,z+side*.008*smooth(.098,.129,y)*max(0,1-(x/.046)**2)))
 anchor('BagMouth',(0,.129,0),bag);anchor('BagGrip',(-.038,.115,0),bag)
 def ellipsoid(p,sc,mat,parent,rng):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
  o=bpy.context.object;o.name='Bract';o.parent=parent
  for v in o.data.vertices:
   q=v.co;noise=1+rng.uniform(-.085,.085);q.x*=sc[0]*noise;q.y*=sc[2]*noise;q.z*=sc[1]*noise
  o.location=blend(p);o.data.materials.append(mat)
  for f in o.data.polygons:f.use_smooth=True
  return o
 budroots=[]
 for variant in range(9):
  rng=random.Random(420+variant*37);br=root('BudRoot_'+str(variant));parts=[]
  for i in range(38+variant%4*3):
   t=i/(37+variant%4*3);a=i*2.399963+rng.uniform(-.35,.35)
   radial=(.0006+.0018*math.sin(t*math.pi))*(1+.13*math.sin(variant+a*3))
   p=(math.cos(a)*radial,(t-.5)*.006,math.sin(a)*radial);rr=rng.uniform(.00065,.00105)
   o=ellipsoid(p,(rr,rr*rng.uniform(1.25,1.9),rr*.8),rng.choice(green),br,rng)
   o.rotation_euler=(rng.uniform(-.8,.8),rng.uniform(-.8,.8),a);parts.append(o)
  for i in range(10):
   a=rng.uniform(0,math.tau);y=rng.uniform(-.002,.002);r=.002
   base=(r*math.cos(a),y,r*math.sin(a));tip=((r+.0016)*math.cos(a),y+.0005,(r+.0016)*math.sin(a))
   tangent=(-math.sin(a)*.00045,0,math.cos(a)*.00045)
   pts=[base,tuple(base[k]+tangent[k] for k in range(3)),tip,tuple(base[k]-tangent[k] for k in range(3)),((r+.0008)*math.cos(a),y+.0004,(r+.0008)*math.sin(a))]
   parts.append(mesh('SmallLeaf',[blend(p) for p in pts],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],rng.choice(green),br))
  for i in range(18):
   a=rng.uniform(0,math.tau);y=rng.uniform(-.0015,.0025)
   pts=[((.002+t*.0008)*math.cos(a+t*.8),y+t*.0013,(.002+t*.0008)*math.sin(a+t*.8)) for t in [j/6 for j in range(7)]]
   parts.append(tube('Stigma',pts,.000045,hairmat,br))
  parts.append(tube('Stem',[(0,-.0035,0),(0,.001,0)],.00022,stemmat,br))
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();bud=bpy.context.object;bud.name='Bud_'+str(variant)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
  bud.shape_key_add(name='Basis');burn=bud.shape_key_add(name='Spent')
  for i,v in enumerate(bud.data.vertices):
   x,y,z=eng(v.co);burn.data[i].co=blend((x*.78,(y+.0035)*.62-.0035,z*.78))
  bud['needsPBRBake']=True;budroots.append(br)

 pcrng=random.Random(1337);pcroot=root('PackedChargeRoot');pcparts=[]
 for i in range(24):
  t=i/23;a=i*2.399963+pcrng.uniform(-.2,.2)
  radial=(.0003+.0015*math.sin(t*math.pi))
  p=(math.cos(a)*radial,(t-.5)*.003,math.sin(a)*radial);rr=pcrng.uniform(.00045,.00075)
  o=ellipsoid(p,(rr,rr*pcrng.uniform(1.1,1.5),rr*.75),pcrng.choice(green),pcroot,pcrng)
  o.rotation_euler=(pcrng.uniform(-.6,.6),pcrng.uniform(-.6,.6),a);pcparts.append(o)
 for i in range(8):
  a=pcrng.uniform(0,math.tau);y=pcrng.uniform(-.001,.001)
  pts=[((.001+t*.0005)*math.cos(a+t*.6),y+t*.0008,(.001+t*.0005)*math.sin(a+t*.6)) for t in [j/4 for j in range(5)]]
  pcparts.append(tube('PackedStigma',pts,.000035,hairmat,pcroot))
 bpy.ops.object.select_all(action='DESELECT')
 for o in pcparts:o.select_set(True)
 bpy.context.view_layer.objects.active=pcparts[0];bpy.ops.object.join();pcob=bpy.context.object;pcob.name='PackedCharge'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
 pcob.shape_key_add(name='Basis');pcburn=pcob.shape_key_add(name='Spent')
 for i,v in enumerate(pcob.data.vertices):
  x,y,z=eng(v.co);pcburn.data[i].co=blend((x*.65,(y+.0015)*.45-.0015,z*.65))

 cavity.data.calc_loop_triangles();verts=[eng(v.co) for v in cavity.data.vertices]
 triangles=[list(t.vertices) for t in cavity.data.loop_triangles]
 bvh=BVHTree.FromPolygons([Vector(v) for v in verts],triangles,all_triangles=True)
 def inside(p):
  ray=Vector((1,0,0));p=Vector(p);hits=0
  for _ in range(128):
   hit,normal,index,d=bvh.ray_cast(p,ray,1.)
   if hit is None:return hits%2==1
   hits+=1;p=hit+ray*1e-8
  raise RuntimeError('Cavity ray did not converge')
 rng=random.Random(881);samples=[];tries=0
 while len(samples)<args.samples:
  tries+=1
  if tries>args.samples*20:raise RuntimeError('Cavity sampling failed')
  p=(rng.uniform(-.035,.035),rng.uniform(0,.226),rng.uniform(-.035,.035))
  if inside(p):samples.append(p)
 manifest={'schema':1,'units':'m','engineAxes':'Y-up','blenderAxes':'Z-up',
  'pipeLengthMM':args.pipe_length_mm,'bottleMouth':[0,.226,0],
  'outlet':[.0326,.032,0],'outletDirection':[1,0,0],
  'pipeTip':[0,-.049*scale,0],'bowlTarget':[0,.045*scale,0],'budSeat':[0,.040*scale,0],
  'cavityVolumeM3':volume,'vertices':verts,'triangles':triangles,'samples':samples,
  'legacyWaterScale':.94,'legacyDrainThreshold':.072,
  'status':'CURRENT BUILD NEEDS MANUAL CHECK'}
 (out/'prop_contract.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf-8')
 def export_root(par,filename):
  bpy.ops.object.select_all(action='DESELECT');par.select_set(True)
  for o in par.children_recursive:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(out/filename),export_format='GLB',use_selection=True,
   export_yup=True,export_extras=True,export_animations=False,export_morph=True)
  for o in par.children_recursive:
   if o.type=='MESH':o.data.calc_loop_triangles()
  report[filename]={'objects':len(par.children_recursive),'triangles':sum(len(o.data.loop_triangles) for o in par.children_recursive if o.type=='MESH')}
 for par,name in [(bottle,'bottle_hero.glb'),(spare,'cap_spare.glb'),(pipe,'pipe_hero.glb'),(bag,'bag_hero.glb'),(physics,'bottle_cavity.glb'),(pcroot,'packed_charge.glb')]+[(r,'bud_'+str(i)+'.glb') for i,r in enumerate(budroots)]:export_root(par,name)
 opened.hide_render=True;rim.hide_render=True;cavity.hide_render=True;res.hide_render=True
 bpy.ops.wm.save_as_mainfile(filepath=str(out/'gravity_props.blend'))
 (out/'generation_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('Generated candidates successfully to:',out)

if __name__=='__main__':main()
