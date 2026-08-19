/*
 * forbidden-patterns.test.js — the §11 release gate, enforced as a test
 * so the deploy workflow fails when production interface code contains
 * client-side experiment logic, hidden-state fields, planner weights,
 * forced-treatment parameters, unacknowledged transport, or raw-payload
 * display. Test files themselves are exempt (they must name the patterns
 * to forbid them).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const DEPLOYED = [
  "index.html",
  "join/index.html",
  "host/index.html",
  "privacy.html",
  "withdrawal.html",
  "assets/app.js",
  "assets/api.js",
  "assets/state.js",
  "assets/ui.js",
  "assets/timer.js",
  "assets/host.js",
  "assets/config.js",
  "assets/translations-en.js",
  "assets/translations-vi.js",
  "assets/styles.css"
];

/* Vendored, unmodified third-party library (QR encoder). Held to the
 * hidden-state and experiment-logic bans, but exempt from stylistic
 * client conventions since it is not our interface code. */
const VENDORED = ["assets/qrcode.js"];

/* §11 list, §4.2 removals, and §4.7 hidden-state names. */
const FORBIDDEN = [
  "assignTreatment(",
  "buildPlan(",
  "nextLoadAfter(",
  "socialValue(",
  "Math.random(",
  "?t=",
  "FATIGUE_COST_HIGH",
  "SOCIAL_VALUE_H",
  "SOCIAL_VALUE_L",
  "H_PROB",
  "RECOVERY_PROB",
  "theorem_cost",
  "social_score",
  "planner_cost",
  'mode: "no-cors"',
  "no-cors",
  "actual_type",
  "future_types",
  "recovery_draw",
  "recovery_u",
  "future_recovery_draws",
  "sequence_id",
  "url_forced",
  "url_treatment",
  "prolific_pid",
  "hardwareConcurrency",
  "document.referrer"
];

/* Hidden-state and experiment-logic bans apply to vendored code too. */
const HIDDEN_STATE_BANS = [
  "assignTreatment(", "buildPlan(", "nextLoadAfter(", "Math.random(",
  "actual_type", "future_types", "recovery_draw", "recovery_u",
  "sequence_id", "theorem_cost", "social_score", "planner_cost", "no-cors"
];

for (const file of DEPLOYED) {
  test("deployed file is free of forbidden patterns: " + file, () => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const pattern of FORBIDDEN) {
      assert.equal(
        text.includes(pattern), false,
        file + " contains forbidden pattern: " + pattern
      );
    }
  });
}

for (const file of VENDORED) {
  test("vendored file is free of hidden-state and experiment logic: " + file, () => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const pattern of HIDDEN_STATE_BANS) {
      assert.equal(text.includes(pattern), false, file + " contains banned pattern: " + pattern);
    }
  });
}

test("persistent storage is confined to recovery and host-key records", () => {
  // localStorage is permitted in exactly two interface modules: state.js
  // (the participant's device-bound resume credential, which must survive
  // a closed tab under shared-QR entry) and host.js (the coauthor's host
  // key, so she can bookmark the bare control page). Nowhere else.
  const allowed = { "assets/state.js": true, "assets/host.js": true };
  for (const file of DEPLOYED) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    if (file === "assets/state.js") {
      assert.match(text, /localStorage\.setItem\(STORAGE_KEY/);
      assert.match(text, /localStorage\.setItem\(PENDING_ENTRY_KEY/);
      continue;
    }
    if (allowed[file]) continue;
    assert.equal(text.includes("localStorage"), false, file + " must not touch localStorage");
  }
});

test("no raw-payload fallback: the client never renders JSON into a textarea (§4.11)", () => {
  const app = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
  assert.doesNotMatch(app, /textarea[^]{0,200}JSON\.stringify/);
  assert.doesNotMatch(app, /JSON\.stringify\(buildPayload/);
});

test("index.html enforces CSP, no-referrer, and noindex (§4.4–§4.5)", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /form-action https:\/\/script\.google\.com/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(html, /<script>[^<]/, "no inline scripts under script-src 'self'");
});

test("robots.txt disallows all crawling (§4.4)", () => {
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Disallow: \//);
});

test("the public config carries no experimental randomness parameters (§4.2)", () => {
  const config = fs.readFileSync(path.join(root, "assets/config.js"), "utf8");
  assert.match(config, /API_URL/);
  assert.match(config, /PARENT_ORIGIN/);
  // Display constants are allowed; generator parameters are not.
  assert.doesNotMatch(config, /Bernoulli|seed|SEED/);
});

test("client modules never read URL treatment parameters", () => {
  for (const file of ["assets/app.js", "assets/state.js", "assets/api.js"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(text, /get\("t"\)|get\('t'\)/, file);
  }
});

test("the device descriptor transmits only the §6.4 minimized fields", async () => {
  const { deviceDescriptor } = await import("../assets/state.js");
  const fakeWin = {
    innerWidth: 390, innerHeight: 800,
    navigator: { maxTouchPoints: 5, userAgent: "Mozilla/5.0 (iPhone) Safari/605.1" }
  };
  const d = deviceDescriptor(fakeWin);
  assert.deepEqual(Object.keys(d).sort(), [
    "browser_family", "device_class", "timezone_offset_minutes",
    "viewport_width_band", "viewport_height_band"
  ].sort());
  assert.equal(d.device_class, "mobile");
  assert.equal(d.viewport_width_band, "lt400");
  // The raw user-agent string itself is never part of the payload.
  assert.equal(Object.values(d).includes(fakeWin.navigator.userAgent), false);
});
