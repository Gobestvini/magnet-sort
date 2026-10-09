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
      const duration = reduced ? .08 : .22;
      segments.push({ ...event, start: cursor, end: cursor + duration });
      cursor += duration;
      groupEnd = cursor;
    }
  }
  return { before, after: resolution.state, magnet: resolution.magnet, segments, reduced,
    duration: Math.max(cursor, groupEnd) + (reduced ? .04 : .12) };
}

export function sampleTransferTimeline(timeline, time) {
  const poses = new Map();
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
      const progress = Math.min(1, (time - segment.start) / (segment.end - segment.start));
      for (const unit of segment.units) {
        if (progress >= 1) poses.delete(unit.id);
        else if (poses.has(unit.id)) poses.get(unit.id).scale = 1 - progress;
      }
    }
  }
  return { units: [...poses.values()], magnet: time < timeline.duration ? timeline.magnet : null,
    complete: time >= timeline.duration };
}
