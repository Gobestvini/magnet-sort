"""Verify the files on disk, independently of the slicing process.

Optional: --figma-export <zip downloaded using Figma's ordinary Export UI>.
Figma's raster output is measured, not falsely asserted to be lossless.
"""
from pathlib import Path
from PIL import Image
import base64
import hashlib
import io
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
import numpy as np

root=Path(__file__).resolve().parents[1]
folder=root/'artifacts/figma-exact'
manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
assert len(manifest['screens'])==12
results=[]
exports=None
if '--figma-export' in sys.argv:
    exports=zipfile.ZipFile(sys.argv[sys.argv.index('--figma-export')+1])
for s in manifest['screens']:
    source=Image.open(root/s['source']).convert('RGBA')
    assert hashlib.sha256((root/s['source']).read_bytes()).hexdigest()==s['sourceSha256']
    combined=Image.new('RGBA',source.size)
    for layer in s['layers']:
        raw=(folder/layer['file']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==layer['sha256'],layer['file']
        im=Image.open(io.BytesIO(raw)).convert('RGBA')
        assert im.size==(layer['width'],layer['height'])
        combined.alpha_composite(im,(layer['x'],layer['y']))
    assert np.array_equal(np.asarray(combined),np.asarray(source)),s['name']
    tree=ET.parse(folder/(s['name']+'.svg'))
    images=tree.findall('.//{http://www.w3.org/2000/svg}image')
    assert len(images)==s['layerCount']
    expected={l['name'].replace(' / ','__'):l for l in s['layers']}
    # Verify the actual import payload as well as the loose PNG files.
    for node in images:
        layer=expected[node.attrib['id']]
        raw=base64.b64decode(node.attrib['{http://www.w3.org/1999/xlink}href'].split(',',1)[1])
        assert hashlib.sha256(raw).hexdigest()==layer['sha256']
        for key in ['x','y','width','height']:
            assert int(node.attrib[key])==layer[key]
    result={'name':s['name'],'layers':s['layerCount'],'sourceMaxError':0}
    if exports:
        data=exports.read(s['name']+'.png')
        figma=Image.open(io.BytesIO(data)).convert('RGBA')
        assert figma.size==source.size
        figma.save(folder/(s['name']+'-figma-export.png'))
        diff=np.abs(np.asarray(figma).astype(np.int16)-np.asarray(source).astype(np.int16))
        result.update(figmaMaxChannelError=int(diff.max()),figmaMeanChannelError=round(float(diff.mean()),6),figmaPixelsOver2=int(np.any(diff[:,:,:3]>2,axis=2).sum()))
    results.append(result)
report={'screens':len(results),'layers':sum(r['layers'] for r in results),'sourceMaxError':0,'figmaExportChecked':exports is not None,'results':results}
(folder/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({key:value for key,value in report.items() if key!='results'}))
