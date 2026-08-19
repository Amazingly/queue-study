/*
 * Classroom host control — on-demand sessions.
 *
 * The coauthor opens this page from a private link that carries her host
 * key (?host=qh_...). One tap opens a live session: the server issues a
 * fresh six-digit code and begins drawing from the frozen pool; this page
 * shows the code large, plus a QR that deep-links students straight to
 * the entry screen with the code prefilled. She projects it, and closes
 * the session (or lets it auto-expire) when class ends. No advance
 * planning, no dependence on the coordinator.
 *
 * Transport is the shared acknowledged iframe channel (api.js); the host
 * key authorizes only host_open/host_close/host_status.
 *
 * Robustness for classroom projection (deliberate design):
 *   - Polling runs ONLY while a session is open. On the pre-open setup
 *     screen there is no timer, so a typed session name and the chosen
 *     auto-close time are never wiped or silently reverted mid-edit.
 *   - While a session is open, a transient status-poll failure NEVER tears
 *     down the projected code/QR; it shows a small "reconnecting" note and
 *     keeps the code on screen (it is still valid on the server). Only a
 *     permanent error (bad/expired link, unsupported version, pool not set
 *     up) replaces the screen.
 */

import { apiCall, ApiError } from "./api.js";
import { esc, el } from "./ui.js";

const HOST_KEY_STORE = "queue_study_host_key_v1";
const POLL_MS = 15000;

function readHostKey() {
  let key = null;
  try {
    const params = new URLSearchParams(window.location.search);
    key = params.get("host");
    if (key) {
      localStorage.setItem(HOST_KEY_STORE, key);
      params.delete("host");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState(null, "", clean);
    } else {
      key = localStorage.getItem(HOST_KEY_STORE);
    }
  } catch (e) { /* private mode */ }
  return key || null;
}

let hostKey = null;
let pollTimer = null;
let view = null;      // "form" | "open" | "fatal" | "offline"
let openCode = null;  // the code currently projected, to detect changes

/* The participant entry URL that the projected QR encodes: the site root
 * with the gateway flag and the current code prefilled. Derived from this
 * page's own location (…/queue-study/host/ → …/queue-study/). */
function joinUrlFor(code) {
  const root = new URL("../", window.location.href).href;
  return root + "?entry=join&c=" + encodeURIComponent(code);
}

