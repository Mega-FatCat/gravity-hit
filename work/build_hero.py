# ============================================================================
# NOTE — HYBRID ASSET / PARTIAL RUNTIME USE (GH-43 ARCHITECTURAL AUDIT)
# ============================================================================
# This script exports 'work/game/public/assets/clipper.glb'.
# NOTE: In the live game, only the LOWER CHASSIS meshes are retained:
#   ['Body', 'Base mould seam', 'Refill valve', 'Refill valve recess', 'Upper collar']
#
# The upper mechanism (striker wheel, wheel teeth, wheel axle, flint stanchion,
# steel windscreen guard, burner nozzle, gas lever) and the graphic wrap are
# STRIPPED OUT and procedurally constructed at higher fidelity in:
#   work/game/src/props.js -> correctLighter()
#
# If you want to modify lighter ergonomics, windscreen, striker wheel, or wrap,
# edit work/game/src/props.js.
# ============================================================================

import bpy, math, os
from mathutils import Vector
root=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
def material(name,color,rough=.3,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
black=material('Satin black polymer',(.012,.016,.013),.31)
steel=material('Brushed stainless guard',(.52,.56,.58),.24,1)
darksteel=material('Knurled flint wheel',(.14,.16,.17),.58,.85)
brass=material('Burner brass',(.35,.23,.08),.32,.9)
label=material('Printed graphic',(.02,.02,.02),.4)
def finish(obj,name,mat,bevel=0):
 obj.name=name;obj.data.materials.append(mat)
 if bevel:
  b=obj.modifiers.new('Moulded edge radii','BEVEL');b.width=bevel;b.segments=3;bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=b.name)
 for p in obj.data.polygons:p.use_smooth=True
 return obj
def cyl(name,r,depth,loc,mat,vertices=64):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);return finish(bpy.context.object,name,mat,.00025)
def cube(name,scale,loc,mat,bevel=.0005):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,mat,bevel)
def lathe(name,profile,mat,n=96):
 verts=[];faces=[]
 for r,z in profile:
  for i in range(n):a=i/n*2*math.pi;verts.append((r*math.sin(a),r*math.cos(a),z))
 for j in range(len(profile)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a+n,b+n,b,a))
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);finish(o,name,mat)
 uv=m.uv_layers.new()
 for poly in m.polygons:
  for li in poly.loop_indices:
   vi=m.loops[li].vertex_index;j=vi//n;i=vi%n;uv.data[li].uv=(i/n,j/(len(profile)-1))
 return o
lathe('Body',[(0,0),(.0068,0),(.0078,.001),(.008,.004),(.0081,.058),(.0078,.062),(.0068,.063),(0,.063)],black)
lathe('Label',[(.00812,.004),(.00818,.058)],label)
cyl('Base mould seam',.0079,.0007,(0,0,.003),black)
cyl('Refill valve recess',.0021,.0005,(0,0,.0001),darksteel)
cyl('Refill valve',.0011,.0006,(0,0,-.0001),brass)
cyl('Upper collar',.0081,.003,(0,0,.062),black)
# Bent steel shield with a physical inner face and rounded open edge.
verts=[];faces=[];steps=64
for z,r in [(.064,.0081),(.074,.0078),(.074,.0073),(.064,.0076)]:
 for i in range(steps+1):a=math.radians(30+i/steps*235);verts.append((r*math.sin(a),r*math.cos(a),z))
for j in range(3):
 for i in range(steps):a=j*(steps+1)+i;faces.append((a,a+1,a+steps+2,a+steps+1))
for i in [0,steps]:faces.append((i,i+steps+1,i+2*(steps+1),i+3*(steps+1)))
m=bpy.data.meshes.new('Shield');m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new('Steel shield',m);bpy.context.collection.objects.link(o);finish(o,'Steel shield',steel,.00015)
cube('Gas lever',(.007,.006,.0035),(.003,-.002,.066),black,.0007)
cyl('Flint tube',.0025,.014,(-.003,-.003,.068),black)
wheel=cyl('Striker wheel',.0035,.0048,(-.003,-.003,.076),darksteel,64);wheel.rotation_euler.x=math.pi/2
for i in range(32):
 a=i/32*math.pi*2;o=cube('Wheel tooth',(.00042,.005,.00065),(-.003+math.sin(a)*.0035,-.003,.076+math.cos(a)*.0035),steel,.00009);o.rotation_euler.y=a
for side in [-1,1]:
 o=cyl('Wheel axle',.001,.0009,(-.003,-.003+side*.0028,.076),steel,24);o.rotation_euler.x=math.pi/2
lathe('Burner nozzle',[(.0016,.066),(.0016,.070),(.0011,.071),(.00075,.071),(.00075,.066)],brass,48).location=(.003,.002,0)
for side in [-1,1]:cube('Head ventilation slot',(.0003,.002,.0007),(side*.0079,.001,.068),black,.0001)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'game','public','assets','clipper.glb'),export_format='GLB',use_selection=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'clipper.blend'))
print('DETAILED CLIPPER COMPLETE')
