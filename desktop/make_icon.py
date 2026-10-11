#!/usr/bin/env python3
"""Draw a BaskanOS Dock icon and pack it as AppIcon.icns."""

from __future__ import annotations

import struct
import subprocess
import zlib
from pathlib import Path

SIZE = 1024
HERE = Path(__file__).resolve().parent
OUT = HERE / "AppIcon.icns"
PNG = HERE / "AppIcon-1024.png"

# Brand: dark green + gold
BG = (11, 18, 16)
GOLD = (212, 160, 23)
ACCENT = (61, 155, 120)
LIGHT = (232, 239, 233)


def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgba[y * width * 4 : (y + 1) * width * 4]) for y in range(height))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def blend(buf: bytearray, x: int, y: int, color) -> None:
    if x < 0 or y < 0 or x >= SIZE or y >= SIZE:
        return
    i = (y * SIZE + x) * 4
    src_a = color[3] / 255
    if src_a <= 0:
        return
    dst_a = buf[i + 3] / 255
    out_a = src_a + dst_a * (1 - src_a)
    if out_a <= 0:
        return
    for c in range(3):
        src = color[c] / 255
        dst = buf[i + c] / 255
        buf[i + c] = int(255 * ((src * src_a + dst * dst_a * (1 - src_a)) / out_a))
    buf[i + 3] = int(255 * out_a)


def fill_round_rect(buf, x0, y0, x1, y1, radius, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            dx = dy = 0.0
            if x < x0 + radius:
                dx = x0 + radius - x
            elif x > x1 - radius:
                dx = x - (x1 - radius)
            if y < y0 + radius:
                dy = y0 + radius - y
            elif y > y1 - radius:
                dy = y - (y1 - radius)
            if dx * dx + dy * dy <= radius * radius + radius:
                blend(buf, x, y, color)


def fill_circle(buf, cx, cy, radius, color):
    r2 = radius * radius
    for y in range(int(cy - radius), int(cy + radius) + 1):
        for x in range(int(cx - radius), int(cx + radius) + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                blend(buf, x, y, color)


def fill_rect(buf, x0, y0, x1, y1, color):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            blend(buf, x, y, color)


def draw():
    buf = bytearray(SIZE * SIZE * 4)
    # transparent outside rounded square
    margin = 72
    fill_round_rect(buf, margin, margin, SIZE - margin, SIZE - margin, 180, (*BG, 255))
    # gold top bar
    fill_round_rect(buf, 180, 220, 844, 300, 28, (*GOLD, 255))
    # accent column
    fill_round_rect(buf, 180, 340, 300, 780, 24, (*ACCENT, 230))
    # panel rows
    for i, y in enumerate((340, 460, 580, 700)):
        fill_round_rect(buf, 340, y, 844, y + 80, 20, (*LIGHT, 28 if i else 40))
    # gold dot
    fill_circle(buf, 760, 260, 22, (*LIGHT, 255))
    write_png(PNG, SIZE, SIZE, buf)


def pack_icns():
    iconset = HERE / "AppIcon.iconset"
    if iconset.exists():
        for p in iconset.iterdir():
            p.unlink()
    else:
        iconset.mkdir()
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        out = iconset / f"icon_{s}x{s}.png"
        subprocess.run(
            ["sips", "-z", str(s), str(s), str(PNG), "--out", str(out)],
            check=True,
            capture_output=True,
        )
        if s <= 512:
            out2 = iconset / f"icon_{s}x{s}@2x.png"
            subprocess.run(
                ["sips", "-z", str(s * 2), str(s * 2), str(PNG), "--out", str(out2)],
                check=True,
                capture_output=True,
            )
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(OUT)], check=True)
    print("Icon:", OUT)


if __name__ == "__main__":
    draw()
    pack_icns()
