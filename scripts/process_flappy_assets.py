#!/usr/bin/env python3
"""Prepare the supplied Flappy Bird artwork for the mini program.

The source illustrations contain large transparent margins. The background also
contains a deliberately white lower panel that must be replaced by the supplied
ground artwork. This script performs those two mechanical steps and writes
compact runtime assets into ``assets/flappy``.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


SOURCE_NAMES = {
    "bird": "小鸟.png",
    "pipe": "管道.png",
    "background": "背景.png",
    "ground": "陆地.png",
}


def alpha_crop(image: Image.Image, padding: int) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("transparent source image has no visible pixels")

    left, top, right, bottom = bbox
    return rgba.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(rgba.width, right + padding),
            min(rgba.height, bottom + padding),
        )
    )


def resize_to_width(image: Image.Image, width: int) -> Image.Image:
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def find_white_panel_start(background: Image.Image) -> int:
    rgb = background.convert("RGB")
    sample_step = max(1, rgb.width // 160)

    for y in range(rgb.height):
        samples = [rgb.getpixel((x, y)) for x in range(0, rgb.width, sample_step)]
        nearly_white = sum(
            1
            for red, green, blue in samples
            if min(red, green, blue) >= 245 and max(red, green, blue) - min(red, green, blue) <= 8
        )
        if nearly_white / len(samples) >= 0.98:
            return y

    raise ValueError("could not locate the white lower panel in the background")


def ground_body_crop(ground: Image.Image) -> Image.Image:
    """Crop to the continuous grass/soil body, excluding floating decorations.

    The source ground has flowers above the platform and transparent padding
    around it. Starting at the first mostly opaque row prevents those transparent
    gaps from exposing the white background panel after compositing.
    """

    rgba = ground.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("ground source image has no visible pixels")

    left, _, right, bottom = bbox
    start_y = None
    for y in range(bbox[1], bottom):
        row = alpha.crop((0, y, rgba.width, y + 1))
        opaque_ratio = sum(1 for value in row.getdata() if value > 8) / rgba.width
        if opaque_ratio >= 0.93:
            start_y = y
            break

    if start_y is None:
        raise ValueError("could not locate the continuous body of the ground image")

    # Move inside the antialiased top edge and remove the source artwork's
    # black/white outer stroke at the bottom. Keeping that decorative stroke
    # creates a visible light seam along the bottom edge of a full-screen game.
    content_bottom = bottom - 16
    return rgba.crop((left, start_y + 6, right, max(start_y + 7, content_bottom)))


def composite_background(background: Image.Image, ground: Image.Image) -> Image.Image:
    rgb = background.convert("RGB")
    white_start = find_white_panel_start(rgb)
    panel_size = (rgb.width, rgb.height - white_start)

    body = ground_body_crop(ground)
    fitted = ImageOps.fit(
        body,
        panel_size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )

    composed = rgb.convert("RGBA")
    composed.alpha_composite(fitted, (0, white_start))
    return composed.convert("RGB")


def process(source_dir: Path, output_dir: Path) -> None:
    sources = {key: source_dir / name for key, name in SOURCE_NAMES.items()}
    missing = [str(path) for path in sources.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError("missing source assets: " + ", ".join(missing))

    output_dir.mkdir(parents=True, exist_ok=True)

    bird = alpha_crop(Image.open(sources["bird"]), padding=24)
    bird = resize_to_width(bird, 360)
    bird.save(output_dir / "bird.png", optimize=True, compress_level=9)

    pipe = alpha_crop(Image.open(sources["pipe"]), padding=14)
    pipe = resize_to_width(pipe, 240)
    pipe.save(output_dir / "pipe.png", optimize=True, compress_level=9)

    background = composite_background(
        Image.open(sources["background"]),
        Image.open(sources["ground"]),
    )
    background = background.resize((750, 1334), Image.Resampling.LANCZOS)
    background.save(
        output_dir / "background.jpg",
        quality=86,
        optimize=True,
        progressive=True,
        subsampling=1,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="directory containing the four supplied Chinese-named PNG files")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("assets/flappy"),
        help="runtime asset output directory (default: assets/flappy)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    process(args.source.resolve(), args.output.resolve())
