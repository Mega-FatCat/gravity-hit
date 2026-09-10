"""
Rebuild shrub_04 into a dense, full, rounded 3D woody heath shrub with rich overlapping foliage.
Fills all 360 degrees of perimeter and provides an elevated upper dome to serve as authentic
screening thickets and dense woodland bushes.
Optimized to ~32k polygons full / ~5.5k LOD for high performance.
"""
import bpy
import os
import math
import random

assets_dir = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "game", "public", "assets"))
shrub_04_dir = os.path.join(assets_dir, "shrub_04")
gltf_src = os.path.join(shrub_04_dir, "shrub_04.gltf")
gltf_base = os.path.join(shrub_04_dir, "shrub_04_base.gltf")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=gltf_base)

source_objs = {}
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        source_objs[o.name] = o

print("Loaded source shrub_04 objects:", list(source_objs.keys()))

variant_configs = [
    {
        "name": "shrub_04_a",
        "seed": 777,
        "src_key": "shrub_04_a",
        "rot_2": 3.14,
        "rot_3": 1.10,
        "scale_2": 0.88,
        "scale_3": 0.76,
    },
    {
        "name": "shrub_04_b",
        "seed": 888,
        "src_key": "shrub_04_b",
        "rot_2": 3.40,
        "rot_3": 1.35,
        "scale_2": 0.85,
        "scale_3": 0.74,
    },
    {
        "name": "shrub_04_c",
        "seed": 999,
        "src_key": "shrub_04_c",
        "rot_2": 2.90,
        "rot_3": 0.90,
        "scale_2": 0.86,
        "scale_3": 0.78,
    }
]

created_roots = []

for cfg in variant_configs:
    rng = random.Random(cfg["seed"])
    clump_objs = []
    
    src = source_objs[cfg["src_key"]]
    
    # 1. Base framework (primary spread)
    o1 = src.copy()
    o1.data = src.data.copy()
    bpy.context.scene.collection.objects.link(o1)
    o1.location = (0, 0, 0)
    o1.rotation_euler = (0, 0, 0)
    o1.scale = (1.0, 1.0, 1.0)
    clump_objs.append(o1)
    
    # 2. Opposite hemisphere boughs (fills the empty 180°-360° sector)
    o2 = src.copy()
    o2.data = src.data.copy()
    bpy.context.scene.collection.objects.link(o2)
    s2 = cfg["scale_2"] * rng.uniform(0.95, 1.05)
    rot2 = cfg["rot_2"] + rng.uniform(-0.15, 0.15)
    o2.location = (
        rng.uniform(-0.02, 0.02),
        rng.uniform(-0.02, 0.02),
        rng.uniform(-0.005, 0.005)
    )
    o2.rotation_euler = (
        rng.uniform(-0.04, 0.04),
        rng.uniform(-0.04, 0.04),
        rot2
    )
    o2.scale = (s2, s2, s2 * rng.uniform(0.95, 1.05))
    clump_objs.append(o2)
    
    # 3. Elevated upper dome crown (fills vertical volume for screening height)
    o3 = src.copy()
    o3.data = src.data.copy()
    bpy.context.scene.collection.objects.link(o3)
    s3 = cfg["scale_3"] * rng.uniform(0.95, 1.05)
    rot3 = cfg["rot_3"] + rng.uniform(-0.15, 0.15)
    tilt = rng.uniform(0.12, 0.22)
    o3.location = (
        rng.uniform(-0.015, 0.015),
        rng.uniform(-0.015, 0.015),
        rng.uniform(0.025, 0.05)
    )
    o3.rotation_euler = (
        math.sin(rot3) * tilt,
        -math.cos(rot3) * tilt,
        rot3
    )
    o3.scale = (s3, s3, s3 * 1.12)
    clump_objs.append(o3)
    
    # Join into single unified bush mesh
    bpy.ops.object.select_all(action='DESELECT')
    for o in clump_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = clump_objs[0]
    bpy.ops.object.join()
    
    joined = bpy.context.view_layer.objects.active
    
    # Optimize full variant to ~34k polygons: preserves 360-degree screening and rich leaf mass
    mod_pre = joined.modifiers.new("PRE", "DECIMATE")
    mod_pre.ratio = 0.15 # ~34k faces
    mod_pre.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod_pre.name)
    
    created_roots.append((joined, cfg["name"]))

# Remove original source objects
for o in source_objs.values():
    bpy.data.objects.remove(o, do_unlink=True)

# Rename to target names
for joined, target_name in created_roots:
    joined.name = target_name
    print(f"Created {target_name}: {len(joined.data.vertices)} vertices, {len(joined.data.polygons)} faces, dim: {[round(v, 2) for v in joined.dimensions]}")
    for mat in joined.data.materials:
        if mat:
            mat.use_backface_culling = False

# Layout along X axis
for i, (joined, _) in enumerate(created_roots):
    joined.location = (i * 1.5, 0, 0)

# Export full shrub_04.gltf
bpy.ops.export_scene.gltf(
    filepath=gltf_src,
    export_format='GLTF_SEPARATE',
    use_selection=False
)
print("Successfully exported rebuilt shrub_04.gltf!")

# Build matching volume-preserving LOD: shrub_04_lod.glb
lod_path = os.path.join(assets_dir, "shrub_04_lod.glb")
for joined, target_name in created_roots:
    bpy.context.view_layer.objects.active = joined
    joined.select_set(True)
    mod = joined.modifiers.new("LOD", "DECIMATE")
    mod.ratio = 0.17 # ~5.8k faces per variant - retains rich screening volume
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"LOD {target_name}: {len(joined.data.vertices)} verts, {len(joined.data.polygons)} faces")
    joined.select_set(False)

bpy.ops.export_scene.gltf(
    filepath=lod_path,
    export_format='GLB',
    use_selection=False
)
print("Successfully exported rebuilt shrub_04_lod.glb!")
