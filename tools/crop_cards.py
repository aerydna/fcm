#!/usr/bin/env python3
"""Segment the FCM reference sheets into individual card images.

The rulebook card pages are grid-aligned on a cream background
(254,241,212). We build a foreground mask (everything that is not the
cream background) and segment it with 1-D projections: first into
vertical column bands, then each band into horizontal card boxes.
Thin connecting arrows fall below the projection thresholds.
"""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
from PIL import Image

BG = np.array([254, 241, 212])


def foreground(im: np.ndarray) -> np.ndarray:
    """True where pixel differs clearly from the cream background."""
    diff = np.abs(im.astype(int) - BG).sum(axis=2)
    return diff > 45


def runs(vec: np.ndarray, thresh: float, min_len: int, gap: int) -> list[tuple[int, int]]:
    """Return (start, end) runs where vec>thresh, merging gaps<=gap."""
    on = vec > thresh
    out: list[list[int]] = []
    i = 0
    n = len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            out.append([i, j])
            i = j
        else:
            i += 1
    # merge close runs
    merged: list[list[int]] = []
    for r in out:
        if merged and r[0] - merged[-1][1] <= gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [(a, b) for a, b in merged if b - a >= min_len]


def tighten(mask: np.ndarray, y0: int, y1: int, x0: int, x1: int, pad: int):
    sub = mask[y0:y1, x0:x1]
    ys = np.where(sub.any(axis=1))[0]
    xs = np.where(sub.any(axis=0))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    ny0 = y0 + ys[0] - pad
    ny1 = y0 + ys[-1] + 1 + pad
    nx0 = x0 + xs[0] - pad
    nx1 = x0 + xs[-1] + 1 + pad
    return max(0, ny0), min(mask.shape[0], ny1), max(0, nx0), min(mask.shape[1], nx1)


def segment(path: str, region, out_dir: str, prefix: str,
            col_frac: float, row_frac: float, min_w: int, min_h: int,
            dry: bool, col_gap: int = 40, row_gap: int = 30):
    im = np.asarray(Image.open(path).convert("RGB"))
    fg = foreground(im)
    ry0, ry1, rx0, rx1 = region
    if ry1 < 0:
        ry1 = im.shape[0]
    if rx1 < 0:
        rx1 = im.shape[1]
    sub = fg[ry0:ry1, rx0:rx1]

    colsum = sub.sum(axis=0)
    col_bands = runs(colsum, col_frac * colsum.max(), min_len=min_w, gap=col_gap)

    boxes = []
    for cx0, cx1 in col_bands:
        colmask = sub[:, cx0:cx1]
        rowsum = colmask.sum(axis=1)
        row_bands = runs(rowsum, row_frac * rowsum.max(), min_len=min_h, gap=row_gap)
        for rr0, rr1 in row_bands:
            t = tighten(fg, ry0 + rr0, ry0 + rr1, rx0 + cx0, rx0 + cx1, pad=6)
            if not t:
                continue
            y0, y1, x0, x1 = t
            w, h = x1 - x0, y1 - y0
            if w < min_w or h < min_h:
                continue
            boxes.append((x0, y0, x1, y1))

    boxes.sort(key=lambda b: (round(b[1] / 120), b[0]))
    print(f"{prefix}: {len(boxes)} boxes")
    for i, (x0, y0, x1, y1) in enumerate(boxes, 1):
        print(f"  {i:02d} x{x0}-{x1} y{y0}-{y1}  ({x1-x0}x{y1-y0})")
        if not dry:
            Image.fromarray(im[y0:y1, x0:x1]).save(f"{out_dir}/{prefix}_{i:02d}.png")
    return boxes


if __name__ == "__main__":
    dry = "--save" not in sys.argv
    Path("assets/employees").mkdir(parents=True, exist_ok=True)
    Path("assets/milestones").mkdir(parents=True, exist_ok=True)
    # Employees: full page
    segment("assets/pages/hi-06.png", (0, -1, 0, -1),
            "assets/employees", "emp",
            col_frac=0.06, row_frac=0.06, min_w=260, min_h=200, dry=dry)
    # Milestones: right grid region only (6 rows x 3 columns)
    segment("assets/pages/hi-05.png", (40, 2160, 1140, -1),
            "assets/milestones", "ms",
            col_frac=0.06, row_frac=0.12, min_w=260, min_h=200, dry=dry,
            row_gap=6)
