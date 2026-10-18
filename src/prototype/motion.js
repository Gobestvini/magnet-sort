import { SOURCE_LIGHT_FADE } from './source-light.js';
// Tuned for the attached video's rapid, staggered neighbour-to-neighbour flip.
// These values are our animation profile, not measured reference timings.
export function makeTransferTimeline(before, resolution, reduced = false) {
  const flight = reduced ? .09 : .28;
  const stagger = reduced ? .045 : .105;
  const segments = [];
  const deactivation = before.rulesVersion===4 ? (reduced ? .08 : SOURCE_LIGHT_FADE) : (reduced ? .04 : .24);
  const activationEnd = reduced ? .06 : .30;
  let cursor = activationEnd;
  let deactivateStart = null, deactivateEnd = null;
  let batch = null, groupStart = cursor, count = 0, groupEnd = cursor;
  for (const event of resolution.events) {
    if (event.batch !== batch) {
      cursor = Math.max(cursor, groupEnd);
      groupStart = cursor;
      count = 0;
      batch = event.batch;
    }
    if (event.type === 'unitMoved') {
      const start = groupStart + count++ * stagger;
      segments.push({ ...event, start, end: start + flight });
      groupEnd = start + flight;
    } else if (event.type === 'unitsCleared') {
      cursor = groupEnd;
      const accentStart = cursor;
      const packStart = cursor + (reduced ? .025 : .24);
      cursor = packStart;
      const collectDuration = reduced ? .09 : .56;
      const collectStagger = reduced ? .018 : .05;
      const packEnd = cursor + (reduced ? .04 : .48);
      const pieceDuration = reduced ? .02 : .20;
      const pieceStagger = (packEnd - cursor - pieceDuration) / Math.max(1, event.units.length - 1);
      const launch = packEnd + (reduced ? 0 : .07);
      const flights = [...event.units].reverse().map((unit, index) => ({ unit,
        packStart: cursor + index * pieceStagger, packEnd: cursor + index * pieceStagger + pieceDuration,
        index: event.units.length - 1 - index, start: launch + index * collectStagger,
        end: launch + index * collectStagger + collectDuration }));
      const duration = flights.at(-1).end - cursor;
      segments.push({ ...event, flights, packEnd, packStart, accentStart, start: cursor, end: cursor + duration });
      cursor += duration;
      groupEnd = cursor;
    } else if (event.type === 'stackSpawned') {
      cursor = Math.max(cursor, groupEnd);
      if(deactivateStart===null){deactivateStart=cursor;deactivateEnd=cursor+deactivation;cursor=deactivateEnd;}
      segments.push({ ...event, start: cursor, end: cursor + (reduced ? .04 : .18) });
      cursor = segments.at(-1).end; groupEnd = cursor;
    } else if (event.type === 'magnetsChanged') {
      cursor = Math.max(cursor, groupEnd);
      if(deactivateStart===null){deactivateStart=cursor;deactivateEnd=cursor+deactivation;cursor=deactivateEnd;}
      segments.push({ ...event, start: cursor, end: cursor + (reduced ? .04 : .24) });
      cursor = segments.at(-1).end; groupEnd = cursor;
    } else {
      throw new Error('Unknown presentation event: ' + event.type);
    }
  }
  if(deactivateStart===null){deactivateStart=Math.max(cursor,groupEnd);deactivateEnd=deactivateStart+deactivation;cursor=deactivateEnd;}
  const groups=new Map();
  for(const s of segments.filter(s=>s.type==='unitMoved')){
    if(!groups.has(s.batch))groups.set(s.batch,{start:s.start,end:s.end,cells:new Set()});
    const group=groups.get(s.batch);group.end=Math.max(group.end,s.end);
    group.cells.add(`${s.from.row}:${s.from.col}`);group.cells.add(`${s.to.row}:${s.to.col}`);
  }
  return { before, after: resolution.state, magnet: resolution.magnet, influence:resolution.influence, segments, reduced,
    transferGroups:[...groups.values()].map(g=>({...g,cells:[...g.cells]})),
    activationEnd, deactivateStart, deactivateEnd,
    queueStart: segments.find(s=>s.type==='magnetsChanged')?.start ?? Infinity,
    duration: Math.max(cursor, groupEnd) + (reduced ? .04 : .38) };
}

const smooth = p => p * p * (3 - 2 * p);
// Lift first, turn through one edge, then place the other face flat.
// The face changes at the edge-on instant; the resting artwork stays upright.
export function sampleHexFlip(progress, reduced = false) {
  const p = Math.max(0, Math.min(1, progress));
  if (reduced) return { travel: smooth(p), lift: 0, angle: 0, reverseFace: false };
  const turn = smooth(Math.max(0, Math.min(1, (p - .12) / .76)));
  const travel = smooth(Math.max(0, Math.min(1, (p - .08) / .84)));
  const lift = p < .22 ? .48 * smooth(p / .22)
    : p < .72 ? .48 + .10 * Math.sin((p - .22) / .5 * Math.PI)
    : .48 * (1 - smooth((p - .72) / .28));
  return { travel, lift, angle: -Math.PI * turn, reverseFace: turn > .5 };
}

