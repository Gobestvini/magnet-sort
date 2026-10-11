// Tuned for the attached video's rapid, staggered neighbour-to-neighbour flip.
// These values are our animation profile, not measured reference timings.
export function makeTransferTimeline(before, resolution, reduced = false) {
  const flight = reduced ? .09 : .19;
  const stagger = reduced ? .045 : .055;
  const segments = [];
  let cursor = reduced ? .06 : .16;
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
    } else {
      cursor = groupEnd;
      const collectDuration = reduced ? .09 : .56;
      const collectStagger = reduced ? .018 : .05;
      const packEnd = cursor + (reduced ? .04 : .48);
      const launch = packEnd + (reduced ? 0 : .07);
      const flights = [...event.units].reverse().map((unit, index) => ({ unit,
        index: event.units.length - 1 - index, start: launch + index * collectStagger,
        end: launch + index * collectStagger + collectDuration }));
      const duration = flights.at(-1).end - cursor;
      segments.push({ ...event, flights, packEnd, start: cursor, end: cursor + duration });
      cursor += duration;
      groupEnd = cursor;
    }
  }
  return { before, after: resolution.state, magnet: resolution.magnet, segments, reduced,
    duration: Math.max(cursor, groupEnd) + (reduced ? .04 : .38) };
}

// Only presentation changes: IDs/counts stay intact as layers gather downward.
export function collectionPacking(pack = 0) {
  return { pitch: 1 - pack * .94, scale: 1 - pack * .32 };
}

export function sampleTransferTimeline(timeline, time) {
  const poses = new Map();
  let collected = timeline.before.cleared, lastArrival = null;
  const bursts = [];
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
    } else {
      const p = Math.min(1, (time - segment.start) / (segment.packEnd - segment.start));
      const pack = p * p * (3 - 2 * p);
      const burstAge = time - segment.packEnd;
      if (burstAge >= 0 && burstAge < .36) bursts.push({ cell: segment.cell, color: segment.units[0].color, age: burstAge });
      for (const flight of segment.flights) {
        if (time >= flight.end) {
          poses.delete(flight.unit.id); collected++;
          lastArrival = Math.max(lastArrival ?? 0, flight.end);
        } else if (time >= flight.start) {
          poses.set(flight.unit.id, { ...flight.unit, cell: segment.cell, index: flight.index,
            scale: 1, pack: 1, collecting: true, progress: (time - flight.start) / (flight.end - flight.start) });
        } else {
          poses.set(flight.unit.id, { ...flight.unit, cell: segment.cell, index: flight.index, scale: 1, pack });
        }
      }
    }
  }
  return { units: [...poses.values()], collected, lastArrival, bursts, magnet: time < timeline.duration ? timeline.magnet : null,
    complete: time >= timeline.duration };
}
