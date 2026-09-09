"""Build a moderate-distance fir asset; retain originals for close-up inspection."""
import bpy
import os

root = os.path.dirname(os.path.abspath(__file__))
assets = os.path.join(root, "game", "public", "assets")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(assets, "fir_sapling", "fir_sapling.gltf"))
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("Woodland mid-distance LOD", "DECIMATE")
    modifier.ratio = 0.075
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print(obj.name, len(obj.data.polygons), "faces", flush=True)
    obj.select_set(False)
bpy.ops.export_scene.gltf(filepath=os.path.join(assets, "fir_sapling_lod.glb"), export_format="GLB")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(assets, "pine.glb"))
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("Distant pine canopy", "DECIMATE")
    modifier.ratio = 0.28
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    print(obj.name, len(obj.data.polygons), "faces", flush=True)
    obj.select_set(False)
bpy.ops.export_scene.gltf(filepath=os.path.join(assets, "pine_distant.glb"), export_format="GLB")
