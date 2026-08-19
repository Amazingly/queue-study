/*
 * Vietnamese interface text. Key set mirrors translations-en.js exactly;
 * tests enforce parity. Strings adapted from the verified easy-version
 * instrument and the ethics application (Appendix A); new strings follow
 * the neutral state language of §8.3 ("trạng thái chi phí chờ tiêu chuẩn"
 * / "trạng thái chi phí chờ cao"). Investigator, institution, contact
 * and withdrawal wording are final; ethics-committee reference and
 * contact remain provisional until review completes, and all
 * revised Vietnamese strings require independent native-language review
 * before the main sample (§13).
 */

export const VI = {
  lang_name: "Tiếng Việt",

  /* ---- Landing / token ---- */
  landing_title: "Nghiên cứu về quyết định gửi hồ sơ",
  landing_no_token:
    "Trang này là cổng vào của một nghiên cứu có mời tham gia. Để tham gia, bạn cần một đường dẫn mời cá nhân, dùng một lần. Nếu bạn đã nhận được lời mời, vui lòng mở đúng đường dẫn trong lời mời đó. Nếu đường dẫn của bạn dẫn đến thông báo này, đường dẫn có thể chưa đầy đủ — vui lòng liên hệ nhóm nghiên cứu tại quangn@gmail.com.",
  landing_checking: "Đang kiểm tra lời mời của bạn…",
  landing_manual_label: "Nếu không quét được mã QR trên phiếu mời, hãy nhập mã dự phòng in bên dưới mã QR (không cần gõ dấu cách):",
  landing_manual_button: "Tiếp tục với mã này",
  landing_manual_error: "Mã này có vẻ không hợp lệ. Vui lòng kiểm tra lại phiếu và thử lại, hoặc nhờ nghiên cứu viên hỗ trợ.",
  landing_gateway_button: "Tôi có mã lớp học từ giảng viên",

  /* ---- Cổng vào chung tại lớp học (/join/) ---- */
  gateway_title: "Tham gia nghiên cứu tại lớp học",
  gateway_body: "Nhập mã lớp học gồm sáu chữ số do giảng viên của bạn hiển thị.",
  gateway_code_label: "Mã lớp học",
  gateway_code_submit: "Tiếp tục",
  gateway_code_error: "Vui lòng nhập đúng mã sáu chữ số do giảng viên hiển thị.",
  err_lecture_invalid_title: "Không nhận dạng được mã lớp học",
  err_lecture_invalid: "Mã này không được nhận dạng. Vui lòng kiểm tra sáu chữ số do giảng viên hiển thị và thử lại.",
  err_lecture_not_open_title: "Buổi học chưa mở",
  err_lecture_not_open: "Mã lớp học này chưa được kích hoạt. Vui lòng chờ giảng viên thông báo bắt đầu rồi thử lại.",
  err_lecture_closed_title: "Buổi học đã đóng",
  err_lecture_closed: "Mã lớp học này không còn nhận người tham gia mới. Nếu bạn đã bắt đầu nghiên cứu trên thiết bị này, mở lại trang nghiên cứu sẽ cho phép tiếp tục phiên của bạn.",
  err_lecture_full_title: "Đã hết chỗ",
  err_lecture_full: "Tất cả các suất tham gia của buổi học này đã được sử dụng. Cảm ơn sự quan tâm của bạn.",
  elig_confirm_prior: "Tôi xác nhận rằng tôi CHƯA từng tham gia nghiên cứu này (ở lớp này hoặc lớp khác).",
  elig_prior_note: "Mỗi người chỉ tham gia và nhận thưởng một lần. Nếu bạn đã tham gia ở một buổi học khác, vui lòng không tiếp tục — cảm ơn sự trung thực của bạn.",

  /* ---- Progress labels ---- */
  progress_language: "Ngôn ngữ",
  progress_eligibility: "Điều kiện tham gia",
  progress_consent: "Đồng ý tham gia",
  progress_instructions: "Hướng dẫn",
  progress_quiz: "Kiểm tra hiểu",
  progress_rounds: "Vòng quyết định",
  progress_beliefs: "Ước đoán",
  progress_survey: "Bảng hỏi",
  progress_done: "Hoàn thành",

  /* ---- Language screen ---- */
  language_title: "Ngôn ngữ / Language",
  language_body: "Vui lòng chọn ngôn ngữ. / Please choose your language.",

  /* ---- Eligibility (§8.1) ---- */
  elig_title: "Điều kiện tham gia",
  elig_body: "Bạn chỉ có thể tham gia nếu bạn từ 18 tuổi trở lên.",
  elig_confirm: "Tôi xác nhận rằng tôi từ 18 tuổi trở lên.",
  elig_error: "Để tham gia, bạn cần xác nhận rằng bạn từ 18 tuổi trở lên.",
  elig_continue: "Tiếp tục",

  /* ---- Consent (§8.2) ---- */
  consent_title: "Thông tin và đồng ý tham gia",
  consent_study_title: "Nghiên cứu: Nhãn dự đoán công khai và hành vi gửi hồ sơ vào hàng chờ dịch vụ",
  consent_team: "Nghiên cứu do TS. Quang Nguyễn (Đại học Middlesex, Vương quốc Anh) thực hiện, phối hợp cùng trường đại học tổ chức buổi nghiên cứu này. Mã tham chiếu phê duyệt đạo đức nghiên cứu: đang trong quá trình xét duyệt; mã tham chiếu sẽ được hiển thị tại đây sau khi hoàn tất.",
  consent_purpose:
    "Nghiên cứu tìm hiểu cách mọi người quyết định có gửi hồ sơ vào một hệ thống xử lý hay không. Nghiên cứu kéo dài khoảng 15–20 phút và được thực hiện hoàn toàn trên trang này. Bạn sẽ đọc hướng dẫn, trả lời câu hỏi kiểm tra hiểu, đưa ra 20 quyết định, trả lời hai câu hỏi ước đoán và hoàn thành một bảng câu hỏi ngắn.",
  consent_payment:
    "Bạn nhận khoản tiền tham gia cố định là {FIXED} VND, cộng với tiền thưởng theo số điểm bạn kiếm được: 100 điểm = 10.000 VND. Bạn không thể bị mất tiền: tổng điểm âm được tính là 0 khi quy đổi tiền thưởng. Việc thanh toán được thực hiện bằng tiền mặt dựa trên mã hoàn thành ngẫu nhiên hiển thị ở cuối nghiên cứu; bạn không cần tài khoản ngân hàng hay ví điện tử để tham gia.",
  consent_voluntary:
    "Việc tham gia là hoàn toàn tự nguyện. Bạn có thể dừng bất kỳ lúc nào bằng cách đóng trang này mà không chịu bất kỳ thiệt hại nào; người bắt đầu nhưng không hoàn thành có thể yêu cầu nhận khoản tiền tham gia cố định. Việc tham gia và thu nhập không ảnh hưởng đến điểm số, học bổng hay quan hệ của bạn với nhà trường, và nghiên cứu này không thuộc bất kỳ môn học nào.",
  consent_risks:
    "Những bất tiện có thể gặp là nhỏ: đọc trên màn hình và giới hạn 60 giây cho mỗi quyết định. Nếu hết thời gian, hồ sơ đơn giản là không được gửi — điều này được thông báo trước và không gây thiệt hại nào ngoài vòng đó.",
  consent_data:
    "Chúng tôi không hỏi tên, email, số điện thoại hay mã số sinh viên của bạn trong nghiên cứu. Hồ sơ nghiên cứu gồm các quyết định của bạn, các ước đoán, câu trả lời bảng hỏi, các nhóm nhân khẩu học khái quát, và các số liệu tương tác được ghi tự động: thời gian cho mỗi quyết định, việc trang bị mất tiêu điểm hoặc bị ẩn, việc mở bảng hướng dẫn, và loại thiết bị khái quát (ví dụ: điện thoại hay máy tính). Câu trả lời của bạn được lưu vào máy chủ nghiên cứu trong quá trình bạn làm, để một phiên bị gián đoạn có thể tiếp tục từ chỗ đã dừng; nếu bạn dừng sớm, phần dữ liệu đã ghi được giữ lại và chỉ được phân tích ở dạng tổng hợp (ví dụ: để báo cáo có bao nhiêu người rời nghiên cứu và ở giai đoạn nào).",
  consent_confidentiality:
    "Dữ liệu nghiên cứu được lưu trữ an toàn, chỉ gắn với các mã ngẫu nhiên, được giữ tách biệt khỏi hồ sơ thanh toán, được lưu năm năm sau khi công bố, và có thể được chia sẻ công khai dưới dạng đã ẩn danh. Hồ sơ thanh toán — liên kết mã hoàn thành với thông tin nhận tiền — được lưu riêng, chỉ những nghiên cứu viên phụ trách thanh toán được truy cập, và sẽ bị hủy khi việc thanh toán hoàn tất.",
  consent_withdrawal:
    "Bạn có thể rút dữ liệu của mình cho đến 14 ngày sau khi tham gia theo thủ tục ở trang rút dữ liệu bên dưới; sau thời hạn đó dữ liệu đã được đưa vào các tệp phân tích ẩn danh và không thể truy ngược về phiên của bạn.",
  consent_contact:
    "Câu hỏi về nghiên cứu: TS. Quang Nguyễn, quangn@gmail.com. Câu hỏi về quyền của người tham gia: hội đồng đạo đức nghiên cứu của trường đại học phối hợp, thông tin liên hệ có thể được cung cấp bởi nhóm nghiên cứu qua quangn@gmail.com.",
  consent_links: "Thông tin về quyền riêng tư",
  consent_links_withdrawal: "Thủ tục rút dữ liệu",
  consent_confirm_age: "Tôi từ 18 tuổi trở lên.",
  consent_confirm_read: "Tôi đã đọc thông tin ở trên.",
  consent_confirm_voluntary: "Tôi hiểu rằng việc tham gia là tự nguyện và tôi có thể dừng bất kỳ lúc nào.",
  consent_confirm_agree: "Tôi đồng ý tham gia.",
  consent_error: "Để tham gia, vui lòng đánh dấu cả bốn ô xác nhận.",
  consent_continue: "Bắt đầu nghiên cứu",

  /* ---- Instructions (neutral state language, §8.3) ---- */
  inst1_title: "Vai trò của bạn",
  inst1_body: "Trong mỗi vòng, bạn nhận một hồ sơ và quyết định có gửi hồ sơ vào hệ thống xử lý hay không. Có {N} vòng. Bạn bắt đầu với {START} điểm.",
  inst2_title: "Loại hồ sơ",
  inst2_body: "Hồ sơ loại H có giá trị {H} điểm nếu được xử lý. Hồ sơ loại L có giá trị {L} điểm nếu được xử lý. Một hồ sơ chưa được xác định trên màn hình là loại H hay loại L được gọi là hồ sơ hỗn hợp: có xác suất 40% là loại H và 60% là loại L, nên giá trị kỳ vọng là 0,40×{H} + 0,60×{L} = {EV} điểm.",
  inst3_title: "Chi phí chờ",
  inst3_body: "Mỗi vòng hiển thị trạng thái chi phí chờ hiện tại. Trong trạng thái chi phí chờ tiêu chuẩn, chi phí chờ là {WL} điểm. Trong trạng thái chi phí chờ cao, chi phí chờ là {WH} điểm. Nếu bạn gửi hồ sơ, hồ sơ được xử lý ngay và điểm = giá trị hồ sơ − chi phí chờ hiện tại. Nếu bạn không gửi, điểm từ hồ sơ đó là 0.",
  inst3_formula: "Điểm = giá trị hồ sơ − chi phí chờ hiện tại",
  inst4_title: "Trạng thái chi phí chờ thay đổi như thế nào",
  inst4_body: "Nếu một hồ sơ loại H được xử lý, vòng tiếp theo áp dụng trạng thái chi phí chờ cao. Khi hệ thống đang ở trạng thái chi phí chờ cao và không có hồ sơ loại H nào được xử lý trong vòng đó, hệ thống trở về trạng thái chi phí chờ tiêu chuẩn với xác suất 50%; nếu không, hệ thống vẫn ở trạng thái chi phí chờ cao. Quy tắc này chỉ phụ thuộc vào việc có hồ sơ loại H được xử lý hay không.",
  inst5_title: "Ví dụ tính điểm",
  inst5_body: "Trong trạng thái chi phí chờ tiêu chuẩn, gửi hồ sơ loại H trả {HN} điểm và gửi hồ sơ hỗn hợp có giá trị kỳ vọng {MN} điểm. Trong trạng thái chi phí chờ cao, gửi hồ sơ loại H trả {HS} điểm, còn gửi hồ sơ hỗn hợp có giá trị kỳ vọng {MS} điểm. Gửi hồ sơ loại L luôn làm mất điểm vì giá trị của nó là 0.",
  inst_timer_note: "Trong các vòng quyết định, mỗi quyết định có đồng hồ đếm ngược 60 giây. Đồng hồ tạm dừng khi bảng hướng dẫn đang mở (tối đa {CAP} giây mỗi vòng) và khi trang bị ẩn, nên việc xem lại hướng dẫn hoặc bị gián đoạn ngắn không làm bạn mất thời gian quyết định.",
  instructions_button: "Hướng dẫn",
  instructions_panel_title: "Hướng dẫn nghiên cứu",
  instr_close: "Đóng",
  instr_hint: "Bạn có thể mở lại toàn bộ hướng dẫn bất cứ lúc nào bằng nút “Hướng dẫn” ở góc trên bên phải màn hình. Trong các vòng quyết định, đồng hồ đếm ngược tạm dừng khi bảng hướng dẫn đang mở, nên việc xem lại hướng dẫn không làm bạn mất thời gian quyết định.",
  instr_panel_note: "Nội dung dưới đây giống hệt phần hướng dẫn bạn đã đọc trước khi bắt đầu.",
  continue_btn: "Tiếp tục",

  /* ---- Comprehension quiz ---- */
  quiz_title: "Câu hỏi kiểm tra",
  quiz_intro: "Vui lòng trả lời đúng tất cả câu hỏi trước khi bắt đầu các vòng có trả thưởng. Bạn có thể thử lại nhiều lần, không bị trừ điểm.",
  quiz_error: "Một số câu trả lời chưa đúng. Bạn có thể sửa câu trả lời hoặc xem lại hướng dẫn.",
  quiz_feedback_title: "Giải thích câu trả lời",
  quiz_correct_label: "Đáp án đúng:",
  review_instructions: "Xem lại hướng dẫn",
  points: "điểm",
  q1: "Nếu bạn không gửi hồ sơ, điểm từ hồ sơ đó là bao nhiêu?",
  q2: "Hồ sơ loại H có giá trị bao nhiêu điểm nếu được xử lý?",
  q3: "Hồ sơ hỗn hợp có xác suất là loại H là bao nhiêu?",
  q4: "Giá trị kỳ vọng của hồ sơ hỗn hợp là bao nhiêu?",
  q5: "Nếu hồ sơ loại H được xử lý trong trạng thái chi phí chờ cao, điểm là bao nhiêu?",
  q6: "Nếu hồ sơ loại H được xử lý, vòng tiếp theo áp dụng trạng thái chi phí chờ nào?",
  q6_opt_standard: "Trạng thái chi phí chờ tiêu chuẩn",
  q6_opt_high: "Trạng thái chi phí chờ cao",
  q6_opt_same: "Không thay đổi gì",
  q7: "Một hồ sơ hỗn hợp xuất hiện khi chi phí chờ là 30 điểm. Điểm kỳ vọng nếu gửi hồ sơ này là bao nhiêu?",
  q8: "Một hồ sơ hỗn hợp xuất hiện khi chi phí chờ là 70 điểm. Điểm kỳ vọng nếu gửi hồ sơ này là bao nhiêu? (Bạn có thể nhập số âm.)",
  q7_hint: "Nhập một số nguyên (số điểm).",
  q8_hint: "Nhập một số nguyên (số điểm); dùng dấu trừ nếu cần.",
  q1_explain: "Nếu bạn không gửi, hồ sơ không được xử lý và điểm từ hồ sơ đó bằng 0.",
  q2_explain: "Theo hướng dẫn, hồ sơ loại H có giá trị 120 điểm nếu được xử lý.",
  q3_explain: "Hồ sơ hỗn hợp có xác suất 40% là loại H và 60% là loại L.",
  q4_explain: "Giá trị kỳ vọng của hồ sơ hỗn hợp là 0,40×120 + 0,60×0 = 48 điểm.",
  q5_explain: "Trong trạng thái chi phí chờ cao, chi phí chờ là 70 điểm. Hồ sơ loại H được xử lý trả 120 − 70 = 50 điểm.",
  q6_explain: "Nếu hồ sơ loại H được xử lý, vòng tiếp theo áp dụng trạng thái chi phí chờ cao.",
  q7_explain: "Giá trị kỳ vọng của hồ sơ hỗn hợp là 48 điểm và chi phí chờ là 30 điểm, nên điểm kỳ vọng nếu gửi là 48 − 30 = 18.",
  q8_explain: "Giá trị kỳ vọng của hồ sơ hỗn hợp là 48 điểm và chi phí chờ là 70 điểm, nên điểm kỳ vọng nếu gửi là 48 − 70 = −22.",

  /* ---- Decision rounds ---- */
  round: "Vòng",
  balance: "Số điểm hiện tại",
  load: "Trạng thái chi phí chờ",
  load_normal: "Tiêu chuẩn",
  load_strained: "Cao",
  load_normal_full: "trạng thái chi phí chờ tiêu chuẩn",
  load_strained_full: "trạng thái chi phí chờ cao",
  case_mixed: "Hồ sơ hỗn hợp",
  case_h: "Hồ sơ loại H",
  case_l: "Hồ sơ loại L",
  mixed_text: "Hồ sơ này không được xác định trên màn hình là loại H hay loại L. Có xác suất 40% là loại H và 60% là loại L. Giá trị kỳ vọng: {EV} điểm.",
  h_text: "Hồ sơ này là loại H. Nếu được xử lý, hồ sơ có giá trị {H} điểm.",
  l_text: "Hồ sơ này là loại L. Nếu được xử lý, hồ sơ có giá trị {L} điểm.",
  ev_line_mixed: "Điểm kỳ vọng nếu gửi: {EV} − {W} = {X}",
  ev_line_exact: "Điểm nếu gửi: {V} − {W} = {X}",
  units_line: "Trạng thái chi phí chờ hiện tại:",
  charge_line: "Chi phí chờ vòng này: {W} điểm",
  choose: "Chọn một phương án:",
  send: "Gửi vào hệ thống",
  not_send: "Không gửi",
  timeout_note: "Nếu hết thời gian mà bạn chưa chọn, hồ sơ này sẽ không được gửi.",
  time_left: "Thời gian còn lại:",
  submitting_decision: "Đang ghi nhận quyết định của bạn…",
  fb_served: "Hồ sơ đã được xử lý. Điểm: {X}. Vòng tiếp theo: {LOAD}.",
  fb_notsent: "Bạn không gửi hồ sơ. Điểm: 0. Vòng tiếp theo: {LOAD}.",
  fb_timeout: "Hết thời gian — hồ sơ không được gửi. Điểm: 0. Vòng tiếp theo: {LOAD}.",
  next_round: "Vòng tiếp theo",
  to_beliefs: "Tiếp tục",

  /* ---- Belief elicitation ---- */
  beliefs_title: "Hai câu hỏi ước đoán",
  beliefs_intro: "Trước khi xem kết quả, vui lòng đưa ra ước tính tốt nhất của bạn cho hai câu hỏi về các vòng bạn vừa chơi. Mỗi câu có thể mang lại tối đa {M} điểm: bạn nhận {M} điểm nếu ước tính đúng chính xác, trừ 1 điểm cho mỗi đơn vị chênh lệch giữa ước tính và con số thực (thấp nhất 0 điểm). Số điểm này được cộng vào tiền thưởng.",
  beliefs_examples: "Ví dụ: nếu con số thực là 8 và bạn ước tính 8, bạn nhận {M} điểm; nếu con số thực là 8 và bạn ước tính 5, chênh lệch là 3, nên bạn nhận {M} − 3 = {MEX} điểm.",
  belief1: "Trong {N} hồ sơ bạn nhận được, ước tính tốt nhất của bạn: có bao nhiêu hồ sơ thực sự là loại H? (0–{N})",
  belief2: "Trong {N} vòng, ước tính tốt nhất của bạn: có bao nhiêu hồ sơ loại H của bạn đã được xử lý? (0–{N})",
  belief_submit: "Gửi ước tính",
  belief_error: "Vui lòng nhập số nguyên trong khoảng cho phép ở cả hai câu.",

  /* ---- Results (§4.10) ---- */
  results_title: "Kết quả của bạn",
  r_start: "Điểm khởi đầu",
  r_decisions: "Điểm cộng hoặc trừ từ các vòng quyết định",
  r_beliefs: "Điểm từ câu hỏi ước đoán",
  r_counted: "Điểm dùng để tính tiền thưởng",
  r_bonus: "Tiền thưởng",
  r_floor: "Việc tính thưởng không bao giờ dùng tổng điểm âm: nếu điểm khởi đầu cộng điểm quyết định và điểm ước đoán nhỏ hơn 0, tiền thưởng là 0 VND.",

  /* ---- Questionnaire ---- */
  quest_title: "Bảng câu hỏi ngắn",
  quest_intro: "Bảng câu hỏi không thay đổi thu nhập của bạn.",
  lik1: "Việc hiểu nhãn hồ sơ khó đến mức nào? 1 = rất dễ, 7 = rất khó.",
  lik2: "Nhãn hồ sơ ảnh hưởng đến quyết định của bạn đến mức nào? 1 = không ảnh hưởng, 7 = ảnh hưởng rất mạnh.",
  lik3: "Chi phí chờ ảnh hưởng đến quyết định của bạn đến mức nào? 1 = không ảnh hưởng, 7 = ảnh hưởng rất mạnh.",
  attention: "Để kiểm tra chất lượng dữ liệu, vui lòng chọn số 4 cho câu này.",
  understood: "Bạn có hiểu cách tính điểm từ hồ sơ không?",
  believed: "Bạn có tin thông tin hiển thị trên màn hình không?",
  yes: "Có",
  no: "Không",
  unsure: "Không chắc",
  policy_when: "Màn hình cho biết hồ sơ là loại H hay loại L vào lúc nào?",
  policy_when_every: "Trong mọi vòng",
  policy_when_standard: "Chỉ trong trạng thái chi phí chờ tiêu chuẩn",
  policy_when_high: "Chỉ trong trạng thái chi phí chờ cao",
  policy_when_never: "Không bao giờ hiển thị loại chính xác",
  policy_when_unsure: "Tôi không chắc",
  policy_noticed: "Bạn có nhận thấy thông tin về loại hồ sơ thay đổi theo trạng thái chi phí chờ không?",
  strategy: "Bằng lời của bạn, bạn đã quyết định có gửi hồ sơ như thế nào? (không bắt buộc)",
  confusing: "Có phần nào khó hiểu không? (không bắt buộc)",
  open_text_note: "Vui lòng không ghi tên, email, mã số sinh viên hoặc thông tin khác có thể nhận dạng bạn.",
  prefer_not_answer: "Không muốn trả lời",

  /* ---- Demographics (§8.8) ---- */
  demo_title: "Thông tin về bạn",
  demo_intro: "Các câu trả lời được bảo mật, chỉ dùng cho nghiên cứu và không ảnh hưởng đến thu nhập của bạn.",
  age_band: "Nhóm tuổi của bạn",
  age_18_20: "18–20", age_21_24: "21–24", age_25_29: "25–29",
  age_30_39: "30–39", age_40_49: "40–49", age_50_plus: "50 tuổi trở lên",
  gender: "Giới tính của bạn",
  female: "Nữ", male: "Nam", nonbinary: "Phi nhị giới / bản dạng khác", prefer_not: "Không muốn trả lời",
  field: "Ngành học chính của bạn",
  f1: "Kinh tế / Kinh doanh / Quản trị", f2: "Khoa học tự nhiên / Kỹ thuật / CNTT",
  f3: "Khoa học xã hội khác", f4: "Nhân văn / Ngôn ngữ", f5: "Khác",
  year: "Bạn đang học năm thứ mấy?",
  y1: "Năm thứ nhất", y2: "Năm thứ hai", y3: "Năm thứ ba", y4: "Năm thứ tư", y5: "Năm thứ năm trở lên / Sau đại học",
  prior: "Bạn đã từng tham gia thí nghiệm có trả thưởng trước đây chưa?",
  risk: "Nhìn chung, bạn là người sẵn sàng chấp nhận rủi ro hay cố gắng tránh rủi ro? 0 = hoàn toàn không sẵn sàng, 10 = rất sẵn sàng.",
  patience: "Nhìn chung, bạn sẵn sàng đến mức nào trong việc từ bỏ một lợi ích hôm nay để nhận lợi ích lớn hơn trong tương lai? 0 = hoàn toàn không sẵn sàng, 10 = rất sẵn sàng.",
  form_error: "Vui lòng trả lời tất cả các câu hỏi bắt buộc.",
  submit_all: "Hoàn thành",

  /* ---- Finalization and completion (§4.11, §8.9) ---- */
  finalizing: "Đang gửi câu trả lời của bạn tới máy chủ nghiên cứu…",
  final_retry_title: "Đang chờ xác nhận",
  final_retry_body: "Chúng tôi chưa nhận được xác nhận từ máy chủ nghiên cứu. Câu trả lời của bạn vẫn được lưu trong trình duyệt này. Vui lòng giữ trang này mở và bấm “Gửi lại.” Bạn sẽ không mất các quyết định đã hoàn thành.",
  final_retry_ref: "Mã tham chiếu lần gửi: {REF}",
  final_retry_btn: "Gửi lại",
  done_title: "Đã hoàn thành nghiên cứu",
  done_received: "Câu trả lời của bạn đã được ghi nhận.",
  done_code_label: "Mã hoàn thành:",
  done_fixed: "Tiền tham gia cố định",
  done_bonus: "Tiền thưởng",
  done_total: "Tổng thanh toán",
  done_receipt: "Mã biên nhận: {REF}",
  done_keep: "Bạn được thanh toán bằng tiền mặt. Để nhận tiền, hãy xuất trình mã hoàn thành tại thời gian và địa điểm do nhóm nghiên cứu sắp xếp, hoặc liên hệ nhóm nghiên cứu tại quangn@gmail.com để hẹn thời gian nhận. Vui lòng lưu trang này (hoặc ghi lại mã) cho đến khi bạn đã nhận được tiền; mỗi mã chỉ được thanh toán một lần.",

  /* ---- Session recovery (§4.9) ---- */
  recover_title: "Tiếp tục phiên của bạn",
  recover_body: "Máy chủ nghiên cứu tìm thấy phiên chưa hoàn thành của bạn (mã {CODE}). Bạn có thể tiếp tục từ điểm đã lưu gần nhất; điều kiện được phân, tiến độ và số điểm của bạn không thay đổi. Nếu không muốn tiếp tục, bạn có thể kết thúc tham gia.",
  resume: "Tiếp tục phiên này",
  end_participation: "Kết thúc tham gia",
  end_confirm_title: "Kết thúc tham gia?",
  end_confirm_body: "Nếu bạn kết thúc tham gia bây giờ, phiên của bạn sẽ đóng và không thể mở lại. Các quyết định bạn đã thực hiện vẫn được ghi nhận, và bạn có thể yêu cầu khoản tiền tham gia cố định bằng cách liên hệ nhóm nghiên cứu. Bạn vẫn có thể rút dữ liệu theo hướng dẫn ở trang rút dữ liệu.",
  end_confirm_yes: "Có, kết thúc tham gia",
  end_confirm_no: "Quay lại",
  ended_title: "Đã kết thúc tham gia",
  ended_body: "Phiên của bạn đã được đóng. Nếu bạn muốn nhận khoản tiền tham gia cố định hoặc rút dữ liệu, vui lòng liên hệ nhóm nghiên cứu tại quangn@gmail.com và nêu mã {CODE}.",

  /* ---- Waiting / network ---- */
  contacting: "Đang kết nối với máy chủ nghiên cứu…",
  slow_network: "Kết nối đang chậm. Hệ thống tự động thử lại — vui lòng giữ trang này mở.",
  retry_now: "Thử lại ngay",

  /* ---- Errors ---- */
  err_generic_title: "Đã xảy ra lỗi",
  err_generic: "Máy chủ nghiên cứu trả về phản hồi không mong đợi. Vui lòng thử lại; nếu vấn đề tiếp diễn, liên hệ nhóm nghiên cứu tại quangn@gmail.com và nêu mã tham chiếu {REF}.",
  err_invalid_token_title: "Không nhận dạng được đường dẫn mời",
  err_invalid_token: "Đường dẫn mời này không hợp lệ. Vui lòng kiểm tra rằng bạn đã mở đầy đủ đường dẫn trong lời mời. Nếu vấn đề tiếp diễn, liên hệ nhóm nghiên cứu tại quangn@gmail.com.",
  err_token_completed_title: "Nghiên cứu đã được hoàn thành",
  err_token_completed: "Lời mời này đã được dùng để hoàn thành nghiên cứu. Mỗi lời mời chỉ dùng được một lần. Nếu bạn cho rằng có nhầm lẫn, liên hệ nhóm nghiên cứu tại quangn@gmail.com.",
  err_token_withdrawn_title: "Phiên đã đóng",
  err_token_withdrawn: "Phiên của lời mời này đã được đóng và không thể mở lại. Nếu có câu hỏi, liên hệ nhóm nghiên cứu tại quangn@gmail.com.",
  err_closed_title: "Nghiên cứu hiện chưa mở",
  err_closed: "Việc thu thập dữ liệu hiện đang đóng. Nếu bạn mới nhận được lời mời, vui lòng liên hệ nhóm nghiên cứu tại quangn@gmail.com.",
  err_expired_title: "Phiên đã hết hạn",
  err_expired: "Phiên này không hoạt động trong hơn {H} giờ và đã hết hạn. Vui lòng liên hệ nhóm nghiên cứu tại quangn@gmail.com và nêu mã {CODE}.",
  err_version_title: "Vui lòng tải lại trang",
  err_version: "Phiên bản trang này đã cũ. Vui lòng tải lại trang để tiếp tục.",
  err_state_title: "Vui lòng tải lại trang",
  err_state: "Trang này không đồng bộ với máy chủ nghiên cứu (ví dụ: do nghiên cứu đang mở ở một thẻ khác). Vui lòng đóng các thẻ khác đang mở nghiên cứu, sau đó tải lại trang — tiến độ của bạn đã được lưu trên máy chủ.",

  /* ---- Footer ---- */
  footer_privacy: "Quyền riêng tư",
  footer_withdrawal: "Rút dữ liệu"
};
