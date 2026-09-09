"""Keep the leafy grass clumps instead of selecting only sparse stalk meshes."""
import bpy
import os

assets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "game", "public", "assets")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(assets, "grass_medium_01", "grass_medium_01.gltf"))
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        continue
    triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if triangles > 1800:
        bpy.context.view_layer.objects.active = obj
        mod = obj.modifiers.new("Leafy clump LOD", "DECIMATE")
        mod.ratio = 1800 / triangles
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    print(obj.name, sum(len(p.vertices) - 2 for p in obj.data.polygons), flush=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(assets, "grass_clumps_lod.glb"), export_format="GLB")
