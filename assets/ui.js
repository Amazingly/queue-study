/*
 * Rendering helpers. Builders are pure functions from (translations,
 * server-returned state) to HTML strings, so the payoff display can be
 * unit-tested without a browser (tests/payoff-display.test.js).
 *
 * The decision screen renders ONLY numbers returned by the server for the
 * current round (§4.7): wait_cost, displayed_case_value,
 * displayed_expected_value, displayed_net_value, balance. The client does
 * not recompute payoffs and holds no treatment identifier; the label is
 * whatever `display_label` the server sent.
 *
 * CSP note (§4.5): no inline styles or inline event handlers are emitted;
 * dynamic progress width uses a CSS custom property set via CSSOM.
 */

export function fmt(template, map) {
  return String(template).replace(/\{(\w+)\}/g, (whole, key) => (map && key in map ? String(map[key]) : whole));
}

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function vnd(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? "-" : "";
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function el(id) { return document.getElementById(id); }

export function progressHtml(step, total, label) {
  const pct = Math.max(0, Math.min(100, Math.round((step / total) * 100)));
  return '<div class="step-progress"><div class="top"><span>' + esc(label) + '</span><span>' + pct + '%</span></div>' +
    '<div class="track"><div class="bar" data-progress="' + pct + '"></div></div></div>';
}

/* After render(): push data-progress into the CSS custom property. */
export function applyProgressBars(root = document) {
  root.querySelectorAll(".step-progress .bar[data-progress]").forEach((bar) => {
    bar.style.setProperty("--progress", bar.getAttribute("data-progress") + "%");
  });
}

export function radioBlock(name, qText, options, extraClass) {
  let html = '<div class="q"><p>' + esc(qText) + "</p>";
  for (const o of options) {
    html += '<label class="opt' + (extraClass ? " " + extraClass : "") + '"><input type="radio" name="' + esc(name) + '" value="' + esc(o.v) + '"> <span>' + esc(o.t) + "</span></label>";
  }
  return html + "</div>";
}

export function checkboxRow(id, labelText) {
  return '<label class="opt consent-confirm"><input type="checkbox" id="' + esc(id) + '"> <span>' + esc(labelText) + "</span></label>";
}

export function selectBlock(id, qText, options, placeholder) {
  let html = '<div class="q"><p>' + esc(qText) + '</p><select id="' + esc(id) + '"><option value="">' + esc(placeholder || "—") + "</option>";
  for (const o of options) html += '<option value="' + esc(o.v) + '">' + esc(o.t) + "</option>";
  return html + "</select></div>";
}

export function likertOpts(lo, hi) {
  const out = [];
  for (let i = lo; i <= hi; i++) out.push({ v: String(i), t: String(i) });
  return out;
}

export function getRadio(name) {
  const sel = document.querySelector('input[name="' + name + '"]:checked');
  return sel ? sel.value : null;
}

export function loadName(t, load, full) {
  if (full) return load === "strained" ? t.load_strained_full : t.load_normal_full;
  return load === "strained" ? t.load_strained : t.load_normal;
}

/* ---- Decision screen (pure; server round state in, HTML out) ---- */

export function decisionScreenHtml(t, rs, progressLabel) {
  const isMixed = rs.display_label === "mixed";
  const labelText = isMixed ? t.case_mixed : (rs.display_label === "H" ? t.case_h : t.case_l);
  const caseText = isMixed
    ? fmt(t.mixed_text, { EV: rs.displayed_expected_value })
    : (rs.display_label === "H"
      ? fmt(t.h_text, { H: rs.displayed_case_value })
      : fmt(t.l_text, { L: rs.displayed_case_value }));
  const evLine = isMixed
    ? fmt(t.ev_line_mixed, { EV: rs.displayed_expected_value, W: rs.wait_cost, X: rs.displayed_net_value })
    : fmt(t.ev_line_exact, { V: rs.displayed_case_value, W: rs.wait_cost, X: rs.displayed_net_value });

  return progressHtml(6, 9, progressLabel) +
    '<div class="status">' +
    "<span>" + esc(t.round) + " <strong>" + rs.round + " / " + rs.total_rounds + "</strong></span>" +
    "<span>" + esc(t.balance) + ": <strong>" + rs.balance + "</strong></span>" +
    "<span>" + esc(t.load) + ": <strong>" + esc(loadName(t, rs.current_load)) + "</strong></span>" +
    '<span class="timer">' + esc(t.time_left) + ' <span id="clock">' + rs.decision_seconds + "</span>s</span>" +
    "</div>" +
    '<div class="card">' +
    '<p><span class="case-label">' + esc(labelText) + "</span></p>" +
    "<p>" + esc(caseText) + "</p>" +
    '<div class="formula">' + esc(evLine) + "</div>" +
    '<div class="band">' + esc(t.units_line) + " <strong>" + esc(loadName(t, rs.current_load)) + "</strong><br>" +
    esc(fmt(t.charge_line, { W: rs.wait_cost })) + "</div>" +
    "<p><strong>" + esc(t.choose) + "</strong></p>" +
    '<div class="choices decision-actions">' +
    '<button id="btn_send" type="button">' + esc(t.send) + "</button>" +
    '<button id="btn_not" type="button" class="secondary">' + esc(t.not_send) + "</button>" +
    "</div>" +
    '<p class="muted">' + esc(t.timeout_note) + "</p>" +
    "</div>";
}

/* ---- Round feedback (pure; server decision outcome in, HTML out) ---- */

export function feedbackHtml(t, outcome, progressLabel) {
  const nextLoadName = loadName(t, outcome.next_load, true);
  let msg, cls;
  if (outcome.timed_out) { msg = fmt(t.fb_timeout, { LOAD: nextLoadName }); cls = "feedback-zero"; }
  else if (outcome.decision === "not_send") { msg = fmt(t.fb_notsent, { LOAD: nextLoadName }); cls = "feedback-zero"; }
  else { msg = fmt(t.fb_served, { X: outcome.points, LOAD: nextLoadName }); cls = outcome.points >= 0 ? "feedback-good" : "feedback-zero"; }
  const nextLabel = outcome.next_round_available ? t.next_round : t.to_beliefs;
  return progressHtml(6, 9, progressLabel) +
    '<div class="status"><span>' + esc(t.round) + " <strong>" + outcome.round + " / " + outcome.total_rounds + "</strong></span>" +
    "<span>" + esc(t.balance) + ": <strong>" + outcome.balance_after + "</strong></span></div>" +
    '<div class="card"><p class="' + cls + '">' + esc(msg) + "</p>" +
    '<button id="btn_next" type="button">' + esc(nextLabel) + "</button></div>";
}

/* ---- Results breakdown (§4.10; server components in, HTML out) ---- */

export function resultsTableHtml(t, results) {
  return '<table class="results-table">' +
    "<tr><td>" + esc(t.r_start) + "</td><td>" + results.starting_points + "</td></tr>" +
    "<tr><td>" + esc(t.r_decisions) + "</td><td>" + results.decision_points + "</td></tr>" +
    "<tr><td>" + esc(t.r_beliefs) + "</td><td>" + results.belief_points + "</td></tr>" +
    "<tr><td>" + esc(t.r_counted) + "</td><td>" + results.counted_points + "</td></tr>" +
    '<tr class="total-row"><td>' + esc(t.r_bonus) + "</td><td>" + vnd(results.bonus_vnd) + " VND</td></tr>" +
    "</table>";
}

/* ---- Completion (§8.9; server payment summary in, HTML out) ---- */

export function completionHtml(t, completion) {
  return '<div class="card"><h3>' + esc(t.done_title) + "</h3>" +
    "<p>" + esc(t.done_received) + "</p>" +
    "<p>" + esc(t.done_code_label) + ' <code class="big">' + esc(completion.completion_code) + "</code></p>" +
    '<table class="results-table">' +
    "<tr><td>" + esc(t.done_fixed) + "</td><td>" + vnd(completion.fixed_vnd) + " VND</td></tr>" +
    "<tr><td>" + esc(t.done_bonus) + "</td><td>" + vnd(completion.bonus_vnd) + " VND</td></tr>" +
    '<tr class="total-row"><td>' + esc(t.done_total) + "</td><td>" + vnd(completion.total_vnd) + " VND</td></tr>" +
    "</table>" +
    '<p class="muted">' + esc(fmt(t.done_receipt, { REF: completion.receipt_reference })) + "</p>" +
    '<div class="band quality-note">' + esc(t.done_keep) + "</div>" +
    "</div>";
}

/* ---- Screen mount ---- */

export function render(html) {
  const app = document.getElementById("app");
  app.innerHTML = html;
  window.scrollTo(0, 0);
  applyProgressBars(app);
}
