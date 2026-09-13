# ============================================================================
# WARNING — OBSOLETE / SUPERSEDED AT RUNTIME (GH-43 ARCHITECTURAL AUDIT)
# ============================================================================
# This script exports 'work/game/public/assets/pipe.glb'.
# NOTE: In the live game, 'pipe.glb' is COMPLETELY SUPERSEDED.
# The true runtime source-of-truth for the pipe (slim chillum borosilicate glass,
# custom edge Fresnel shader, 28mm cap aperture grommet, and progressive
# dynamic 2D canvas resin accumulation) is generated procedurally in:
#   work/game/src/props.js -> rebuildPipe()
#
# Do NOT modify this file expecting in-game visual changes to the pipe.
# Edit work/game/src/props.js instead.
# ============================================================================

import bpy
import math
import os

# Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)

root = os.path.dirname(os.path.abspath(__file__))
export_path = os.path.join(root, 'game', 'public', 'assets', 'pipe.glb')

def material(name, color, rough=0.08, transmission=0.0, ior=1.47, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1.0)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if 'Transmission Weight' in p.inputs:
        p.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in p.inputs:
        p.inputs['Transmission'].default_value = transmission
    if 'IOR' in p.inputs:
        p.inputs['IOR'].default_value = ior
    return m

glass_mat = material('Borosilicate Glass', (0.95, 0.99, 0.97), rough=0.05, transmission=0.98, ior=1.474)
rubber_mat = material('Rubber Grommet', (0.05, 0.06, 0.06), rough=0.55, transmission=0.0)

# Build Chillum Pipe via Lathe
profile = [
    (0.0048, -0.018),   # bottom outer rim
    (0.0052, -0.017),   # rounded bottom edge
    (0.0052,  0.052),   # straight downstem OD 10.4mm
    (0.0056,  0.058),   # transition to bowl
    (0.0072,  0.070),   # flared bowl shoulder
    (0.0073,  0.076),   # top bowl outer rim OD 14.6mm
    (0.0068,  0.0775),  # fire-polished rounded top lip apex
    (0.0053,  0.076),   # inner top lip ID 10.6mm
    (0.0045,  0.068),   # inner bowl conical taper
    (0.0032,  0.061),   # constriction pinch entry
    (0.0016,  0.058),   # narrow constriction hole (3.2mm ID)
    (0.0036,  0.052),   # downstem inner bore expansion
    (0.0036, -0.016),   # downstem inner bore
    (0.0042, -0.018),   # bottom inner rim
]

steps = 64
verts = []
faces = []
n_prof = len(profile)

for r, z in profile:
    for i in range(steps):
        a = i / steps * 2 * math.pi
        verts.append((r * math.cos(a), r * math.sin(a), z))

for j in range(n_prof - 1):
    for i in range(steps):
        v1 = j * steps + i
        v2 = j * steps + (i + 1) % steps
        v3 = (j + 1) * steps + (i + 1) % steps
        v4 = (j + 1) * steps + i
        faces.append((v1, v2, v3, v4))

mesh = bpy.data.meshes.new('PipeGlass')
mesh.from_pydata(verts, [], faces)
mesh.update()

obj = bpy.data.objects.new('PipeGlass', mesh)
bpy.context.collection.objects.link(obj)
obj.data.materials.append(glass_mat)

# UV unwrap cylindrical
uv_layer = mesh.uv_layers.new(name='UVMap')
for poly in mesh.polygons:
    poly.use_smooth = True
    for li in poly.loop_indices:
        vi = mesh.loops[li].vertex_index
        j = vi // steps
        i = vi % steps
        uv_layer.data[li].uv = (i / steps, j / (n_prof - 1))

# Rubber Grommet / Seal Collar (seated around the stem at z = 0.023)
grommet_profile = [
    (0.0051, 0.018),
    (0.0068, 0.019),
    (0.0076, 0.023),
    (0.0068, 0.027),
    (0.0051, 0.028),
]
g_verts = []
g_faces = []
n_g = len(grommet_profile)
for r, z in grommet_profile:
    for i in range(steps):
        a = i / steps * 2 * math.pi
        g_verts.append((r * math.cos(a), r * math.sin(a), z))

for j in range(n_g - 1):
    for i in range(steps):
        v1 = j * steps + i
        v2 = j * steps + (i + 1) % steps
        v3 = (j + 1) * steps + (i + 1) % steps
        v4 = (j + 1) * steps + i
        g_faces.append((v1, v2, v3, v4))

g_mesh = bpy.data.meshes.new('RubberGrommet')
g_mesh.from_pydata(g_verts, [], g_faces)
g_mesh.update()
g_obj = bpy.data.objects.new('RubberGrommet', g_mesh)
bpy.context.collection.objects.link(g_obj)
g_obj.data.materials.append(rubber_mat)
for poly in g_mesh.polygons:
    poly.use_smooth = True

# Select both and export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True)
print(f"EXPORTED PIPE GLB SUCCESSFULLY TO: {export_path}")
