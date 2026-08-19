/*
 * api-idempotency.test.js — the acknowledged transport of §4.6: stable
 * request_id across retries, nonce-bound receipt acceptance, bounded
 * retry schedule, and non-retryable domain errors failing fast.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildEnvelope, acceptMessage, retryDelayMs, apiCall, ApiError, newId, uuidV4FromBytes } from "../assets/api.js";
import { PUBLIC_CONFIG } from "../assets/config.js";

test("buildEnvelope carries version, action, request_id, nonce, and payload", () => {
  const env = buildEnvelope("decision", { round: 7 }, "rid-1", "nonce-1");
  assert.equal(env.api_version, 1);
  assert.equal(env.app_version, PUBLIC_CONFIG.APP_VERSION);
  assert.equal(env.action, "decision");
  assert.equal(env.request_id, "rid-1");
  assert.equal(env.nonce, "nonce-1");
  assert.deepEqual(env.payload, { round: 7 });
});

function receipt(overrides) {
  return {
    data: {
      type: "QUEUE_API_RESPONSE",
      request_id: "rid-1",
      nonce: "n-1",
      ok: true,
      ...overrides
    },
    origin: "null",
    source: {}
  };
}

const PENDING = { requestId: "rid-1", nonce: "n-1", iframeWindow: { tag: "frame" } };

test("acceptMessage requires the exact request_id AND nonce", () => {
  assert.equal(acceptMessage(PENDING, receipt({})), true);
  assert.equal(acceptMessage(PENDING, receipt({ request_id: "rid-2" })), false);
  assert.equal(acceptMessage(PENDING, receipt({ nonce: "wrong" })), false);
  assert.equal(acceptMessage(PENDING, receipt({ type: "SOMETHING_ELSE" })), false);
});

test("acceptMessage accepts our frame's window regardless of origin", () => {
  const event = { data: receipt({}).data, origin: "https://evil.example", source: PENDING.iframeWindow };
  assert.equal(acceptMessage(PENDING, event), true);
});

test("acceptMessage accepts known Apps Script origins (including sandboxed 'null')", () => {
  for (const origin of ["https://script.google.com", "https://script.googleusercontent.com", "null"]) {
    const event = { data: receipt({}).data, origin, source: {} };
    assert.equal(acceptMessage(PENDING, event), true, origin);
  }
});

test("acceptMessage rejects an unknown origin from a foreign window even with a stolen shape", () => {
  const event = { data: receipt({}).data, origin: "https://evil.example", source: { other: true } };
  assert.equal(acceptMessage(PENDING, event), false);
});

test("retry delays are positive, non-decreasing, and bounded", () => {
  let prev = 0;
  for (let i = 0; i < 10; i++) {
    const d = retryDelayMs(i);
    assert.ok(d >= prev && d > 0 && d <= 8000);
    prev = d;
  }
});

test("apiCall retries a timeout with the SAME request_id and succeeds", async () => {
  const seen = [];
  const attempt = async (action, payload, requestId) => {
    seen.push(requestId);
    if (seen.length < 3) throw new ApiError("API_TIMEOUT", true);
    return { ok: true, request_id: requestId, data: { done: true } };
  };
  const t0 = Date.now();
  const result = await apiCall("decision", { round: 1 }, { attempt, requestId: "rid-fixed", maxAttempts: 5 });
  assert.deepEqual(result.data, { done: true });
  assert.equal(result.requestId, "rid-fixed");
  assert.equal(seen.length, 3);
  assert.ok(seen.every((id) => id === "rid-fixed"), "request_id must never change across retries");
  assert.ok(Date.now() - t0 >= 3000, "backoff delays must actually elapse");
});

test("apiCall fails fast on a non-retryable domain error", async () => {
  let calls = 0;
  const attempt = async () => { calls += 1; throw new ApiError("STALE_EVENT", false); };
  await assert.rejects(
    () => apiCall("decision", {}, { attempt, maxAttempts: 5 }),
    (err) => err instanceof ApiError && err.code === "STALE_EVENT"
  );
  assert.equal(calls, 1);
});

test("apiCall exhausts retryable attempts then rejects with the last error", async () => {
  let calls = 0;
  const attempt = async () => { calls += 1; throw new ApiError("SERVER_BUSY", true); };
  await assert.rejects(
    () => apiCall("decision", {}, { attempt, maxAttempts: 2 }),
    (err) => err instanceof ApiError && err.code === "SERVER_BUSY"
  );
  assert.equal(calls, 2);
});

test("UUID fallback produces a canonical RFC 4122 v4 identifier", () => {
  const id = uuidV4FromBytes(Uint8Array.from({ length: 16 }, (_, i) => i));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("a generated request id is a UUID (idempotency key quality)", async () => {
  let captured = null;
  const attempt = async (a, p, requestId) => { captured = requestId; return { ok: true, data: {} }; };
  await apiCall("heartbeat", {}, { attempt, maxAttempts: 1 });
  assert.match(captured, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
