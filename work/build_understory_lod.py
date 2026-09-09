"""Static distance LODs: preserve the original close-range scans separately."""
import bpy
import os

assets = os.path.join(os.path.dirname(os.path.abspath(__file__)), "game", "public", "assets")
for source, target, budget in [
    ("fern_02/fern_02.gltf", "fern_02_lod.glb", 500),
    ("shrub_02/shrub_02.gltf", "shrub_02_lod.glb", 1100),
    ("shrub_03/shrub_03.gltf", "shrub_03_lod.glb", 420),
    ("shrub_04/shrub_04.gltf", "shrub_04_lod.glb", 500),
    ("grass_clumps_lod.glb", "grass_far_lod.glb", 200),
    ("rock_moss_set_01/rock_moss_set_01.gltf", "creek_rocks_lod.glb", 1000),
    ("dead_tree_trunk/dead_tree_trunk.gltf", "dead_tree_trunk_lod.glb", 2500),
    ("fir_sapling_lod.glb", "fir_far_lod.glb", 3500),
]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(assets, source))
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if triangles > budget:
            bpy.context.view_layer.objects.active = obj
            mod = obj.modifiers.new("Distant understory", "DECIMATE")
            mod.ratio = budget / triangles
            mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.export_scene.gltf(filepath=os.path.join(assets, target), export_format="GLB")
    print("BUILT", target, flush=True)
