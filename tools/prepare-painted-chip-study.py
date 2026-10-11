"""Crop approved regenerated sprites; retain original connected alpha and color."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import json
root=Path(__file__).resolve().parents[1]/'docs/design/prototypes/gameplay-counted-hex/painted-study'
sizes={}
for color in ['violet','blue','coral']:
    image=Image.open(root/(color+'-source.png')).convert('RGBA')
    alpha=np.array(image.getchannel('A'))
    binary=Image.fromarray(np.where(alpha>8,255,0).astype('uint8')).copy()
    ImageDraw.floodfill(binary,(image.width//2,image.height//2),128)
    image.putalpha(Image.fromarray(np.where(np.array(binary)==128,alpha,0).astype('uint8')))
    image=image.crop(image.getbbox())
    image.thumbnail((512,512),Image.Resampling.LANCZOS)
    image.save(root/(color+'.png'))
    sizes[color]={'width':image.width,'height':image.height}
(root/'sizes.json').write_text(json.dumps(sizes,indent=2)+'\n')
print(sizes)