function qrSvg(text) {
  const qr = globalThis.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function mount(html) {
  el("host").innerHTML = html;
}

function controlsHtml(status) {
  const open = status && status.open;
  const remaining = status ? status.places_remaining : 0;
  const total = status ? status.total_places : 0;
  let html =
    '<div class="card"><h2>Classroom control / Điều khiển lớp học</h2>' +
    '<p class="muted">Pool places remaining / Số suất còn lại: <strong>' + remaining + " / " + total + "</strong>" +
    (status && !status.collection_open ? ' — <span class="error">collection is closed / chưa mở thu thập</span>' : "") +
    "</p>";

  if (!open) {
    html +=
      '<div class="q"><p>Optional session name / Tên buổi học (không bắt buộc)</p>' +
      '<input type="text" id="label" maxlength="60" placeholder="e.g. Prof A, Econ 101"></div>' +
      '<div class="q"><p>Auto-close after / Tự đóng sau</p>' +
      '<select id="minutes">' +
      '<option value="90">90 minutes (recommended) / 90 phút (khuyến nghị)</option>' +
      '<option value="120">120 minutes / 120 phút</option>' +
      '<option value="60">60 minutes / 60 phút</option>' +
      '<option value="0">Do not auto-close (I will close it) / Không tự đóng (tôi sẽ tự đóng)</option>' +
      "</select></div>" +
      '<p id="host_err" class="error hidden"></p>' +
      '<div class="choices"><button id="btn_open" type="button">Open a session now / Mở buổi học ngay</button></div>' +
      "</div>";
    return html;
  }

  const join = joinUrlFor(status.code);
  html +=
    '<p><strong>Students scan this, or go to the study page and enter the code. / ' +
    'Sinh viên quét mã này, hoặc mở trang nghiên cứu và nhập mã.</strong></p>' +
    '<div class="qr-project">' + qrSvg(join) + "</div>" +
    '<p class="host-code">' + esc(status.code) + "</p>" +
    '<p class="muted">Session / Buổi: ' + esc(status.batch) + "</p>" +
    '<p>Joined this session / Đã tham gia: <strong id="joined">' + status.joined_this_session + "</strong>" +
    '  ·  Remaining / Còn lại: <strong id="remaining">' + status.places_remaining + "</strong></p>" +
    '<p class="muted" id="expires">' +
      (status.expires_at ? "Auto-closes / Tự đóng: " + esc(formatLocal(status.expires_at)) : "") + "</p>" +
    '<p id="live_note" class="muted"></p>' +
    '<div class="choices">' +
    '<button id="btn_full" type="button" class="secondary">Full screen / Toàn màn hình</button>' +
    '<button id="btn_close" type="button" class="secondary">Close session / Đóng buổi học</button>' +
    "</div></div>";
  return html;
}

function formatLocal(iso) {
  try { return new Date(iso).toLocaleTimeString(); } catch (e) { return iso; }
}

function wire(status) {
  if (!status || !status.open) {
    const openBtn = el("btn_open");
    if (openBtn) openBtn.addEventListener("click", openSession);
  } else {
    const closeBtn = el("btn_close");
    if (closeBtn) closeBtn.addEventListener("click", closeSession);
    const fullBtn = el("btn_full");
    if (fullBtn) fullBtn.addEventListener("click", () => {
      const target = document.documentElement;
      if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
    });
  }
}

function showError(message) {
  const box = el("host_err");
  if (box) { box.textContent = message; box.classList.remove("hidden"); }
}

function liveNote(message) {
  const box = el("live_note");
  if (box) box.textContent = message || "";
}

/* Render the authoritative status. While a session stays open with the same
 * code, update only the live counters in place — never regenerate the QR
 * (which would flicker on the projector) or tear down full-screen. */
function render(status) {
  if (status && status.open) {
    if (view !== "open" || openCode !== status.code) {
      mount(controlsHtml(status));
      wire(status);
      view = "open";
      openCode = status.code;
    } else {
      const j = el("joined"); if (j) j.textContent = status.joined_this_session;
      const r = el("remaining"); if (r) r.textContent = status.places_remaining;
      liveNote("");
    }
    ensurePolling();
    return;
  }
  // Not open: show the setup form once and stop polling so nothing the host
  // is typing or selecting gets wiped by a timer tick.
  mount(controlsHtml(status));
  wire(status);
  view = "form";
  openCode = null;
  stopPolling();
}

const FATAL_CODES = {
  HOST_KEY_INVALID: true, BAD_FIELD: true, UNEXPECTED_KEY: true,
  APP_VERSION_UNSUPPORTED: true, POOL_NOT_PROVISIONED: true
};

function fatalHtml(code) {
  if (code === "APP_VERSION_UNSUPPORTED") {
    return '<div class="card"><h2>This page is out of date / Trang này đã cũ</h2>' +
      "<p>Please refresh this page. If it still does not work, ask the study coordinator for the current control link. / " +
      "Vui lòng tải lại trang. Nếu vẫn lỗi, hãy hỏi điều phối viên liên kết điều khiển mới nhất.</p></div>";
  }
  if (code === "POOL_NOT_PROVISIONED") {
    return '<div class="card"><h2>The study is not ready yet / Nghiên cứu chưa sẵn sàng</h2>' +
      "<p>The self-service pool has not been set up. Please ask the study coordinator to set it up before class. / " +
      "Kho suất tự phục vụ chưa được thiết lập. Vui lòng nhờ điều phối viên thiết lập trước buổi học.</p></div>";
  }
  return '<div class="card"><h2>Control link not recognized / Không nhận diện được liên kết</h2>' +
    "<p>This classroom control link is not valid. Please use the exact link the study coordinator emailed you, " +
    "or ask them to re-send it. / Liên kết điều khiển không hợp lệ. Vui lòng dùng đúng liên kết điều phối viên đã gửi, " +
    "hoặc nhờ gửi lại.</p></div>";
}

function offlineHtml() {
  return '<div class="card"><h2>Cannot reach the study server / Không kết nối được máy chủ</h2>' +
    "<p>Please check your internet connection. This page will keep trying. / " +
    "Vui lòng kiểm tra kết nối mạng. Trang sẽ tiếp tục thử lại.</p>" +
    '<div class="choices"><button id="btn_retry" type="button">Retry now / Thử lại</button></div></div>';
}

async function refresh() {
  try {
    const { data } = await apiCall("host_status", { host_key: hostKey }, { maxAttempts: 2, timeoutMs: 12000 });
    render(data);
  } catch (err) {
    const code = err instanceof ApiError ? err.code : null;
    if (code && FATAL_CODES[code]) {
      mount(fatalHtml(code));
      view = "fatal";
      stopPolling();
      return;
    }
    // Transient/unknown failure. If a session is projected, keep it on
    // screen — the code is still valid server-side — and only note the blip.
    if (view === "open") {
      liveNote("Reconnecting… the code above is still valid. / Đang kết nối lại… mã ở trên vẫn dùng được.");
      return;
    }
    // No session projected yet: show a retry card (initial load or pre-open).
    mount(offlineHtml());
    view = "offline";
    const r = el("btn_retry"); if (r) r.addEventListener("click", refresh);
  }
}

async function openSession() {
  const label = (el("label") && el("label").value) || "";
  const minutes = Number((el("minutes") && el("minutes").value) || 90);
  const btn = el("btn_open"); if (btn) btn.disabled = true;
  try {
    const { data } = await apiCall("host_open", { host_key: hostKey, minutes, label }, { maxAttempts: 3 });
    render(data);
  } catch (err) {
    if (btn) btn.disabled = false;
    const code = err instanceof ApiError ? err.code : null;
    if (code === "COLLECTION_CLOSED") {
      showError("Data collection is closed. Ask the coordinator to open it before starting a class. / " +
        "Thu thập dữ liệu đang đóng. Nhờ điều phối viên mở trước khi bắt đầu lớp.");
    } else if (code === "LECTURE_FULL") {
      showError("All pool places have been used; no new sessions can start. Please tell the coordinator. / " +
        "Đã dùng hết suất trong kho; không thể mở buổi mới. Vui lòng báo điều phối viên.");
    } else if (code === "POOL_NOT_PROVISIONED") {
      showError("The self-service pool has not been set up yet. Ask the coordinator to set it up first. / " +
        "Kho suất tự phục vụ chưa được thiết lập. Nhờ điều phối viên thiết lập trước.");
    } else if (code === "HOST_KEY_INVALID") {
      showError("This control link is not valid. Ask the coordinator to re-send it. / " +
        "Liên kết điều khiển không hợp lệ. Nhờ điều phối viên gửi lại.");
    } else {
      showError("Could not open a session just now. Please check your connection and try again. / " +
        "Chưa mở được buổi học. Vui lòng kiểm tra kết nối và thử lại.");
    }
  }
}

async function closeSession() {
  const btn = el("btn_close"); if (btn) btn.disabled = true;
  try {
    const { data } = await apiCall("host_close", { host_key: hostKey }, { maxAttempts: 3 });
    render(data);
  } catch (err) {
    if (btn) btn.disabled = false;
    liveNote("Could not close the session. Please try again. / Chưa đóng được buổi học. Vui lòng thử lại.");
  }
}

function ensurePolling() {
  if (!pollTimer) pollTimer = setInterval(refresh, POLL_MS);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function boot() {
  hostKey = readHostKey();
  if (!hostKey) {
    mount('<div class="card"><h2>Classroom control / Điều khiển lớp học</h2>' +
      "<p>Open the private control link the study coordinator emailed you (it ends in <code>?host=…</code>). / " +
      "Hãy mở liên kết điều khiển riêng mà điều phối viên đã gửi (kết thúc bằng <code>?host=…</code>).</p></div>");
    return;
  }
  mount('<div class="card"><p>Loading classroom control… / Đang tải điều khiển lớp học…</p></div>');
  refresh(); // render() starts the poll only once a session is confirmed open
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

boot();
