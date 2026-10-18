import { h } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { art } from './assets.js';
import { tutorialCurve, tutorialDragFrames } from './tutorial-guide.js';

// Compositor-only demonstration: never moves the actual magnet or game model.
export function TutorialGuide({ color, getTarget, runId, reduced }) {
  const root = useRef(null), carrier = useRef(null);
  const [available, setAvailable] = useState(() => !document.hidden && !document.body.dataset.startup);
  const [busy, setBusy] = useState(false), [geometry, setGeometry] = useState(null);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const enabled = available && !busy, still = reduced || systemReduced;
  useEffect(() => {
    const refresh = () => setAvailable(!document.hidden && !document.body.dataset.startup);
    const down = () => setBusy(true), up = () => setBusy(false);
    const key = event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Space'].includes(event.code)) setBusy(true); };
    const media = matchMedia('(prefers-reduced-motion: reduce)'), motion = () => setSystemReduced(media.matches);
    const observer = new MutationObserver(refresh); observer.observe(document.body, { attributes:true, attributeFilter:['data-startup'] });
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('pointerdown', down, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', up);
    window.addEventListener('keydown', key, true); media.addEventListener('change', motion);
    refresh();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', up);
      window.removeEventListener('keydown', key, true); media.removeEventListener('change', motion); };
  }, []);
  useLayoutEffect(() => {
    if (!enabled) return;
    const app = root.current.closest('.prototype-shell');
    const source = app.querySelector(`[data-magnet-color="${color}"] > img`), host = app.querySelector('.board-host');
    if (!source || !host) return;
    const measure = () => {
      const target = getTarget(), rect = source.getBoundingClientRect();
      if (!target || !rect.width || !rect.height) { setGeometry(null); return; }
      const next = { x:rect.x + rect.width / 2, y:rect.y + rect.height / 2, endX:target.x, endY:target.y,
        size:rect.width, endSize:target.size, cell:`${target.cell.col},${target.cell.row}`, width:innerWidth, height:innerHeight };
      setGeometry(previous => previous && Object.keys(next).every(key => next[key] === previous[key]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(source); observer.observe(host);
    source.parentElement.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, { passive:true });
    return () => { observer.disconnect(); source.parentElement.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure); };
  }, [enabled, color, runId, getTarget]);
  useLayoutEffect(() => {
    if (!enabled || !geometry || still) return;
    const curve = tutorialCurve({x:geometry.x,y:geometry.y}, {x:geometry.endX,y:geometry.endY});
    const animation = carrier.current?.animate?.(tutorialDragFrames(curve, geometry.endSize / geometry.size), {duration:2800,iterations:Infinity,easing:'linear'});
    return () => animation?.cancel();
  }, [enabled, geometry, still]);
  if (!enabled) return null;
  const curve = geometry && tutorialCurve({x:geometry.x,y:geometry.y}, {x:geometry.endX,y:geometry.endY});
  return h('div', {className:'tutorial-guide',ref:root,'aria-hidden':'true','data-color':color,'data-target-cell':geometry?.cell,'data-still':still,
    style: geometry ? {'--guide-x':`${geometry.x}px`,'--guide-y':`${geometry.y}px`,'--guide-size':`${geometry.size}px`} : {}},
    geometry && h('svg', {className:'tutorial-route',viewBox:`0 0 ${geometry.width} ${geometry.height}`,width:geometry.width,height:geometry.height},
      h('defs',null,h('marker',{id:'tutorial-tip',viewBox:'0 0 12 12',refX:10,refY:6,markerWidth:15,markerHeight:15,markerUnits:'userSpaceOnUse',orient:'auto'},h('path',{d:'M 1 1 L 10 6 L 1 11 Z',fill:'#fff9d9',stroke:'#6c22d0','stroke-width':1.2}))),
      h('ellipse',{className:'tutorial-target',cx:geometry.endX,cy:geometry.endY,rx:19,ry:16}),
      h('path',{className:'tutorial-route-edge',d:curve.path}),h('path',{className:'tutorial-route-line',d:curve.path,'marker-end':'url(#tutorial-tip)'})),
    geometry && h('div',{className:'tutorial-carrier',ref:carrier},
      h('img',{className:'tutorial-ghost-magnet',src:art('magnet-'+color),alt:'',draggable:false}),
      h('img',{className:'tutorial-drag-hand',src:art('tutorial-hand'),alt:'',draggable:false})));
}
