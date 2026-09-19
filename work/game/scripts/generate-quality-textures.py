"""Generate deterministic 1K/2K texture tiers from the existing source scans."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"

JOBS = [
    ("pine_bark_4k/pine_bark_diff_4k.jpg", "pine_bark_4k/pine_bark_diff_{tier}.jpg"),
    ("pine_bark_4k/pine_bark_nor_gl_4k.jpg", "pine_bark_4k/pine_bark_nor_gl_{tier}.jpg"),
    ("pine_bark_4k/pine_bark_rough_4k.jpg", "pine_bark_4k/pine_bark_rough_{tier}.jpg"),
    ("rock_boulder_dry/diff_4k.jpg", "rock_boulder_dry/diff_{tier}.jpg"),
    ("rock_boulder_dry/nor_gl_4k.jpg", "rock_boulder_dry/nor_gl_{tier}.jpg"),
    ("rock_boulder_dry/rough_4k.jpg", "rock_boulder_dry/rough_{tier}.jpg"),
    ("rock_boulder_dry/ao_4k.jpg", "rock_boulder_dry/ao_{tier}.jpg"),
    ("rock_moss_set_01/textures/diff_4k.jpg", "rock_moss_set_01/textures/diff_{tier}.jpg"),
    ("rock_moss_set_01/textures/nor_gl_4k.jpg", "rock_moss_set_01/textures/nor_gl_{tier}.jpg"),
    ("rock_moss_set_01/textures/rough_4k.jpg", "rock_moss_set_01/textures/rough_{tier}.jpg"),
    ("rock_moss_set_01/textures/ao_4k.jpg", "rock_moss_set_01/textures/ao_{tier}.jpg"),
]


def resize(source: Path, target: Path, size: int) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "JPEG", quality=90, optimize=True, progressive=True, subsampling=0)


for source_name, target_pattern in JOBS:
    source = ROOT / source_name
    for tier, size in (("2k", 2048), ("1k", 1024)):
        target = ROOT / target_pattern.format(tier=tier)
        if target.resolve() == source.resolve():
            continue
        resize(source, target, size)
        print(f"{target.relative_to(ROOT)}: {size}px")
