"""
Rebuild shrub_03 into a full, dense, multi-tiered understory shrub.
Eliminates hollow internal spaces and sparse see-through vegetation by nesting
cross-rotated paired-leaf foliage layers and an elevated central core cushion.
Optimized to ~32k polygons full / ~5.5k LOD for high performance.
"""
import bpy
import os
import math
import random

assets_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "game", "public", "assets"))
shrub_03_dir = os.path.join(assets_dir, "shrub_03")
gltf_src = os.path.join(shrub_03_dir, "shrub_03.gltf")
gltf_base = os.path.join(shrub_03_dir, "shrub_03_base.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=gltf_base)

source_objs = {}
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        source_objs[o.name] = o

print("Loaded source objects:", list(source_objs.keys()))

variant_configs = [
    {
        "name": "shrub_03_a",
        "seed": 421,
        "companion_1": "shrub_03_b",
        "companion_2": "shrub_03_d",
        "rot_1": 1.57,
        "rot_2": 3.14,
        "scale_1": 0.88,
        "scale_2": 0.74,
    },
    {
        "name": "shrub_03_b",
        "seed": 842,
        "companion_1": "shrub_03_c",
        "companion_2": "shrub_03_a",
        "rot_1": 1.40,
        "rot_2": 3.30,
        "scale_1": 0.86,
        "scale_2": 0.72,
    },
    {
        "name": "shrub_03_c",
        "seed": 1337,
        "companion_1": "shrub_03_d",
        "companion_2": "shrub_03_a",
        "rot_1": 1.65,
        "rot_2": 3.00,
        "scale_1": 0.90,
        "scale_2": 0.75,
    },
    {
        "name": "shrub_03_d",
        "seed": 2049,
        "companion_1": "shrub_03_a",
        "companion_2": "shrub_03_b",
        "rot_1": 1.50,
        "rot_2": 3.25,
        "scale_1": 0.87,
        "scale_2": 0.73,
    }
]

created_roots = []

for cfg in variant_configs:
    rng = random.Random(cfg["seed"])
    clump_objs = []
    
    primary_src = source_objs[cfg["name"]]
    
    # 1. Primary authored multi-stem bush
    main_obj = primary_src.copy()
    main_obj.data = primary_src.data.copy()
    bpy.context.scene.collection.objects.link(main_obj)
    main_obj.location = (0, 0, 0)
    main_obj.rotation_euler = (0, 0, 0)
    main_obj.scale = (1.0, 1.0, 1.0)
    clump_objs.append(main_obj)
    
    # 2. Cross-rotated companion bush: covers perimeter gaps and provides lateral leaf overlapping
    comp1_src = source_objs[cfg["companion_1"]]
    comp1_obj = comp1_src.copy()
    comp1_obj.data = comp1_src.data.copy()
    bpy.context.scene.collection.objects.link(comp1_obj)
    s1 = cfg["scale_1"] * rng.uniform(0.95, 1.05)
    rot1 = cfg["rot_1"] + rng.uniform(-0.15, 0.15)
    comp1_obj.location = (
        rng.uniform(-0.03, 0.03),
        rng.uniform(-0.03, 0.03),
        rng.uniform(-0.005, 0.01)
    )
    comp1_obj.rotation_euler = (
        rng.uniform(-0.04, 0.04),
        rng.uniform(-0.04, 0.04),
        rot1
    )
    comp1_obj.scale = (s1, s1, s1 * rng.uniform(0.95, 1.05))
    clump_objs.append(comp1_obj)
    
    # 3. Dense elevated core cushion: fills the central hollow bowl with dense broad paired leaves
    comp2_src = source_objs[cfg["companion_2"]]
    comp2_obj = comp2_src.copy()
    comp2_obj.data = comp2_src.data.copy()
    bpy.context.scene.collection.objects.link(comp2_obj)
    s2 = cfg["scale_2"] * rng.uniform(0.95, 1.05)
    rot2 = cfg["rot_2"] + rng.uniform(-0.2, 0.2)
    comp2_obj.location = (
        rng.uniform(-0.02, 0.02),
        rng.uniform(-0.02, 0.02),
        rng.uniform(0.02, 0.045) # elevated to canopy apex
    )
    comp2_obj.rotation_euler = (
        rng.uniform(-0.06, 0.06),
        rng.uniform(-0.06, 0.06),
        rot2
    )
    comp2_obj.scale = (s2, s2, s2 * 1.06)
    clump_objs.append(comp2_obj)
    
    # Join into single unified understory bush variant
    bpy.ops.object.select_all(action='DESELECT')
    for o in clump_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = clump_objs[0]
    bpy.ops.object.join()
    
    joined = bpy.context.view_layer.objects.active
    
    # Optimize full variant to ~32k polygons: preserves full leaf layers and occlusion with high framerate
    mod_full = joined.modifiers.new("FULL_OPT", "DECIMATE")
    mod_full.ratio = 0.42 # ~32k faces
    mod_full.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod_full.name)
    
    created_roots.append((joined, cfg["name"]))

# Remove original source objects
for o in source_objs.values():
    bpy.data.objects.remove(o, do_unlink=True)

# Clean up materials and ensure double sided
for joined, target_name in created_roots:
    joined.name = target_name
    print(f"Created {target_name}: {len(joined.data.vertices)} vertices, {len(joined.data.polygons)} faces, dim: {[round(v, 2) for v in joined.dimensions]}")
    for mat in joined.data.materials:
        if mat:
            mat.use_backface_culling = False

# Layout along X axis
for i, (joined, _) in enumerate(created_roots):
    joined.location = (i * 1.5, 0, 0)

# Export full shrub_03.gltf
bpy.ops.export_scene.gltf(
    filepath=gltf_src,
    export_format='GLTF_SEPARATE',
    use_selection=False
)
print("Successfully exported rebuilt shrub_03.gltf!")

# Build matching volume-preserving LOD model: shrub_03_lod.glb
lod_path = os.path.join(assets_dir, "shrub_03_lod.glb")
for joined, target_name in created_roots:
    bpy.context.view_layer.objects.active = joined
    joined.select_set(True)
    mod = joined.modifiers.new("LOD", "DECIMATE")
    mod.ratio = 0.17 # ~5.5k faces per variant - preserves understory leaf blanket and silhouettes
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"LOD {target_name}: {len(joined.data.vertices)} verts, {len(joined.data.polygons)} faces")
    joined.select_set(False)

bpy.ops.export_scene.gltf(
    filepath=lod_path,
    export_format='GLB',
    use_selection=False
)
print("Successfully exported rebuilt shrub_03_lod.glb!")
