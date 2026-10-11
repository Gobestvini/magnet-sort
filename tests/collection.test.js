import test from 'node:test';
import assert from 'node:assert/strict';
import { prototypeLevels } from '../src/prototype/levels.js';
import { createPrototypeState, applyMagnet } from '../src/prototype/model.js';
import { makeTransferTimeline, sampleTransferTimeline } from '../src/prototype/motion.js';

for (const reduced of [false, true]) test(`collection preserves IDs and credits only arrivals (reduced=${reduced})`, () => {
  const level = prototypeLevels[0], before = createPrototypeState(level);
  const result = applyMagnet(before, level.solution[0]);
  const timeline = makeTransferTimeline(before, result, reduced);
  const batches = timeline.segments.filter(segment => segment.type === 'unitsCleared');
  const flights = batches.flatMap(segment => segment.flights);
  assert.equal(flights.length, result.state.cleared);
  assert.equal(new Set(flights.map(flight => flight.unit.id)).size, flights.length);
  for (const batch of batches) {
    const start = sampleTransferTimeline(timeline, batch.start);
    const packed = sampleTransferTimeline(timeline, batch.packEnd);
    const ids = new Set(batch.units.map(unit => unit.id));
    assert.ok(batch.flights[0].start >= batch.packEnd, 'compaction finishes before collection flight');
    assert.ok(start.units.filter(unit => ids.has(unit.id)).every(unit => unit.pack === 0 && !unit.collecting));
    assert.ok(packed.units.filter(unit => ids.has(unit.id)).every(unit => unit.pack === 1));
    const halfway = sampleTransferTimeline(timeline, (batch.start + batch.packEnd) / 2);
    assert.ok(halfway.units.filter(unit => ids.has(unit.id)).every(unit => Math.abs(unit.pack - .5) < 1e-10 && !unit.collecting));
    assert.equal(halfway.collected, start.collected, 'compaction does not prematurely award units');
    assert.equal(packed.bursts.length, 1, 'completion of compaction starts the accent');
    assert.deepEqual(batch.flights.map(flight => flight.index), [5, 4, 3, 2, 1, 0], 'top piece leaves first');
    for (const flight of batch.flights) {
      const launched = sampleTransferTimeline(timeline, flight.start);
      assert.equal(launched.units.find(unit => unit.id === flight.unit.id)?.collecting, true);
      assert.ok(sampleTransferTimeline(timeline, flight.end - 1e-7).units.some(unit => unit.id === flight.unit.id));
      assert.ok(!sampleTransferTimeline(timeline, flight.end).units.some(unit => unit.id === flight.unit.id));
    }
  }
  for (let time = 0; time <= timeline.duration; time += 1 / 120) {
    const frame = sampleTransferTimeline(timeline, time);
    assert.equal(frame.collected, before.cleared + flights.filter(flight => flight.end <= time).length);
    assert.equal(frame.units.length + frame.collected, before.initialUnits);
    assert.equal(new Set(frame.units.map(unit => unit.id)).size, frame.units.length);
    assert.equal(sampleTransferTimeline(timeline, time).collected, frame.collected, 'sampling/pause cannot credit twice');
  }
  const last = flights.at(-1);
  assert.equal(sampleTransferTimeline(timeline, last.end - 1e-7).complete, false);
  const final = sampleTransferTimeline(timeline, timeline.duration);
  assert.equal(final.collected, result.state.cleared);
  assert.deepEqual(final.units, []);
  assert.equal(final.complete, true);
});
