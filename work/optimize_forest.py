import bpy, os, math
root=os.path.dirname(os.path.abspath(__file__))
src=os.path.join(root,'raw','pine_tree_01','pine_tree_01.gltf')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
trees=[o for o in bpy.context.scene.objects if o.type=='MESH']
keep=min(trees,key=lambda o:len(o.data.vertices))
for o in trees:
    if o!=keep:bpy.data.objects.remove(o,do_unlink=True)
keep.location=(0,0,0)
bpy.context.view_layer.objects.active=keep
keep.select_set(True)
print('SOURCE VERTICES',len(keep.data.vertices),flush=True)
mod=keep.modifiers.new('Realtime LOD','DECIMATE');mod.ratio=.012
bpy.ops.object.modifier_apply(modifier=mod.name)
print('OPTIMIZED VERTICES',len(keep.data.vertices),flush=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'game','public','assets','pine.glb'),export_format='GLB',use_selection=True)
print('DONE',flush=True)
