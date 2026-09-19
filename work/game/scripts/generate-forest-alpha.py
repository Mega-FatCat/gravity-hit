"""Build filtered foliage masks and forest-tuned scan colour for FOREST-TEXTURE-01.

The source scan masks are effectively binary.  At normal gameplay distances that
turns otherwise detailed leaf geometry into a saw-toothed / scissors-cut edge.
This script keeps the authored coverage, but gives the outer 2-3 texels a real
coverage ramp so MSAA/alpha-to-coverage and mip filtering have useful data.

The second pass also writes colour variants for the scanned shrubs.  The source
atlases are excellent scans but intentionally very flat/pale; once hundreds of
instances are viewed together that pushes the whole understory toward a silver-
cyan "card" look.  The generated colour files keep the photographed veins,
spots, stems and age variation while restoring the darker olive values and local
contrast seen in the reference forest.  This is asset preprocessing only: no
lighting or shader code is changed here.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
ASSETS = {
    "fern_02": 1.15,
    "shrub_02": 4.10,
    "shrub_03": 4.35,
    "shrub_04": 3.75,
}

DIFFUSE_ASSETS = {
    # asset: (source filename, brightness, contrast, saturation, sharpness,
    #         per-channel RGB multipliers)
    "shrub_02": ("shrub_02_diff_2k.png", 0.84, 1.15, 1.13, 1.24, (0.95, 1.00, 0.88)),
    "shrub_03": ("shrub_03_diff_2k.png", 0.90, 1.13, 1.11, 1.22, (0.96, 1.00, 0.91)),
    "shrub_04": ("shrub_04_diff_1k.png", 0.89, 1.12, 1.09, 1.20, (0.97, 1.00, 0.93)),
}

# Opaque foliage still benefits from the same scan-preserving woodland colour
# treatment.  Fir needles are modeled geometry rather than alpha cards, so they
# do not need a packed mask; the pale capture-neutral source merely needs to be
# brought back into the darker chlorophyll range of the reference forest.
OPAQUE_DIFFUSE_ASSETS = {
    "fir_sapling": ("textures/fir_sapling_twigs_diff_1k.jpg", 0.58, 1.18, 1.20, 1.12, (0.90, 1.00, 0.76)),
    # shrub_01 supplies the real photographed leaf tissue used by the procedural
    # broadleaf crowns.  Its scan is intentionally bright/neutral for authoring;
    # in a full canopy that becomes the beige wash visible in QA.  Keep veins,
    # age spots and warm leaves, but move the green tissue into woodland values.
    "shrub_01": ("textures/shrub_01_diff_2k.jpg", 0.54, 1.15, 1.12, 1.12, (0.90, 1.00, 0.72)),
}


def filtered_mask(source: Path, radius: float) -> Image.Image:
    # Source masks are 16-bit grayscale for the scanned plants.  Normalize to
    # 8-bit coverage before filtering so WebGL receives a predictable mask.
    src = Image.open(source).convert("L")
    # Shrub cards contain many tiny transparent pinholes between photographed
    # leaf fragments.  Once those fall below a pixel they become black/bright
    # pepper noise rather than readable gaps. Close only 1-2 px holes before the
    # existing contour blur; fern fronds stay untouched because their fine gaps
    # are an important part of the silhouette.
    closed = src.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)) if radius > 2.0 else src
    soft = closed.filter(ImageFilter.GaussianBlur(radius=radius))

    # Preserve fully opaque leaf interiors and fully empty atlas padding.  Only
    # the narrow boundary band remains fractional.  This keeps silhouette area
    # stable while removing the one-bit edge.
    out = soft.point(lambda value: 0 if value < 10 else (255 if value > 246 else value))
    return out


def forest_diffuse(
    source: Path,
    brightness: float,
    contrast: float,
    saturation: float,
    sharpness: float,
    channels: tuple[float, float, float],
) -> Image.Image:
    """Preserve scan detail while moving the atlas back into woodland values."""
    image = Image.open(source).convert("RGB")
    image = ImageEnhance.Brightness(image).enhance(brightness)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Color(image).enhance(saturation)
    image = ImageEnhance.Sharpness(image).enhance(sharpness)

    r, g, b = image.split()
    rm, gm, bm = channels
    r = r.point(lambda value: min(255, round(value * rm)))
    g = g.point(lambda value: min(255, round(value * gm)))
    b = b.point(lambda value: min(255, round(value * bm)))
    return Image.merge("RGB", (r, g, b))


def packed_foliage(diffuse: Image.Image, alpha: Image.Image) -> Image.Image:
    """Pack coverage with RGB dilation underneath the transparent contour.

    The scanned atlases contain unrelated capture/background RGB outside the
    authored leaf mask. Linear filtering blends those hidden colours into the
    visible contour and creates the dark/pale halo that makes alpha foliage look
    scissors-cut. Build a premultiplied blurred colour field and use it only as
    the mask fades out, so invisible texels carry nearby leaf colour instead.
    """
    rgb = diffuse.convert("RGB")
    mask = alpha.resize(rgb.size, Image.Resampling.LANCZOS).convert("L")
    a = np.asarray(mask, dtype=np.float32) / 255.0
    source = np.asarray(rgb, dtype=np.float32)

    # Six pixels is wide enough for trilinear/mip filtering without smearing
    # visible veins or spots: only hidden/edge RGB is replaced below.
    blur_radius = 6.0
    blurred_alpha = np.asarray(mask.filter(ImageFilter.GaussianBlur(blur_radius)), dtype=np.float32) / 255.0
    bleed_channels: list[np.ndarray] = []
    for channel in range(3):
        premult = np.clip(source[..., channel] * a, 0, 255).astype(np.uint8)
        premult_blur = np.asarray(
            Image.fromarray(premult, mode="L").filter(ImageFilter.GaussianBlur(blur_radius)),
            dtype=np.float32,
        )
        bleed_channels.append(premult_blur / np.maximum(blurred_alpha, 1.0 / 255.0))
    bleed = np.stack(bleed_channels, axis=-1)

    # Keep photographed colour in opaque tissue. Progressively replace only the
    # filtered boundary/padding as alpha falls toward zero.
    edge_mix = np.clip((0.88 - a) / 0.88, 0.0, 1.0)[..., None]
    dilated = source * (1.0 - edge_mix) + bleed * edge_mix
    rgba = np.dstack((np.clip(dilated, 0, 255).astype(np.uint8), np.asarray(mask, dtype=np.uint8)))
    return Image.fromarray(rgba, mode="RGBA")


def main() -> None:
    generated_masks: dict[str, Image.Image] = {}
    for asset, radius in ASSETS.items():
        folder = ROOT / asset
        source = folder / "alpha.png"
        target = folder / "alpha_forest.png"
        mask = filtered_mask(source, radius)
        mask.save(target, optimize=True)
        generated_masks[asset] = mask
        print(f"{asset}: {source.name} -> {target.name} (blur={radius})")

    for asset, (filename, brightness, contrast, saturation, sharpness, channels) in DIFFUSE_ASSETS.items():
        folder = ROOT / asset
        source = folder / filename
        target = folder / "diff_forest.png"
        diffuse = forest_diffuse(source, brightness, contrast, saturation, sharpness, channels)
        diffuse.save(target, optimize=True)
        packed = folder / "diff_forest_rgba.png"
        packed_foliage(diffuse, generated_masks[asset]).save(packed, optimize=True)
        print(f"{asset}: {source.name} -> {target.name} (forest colour/detail pass)")
        print(f"{asset}: {target.name} + alpha_forest.png -> {packed.name}")

    for asset, (filename, brightness, contrast, saturation, sharpness, channels) in OPAQUE_DIFFUSE_ASSETS.items():
        folder = ROOT / asset
        source = folder / filename
        target = folder / "diff_forest.png"
        forest_diffuse(source, brightness, contrast, saturation, sharpness, channels).save(target, optimize=True)
        print(f"{asset}: {filename} -> {target.name} (opaque forest colour/detail pass)")


if __name__ == "__main__":
    main()
