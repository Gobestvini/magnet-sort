"""Trim explicitly requested generated game sprites, preserving their painted pixels.

Remove disconnected alpha islands; retain the largest center-connected silhouette.
No recoloring or reconstructed edge painting.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import numpy as np

root = Path(__file__).resolve().parents[1] / 'docs/design/prototypes/gameplay-counted-hex/assets'
metadata = {}
for name in ['tile-cream', 'chip-violet', 'chip-blue', 'chip-coral', 'blocker']:
    source = root / (name + '-generated.png')
    if not source.exists():
        continue
    image = Image.open(source).convert('RGBA')
    if name == 'blocker':
        cut = Image.new('L', image.size)
        ImageDraw.Draw(cut).polygon([(77,4),(140,38),(140,105),(77,143),(14,105),(14,38)], fill=255)
        image.putalpha(cut)
    alpha = np.array(image.getchannel('A'))
    binary = Image.fromarray(np.where(alpha > 8, 255, 0).astype('uint8')).copy()
    ImageDraw.floodfill(binary, (image.width // 2, image.height // 2), 128)
    connected = np.array(binary) == 128
    image.putalpha(Image.fromarray(np.where(connected, alpha, 0).astype('uint8')))
    image = image.crop(image.getbbox())
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    image.save(root / (name + '.png'))
    metadata[name] = {'width': image.width, 'height': image.height, 'ratio': image.height / image.width}
(root / 'sprite-sizes.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(metadata)
