"""
Futugrana hero: a slim display on a stand, camera pushing in until the screen
fills the frame. The screen is a holdout (transparent): the live HTML
dashboard is projected into it by src/scripts/hero-sequence.ts using the
per-frame screen corners written to manifest.json.

Run (from the repo root):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P blender/hero_scene.py -- \
      [--frames 1,45,90] [--scale 50] [--samples 32] [--out blender/out/test]

Without --frames it renders the full sequence. Output: WebP RGBA frames named
0001.webp... plus manifest.json in --out.
"""
import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    if name in argv:
        return argv[argv.index(name) + 1]
    return default


N_FRAMES = int(arg("--count", "90"))
ONLY = [int(x) for x in arg("--frames", "").split(",") if x]
RES_SCALE = int(arg("--scale", "100"))
SAMPLES = int(arg("--samples", "128"))
OUT = os.path.abspath(arg("--out", "blender/out/frames"))
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- geometry
SCREEN_W, SCREEN_H = 1.6, 0.9          # active area, 16:9 (matches the frame)
BEZEL = 0.022                          # glass border around the active area
BODY_T = 0.026                         # body thickness
CORNER_R = 0.028                       # body corner radius
SCREEN_CZ = 1.02                       # screen centre height above the floor
FOCAL = 50.0
R_START = float(arg("--r0", "4.6"))       # camera distance at frame 1
AZ_START = float(arg("--az0", "30"))      # degrees to the right
EL_START = float(arg("--el0", "11"))      # degrees above
LIFT_START = float(arg("--lift0", "0.5")) # aim point above the screen centre
SENSOR = 36.0

INK = (0.051, 0.106, 0.165)            # #0D1B2A brand navy, sRGB


