/*
 * Single active-time decision clock (§4.8).
 *
 * One clock per decision round. The clock accumulates *active* time only:
 * it runs exactly when the page is visible, the instructions panel is
 * closed, and the decision is not locked. There are no overlapping
 * counters; hidden time and instruction time are recorded as separate
 * paradata streams derived from the same event log, so
 * active + hidden + instruction-visible time partitions wall time.
 *
 * The module is DOM-free and takes an injectable clock so its arithmetic
 * is unit-testable (tests/timer.test.js). app.js wires it to
 * document.visibilityState and to the instructions panel, and enforces
 * the §4.8 rules: when the page hides, the panel is closed first, then
 * visibility is reported here; the per-round instruction pause is capped
 * (PUBLIC_CONFIG.INSTRUCTION_PAUSE_LIMIT_SECONDS) — once
 * instructionMsUsed() reaches the cap, the caller closes the panel and
 * the clock resumes.
 */

export function createActiveClock({ limitMs, instructionCapMs, now }) {
  const clock = typeof now === "function" ? now : () => performance.now();

  let startedAt = null;        // wall-clock start of the round
  let visible = true;
  let instructionsOpen = false;
  let locked = false;

  let activeMs = 0;
  let runningSince = null;     // set while the active clock is running

  let hiddenMs = 0;
  let hiddenSince = null;

  let instructionMs = 0;
  let instructionSince = null;
  let instructionOpens = 0;

  function running() {
    return startedAt !== null && !locked && visible && !instructionsOpen;
  }

  function settle(at) {
    if (runningSince !== null) {
      activeMs += Math.max(0, at - runningSince);
      runningSince = null;
    }
  }

  function reconsider(at) {
    if (running()) {
      if (runningSince === null) runningSince = at;
    } else {
      settle(at);
    }
  }

  return {
    start(at = clock()) {
      if (startedAt !== null) return;
      startedAt = at;
      reconsider(at);
    },

    /* Page visibility. Callers close the instructions panel BEFORE
     * reporting hidden (§4.8 order: close panel, stop clock, record). */
    setVisible(isVisible, at = clock()) {
      if (visible === isVisible) return;
      visible = isVisible;
      if (!isVisible) {
        hiddenSince = at;
      } else if (hiddenSince !== null) {
        hiddenMs += Math.max(0, at - hiddenSince);
        hiddenSince = null;
      }
      reconsider(at);
    },

    setInstructionsOpen(isOpen, at = clock()) {
      if (instructionsOpen === isOpen) return;
      instructionsOpen = isOpen;
      if (isOpen) {
        instructionOpens += 1;
        instructionSince = at;
      } else if (instructionSince !== null) {
        instructionMs += Math.max(0, at - instructionSince);
        instructionSince = null;
      }
      reconsider(at);
    },

    lock(at = clock()) {
      if (locked) return;
      settle(at);
      // Close out open paradata intervals at the moment of the decision.
      if (hiddenSince !== null) { hiddenMs += Math.max(0, at - hiddenSince); hiddenSince = null; }
      if (instructionSince !== null) { instructionMs += Math.max(0, at - instructionSince); instructionSince = null; }
      locked = true;
    },

    activeMsUsed(at = clock()) {
      let total = activeMs;
      if (runningSince !== null) total += Math.max(0, at - runningSince);
      return Math.round(total);
    },

    remainingMs(at = clock()) {
      return Math.max(0, limitMs - this.activeMsUsed(at));
    },

    expired(at = clock()) {
      return this.activeMsUsed(at) >= limitMs;
    },

    instructionMsUsed(at = clock()) {
      let total = instructionMs;
      if (instructionSince !== null) total += Math.max(0, at - instructionSince);
      return Math.round(total);
    },

    /* True once the per-round instruction pause budget is exhausted;
     * the caller must then close the panel (which resumes the clock). */
    instructionCapReached(at = clock()) {
      return this.instructionMsUsed(at) >= instructionCapMs;
    },

    wallMs(at = clock()) {
      return startedAt === null ? 0 : Math.round(Math.max(0, at - startedAt));
    },

    /* Timing paradata transmitted with the decision (§4.8). Only the
     * choice affects the economic transition; these fields are paradata. */
    paradata(at = clock()) {
      let hid = hiddenMs;
      if (hiddenSince !== null) hid += Math.max(0, at - hiddenSince);
      return {
        active_rt_ms: this.activeMsUsed(at),
        wall_rt_ms: this.wallMs(at),
        hidden_ms: Math.round(hid),
        instruction_ms: this.instructionMsUsed(at),
        instruction_opens: instructionOpens
      };
    },

    isLocked() { return locked; }
  };
}
