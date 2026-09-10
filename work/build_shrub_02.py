"""
Rebuild shrub_02 into a dense, multi-tiered lance-leaf woodland sapling/shrub.
Eliminates internal hollow voids and skeletal see-through appearance by nesting
cross-rotated structural layers and an inner mid-height core of willow leaves.
Optimized to ~42k polygons full / ~6.5k LOD for high performance and framerate stability.
"""
import bpy
import os
import math
import random

assets_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "game", "public", "assets"))
shrub_02_dir = os.path.join(assets_dir, "shrub_02")
gltf_src = os.path.join(shrub_02_dir, "shrub_02.gltf")
gltf_base = os.path.join(shrub_02_dir, "shrub_02_base.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=gltf_base)

source_objs = {}
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        source_objs[o.name] = o

print("Loaded source objects:", list(source_objs.keys()))

variant_configs = [
    {
        "name": "shrub_02_a",
        "seed": 512,
        "companion_1": "shrub_02_b",
        "companion_2": "shrub_02_d",
        "rot_1": 1.45,
        "rot_2": 3.35,
        "scale_1": 0.88,
        "scale_2": 0.72,
    },
    {
        "name": "shrub_02_b",
        "seed": 1024,
        "companion_1": "shrub_02_c",
        "companion_2": "shrub_02_a",
        "rot_1": 1.60,
        "rot_2": 3.50,
        "scale_1": 0.86,
        "scale_2": 0.74,
    },
    {
        "name": "shrub_02_c",
        "seed": 2048,
        "companion_1": "shrub_02_a",
        "companion_2": "shrub_02_d",
        "rot_1": 1.35,
        "rot_2": 3.20,
        "scale_1": 0.85,
        "scale_2": 0.70,
    },
    {
        "name": "shrub_02_d",
        "seed": 4096,
        "companion_1": "shrub_02_b",
        "companion_2": "shrub_02_c",
        "rot_1": 1.50,
        "rot_2": 3.40,
        "scale_1": 0.88,
        "scale_2": 0.75,
    }
]

created_roots = []

for cfg in variant_configs:
    rng = random.Random(cfg["seed"])
    clump_objs = []
    
    primary_src = source_objs[cfg["name"]]
    
    # 1. Primary authored branch & foliage framework
    main_obj = primary_src.copy()
    main_obj.data = primary_src.data.copy()
    bpy.context.scene.collection.objects.link(main_obj)
    main_obj.location = (0, 0, 0)
    main_obj.rotation_euler = (0, 0, 0)
    main_obj.scale = (1.0, 1.0, 1.0)
    clump_objs.append(main_obj)
    
    # 2. Cross-rotated outer canopy boughs (closes radial gap between primary stems)
    comp1_src = source_objs[cfg["companion_1"]]
    comp1_obj = comp1_src.copy()
    comp1_obj.data = comp1_src.data.copy()
    bpy.context.scene.collection.objects.link(comp1_obj)
    s1 = cfg["scale_1"] * rng.uniform(0.96, 1.04)
    rot1 = cfg["rot_1"] + rng.uniform(-0.15, 0.15)
    comp1_obj.location = (
        rng.uniform(-0.06, 0.06),
        rng.uniform(-0.06, 0.06),
        rng.uniform(0.01, 0.03)
    )
    comp1_obj.rotation_euler = (
        rng.uniform(-0.05, 0.05),
        rng.uniform(-0.05, 0.05),
        rot1
    )
    comp1_obj.scale = (s1, s1, s1 * rng.uniform(0.95, 1.05))
    clump_objs.append(comp1_obj)
    
    # 3. Dense inner core infill (fills hollow internal cavity at mid-height)
    comp2_src = source_objs[cfg["companion_2"]]
    comp2_obj = comp2_src.copy()
    comp2_obj.data = comp2_src.data.copy()
    bpy.context.scene.collection.objects.link(comp2_obj)
    s2 = cfg["scale_2"] * rng.uniform(0.94, 1.05)
    rot2 = cfg["rot_2"] + rng.uniform(-0.2, 0.2)
    comp2_obj.location = (
        rng.uniform(-0.04, 0.04),
        rng.uniform(-0.04, 0.04),
        rng.uniform(0.03, 0.07)
    )
    comp2_obj.rotation_euler = (
        rng.uniform(-0.08, 0.08),
        rng.uniform(-0.08, 0.08),
        rot2
    )
    comp2_obj.scale = (s2, s2, s2 * 1.08)
    clump_objs.append(comp2_obj)
    
    # Join into single unified shrub variant
    bpy.ops.object.select_all(action='DESELECT')
    for o in clump_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = clump_objs[0]
    bpy.ops.object.join()
    
    joined = bpy.context.view_layer.objects.active
    
    # Optimize full variant to ~42k polygons: preserves full leaf layers and occlusion with high framerate
    mod_full = joined.modifiers.new("FULL_OPT", "DECIMATE")
    mod_full.ratio = 0.42 # ~40k-45k faces
    mod_full.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod_full.name)
    
    created_roots.append((joined, cfg["name"]))

# Remove original source objects
for o in source_objs.values():
    bpy.data.objects.remove(o, do_unlink=True)

# Rename created meshes to exact variant names
for joined, target_name in created_roots:
    joined.name = target_name
    print(f"Created {target_name}: {len(joined.data.vertices)} vertices, {len(joined.data.polygons)} faces, dim: {[round(v, 2) for v in joined.dimensions]}")
    for mat in joined.data.materials:
        if mat:
            mat.use_backface_culling = False

# Layout along X axis
for i, (joined, _) in enumerate(created_roots):
    joined.location = (i * 2.5, 0, 0)

# Export full shrub_02.gltf
bpy.ops.export_scene.gltf(
    filepath=gltf_src,
    export_format='GLTF_SEPARATE',
    use_selection=False
)
print("Successfully exported rebuilt shrub_02.gltf!")

# Build matching volume-preserving LOD model: shrub_02_lod.glb
lod_path = os.path.join(assets_dir, "shrub_02_lod.glb")
for joined, target_name in created_roots:
    bpy.context.view_layer.objects.active = joined
    joined.select_set(True)
    mod = joined.modifiers.new("LOD", "DECIMATE")
    mod.ratio = 0.16 # ~6.5k-7.2k faces per variant - 3x denser than original LOD, preserves leaf screen opacity
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"LOD {target_name}: {len(joined.data.vertices)} verts, {len(joined.data.polygons)} faces")
    joined.select_set(False)

bpy.ops.export_scene.gltf(
    filepath=lod_path,
    export_format='GLB',
    use_selection=False
)
print("Successfully exported rebuilt shrub_02_lod.glb!")