// V4 uses a short rocking hop. The complete raster keeps its authored face;
// it never changes sides at an edge-on instant or exposes a lit underside.
export function sampleHexTransfer(progress, reduced = false) {
  const p=Math.max(0,Math.min(1,progress));
  if(reduced)return {travel:smooth(p),lift:0,angle:0,reverseFace:false};
  const arc=Math.sin(Math.PI*smooth(p));
  return {travel:smooth(p),lift:.28*arc,angle:-Math.PI/6*arc,reverseFace:false};
}

// Only presentation changes: IDs/counts stay intact as layers gather downward.
export function collectionPacking(pack = 0) {
  return { pitch: 1 - pack * .94, scale: 1 - pack * .62 };
}

export function sampleTransferTimeline(timeline, time) {
  const poses = new Map();
  let collected = timeline.before.cleared, lastArrival = null;
  const bursts = [];
  const hiddenCells=new Set(), clearBadges=[];
  for(const group of timeline.transferGroups)if(time>=group.start&&time<=group.end)for(const cell of group.cells)hiddenCells.add(cell);
  for(const segment of timeline.segments){
    if(segment.type==='unitsCleared'){
      if(time>=segment.accentStart&&time<segment.packStart)clearBadges.push({cell:segment.cell,count:segment.units.length});
      if(time>=segment.packStart&&time<segment.end)hiddenCells.add(`${segment.cell.row}:${segment.cell.col}`);
    }
  }
  for (const stack of timeline.before.stacks) stack.units.forEach((unit, index) => {
    poses.set(unit.id, { ...unit, cell: stack.cell, index, scale: 1 });
  });
  for (const segment of timeline.segments) {
    if (time < segment.start) continue;
    if (segment.type === 'unitMoved') {
      if (time >= segment.end) poses.set(segment.unit.id, { ...segment.unit, cell: segment.to, index: segment.toIndex, scale: 1 });
      else poses.set(segment.unit.id, { ...segment.unit, from: segment.from, to: segment.to,
        fromIndex: segment.fromIndex, toIndex: segment.toIndex, scale: 1,
        progress: (time - segment.start) / (segment.end - segment.start) });
    } else if (segment.type === 'stackSpawned') {
      const scale = smooth(Math.min(1,(time-segment.start)/(segment.end-segment.start)));
      segment.units.forEach((unit,index)=>poses.set(unit.id,{...unit,cell:segment.cell,index,scale}));
    } else if (segment.type === 'unitsCleared') {
      const packs = segment.flights.map(flight => {
        const p = Math.max(0, Math.min(1, (time - flight.packStart) / (flight.packEnd - flight.packStart)));
        return { ...flight, pack: p * p * (3 - 2 * p) };
      });
      const burstAge = time - segment.packEnd;
      if (burstAge >= 0 && burstAge < .36) bursts.push({ cell: segment.cell, color: segment.units[0].color, age: burstAge });
      for (const flight of packs) {
        // Height is the sum of the layers underneath. An upper hex cannot
        // shrink down through another hex whose animation has not started.
        const layer = packs.filter(lower => lower.index < flight.index)
          .reduce((height, lower) => height + collectionPacking(lower.pack).pitch, 0);
        if (time >= flight.end) {
          poses.delete(flight.unit.id); collected++;
          lastArrival = Math.max(lastArrival ?? 0, flight.end);
        } else if (time >= flight.start) {
          poses.set(flight.unit.id, { ...flight.unit, cell: segment.cell, index: flight.index,
            scale: 1, pack: 1, layer, collecting: true, progress: (time - flight.start) / (flight.end - flight.start) });
        } else {
          poses.set(flight.unit.id, { ...flight.unit, cell: segment.cell, index: flight.index, scale: 1, pack: flight.pack, layer });
        }
      }
    }
  }
  const magneticStrength=time<timeline.activationEnd?smooth(Math.max(0,time/timeline.activationEnd)):
    time<timeline.deactivateStart?1:time<timeline.deactivateEnd?1-smooth((time-timeline.deactivateStart)/(timeline.deactivateEnd-timeline.deactivateStart)):0;
  return { units: [...poses.values()], collected, lastArrival, bursts, hiddenCells:[...hiddenCells], clearBadges,
    magneticStrength, magneticPhase:time<timeline.activationEnd?'activation':time<timeline.deactivateStart?'active':time<timeline.deactivateEnd?'deactivation':'ordinary',
    magnet: time < timeline.deactivateEnd ? timeline.magnet : null,
    complete: time >= timeline.duration };
}