def srgb_to_linear(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def ease_in_out_cubic(t):
    t = max(0.0, min(1.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def rounded_rect_points(w, h, r, seg=12):
    pts = []
    corners = [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
               (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]
    for cx, cy, start in corners:
        for i in range(seg + 1):
            a = math.radians(start + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, w, h, depth, r, bevel=0.0025, seg=12):
    """Rounded-rectangle slab lying in the XZ plane, front face at y=0,
    extruded toward +y (away from the camera)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, 0.0, z)) for x, z in rounded_rect_points(w, h, r, seg)]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(60)
        mod.harden_normals = True
    for p in mesh.polygons:
        p.use_smooth = True
    return obj


def principled(name, base, metallic=0.0, rough=0.5, coat=0.0, coat_rough=0.05, spec=0.5):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(base), 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    return mat


def screen_material():
    """Pure holdout: the screen is a clean hole, the live HTML dashboard shows
    through with its own contrast. No reflections on the screen glass (tried:
    a uniform sheen reads as a grey veil, a glint stripe as a distraction)."""
    mat = bpy.data.materials.new("screen")
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    hold = nt.nodes.new("ShaderNodeHoldout")
    nt.links.new(hold.outputs[0], out.inputs["Surface"])
    return mat


def build_display():
    body_mat = principled("anodized", (0.12, 0.135, 0.165), metallic=1.0, rough=0.26)
    glass_mat = principled("black_glass", (0.004, 0.005, 0.007), rough=0.03, coat=1.0, coat_rough=0.02, spec=0.5)
    stand_mat = principled("stand", (0.14, 0.155, 0.185), metallic=1.0, rough=0.3)

    gw, gh = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
    # Body: slightly larger than the glass, the metal frame shows as a thin rim.
    body = slab("body", gw + 0.008, gh + 0.008, BODY_T, CORNER_R, bevel=0.004)
    body.location = (0, 0.0006, SCREEN_CZ)
    body.data.materials.append(body_mat)

    glass = slab("glass", gw, gh, 0.0012, CORNER_R - 0.004, bevel=0.0)
    glass.location = (0, -0.0004, SCREEN_CZ)
    glass.data.materials.append(glass_mat)

    bpy.ops.mesh.primitive_plane_add(size=1)
    scr = bpy.context.active_object
    scr.name = "screen"
    scr.rotation_euler = (math.radians(90), 0, 0)
    scr.scale = (SCREEN_W, SCREEN_H, 1)
    scr.location = (0, -0.0008, SCREEN_CZ)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    scr.data.materials.append(screen_material())

    # Stand: a slim neck behind the panel and a thin rounded foot.
    neck_h = SCREEN_CZ - 0.06
    neck = slab("neck", 0.16, neck_h, 0.018, 0.006, bevel=0.002)
    neck.location = (0, BODY_T + 0.03, neck_h / 2 + 0.008)
    neck.data.materials.append(stand_mat)

    foot = slab("foot", 0.44, 0.26, 0.012, 0.05, bevel=0.002)
    foot.rotation_euler = (math.radians(-90), 0, 0)
    foot.location = (0, BODY_T - 0.05, 0.012)
    foot.data.materials.append(stand_mat)
    return scr


def build_floor():
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "shadow_catcher"
    floor.is_shadow_catcher = True
    floor.data.materials.append(principled("floor", (1, 1, 1), rough=0.9))


def area_light(name, loc, rot, size, energy, color=(1, 1, 1), size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    if size_y:
        data.shape = "RECTANGLE"
        data.size = size
        data.size_y = size_y
    else:
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    obj.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.collection.objects.link(obj)
    return obj


def build_lights():
    # Big softbox above and in front: soft top-down shadow and the long
    # highlight that slides across the glass as the camera moves.
    area_light("key", (0.6, -2.6, 3.4), (38, 0, 8), 3.2, 1500, size_y=1.6)
    # Low cool fill from the left so the dark metal keeps its shape.
    area_light("fill", (-3.4, -1.6, 1.4), (75, 0, -62), 2.5, 260, color=(0.86, 0.92, 1.0))
    # Strip softbox low on the front-left: a crisp highlight that travels
    # along the glossy black bezel and the metal edge as the camera arcs.
    glint = area_light("glint", (-2.1, -3.4, 0.55), (90, 0, -32), 0.45, 520, size_y=3.4)
    glint.rotation_euler = look_at_rotation(glint.location, (0, 0, SCREEN_CZ))
    # Warm rim from behind-right: separates the body edge from the white page.
    area_light("rim", (2.6, 2.2, 2.2), (60, 0, 130), 1.4, 420, color=(1.0, 0.93, 0.82))

    # Studio world: bright "ceiling", darker floor/horizon. Gives graded
    # reflections on glass and metal instead of a flat white veil.
    world = bpy.data.worlds.new("world")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.035, 0.04, 0.05, 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    remap = nt.nodes.new("ShaderNodeMapRange")  # z in [-1, 1] -> [0, 1]
    remap.inputs["From Min"].default_value = -1
    remap.inputs["From Max"].default_value = 1
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], remap.inputs["Value"])
    nt.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.9


def look_at_rotation(cam_loc, target):
    direction = Vector(target) - Vector(cam_loc)
    return direction.to_track_quat("-Z", "Y").to_euler()


def build_camera():
    data = bpy.data.cameras.new("cam")
    data.lens = FOCAL
    data.sensor_width = SENSOR
    data.sensor_fit = "HORIZONTAL"
    cam = bpy.data.objects.new("cam", data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    # The camera travels on a crane-like arc around the screen centre:
    # from a raised three-quarter view on the right (body thickness and edge
    # light read as a real object) to a frontal close-up where the screen
    # exactly fills the 16:9 frame. Aim point starts above the display so it
    # sits low in the frame, like the card peeking from the bottom of the hero.
    centre = Vector((0, -0.0008, SCREEN_CZ))
    r_end = (SCREEN_W / 2) / (SENSOR / 2 / FOCAL)
    R0, AZ0, EL0, LIFT0 = R_START, math.radians(AZ_START), math.radians(EL_START), LIFT_START

    for i in range(N_FRAMES):
        t = ease_in_out_cubic(i / (N_FRAMES - 1))
        r = R0 + (r_end - R0) * t
        az = AZ0 * (1 - t)
        el = EL0 * (1 - t)
        lift = LIFT0 * (1 - t)
        loc = centre + Vector((r * math.sin(az) * math.cos(el), -r * math.cos(az) * math.cos(el), r * math.sin(el)))
        cam.location = loc
        cam.rotation_euler = look_at_rotation(loc, centre + Vector((0, 0, lift)))
        cam.keyframe_insert("location", frame=i + 1)
        cam.keyframe_insert("rotation_euler", frame=i + 1)
    end_loc = centre + Vector((0, -r_end, 0))
    # Exact end pose (no float drift from the look-at).
    cam.location = end_loc
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.keyframe_insert("location", frame=N_FRAMES)
    cam.keyframe_insert("rotation_euler", frame=N_FRAMES)
    for fc in cam.animation_data.action.fcurves if hasattr(cam.animation_data.action, "fcurves") else []:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return cam


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = arg("--device", "GPU")
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        if sc.cycles.device == "CPU":
            raise RuntimeError("CPU requested")
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
    except Exception as e:  # CPU fallback
        print("GPU setup failed, CPU render:", e)
        sc.cycles.device = "CPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_auto_tile = True
    sc.cycles.tile_size = 512
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.render.film_transparent = True
    sc.render.resolution_x = 1920
    sc.render.resolution_y = 1080
    sc.render.resolution_percentage = RES_SCALE
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "WEBP"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.quality = 82
    sc.frame_start = 1
    sc.frame_end = N_FRAMES


def screen_corners(screen_obj, cam):
    """TL, TR, BR, BL of the active area, normalized, origin top-left."""
    sc = bpy.context.scene
    hw, hh = SCREEN_W / 2, SCREEN_H / 2
    y = -0.0008
    world = [(-hw, y, SCREEN_CZ + hh), (hw, y, SCREEN_CZ + hh),
             (hw, y, SCREEN_CZ - hh), (-hw, y, SCREEN_CZ - hh)]
    out = []
    for p in world:
        v = world_to_camera_view(sc, cam, Vector(p))
        out += [round(v.x, 6), round(1 - v.y, 6)]
    return out


def main():
    reset_scene()
    scr = build_display()
    build_floor()
    build_lights()
    cam = build_camera()
    setup_render()

    sc = bpy.context.scene
    corners = []
    for f in range(1, N_FRAMES + 1):
        sc.frame_set(f)
        corners.append(screen_corners(scr, cam))
    corners[-1] = [0, 0, 1, 0, 1, 1, 0, 1]  # exact by construction
    manifest = {
        "frames": N_FRAMES,
        "width": 1920,
        "height": 1080,
        "pattern": "/hero-seq/{n}.webp",
        "pad": 4,
        "corners": corners,
    }
    with open(os.path.join(OUT, "manifest.json"), "w") as fh:
        json.dump(manifest, fh, separators=(",", ":"))
    print("last-but-one corners", corners[-2])

    frames = ONLY or list(range(1, N_FRAMES + 1))
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(OUT, f"{f:04d}")
        bpy.ops.render.render(write_still=True)
        print("rendered", f)


main()
