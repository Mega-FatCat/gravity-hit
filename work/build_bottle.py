import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

root = os.path.dirname(os.path.abspath(__file__))
export_path = os.path.join(root, 'game', 'public', 'assets', 'bottle.glb')

def material(name, color, rough=0.18, transmission=0.92, ior=1.51, metal=0.0):
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

pet_mat = material('PET Plastic', (0.97, 0.99, 0.98), rough=0.15, transmission=0.94, ior=1.51)
label_mat = material('Bottle Label', (1.0, 1.0, 1.0), rough=0.32, transmission=0.0)
cap_mat = material('Green Plastic Cap', (0.16, 0.45, 0.22), rough=0.38, transmission=0.0)

# Build PET Bottle Body Profile
# 500ml standard water bottle profile:
# Base r=0.028 to 0.0325, height ~0.22m
profile = [
    # (radius, z)
    (0.000, 0.003),   # center push-up / sprue gate
    (0.012, 0.005),   # internal dimple
    (0.022, 0.002),   # foot contact base ring
    (0.029, 0.006),   # outer foot curvature
    (0.032, 0.016),   # bottom heel
    (0.0325, 0.032),  # outlet region
    (0.0325, 0.050),  # lower body
    # Corrugation rib 1
    (0.0312, 0.053),
    (0.0325, 0.056),
    # Label panel area (0.058 to 0.128)
    (0.0322, 0.060),
    (0.0322, 0.126),
    # Corrugation rib 2
    (0.0310, 0.129),
    (0.0325, 0.132),
    # Corrugation rib 3
    (0.0310, 0.136),
    (0.0325, 0.139),
    # Shoulder dome
    (0.0322, 0.148),
    (0.0305, 0.162),
    (0.0265, 0.178),
    (0.0205, 0.192),
    (0.0145, 0.202),  # neck base
    (0.0135, 0.206),  # support ring collar
    (0.0152, 0.207),
    (0.0152, 0.209),
    (0.0135, 0.210),
    # Threaded neck finish
    (0.0132, 0.214),
    (0.0142, 0.216),  # thread 1
    (0.0132, 0.218),
    (0.0142, 0.220),  # thread 2
    (0.0132, 0.222),
    (0.0130, 0.226),  # neck lip
    (0.0118, 0.226),  # inner neck lip
    (0.0118, 0.205),  # inner neck wall
]

steps = 64
verts = []
faces = []
n_prof = len(profile)

for j, (r, z) in enumerate(profile):
    for i in range(steps):
        a = i / steps * 2 * math.pi
        # 5-petal petalloid base modulation at bottom (z < 0.025)
        mod_r = r
        if z < 0.025 and r > 0.005:
            petal = math.cos(a * 5) * 0.0022 * (1.0 - z / 0.025)
            mod_r = max(0.002, r + petal)
        verts.append((mod_r * math.cos(a), mod_r * math.sin(a), z))

for j in range(n_prof - 1):
    for i in range(steps):
        v1 = j * steps + i
        v2 = j * steps + (i + 1) % steps
        v3 = (j + 1) * steps + (i + 1) % steps
        v4 = (j + 1) * steps + i
        faces.append((v1, v2, v3, v4))

b_mesh = bpy.data.meshes.new('BottleShell')
b_mesh.from_pydata(verts, [], faces)
b_mesh.update()

b_obj = bpy.data.objects.new('BottleShell', b_mesh)
bpy.context.collection.objects.link(b_obj)
b_obj.data.materials.append(pet_mat)
for poly in b_mesh.polygons:
    poly.use_smooth = True

# Cylindrical Label wrap around z=0.060 to 0.126
l_verts = []
l_faces = []
lr = 0.0326
lz_bottom = 0.060
lz_top = 0.126

for z in [lz_bottom, lz_top]:
    for i in range(steps + 1):
        a = i / steps * 2 * math.pi
        l_verts.append((lr * math.cos(a), lr * math.sin(a), z))

for i in range(steps):
    v1 = i
    v2 = i + 1
    v3 = (steps + 1) + (i + 1)
    v4 = (steps + 1) + i
    l_faces.append((v1, v2, v3, v4))

