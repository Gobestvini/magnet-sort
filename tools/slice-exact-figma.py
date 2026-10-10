"""Lossless, source-coordinate asset slicing explicitly requested by the user.

The reference compositions contain painted lettering and occlusions. Keep those
pixels instead of silently replacing them with fonts, vectors or invented art.
Every foreground region is a separate PNG layer. Background has transparent
holes under those regions, so it never contains a flattened copy of the UI.
These are reference slices, not reconstructed unoccluded runtime sprites.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import base64
import hashlib
import html
import json
import numpy as np
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/design/mockups/2026-10-09-facebook-casual'
OUT = ROOT / 'artifacts/figma-exact'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 941, 1672
report = {'version': 2, 'method': 'Lossless semantic raster slices; original coordinates; no resampling', 'screens': []}


def write_svg(screen):
    groups={}
    for layer in screen['layers']:
        groups.setdefault(layer['name'].split(' / ')[0],[]).append(layer)
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    for group,layers in groups.items():
        svg.append(f'<g id="{html.escape(group)}">')
        for layer in layers:
            encoded=base64.b64encode((OUT/layer['file']).read_bytes()).decode()
            svg.append(f'<image id="{html.escape(layer["name"].replace(" / ","__"))}" x="{layer["x"]}" y="{layer["y"]}" width="{layer["width"]}" height="{layer["height"]}" xlink:href="data:image/png;base64,{encoded}"/>')
        svg.append('</g>')
    svg.append('</svg>')
    (OUT/(screen['name']+'.svg')).write_text(''.join(svg),encoding='utf-8')


if '--svg-only' in sys.argv:
    for screen in json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))['screens']:
        write_svg(screen)
    print('Rebuilt grouped SVGs from the verified PNG manifest.')
    sys.exit(0)


class Screen:
    def __init__(self, path):
        self.name = path.stem
        self.original = Image.open(path).convert('RGBA')
        assert self.original.size == (W, H)
        self.owner = Image.new('I', (W, H), 0)
        self.draw = ImageDraw.Draw(self.owner)
        self.names = [('Background / visible original paint', 'background')]

    def rect(self, name, box, kind='art'):
        self.names.append((name, kind))
        x0, y0, x1, y1 = box
        self.draw.rectangle((x0, y0, x1-1, y1-1), fill=len(self.names)-1)

    def polygon(self, name, points, kind='art'):
        self.names.append((name, kind))
        self.draw.polygon(points, fill=len(self.names)-1)

    def board(self, box, offset=0):
        # Source cells are illustrated, irregular and occluded. Voronoi seams
        # partition their existing paint; no geometric replacement is drawn.
        centers=[]
        for row in range(5):
            xs = [140, 310, 470, 630, 800] if row%2==0 else [220, 390, 550, 710]
            if row == 0: xs = [195, 310, 470, 630, 785]
            for col,x in enumerate(xs):
                centers.append((x, 500+row*125+offset))
                self.names.append((f'Board / Tile row {row+1} col {col+1} / visible paint', 'tile-visible'))
        first=len(self.names)-len(centers)
        yy,xx=np.mgrid[box[1]:box[3],box[0]:box[2]]
        distance=np.stack([(xx-x)**2+(yy-y)**2 for x,y in centers])
        partition=Image.fromarray((np.argmin(distance,axis=0)+first).astype(np.int32))
        self.owner.paste(partition,(box[0],box[1]))
        self.draw=ImageDraw.Draw(self.owner)

    def split_stack(self, name, box, cuts):
        x0,y0,x1,y1=box
        starts=[y0]+cuts
        ends=cuts+[y1]
        for i,(a,b) in enumerate(zip(starts,ends)):
            self.rect(f'Pieces / {name} / painted band {i+1}',(x0,a,x1,b),'piece-visible')

    def save(self):
        folder=OUT/self.name
        folder.mkdir(exist_ok=True)
        ids=np.asarray(self.owner)
        layers=[]
        recomposed=Image.new('RGBA',(W,H))
        for i,(name,kind) in enumerate(self.names):
            mask=Image.fromarray(np.where(ids==i,255,0).astype(np.uint8))
            # A two-pixel source-colour bleed prevents alpha seams when Figma
            # scales adjacent cutouts. Overlaps contain identical source pixels.
            mask=mask.filter(ImageFilter.MaxFilter(5))
            bounds=mask.getbbox()
            if bounds is None: continue
            part=self.original.crop(bounds)
            part.putalpha(mask.crop(bounds))
            slug=''.join(c.lower() if c.isalnum() else '-' for c in name).strip('-')
            file=f'{i:03d}-{slug}.png'
            part.save(folder/file,optimize=True)
            recomposed.alpha_composite(part,(bounds[0],bounds[1]))
            layers.append({'name':name,'kind':kind,'file':self.name+'/'+file,'x':bounds[0],'y':bounds[1], 'width':part.width,'height':part.height,'sha256':hashlib.sha256((folder/file).read_bytes()).hexdigest()})
        diff=ImageChops.difference(recomposed,self.original)
        # Compare RGB too: alpha difference alone can conceal colour mismatch.
        extrema=diff.getextrema()
        max_error=max(v[1] for v in extrema)
        assert max_error==0,(self.name,extrema)
        recomposed.save(folder/'reassembled.png')
        screen={'name':self.name,'source':str(SOURCE.relative_to(ROOT)/f'{self.name}.png'),'sourceSha256':hashlib.sha256((SOURCE/(self.name+'.png')).read_bytes()).hexdigest(),'width':W,'height':H,'layers':layers,'layerCount':len(layers),'maxChannelError':max_error}
        write_svg(screen)
        report['screens'].append(screen)


def header(s):
    s.rect('Header / Logo artwork',(40,10,430,248),'logo')
    s.rect('Header / Level badge paint',(438,100,773,204),'panel')
    s.rect('Header / Level lettering',(500,122,711,177),'lettering')
    s.rect('Header / Pause icon and rim',(790,94,907,211),'icon')
    s.rect('HUD / Cleared panel paint',(48,240,650,387),'panel')
    s.rect('HUD / Cleared lettering',(99,263,470,310),'lettering')
    s.rect('HUD / Progress track',(104,313,606,354),'progress')
    s.rect('HUD / Moves panel paint',(650,240,899,387),'panel')
    s.rect('HUD / Moves label',(706,265,854,301),'lettering')
    s.rect('HUD / Moves number',(747,303,818,359),'lettering')


def tools(s, top, bottom, buttons_top):
    s.rect('Tools / Shared gold tray paint',(20,top,922,bottom),'panel')
    for label,a,b in [('Violet',50,340),('Blue',340,607),('Coral',607,890)]:
        s.rect(f'Tools / {label} card paint',(a,top+10,b,bottom-15),'card')
    # These original, source-sized icon rectangles retain their painted shadows.
    for label,box in [('Violet',(80,top+50,313,bottom-43)),('Blue',(367,top+50,587,bottom-43)),('Coral',(640,top+50,862,bottom-43))]:
        s.rect(f'Tools / {label} magnet artwork',box,'magnet')
    s.rect('Actions / Hint button paint',(55,buttons_top,461,buttons_top+126),'button')
    s.rect('Actions / Hint icon',(128,buttons_top+17,197,buttons_top+102),'icon')
    s.rect('Actions / Hint lettering',(252,buttons_top+35,372,buttons_top+87),'lettering')
    s.rect('Actions / Restart button paint',(477,buttons_top,892,buttons_top+126),'button')
    s.rect('Actions / Restart icon',(566,buttons_top+17,648,buttons_top+102),'icon')
    s.rect('Actions / Restart lettering',(662,buttons_top+35,822,buttons_top+87),'lettering')


for path in sorted(SOURCE.glob('[0-9]*.png')):
    s=Screen(path);n=int(s.name[:2])
    if n==1:
        s.rect('Loading / Logo',(168,80,790,468),'logo')
        s.rect('Loading / Magnet glow and orbit',(140,470,830,1190),'effect')
        s.rect('Loading / Violet ring',(105,820,342,1045),'piece-visible')
        s.rect('Loading / Blue ring',(326,965,596,1182),'piece-visible')
        s.rect('Loading / Coral ring',(579,905,816,1117),'piece-visible')
        s.rect('Loading / Hero magnet',(265,480,752,954),'magnet')
        s.rect('Loading / Title lettering',(231,1226,716,1331),'lettering')
        s.rect('Loading / Subtitle lettering',(250,1331,701,1392),'lettering')
        s.rect('Loading / Progress track',(99,1393,842,1507),'progress')
        s.rect('Loading / Painted fill',(120,1408,637,1489),'progress')
        s.rect('Loading / Percentage',(400,1500,551,1578),'lettering')
    elif n==12:
        s.rect('Error / Logo',(197,45,759,415),'logo')
        s.rect('Error / Modal paint',(43,409,897,1509),'panel')
        s.rect('Error / Title badge',(125,454,814,677),'panel')
        s.rect('Error / Title lettering',(183,476,761,625),'lettering')
        s.rect('Error / Magnet and glow',(213,675,719,1085),'magnet')
        s.rect('Error / Please try again',(258,1084,687,1158),'lettering')
        s.rect('Error / Retry button paint',(110,1163,829,1381),'button')
        s.rect('Error / Retry lettering',(347,1210,599,1308),'lettering')
        s.rect('Error / Divider',(108,1380,837,1398),'divider')
        s.rect('Error / Browser requirement',(181,1401,760,1459),'lettering')
    else:
        header(s)
        offset=65 if n==5 else 0
        s.board((25,404+offset,909,1118+offset),offset)
        # Visible stack faces and their original bevels; no fake hex primitives.
        s.split_stack('Top left mixed',(235,426+offset,357,589+offset),[503+offset,540+offset,562+offset])
        if n==2:
            s.split_stack('Tutorial right',(648,541,781,706),[615,651,677])
            s.split_stack('Tutorial lower',(483,796,620,943),[870,905])
        else:
            s.rect('Board / Top blocker',(793//2,856//2,1093//2,1146//2),'blocker')
            s.split_stack('Top right mixed',(582,426+offset,710,589+offset),[503+offset,540+offset,562+offset])
            s.split_stack('Lower mixed',(161,766+offset,296,945+offset),[849+offset,883+offset,912+offset])
            s.rect('Board / Bottom blocker',(389,934+offset,552,1100+offset),'blocker')
        if n==2:
            s.polygon('Tutorial / Arrow artwork',[(261,748),(303,745),(337,788),(349,897),(368,986),(429,1143),(379,1143),(309,984),(281,888),(279,819),(252,824),(245,803)],'effect')
            s.rect('Tutorial / Instruction card',(116,1132,830,1296),'panel')
            s.rect('Tutorial / First instruction lettering',(159,1156,780,1213),'lettering')
            s.rect('Tutorial / Second instruction lettering',(263,1212,699,1258),'lettering')
            s.rect('Tutorial / Tool card',(301,1300,646,1616),'card')
            s.rect('Tutorial / Magnet',(350,1344,609,1565),'magnet')
            s.rect('Tutorial / Hand',(494,1454,690,1648),'hand')
        else:
            if n in (3,4,9,10): top,bottom,bt=1196,1506,1508
            elif n==5: top,bottom,bt=1231,1530,1526
            else: top,bottom,bt=1194,1503,1507
            s.rect('Instruction / Painted lettering',(80,1117+(45 if n==5 else 0),879,1179+(45 if n==5 else 0)),'lettering')
            tools(s,top,bottom,bt)
        if n==4:
            s.rect('Placement / Valid target and force path',(393,773,567,991),'effect')
            s.rect('Placement / Floating violet magnet',(375,640,575,826),'magnet')
            s.rect('Placement / Hand',(527,727,684,921),'hand')
        if n==5:
            s.rect('Placement / Rejected magnet and arrow',(186,374,336,535),'magnet')
            s.rect('Placement / Occupied tooltip plate',(340,379,639,507),'panel')
            s.rect('Placement / Occupied tooltip lettering',(400,398,588,468),'lettering')
            s.rect('Placement / Error badge',(332,489,397,555),'icon')
        if n==6:
            s.rect('Pulling / Destination magnet',(329,815,442,936),'magnet')
            for label,box in [('A',(235,755,311,833)),('B',(302,732,368,813)),('C',(360,769,419,844))]:
                s.rect('Pulling / Flying piece '+label,box,'piece-visible')
        if n==7:
            s.rect('Clearing / Glow and particles',(344,557,590,824),'effect')
            s.rect('Clearing / Plus six',(418,555,528,632),'lettering')
            s.split_stack('Clearing rings',(422,638,524,807),[692,724,752,778])
        if n==8:
            s.rect('Hint / Target tile glow',(376,654,555,828),'effect')
            s.rect('Hint / Arrow',(433,656,505,731),'icon')
            s.rect('Hint / Tooltip plate',(283,535,669,678),'panel')
            s.rect('Hint / Tooltip lettering',(319,554,632,630),'lettering')
        if n==9:
            s.rect('Pause / Modal paint',(115,1007//2,1660//2,1311),'panel')
            s.rect('Pause / Title artwork',(552//2,1100//2,1342//2,1334//2),'lettering')
            s.rect('Pause / Magnet and glow',(663//2,1327//2,1227//2,1752//2),'magnet')
            s.rect('Pause / Resume button paint',(348//2,1728//2,1535//2,2045//2),'button')
            s.rect('Pause / Resume lettering',(641//2,1806//2,1247//2,1963//2),'lettering')
            s.rect('Pause / Restart button paint',(463//2,2050//2,1429//2,2292//2),'button')
            s.rect('Pause / Restart icon',(600//2,2094//2,782//2,2242//2),'icon')
            s.rect('Pause / Restart lettering',(888//2,2118//2,1268//2,2223//2),'lettering')
            s.rect('Pause / Reduced motion row',(323//2,2300//2,1562//2,2519//2),'panel')
            s.rect('Pause / Reduced motion lettering',(409//2,2362//2,1035//2,2451//2),'lettering')
            s.rect('Pause / Switch track',(1182//2,2329//2,1487//2,2488//2),'switch')
            s.rect('Pause / Switch thumb',(1190//2,2340//2,1335//2,2480//2),'switch')
            s.rect('Pause / Close button',(1404//2,963//2,1663//2,1218//2),'icon')
        if n==10:
            # Confetti covers the board, but is separate from dialog controls.
            for label,box in [('Left upper',(25,390,323,693)),('Right upper',(638,381,936,694)),('Left lower',(20,688,250,1205)),('Right lower',(756,687,936,1198))]:
                s.rect('Victory / Confetti '+label,box,'effect')
            s.rect('Victory / Modal paint',(239//2,1228//2,1649//2,2358//2),'panel')
            s.rect('Victory / Magnet rays',(506//2,749//2,1393//2,1354//2),'effect')
            s.rect('Victory / Magnet artwork',(633//2,895//2,1253//2,1321//2),'magnet')
            s.rect('Victory / Star left',(495//2,1107//2,644//2,1296//2),'icon')
            s.rect('Victory / Star top',(840//2,765//2,1052//2,1003//2),'icon')
            s.rect('Victory / Star right',(1238//2,1047//2,1411//2,1250//2),'icon')
            s.rect('Victory / Ribbon artwork',(167//2,1292//2,1722//2,1730//2),'ribbon')
            s.rect('Victory / Ribbon title artwork',(377//2,1334//2,1519//2,1542//2),'lettering')
            s.rect('Victory / Nice chain',(700//2,1580//2,1175//2,1704//2),'lettering')
            s.rect('Victory / Next puzzle button paint',(354//2,1717//2,1539//2,2047//2),'button')
            s.rect('Victory / Next puzzle lettering',(579//2,1806//2,1313//2,1957//2),'lettering')
            s.rect('Victory / Play again button paint',(499//2,2046//2,1392//2,2295//2),'button')
            s.rect('Victory / Replay icon',(647//2,2094//2,795//2,2246//2),'icon')
            s.rect('Victory / Play again lettering',(802//2,2110//2,1262//2,2232//2),'lettering')
        if n==11:
            s.rect('Defeat / Modal paint',(107,527,836,1332),'panel')
            s.rect('Defeat / Title artwork',(287,563,670,755),'lettering')
            s.rect('Defeat / Magnet rays',(193,747,762,962),'effect')
            s.rect('Defeat / Magnet artwork',(338,747,641,962),'magnet')
            s.rect('Defeat / Instruction lettering',(306,962,672,1067),'lettering')
            s.rect('Defeat / Try again button paint',(155,1067,788,1240),'button')
            s.rect('Defeat / Try again lettering',(314,1102,640,1189),'lettering')
            s.rect('Defeat / Restart lettering',(396,1228,556,1281),'lettering')
    s.save()

(OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
gallery='''<!doctype html><html lang="en"><meta charset="utf-8"><title>Magnet Sort — exact mockup slices</title><style>body{margin:30px;background:#17102c;color:white;font:18px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}img{width:100%}figure{margin:0}p{max-width:1100px}a{color:#e8c8ff}</style><h1>Exact source artwork · 12 screens</h1><p>Reassembled from separate PNG layers at original coordinates. Zero changed source pixels in all 12 compositions. Painted lettering is preserved as artwork. Source slices retain occlusion boundaries and require cleanup before arbitrary runtime reuse.</p><p><a href="https://www.figma.com/design/Nntj95XfGJSGVy0FwadZMN">Figma</a> · <a href="manifest.json">Asset manifest</a></p><main>'''
for s in report['screens']:
    gallery+=f'<figure><img src="{s["name"]}.svg"><figcaption>{s["name"]} · {s["layerCount"]} layers · max error 0</figcaption></figure>'
(OUT/'index.html').write_text(gallery+'</main></html>',encoding='utf-8')
print(json.dumps({'screens':len(report['screens']),'layers':sum(s['layerCount'] for s in report['screens']),'maxChannelError':max(s['maxChannelError'] for s in report['screens'])}))
