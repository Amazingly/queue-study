/*
 * timer.test.js — the single active-time clock of §4.8: runs only while
 * visible with the instructions panel closed and the decision unlocked;
 * hidden and instruction time never consume the decision window; the
 * per-round instruction pause is capped; paradata partitions wall time.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createActiveClock } from "../assets/timer.js";

const LIMIT = 60000;
const CAP = 120000;

function clockAt() {
  let t = 0;
  return {
    now: () => t,
    advance: (ms) => { t += ms; return t; },
    at: () => t
  };
}

function make(fake) {
  return createActiveClock({ limitMs: LIMIT, instructionCapMs: CAP, now: fake.now });
}

test("active time accrues only while running", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(10000);
  assert.equal(c.activeMsUsed(fake.at()), 10000);
  assert.equal(c.remainingMs(fake.at()), 50000);
});

test("hidden time pauses the clock and is recorded separately", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(5000);
  c.setVisible(false, fake.at());
  fake.advance(30000);                       // a phone call
  c.setVisible(true, fake.at());
  fake.advance(4000);
  const p = c.paradata(fake.at());
  assert.equal(p.active_rt_ms, 9000);
  assert.equal(p.hidden_ms, 30000);
  assert.equal(p.wall_rt_ms, 39000);
  assert.equal(c.expired(fake.at()), false);
});

test("instruction consultation pauses the clock and is counted", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(8000);
  c.setInstructionsOpen(true, fake.at());
  fake.advance(25000);
  c.setInstructionsOpen(false, fake.at());
  fake.advance(2000);
  const p = c.paradata(fake.at());
  assert.equal(p.active_rt_ms, 10000);
  assert.equal(p.instruction_ms, 25000);
  assert.equal(p.instruction_opens, 1);
  assert.equal(p.hidden_ms, 0);
});

test("no double pause: hiding the page while instructions are open (panel closed first per §4.8)", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(10000);
  c.setInstructionsOpen(true, fake.at());
  fake.advance(5000);
  // §4.8 order on hide: close the panel, then report hidden.
  c.setInstructionsOpen(false, fake.at());
  c.setVisible(false, fake.at());
  fake.advance(20000);
  c.setVisible(true, fake.at());
  fake.advance(1000);
  const p = c.paradata(fake.at());
  assert.equal(p.active_rt_ms, 11000);
  assert.equal(p.instruction_ms, 5000);
  assert.equal(p.hidden_ms, 20000);
  // Partition: active + instruction + hidden = wall.
  assert.equal(p.active_rt_ms + p.instruction_ms + p.hidden_ms, p.wall_rt_ms);
});

test("instruction pause budget caps at 120 seconds per round", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  c.setInstructionsOpen(true, fake.at());
  fake.advance(119000);
  assert.equal(c.instructionCapReached(fake.at()), false);
  fake.advance(1000);
  assert.equal(c.instructionCapReached(fake.at()), true);
});

test("expiry is driven by ACTIVE time only, never by wall time", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(30000);                       // 30s active
  c.setVisible(false, fake.at());
  fake.advance(600000);                      // 10 hidden minutes
  c.setVisible(true, fake.at());
  assert.equal(c.expired(fake.at()), false); // only 30s consumed
  fake.advance(29000);
  assert.equal(c.expired(fake.at()), false);
  fake.advance(1000);
  assert.equal(c.expired(fake.at()), true);
  assert.equal(c.remainingMs(fake.at()), 0);
});

test("locking freezes every counter at the decision moment", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  fake.advance(12000);
  c.lock(fake.at());
  fake.advance(500000);
  const p = c.paradata(fake.at());
  assert.equal(p.active_rt_ms, 12000);
  assert.equal(c.isLocked(), true);
});

test("multiple instruction opens accumulate opens and milliseconds", () => {
  const fake = clockAt();
  const c = make(fake);
  c.start(fake.at());
  for (let i = 0; i < 3; i++) {
    fake.advance(1000);
    c.setInstructionsOpen(true, fake.at());
    fake.advance(2000);
    c.setInstructionsOpen(false, fake.at());
  }
  const p = c.paradata(fake.at());
  assert.equal(p.instruction_opens, 3);
  assert.equal(p.instruction_ms, 6000);
  assert.equal(p.active_rt_ms, 3000);
});