l_mesh = bpy.data.meshes.new('BottleLabel')
l_mesh.from_pydata(l_verts, [], l_faces)
l_mesh.update()
l_obj = bpy.data.objects.new('BottleLabel', l_mesh)
bpy.context.collection.objects.link(l_obj)
l_obj.data.materials.append(label_mat)

l_uv = l_mesh.uv_layers.new(name='UVMap')
for poly in l_mesh.polygons:
    poly.use_smooth = True
    for li in poly.loop_indices:
        vi = l_mesh.loops[li].vertex_index
        j = vi // (steps + 1)
        i = vi % (steps + 1)
        l_uv.data[li].uv = (i / steps, j)

# Green Plastic Screw Cap (separate object, seated at z = 0.210 to 0.228)
cap_profile = [
    (0.0080, 0.228),  # central hole for pipe grommet
    (0.0152, 0.228),  # top face
    (0.0154, 0.226),  # top rounded chamfer
    (0.0154, 0.211),  # outer skirt
    (0.0142, 0.211),  # bottom skirt lip
    (0.0142, 0.225),  # inner skirt
    (0.0080, 0.225),  # inner top ceiling
]
c_verts = []
c_faces = []
n_c = len(cap_profile)
for r, z in cap_profile:
    for i in range(steps):
        a = i / steps * 2 * math.pi
        # Knurl ridges on outer skirt (steps % 2)
        mod_r = r
        if r > 0.0150 and 0.212 < z < 0.226:
            mod_r += (i % 2) * 0.0004
        c_verts.append((mod_r * math.cos(a), mod_r * math.sin(a), z))

for j in range(n_c - 1):
    for i in range(steps):
        v1 = j * steps + i
        v2 = j * steps + (i + 1) % steps
        v3 = (j + 1) * steps + (i + 1) % steps
        v4 = (j + 1) * steps + i
        c_faces.append((v1, v2, v3, v4))

c_mesh = bpy.data.meshes.new('PlasticCap')
c_mesh.from_pydata(c_verts, [], c_faces)
c_mesh.update()
c_obj = bpy.data.objects.new('PlasticCap', c_mesh)
bpy.context.collection.objects.link(c_obj)
c_obj.data.materials.append(cap_mat)
for poly in c_mesh.polygons:
    poly.use_smooth = True

# Melted Outlet Hole Marker / Collar at z = 0.032, on front-right (x = 0.0325 * cos(0.4), z = 0.032)
# A small torus ring showing the heat-melted rim of the plastic puncture hole
hole_mesh = bpy.data.meshes.new('OutletMeltRim')
rim_verts = []
rim_faces = []
rim_r_major = 0.0028
rim_r_minor = 0.0006
rim_steps_u = 24
rim_steps_v = 12
for u in range(rim_steps_u):
    phi = u / rim_steps_u * 2 * math.pi
    for v in range(rim_steps_v):
        theta = v / rim_steps_v * 2 * math.pi
        rx = (rim_r_major + rim_r_minor * math.cos(theta)) * math.cos(phi)
        rz = (rim_r_major + rim_r_minor * math.cos(theta)) * math.sin(phi)
        ry = rim_r_minor * math.sin(theta)
        # Position on bottle surface
        rim_verts.append((0.0326 + ry, rx, 0.032 + rz))

for u in range(rim_steps_u):
    for v in range(rim_steps_v):
        v1 = u * rim_steps_v + v
        v2 = ((u + 1) % rim_steps_u) * rim_steps_v + v
        v3 = ((u + 1) % rim_steps_u) * rim_steps_v + (v + 1) % rim_steps_v
        v4 = u * rim_steps_v + (v + 1) % rim_steps_v
        rim_faces.append((v1, v2, v3, v4))

hole_mesh.from_pydata(rim_verts, [], rim_faces)
hole_mesh.update()
h_obj = bpy.data.objects.new('OutletMeltRim', hole_mesh)
bpy.context.collection.objects.link(h_obj)
h_obj.data.materials.append(material('Melted Rim', (0.18, 0.14, 0.10), rough=0.6, transmission=0.2))
for poly in hole_mesh.polygons:
    poly.use_smooth = True

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=True)
print(f"EXPORTED BOTTLE GLB SUCCESSFULLY TO: {export_path}")
