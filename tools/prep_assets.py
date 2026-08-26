#!/usr/bin/env python3
"""Holiday Landing - asset preparation.

Turns the five supplied source images into the small, alpha-correct assets that
get base64-embedded into the game.  See SPEC section 2 and 9.

plane-b / plane-c ship with no alpha channel: their "transparency" is a baked
light-grey checkerboard (#FEFEFE / #F4F4F4).  We key it out by CONNECTIVITY,
never by whiteness -- plane-b has white fuselage stripes, a light canopy and a
grey propeller that a whiteness key would destroy.
"""
import numpy as np
from PIL import Image
from scipy import ndimage
import os, sys

SRC = os.path.dirname(os.path.abspath(__file__)) + '/../assets-src'
OUT = os.path.dirname(os.path.abspath(__file__)) + '/../assets'
os.makedirs(OUT, exist_ok=True)

PLANE_LONGEST = 144      # px, longest side of the trimmed sprite
PLANE_QUALITY = 88       # WebP: ~5 KB/sprite vs ~21 KB for optimised PNG
MAP_WIDTH     = int(os.environ.get('MAP_WIDTH', 1024))
MAP_QUALITY   = int(os.environ.get('MAP_QUALITY', 72))
OCEAN         = (0x0C, 0x1A, 0x3A)   # verification background


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r + 0.5


def key_checkerboard(rgb):
    """Alpha mask for an image whose background is a near-white checkerboard."""
    a = rgb.astype(np.int16)
    mn, mx = a.min(axis=2), a.max(axis=2)
    near = (mn > 232) & ((mx - mn) < 14)          # near-white AND near-neutral
    lab, _ = ndimage.label(near)                   # 4-connectivity
    border = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])))
    border.discard(0)
    bg = np.isin(lab, list(border))                # background = touches the frame
    obj = ndimage.binary_fill_holes(~bg)           # object + any enclosed holes
    return obj


def premultiplied_resize(rgb, alpha, size):
    """LANCZOS downscale in premultiplied space, then un-premultiply.

    Resizing straight RGBA drags the white background into every edge pixel and
    produces the halo the spec warns about.  Premultiplying makes the fully
    transparent pixels contribute exactly nothing.
    """
    af = np.clip(alpha.astype(np.float32), 0, 1)
    pm = rgb.astype(np.float32) * af[..., None]

    def rs(ch):
        return np.asarray(Image.fromarray(ch, mode='F').resize(size, Image.LANCZOS), dtype=np.float32)

    pm_s = np.dstack([rs(pm[..., i]) for i in range(3)])
    a_s = np.clip(rs(af), 0, 1)
    safe = np.maximum(a_s, 1e-4)[..., None]
    rgb_s = np.clip(pm_s / safe, 0, 255)
    # kill colour noise where there is no coverage at all
    rgb_s[a_s < 1e-3] = 0
    out = np.dstack([rgb_s, (a_s * 255.0)])
    return np.clip(np.rint(out), 0, 255).astype(np.uint8)


def prep_plane(name, erode=2):
    im = Image.open(f'{SRC}/{name}-src.webp')
    has_alpha = im.mode in ('RGBA', 'LA') or 'transparency' in im.info
    rgb = np.array(im.convert('RGB'))

    if has_alpha:
        alpha = np.array(im.convert('RGBA'))[..., 3].astype(np.float32) / 255.0
        mask = alpha > 0.5
        note = 'native alpha'
    else:
        mask = key_checkerboard(rgb)
        if erode:
            # the boundary band is plane-colour blended with white background;
            # keeping it is exactly what produces a halo on dark water
            mask = ndimage.binary_erosion(mask, structure=disk(erode))
        alpha = mask.astype(np.float32)
        note = f'connectivity key, eroded {erode}px'

    ys, xs = np.where(mask)
    if len(xs) == 0:
        sys.exit(f'{name}: empty mask')
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgb_c, a_c = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]

    h, w = a_c.shape
    s = PLANE_LONGEST / max(w, h)
    size = (max(1, round(w * s)), max(1, round(h * s)))
    out = premultiplied_resize(rgb_c, a_c, size)

    path = f'{OUT}/{name}.webp'
    Image.fromarray(out, 'RGBA').save(path, 'WEBP', quality=PLANE_QUALITY, method=6)
    kb = os.path.getsize(path) / 1024
    print(f'{name:8s} {note:32s} trim {w}x{h} -> {size[0]}x{size[1]}  {kb:5.1f} KB')
    return out


def prep_map():
    im = Image.open(f'{SRC}/map-src.webp').convert('RGB')
    w, h = im.size
    im2 = im.resize((MAP_WIDTH, round(h * MAP_WIDTH / w)), Image.LANCZOS)
    path = f'{OUT}/map.webp'
    im2.save(path, 'WEBP', quality=MAP_QUALITY, method=6)
    print(f'{"map":8s} {f"webp q{MAP_QUALITY} method 6":32s} {w}x{h} -> {im2.size[0]}x{im2.size[1]}  '
          f'{os.path.getsize(path)/1024:5.1f} KB')


def verify(planes):
    """Composite every sprite on the ocean colour and look for white fringing."""
    pad, big = 16, 3
    cells = []
    for name, arr in planes.items():
        h, w = arr.shape[:2]
        a = arr[..., 3:4].astype(np.float32) / 255.0
        comp = arr[..., :3].astype(np.float32) * a + np.array(OCEAN, np.float32) * (1 - a)
        cells.append((name, np.clip(comp, 0, 255).astype(np.uint8)))

    H = max(c.shape[0] for _, c in cells) * big + pad * 2
    W = sum(c.shape[1] * big for _, c in cells) + pad * (len(cells) + 1)
    sheet = np.zeros((H, W, 3), np.uint8)
    sheet[:, :] = OCEAN
    x = pad
    worst = {}
    for name, c in cells:
        z = np.kron(c, np.ones((big, big, 1), np.uint8))
        sheet[pad:pad + z.shape[0], x:x + z.shape[1]] = z
        x += z.shape[1] + pad
        # fringe metric: brightest near-neutral pixel among partially covered edges
        arr = planes[name]
        al = arr[..., 3].astype(np.float32) / 255.0
        edge = (al > 0.15) & (al < 0.85)
        if edge.sum():
            px = arr[..., :3][edge].astype(np.int16)
            neutral = (px.max(1) - px.min(1)) < 26
            bright = px.min(1) > 200
            worst[name] = int((neutral & bright).sum())
        else:
            worst[name] = 0
    Image.fromarray(sheet).save(f'{OUT}/_verify_planes.png')
    print('\nfringe check (near-white neutral pixels on antialiased edges, lower is better):')
    for k, v in worst.items():
        print(f'  {k}: {v}')


if __name__ == '__main__':
    planes = {n: prep_plane(n) for n in ('plane-a', 'plane-b', 'plane-c')}
    prep_map()
    verify(planes)
