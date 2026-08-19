/*
 * English interface text. Placeholders in {BRACES} are filled by ui.fmt().
 * Values shown to participants (120, 0, 30, 70, 48, 40%, 50%, 300, payment
 * amounts) are public statements of the design (§4.2). Investigator,
 * institution, contact and withdrawal wording are final; the ethics-
 * committee reference and contact remain provisional until review
 * completes, and openCollection() refuses to run until a coordinator
 * confirms the final wording (§8.2, §13).
 *
 * System-state language follows §8.3: the interface says "standard
 * waiting-cost state" and "high waiting-cost state" and states the
 * transition rule mechanically. It does not describe Type H cases as
 * burdensome and does not suggest an obligation to protect the system.
 */

export const EN = {
  lang_name: "English",

  /* ---- Landing / token ---- */
  landing_title: "Queue Decision Study",
  landing_no_token:
    "This page is the entry point for an invited research study. Taking part requires a personal, single-use invitation link. If you received an invitation, please open the exact link it contains. If your link brings you to this message, the link may be incomplete — please contact the research team at quangn@gmail.com.",
  landing_checking: "Checking your invitation…",
  landing_manual_label: "If you cannot scan the QR code on your invitation slip, type the backup code printed under it (spaces do not matter):",
  landing_manual_button: "Continue with this code",
  landing_manual_error: "That does not look like a valid invitation code. Please check the slip and try again, or ask the researcher for help.",
  landing_gateway_button: "I have a classroom code from my lecturer",

  /* ---- Shared classroom gateway (/join/) ---- */
  gateway_title: "Join the study in your classroom",
  gateway_body: "Enter the six-digit classroom code shown by your lecturer.",
  gateway_code_label: "Classroom code",
  gateway_code_submit: "Continue",
  gateway_code_error: "Please enter the six-digit code exactly as shown by your lecturer.",
  err_lecture_invalid_title: "Classroom code not recognized",
  err_lecture_invalid: "This code is not recognized. Please check the six digits shown by your lecturer and try again.",
  err_lecture_not_open_title: "This session has not opened yet",
  err_lecture_not_open: "This classroom code is not active yet. Please wait for your lecturer to announce the start, then try again.",
  err_lecture_closed_title: "This session is closed",
  err_lecture_closed: "This classroom code is no longer accepting new participants. If you already started the study on this device, reopening the study page will offer to resume your session.",
  err_lecture_full_title: "All places are taken",
  err_lecture_full: "All experimental places for this classroom session have been taken. Thank you for your interest.",
  elig_confirm_prior: "I confirm that I have NOT previously participated in this study (in this or any other class).",
  elig_prior_note: "Each person may take part and be paid once. If you already participated in another lecture, please do not continue — thank you for your honesty.",

  /* ---- Progress labels ---- */
  progress_language: "Language",
  progress_eligibility: "Eligibility",
  progress_consent: "Consent",
  progress_instructions: "Instructions",
  progress_quiz: "Comprehension",
  progress_rounds: "Decision rounds",
  progress_beliefs: "Estimates",
  progress_survey: "Survey",
  progress_done: "Finished",

  /* ---- Language screen ---- */
  language_title: "Ngôn ngữ / Language",
  language_body: "Vui lòng chọn ngôn ngữ. / Please choose your language.",

  /* ---- Eligibility (§8.1) ---- */
  elig_title: "Eligibility",
  elig_body: "You may participate only if you are at least 18 years old.",
  elig_confirm: "I confirm that I am 18 years old or older.",
  elig_error: "Participation requires confirming that you are at least 18 years old.",
  elig_continue: "Continue",

  /* ---- Consent (§8.2; base text follows the ethics application, Appendix A) ---- */
  consent_title: "Information and consent",
  consent_study_title: "Study: Public Predictive Labels and Queue-Entry Behavior in Service Systems",
  consent_team: "This study is run by Dr. Quang Nguyen, Middlesex University (United Kingdom), together with the collaborating university hosting this session. Ethics review reference: under review; the approval reference will be shown here once ethics review is complete.",
  consent_purpose:
    "The study examines how people decide whether to send cases into a service system. It takes about 15–20 minutes and is completed entirely on this page. You will read instructions, answer comprehension questions, make 20 decisions, answer two estimation questions, and complete a short questionnaire.",
  consent_payment:
    "You receive a fixed participation payment of {FIXED} VND, plus a bonus based on the points you earn: 100 points = 10,000 VND. You cannot lose money: a negative point total counts as zero for the bonus. Payment is made in cash against the random completion code shown at the end of the study; you do not need a bank account or e-wallet to take part.",
  consent_voluntary:
    "Participation is voluntary. You may stop at any time by closing this page, without penalty; participants who begin but do not finish may request the fixed payment. Participation and earnings do not affect your grades, scholarships, or your relationship with your university, and this study is not part of any course.",
  consent_risks:
    "The foreseeable discomforts are minor: reading on a screen and a 60-second time limit per decision. If time runs out, the case is simply not sent — this is disclosed in advance and costs you nothing beyond that round.",
  consent_data:
    "We do not ask for your name, email address, phone number, or student ID in the study itself. The research record contains your decisions, your estimates, your questionnaire answers, coarse demographic categories, and automatically recorded interaction measurements: how long each decision takes, whether the page loses focus or is hidden, use of the instructions panel, and a coarse device category (for example, phone or desktop). Your answers are saved to the study server as you progress, so an interrupted session can continue where it stopped; if you stop early, the partial record is retained and analyzed only in aggregate form (for example, to report how many people left the study and at what point).",
  consent_confidentiality:
    "Research data are stored securely, identified only by random codes, kept separately from payment records, retained for five years after publication, and may be shared publicly in de-identified form. Payment records that link your completion code to a payment contact are stored separately, are accessible only to the researchers responsible for payment, and are destroyed once all payments are complete.",
  consent_withdrawal:
    "You may withdraw your data until 14 days after participation by following the procedure on the withdrawal page linked below; after that date the data will have entered anonymized analysis files and can no longer be traced to your session.",
  consent_contact:
    "Questions about the study: Dr. Quang Nguyen, quangn@gmail.com. Questions about your rights as a participant: the research ethics committee of the collaborating university, whose contact details are available from the research team at quangn@gmail.com.",
  consent_links: "Privacy information",
  consent_links_withdrawal: "Withdrawal procedure",
  consent_confirm_age: "I am at least 18 years old.",
  consent_confirm_read: "I have read the information above.",
  consent_confirm_voluntary: "I understand that participation is voluntary and that I may stop at any time.",
  consent_confirm_agree: "I consent to take part.",
  consent_error: "To take part, please tick all four confirmation boxes.",
  consent_continue: "Begin the study",

  /* ---- Instructions (neutral state language, §8.3) ---- */
  inst1_title: "Your role",
  inst1_body: "In each round you receive one case and decide whether to send it to a processing system. There are {N} rounds. You start with {START} points.",
  inst2_title: "Case types",
  inst2_body: "A Type H case is worth {H} points if processed. A Type L case is worth {L} points if processed. A case not identified on screen as H or L is called a Mixed case: it is Type H with 40% probability and Type L with 60%, so its expected value is 0.40×{H} + 0.60×{L} = {EV} points.",
  inst3_title: "Waiting cost",
  inst3_body: "Each round shows the current waiting-cost state. In the standard waiting-cost state, the waiting cost is {WL} points. In the high waiting-cost state, the waiting cost is {WH} points. If you send the case, it is processed immediately and points = case value − current waiting cost. If you do not send, the case pays 0.",
  inst3_formula: "Points = case value − current waiting cost",
  inst4_title: "How the waiting-cost state changes",
  inst4_body: "If a Type H case is processed, the next round uses the high waiting-cost state. When the system is already in the high waiting-cost state and no Type H case is processed in that round, it returns to the standard waiting-cost state with a 50% probability; otherwise it remains in the high waiting-cost state. This rule depends only on whether a Type H case was processed.",
  inst5_title: "Payoff examples",
  inst5_body: "In the standard waiting-cost state, sending a Type H case pays {HN} points and sending a Mixed case has expected value {MN} points. In the high waiting-cost state, sending a Type H case pays {HS} points, while sending a Mixed case has expected value {MS} points. Sending a Type L case always loses points because its value is 0.",
  inst_timer_note: "During the decision rounds a 60-second countdown runs for each decision. The countdown pauses while the instructions panel is open (up to a limit of {CAP} seconds per round) and while this page is hidden, so consulting the instructions or being briefly interrupted does not cost you decision time.",
  instructions_button: "Instructions",
  instructions_panel_title: "Study instructions",
  instr_close: "Close",
  instr_hint: "You can reopen the full instructions at any time with the “Instructions” button in the top-right corner. During the decision rounds the countdown pauses while the instructions panel is open, so consulting them costs you no decision time.",
  instr_panel_note: "The text below is identical to the instructions you read before starting.",
  continue_btn: "Continue",

  /* ---- Comprehension quiz (Q1–Q6 from the verified instrument; Q7–Q8 per §8.4) ---- */
  quiz_title: "Comprehension check",
  quiz_intro: "Please answer all questions correctly before the paid rounds begin. You may retry as often as needed, without penalty.",
  quiz_error: "Some answers are not correct. You may change your answers or review the instructions.",
  quiz_feedback_title: "Answer explanations",
  quiz_correct_label: "Correct answer:",
  review_instructions: "Review instructions",
  points: "points",
  q1: "If you do not send a case, what does that case pay?",
  q2: "A Type H case is worth how many points if processed?",
  q3: "A Mixed case has what chance of being Type H?",
  q4: "What is the expected value of a Mixed case?",
  q5: "If a Type H case is processed in the high waiting-cost state, what does it pay?",
  q6: "If a Type H case is processed, which waiting-cost state applies in the next round?",
  q6_opt_standard: "The standard waiting-cost state",
  q6_opt_high: "The high waiting-cost state",
  q6_opt_same: "Nothing changes",
  q7: "A Mixed case appears when the waiting cost is 30 points. What are the expected points from sending it?",
  q8: "A Mixed case appears when the waiting cost is 70 points. What are the expected points from sending it? (You may enter a negative number.)",
  q7_hint: "Enter a whole number of points.",
  q8_hint: "Enter a whole number of points; use a minus sign if needed.",
  q1_explain: "If you do not send the case, it is not processed and the payoff from that case is 0.",
  q2_explain: "The instructions state that a Type H case is worth 120 points if processed.",
  q3_explain: "A Mixed case is Type H with 40% probability and Type L with 60% probability.",
  q4_explain: "The expected value of a Mixed case is 0.40×120 + 0.60×0 = 48 points.",
  q5_explain: "In the high waiting-cost state, the waiting cost is 70 points. A processed Type H case pays 120 − 70 = 50 points.",
  q6_explain: "If a Type H case is processed, the next round uses the high waiting-cost state.",
  q7_explain: "The expected value of a Mixed case is 48 points and the waiting cost is 30 points, so the expected points from sending are 48 − 30 = 18.",
  q8_explain: "The expected value of a Mixed case is 48 points and the waiting cost is 70 points, so the expected points from sending are 48 − 70 = −22.",

  /* ---- Decision rounds ---- */
  round: "Round",
  balance: "Current balance",
  load: "Waiting-cost state",
  load_normal: "Standard",
  load_strained: "High",
  load_normal_full: "standard waiting-cost state",
  load_strained_full: "high waiting-cost state",
  case_mixed: "Mixed case",
  case_h: "Type H case",
  case_l: "Type L case",
  mixed_text: "This case is not identified on screen as Type H or L. It is Type H with 40% probability and Type L with 60%. Expected value: {EV} points.",
  h_text: "This case is Type H. If processed, it is worth {H} points.",
  l_text: "This case is Type L. If processed, it is worth {L} points.",
  ev_line_mixed: "Expected points if sent: {EV} − {W} = {X}",
  ev_line_exact: "Points if sent: {V} − {W} = {X}",
  units_line: "Current waiting-cost state:",
  charge_line: "Waiting cost this round: {W} points",
  choose: "Choose one:",
  send: "Send",
  not_send: "Do not send",
  timeout_note: "If time runs out before you choose, this case will not be sent.",
  time_left: "Time remaining:",
  submitting_decision: "Recording your decision…",
  fb_served: "The case was processed. Points: {X}. Next round: {LOAD}.",
  fb_notsent: "You did not send the case. Points: 0. Next round: {LOAD}.",
  fb_timeout: "Time ran out — the case was not sent. Points: 0. Next round: {LOAD}.",
  next_round: "Next round",
  to_beliefs: "Continue",

  /* ---- Belief elicitation (§8.5: best estimates; preregistered linear rule) ---- */
  beliefs_title: "Two estimation questions",
  beliefs_intro: "Before seeing your results, please give your best estimate in answer to two questions about the rounds you just played. Each question can earn up to {M} points: you receive {M} points if your estimate is exactly correct, minus 1 point for each unit of difference between your estimate and the true number (never below 0). These points are added to your bonus.",
  beliefs_examples: "Examples: if the true number is 8 and your estimate is 8, you earn {M} points; if the true number is 8 and your estimate is 5, the difference is 3, so you earn {M} − 3 = {MEX} points.",
  belief1: "Out of your {N} cases, what is your best estimate of how many were actually Type H? (0–{N})",
  belief2: "Out of the {N} rounds, what is your best estimate of how many of your Type H cases were processed? (0–{N})",
  belief_submit: "Submit estimates",
  belief_error: "Please enter whole numbers within the allowed range for both questions.",

  /* ---- Results (§4.10 separation) ---- */
  results_title: "Your results",
  r_start: "Starting points",
  r_decisions: "Points gained or lost in decisions",
  r_beliefs: "Points from estimation questions",
  r_counted: "Points used to calculate bonus",
  r_bonus: "Bonus payment",
  r_floor: "The bonus calculation never uses a negative total: if starting points plus decision and estimation points are below zero, the bonus is 0 VND.",

  /* ---- Questionnaire ---- */
  quest_title: "Short questionnaire",
  quest_intro: "The questionnaire does not change your earnings.",
  lik1: "How difficult was it to understand the case labels? 1 = very easy, 7 = very difficult.",
  lik2: "How much did the case label affect your decisions? 1 = not at all, 7 = very strongly.",
  lik3: "How much did the waiting cost affect your decisions? 1 = not at all, 7 = very strongly.",
  attention: "For data quality, please select 4 on this item.",
  understood: "Did you understand how case points were calculated?",
  believed: "Did you believe the information shown on screen?",
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
  policy_when: "When did the screen show whether a case was Type H or Type L?",
  policy_when_every: "In every round",
  policy_when_standard: "Only in the standard waiting-cost state",
  policy_when_high: "Only in the high waiting-cost state",
  policy_when_never: "It never showed the exact type",
  policy_when_unsure: "I am not sure",
  policy_noticed: "Did you notice that the information shown about the case type changed with the waiting-cost state?",
  strategy: "In your own words, how did you decide whether to send a case? (optional)",
  confusing: "Was anything difficult to understand? (optional)",
  open_text_note: "Please do not include your name, email address, student number, or other information that could identify you.",
  prefer_not_answer: "Prefer not to answer",

  /* ---- Demographics (§8.8: bands) ---- */
  demo_title: "About you",
  demo_intro: "These answers are confidential, used for research only, and do not affect your earnings.",
  age_band: "Your age group",
  age_18_20: "18–20", age_21_24: "21–24", age_25_29: "25–29",
  age_30_39: "30–39", age_40_49: "40–49", age_50_plus: "50 or older",
  gender: "Your gender",
  female: "Female", male: "Male", nonbinary: "Non-binary / another identity", prefer_not: "Prefer not to say",
  field: "Your main field of study",
  f1: "Economics / Business / Management", f2: "Natural sciences / Engineering / IT",
  f3: "Other social sciences", f4: "Humanities / Languages", f5: "Other",
  year: "Which year of study are you in?",
  y1: "First year", y2: "Second year", y3: "Third year", y4: "Fourth year", y5: "Fifth year or above / Postgraduate",
  prior: "Have you participated in a paid experiment before?",
  risk: "In general, how willing are you to take risks? 0 = completely unwilling, 10 = very willing.",
  patience: "In general, how willing are you to give up something beneficial today in order to benefit more in the future? 0 = completely unwilling, 10 = very willing.",
  form_error: "Please answer all required questions.",
  submit_all: "Finish",

  /* ---- Finalization and completion (§4.11, §8.9) ---- */
  finalizing: "Submitting your responses to the study server…",
  final_retry_title: "Confirmation pending",
  final_retry_body: "We have not yet received confirmation from the study server. Your responses remain saved in this browser. Please keep this page open and select “Retry submission.” You will not lose your completed decisions.",
  final_retry_ref: "Attempt reference: {REF}",
  final_retry_btn: "Retry submission",
  done_title: "Study completed",
  done_received: "Your responses have been received.",
  done_code_label: "Completion code:",
  done_fixed: "Fixed participation payment",
  done_bonus: "Bonus payment",
  done_total: "Total payment",
  done_receipt: "Receipt reference: {REF}",
  done_keep: "Your payment is made in cash. To collect it, show your completion code at a time and place arranged by the research team, or contact the research team at quangn@gmail.com to arrange a collection time. Please save this page (or write down the code) until you have received your payment; each code can be paid out only once.",

  /* ---- Session recovery (§4.9: resume or end; no reassignment path) ---- */
  recover_title: "Continue your session",
  recover_body: "The study server found your unfinished session (code {CODE}). You can continue from the most recently saved point; your assigned condition, progress, and balance are unchanged. If you do not wish to continue, you can end participation.",
  resume: "Resume this session",
  end_participation: "End participation",
  end_confirm_title: "End participation?",
  end_confirm_body: "If you end participation now, your session closes and cannot be reopened. The decisions you have made so far remain recorded, and you may request the fixed participation payment by contacting the research team. Withdrawal of your data remains possible as described on the withdrawal page.",
  end_confirm_yes: "Yes, end participation",
  end_confirm_no: "Go back",
  ended_title: "Participation ended",
  ended_body: "Your session has been closed. If you wish to receive the fixed participation payment or to withdraw your data, contact the research team at quangn@gmail.com and mention code {CODE}.",

  /* ---- Waiting / network ---- */
  contacting: "Contacting the study server…",
  slow_network: "The connection is slow. Retrying automatically — please keep this page open.",
  retry_now: "Retry now",

  /* ---- Errors ---- */
  err_generic_title: "Something went wrong",
  err_generic: "The study server returned an unexpected response. Please try again; if the problem persists, contact the research team at quangn@gmail.com and mention reference {REF}.",
  err_invalid_token_title: "Invitation link not recognized",
  err_invalid_token: "This invitation link is not valid. Please check that you opened the complete link from your invitation. If the problem persists, contact the research team at quangn@gmail.com.",
  err_token_completed_title: "Study already completed",
  err_token_completed: "This invitation has already been used to complete the study. Each invitation can be used only once. If you believe this is an error, contact the research team at quangn@gmail.com.",
  err_token_withdrawn_title: "Session closed",
  err_token_withdrawn: "This invitation's session has been closed and cannot be reopened. If you have questions, contact the research team at quangn@gmail.com.",
  err_closed_title: "The study is not currently open",
  err_closed: "Data collection is currently closed. If you received an invitation recently, please contact the research team at quangn@gmail.com.",
  err_expired_title: "Session expired",
  err_expired: "This session was inactive for longer than {H} hours and has expired. Please contact the research team at quangn@gmail.com and mention code {CODE}.",
  err_version_title: "Please reload this page",
  err_version: "This page version is out of date. Please reload the page to continue.",
  err_state_title: "Please reload this page",
  err_state: "This page is out of step with the study server (for example, because the study is open in another tab). Please close other tabs showing the study, then reload this page — your progress is saved on the server.",

  /* ---- Footer ---- */
  footer_privacy: "Privacy",
  footer_withdrawal: "Withdrawal"
};
