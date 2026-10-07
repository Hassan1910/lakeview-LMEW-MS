#!/usr/bin/env python3
"""Rasterize brand/mark.svg compositions into the Expo PNG assets."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "mobile" / "assets"

NAVY = (11, 79, 108, 255)
DEEP = (6, 33, 64, 255)
HULL = (248, 250, 252, 255)
WAVE = (1, 186, 239, 255)
WAVE_SOFT = (125, 211, 252, 255)
GOLD = (245, 158, 11, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, width: int, height: int, rgba: bytearray) -> None:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


class Canvas:
    def __init__(self, width: int, height: int, scale: int = 2):
        self.width = width
        self.height = height
        self.scale = scale
        self.sw = width * scale
        self.sh = height * scale
        self.buf = bytearray(self.sw * self.sh * 4)

    def blend(self, x: int, y: int, color: tuple[int, int, int, int]) -> None:
        if x < 0 or y < 0 or x >= self.sw or y >= self.sh:
            return
        i = (y * self.sw + x) * 4
        sr, sg, sb, sa = color
        if sa >= 255:
            self.buf[i : i + 4] = bytes(color)
            return
        if sa <= 0:
            return
        dr, dg, db, da = self.buf[i : i + 4]
        sa_f = sa / 255
        da_f = da / 255
        out_a = sa_f + da_f * (1 - sa_f)
        if out_a <= 0:
            return
        def mix(src: int, dst: int) -> int:
            return int((src * sa_f + dst * da_f * (1 - sa_f)) / out_a + 0.5)
        self.buf[i] = mix(sr, dr)
        self.buf[i + 1] = mix(sg, dg)
        self.buf[i + 2] = mix(sb, db)
        self.buf[i + 3] = int(out_a * 255 + 0.5)

    def fill(self, color: tuple[int, int, int, int]) -> None:
        pixel = bytes(color)
        self.buf[:] = pixel * (self.sw * self.sh)

    def circle(self, cx: float, cy: float, radius: float, color: tuple[int, int, int, int]) -> None:
        s = self.scale
        cx *= s
        cy *= s
        radius *= s
        x0 = max(0, int(cx - radius - 1))
        y0 = max(0, int(cy - radius - 1))
        x1 = min(self.sw - 1, int(cx + radius + 1))
        y1 = min(self.sh - 1, int(cy + radius + 1))
        r2 = radius * radius
        for y in range(y0, y1 + 1):
            dy = y + 0.5 - cy
            for x in range(x0, x1 + 1):
                dx = x + 0.5 - cx
                if dx * dx + dy * dy <= r2:
                    self.blend(x, y, color)

    def polygon(self, points: list[tuple[float, float]], color: tuple[int, int, int, int]) -> None:
        s = self.scale
        pts = [(x * s, y * s) for x, y in points]
        ys = [y for _, y in pts]
        y0 = max(0, int(min(ys)))
        y1 = min(self.sh - 1, int(max(ys)) + 1)
        for y in range(y0, y1 + 1):
            scan = y + 0.5
            hits: list[float] = []
            for i, (x1, y1) in enumerate(pts):
                x2, y2 = pts[(i + 1) % len(pts)]
                if (y1 <= scan < y2) or (y2 <= scan < y1):
                    hits.append(x1 + (scan - y1) * (x2 - x1) / (y2 - y1))
            hits.sort()
            for i in range(0, len(hits) - 1, 2):
                x_start = max(0, int(hits[i]))
                x_end = min(self.sw - 1, int(hits[i + 1]))
                for x in range(x_start, x_end + 1):
                    self.blend(x, y, color)

    def stroke(self, points: list[tuple[float, float]], width: float, color: tuple[int, int, int, int]) -> None:
        radius = width / 2
        for x, y in points:
            self.circle(x, y, radius, color)

    def downsample(self) -> bytearray:
        out = bytearray(self.width * self.height * 4)
        n = self.scale * self.scale
        sw = self.sw
        for y in range(self.height):
            for x in range(self.width):
                r = g = b = a = 0
                for sy in range(self.scale):
                    row = (y * self.scale + sy) * sw
                    for sx in range(self.scale):
                        i = (row + x * self.scale + sx) * 4
                        r += self.buf[i]
                        g += self.buf[i + 1]
                        b += self.buf[i + 2]
                        a += self.buf[i + 3]
                o = (y * self.width + x) * 4
                out[o] = r // n
                out[o + 1] = g // n
                out[o + 2] = b // n
                out[o + 3] = a // n
        return out


def quad(p0, p1, p2, steps: int = 24) -> list[tuple[float, float]]:
    points = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        points.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return points


def wave(y: float, lift: float) -> list[tuple[float, float]]:
    start = (8.0, y)
    spans = []
    control = (16.0, y - lift)
    end = (24.0, y)
    spans.extend(quad(start, control, end))
    for _ in range(2):
        reflected = (end[0] * 2 - control[0], end[1] * 2 - control[1])
        control = reflected
        nxt = (end[0] + 16, y)
        spans.extend(quad(end, control, nxt)[1:])
        end = nxt
    return spans


def draw_symbol(canvas: Canvas, origin_x: float, origin_y: float, unit: float) -> None:
    def map_point(x: float, y: float) -> tuple[float, float]:
        return (origin_x + x * unit, origin_y + y * unit)

    canvas.stroke([map_point(x, y) for x, y in wave(52, 6)], 3.2 * unit, WAVE)
    canvas.stroke([map_point(x, y) for x, y in wave(58, 4)], 2.6 * unit, WAVE_SOFT)
    canvas.polygon([map_point(x, y) for x, y in ((11, 34), (53, 34), (46, 47), (18, 47))], HULL)
    gx, gy = map_point(32, 24)
    canvas.circle(gx, gy, 4.5 * unit, GOLD)


def draw_tile(canvas: Canvas, origin_x: float, origin_y: float, size: float) -> None:
    radius = 14 / 64 * size
    canvas.rounded = None
    x0, y0 = origin_x, origin_y
    canvas.rect_fill(x0 + radius, y0, size - 2 * radius, size, NAVY)
    canvas.rect_fill(x0, y0 + radius, size, size - 2 * radius, NAVY)
    for cx, cy in (
        (x0 + radius, y0 + radius),
        (x0 + size - radius, y0 + radius),
        (x0 + radius, y0 + size - radius),
        (x0 + size - radius, y0 + size - radius),
    ):
        canvas.circle(cx, cy, radius, NAVY)
    draw_symbol(canvas, origin_x, origin_y, size / 64)


def rect_fill(self: Canvas, x: float, y: float, w: float, h: float, color: tuple[int, int, int, int]) -> None:
    s = self.scale
    x0 = max(0, int(x * s))
    y0 = max(0, int(y * s))
    x1 = min(self.sw - 1, int((x + w) * s))
    y1 = min(self.sh - 1, int((y + h) * s))
    for yy in range(y0, y1 + 1):
        for xx in range(x0, x1 + 1):
            self.blend(xx, yy, color)


Canvas.rect_fill = rect_fill  # type: ignore[attr-defined]


def render(size: int, paint) -> bytearray:
    canvas = Canvas(size, size, 2)
    paint(canvas)
    return canvas.downsample()


def icon(canvas: Canvas) -> None:
    canvas.fill(NAVY)
    unit = (canvas.width * 0.74) / 64
    offset = (canvas.width - 64 * unit) / 2
    draw_symbol(canvas, offset, offset, unit)


def adaptive(canvas: Canvas) -> None:
    unit = (canvas.width * 0.58) / 64
    offset = (canvas.width - 64 * unit) / 2
    draw_symbol(canvas, offset, offset, unit)


def splash(canvas: Canvas) -> None:
    canvas.fill(DEEP)
    tile = canvas.width * 0.34
    origin = (canvas.width - tile) / 2
    draw_tile(canvas, origin, origin, tile)


def main() -> None:
    write_png(OUT / "icon.png", 1024, 1024, render(1024, icon))
    write_png(OUT / "adaptive-icon.png", 1024, 1024, render(1024, adaptive))
    write_png(OUT / "splash.png", 1284, 1284, render(1284, splash))
    print(f"wrote assets in {OUT}")


if __name__ == "__main__":
    main()
