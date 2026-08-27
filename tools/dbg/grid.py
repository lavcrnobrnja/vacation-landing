#!/usr/bin/env python3
"""Render one runway zoomed with a labelled logical-pixel grid, so corners can
be read off the map directly."""
import sys, math, json, os
from PIL import Image, ImageDraw
W,H=1280,853
base=Image.open(os.path.join(os.path.dirname(__file__),'../../assets-src/map-src.webp')).convert('RGB').resize((W,H),Image.LANCZOS)
REG={'A':(457,524,150),'B':(762,280,150),'C':(1103,686,190)}
def render(k, quad=None, zoom=4):
    cx,cy,s=REG[k]; s=int(s*0.95)
    x0,y0=cx-s,cy-s; x1,y1=cx+s,cy+s
    im=base.crop((x0,y0,x1,y1)).resize(((x1-x0)*zoom,(y1-y0)*zoom),Image.LANCZOS)
    d=ImageDraw.Draw(im,'RGBA')
    for gx in range(x0-x0%20, x1+1, 20):
        big = gx%100==0
        X=(gx-x0)*zoom
        d.line([(X,0),(X,im.height)], fill=(255,255,255,90 if big else 34), width=2 if big else 1)
        if big: d.text((X+3,3), str(gx), fill=(255,255,0,255))
    for gy in range(y0-y0%20, y1+1, 20):
        big = gy%100==0
        Y=(gy-y0)*zoom
        d.line([(0,Y),(im.width,Y)], fill=(255,255,255,90 if big else 34), width=2 if big else 1)
        if big: d.text((3,Y+3), str(gy), fill=(255,255,0,255))
    if quad:
        pts=[((x-x0)*zoom,(y-y0)*zoom) for x,y in quad]
        d.polygon(pts, outline=(0,255,140,255), width=3)
        for i,(px,py) in enumerate(pts):
            d.ellipse([px-6,py-6,px+6,py+6], fill=(0,255,140,255))
            d.text((px+9,py-6), 'ABCD'[i], fill=(0,255,140,255))
    return im
if __name__=='__main__':
    k=sys.argv[1]
    q=json.loads(sys.argv[2]) if len(sys.argv)>2 else None
    render(k,q).save(f'assets/verify/_grid_{k}.png')
    print(f'assets/verify/_grid_{k}.png')
