# Agent nhận việc bằng Supabase Realtime — thiết kế ổn định + tự chữa lỗi

> Lập 12/10/2026 theo yêu cầu anh Hữu: *"Phương án 3 thành công thì sau này còn mở rộng thêm được nhiều dự án
> khác trên app tăng ca… tìm cách tốt nhất để hệ thống hoạt động ổn định, đạt yêu cầu và có giải pháp tự sửa lỗi."*
> Trạng thái: **THIẾT KẾ — chưa code, chưa đổi gì trên Supabase.** Mọi số liệu dưới đây đo ngày 12/10/2026.

## 1. Vì sao làm

- Agent (máy chủ nhà máy, mạng nội bộ) không nhận được lời gọi từ Vercel (Internet) — máy không có địa chỉ công khai,
  đường hầm Cloudflare đang dùng loại tạm (`trycloudflare.com`, đổi địa chỉ mỗi lần khởi động). Nên agent phải tự HỎI.
- Đo Supabase Logs Explorer 24 giờ: **38.383 lượt API**, agent chiếm **98 %**, riêng hỏi/dọn lệnh in **83 %** →
  log 1,07 GB/tháng, vượt hạn mức Free 1 GB (Supabase áp từ đầu 2027).
- 3 tháng (11/07→12/10, 217 bản sao lưu): **393 lệnh in = 4,3 lệnh/ngày**, tất cả trong 07:00–18:59, không có Chủ nhật
  ⇒ ~7.400 lần hỏi mới có 1 lần có việc.
- Đã làm tạm 12/10 (`f1f8e4a`): hỏi 3 → 10 giây, dọn 30 giây → 5 phút ⇒ ~15.600 lượt/ngày, log ước ~0,55 GB.

## 2. Ý tưởng

```
Agent ═══ 1 kết nối WebSocket giữ cả ngày ═══ Supabase Realtime
Người dùng thao tác trên app tăng ca ─▶ Vercel ghi 1 dòng vào bảng (như hôm nay, KHÔNG đổi app tăng ca)
                                       └─▶ Supabase ĐẨY tin "có dòng mới/đổi" ─▶ Agent xử lý ngay
```

Chỉ khi có thao tác mới có lưu lượng. App tăng ca phía Vercel **không phải sửa** — nó vẫn ghi bảng như cũ.

## 3. Tám lớp bảo vệ (tự chữa lỗi) — nguyên tắc: *xấu nhất cũng không tệ hơn hôm nay*

| Lớp | Cơ chế | Bắt được lỗi gì |
|---|---|---|
| L1 | Thư viện supabase-js tự giữ nhịp tim (đặt 15 giây) + tự kết nối lại (lùi dần 1–2–5–10 giây) | Mạng chập chờn, Supabase khởi động lại |
| L2 | **Bộ canh sức khoẻ trong agent**: theo dõi nhịp tim (`ok/timeout/error/disconnected`) + trạng thái từng kênh (`SUBSCRIBED/CLOSED/CHANNEL_ERROR/TIMED_OUT`). Quá 45 giây không khoẻ → **chế độ dự phòng**: hỏi 10 giây như hôm nay; khoẻ lại → về chế độ Realtime | Kết nối đứt mà thư viện chưa kịp tự nối lại |
| L3 | **Bắt bù mỗi lần (tái) kết nối**: vừa `SUBSCRIBED` là quét ngay mọi việc đang chờ | Việc phát sinh đúng lúc đang đứt |
| L4 | **Kiểm tra đầu-cuối (canary) mỗi 10 phút**: agent ghi 1 dòng vào bảng `agent_heartbeat`, phải nhận lại chính tin đó qua Realtime trong 15 giây. Hỏng 2 lần liền → huỷ và tạo lại toàn bộ kết nối; vẫn hỏng → ở chế độ dự phòng + cảnh báo | Lỗi "trông như đang kết nối mà không nhận tin" (vd bảng bị gỡ khỏi Realtime, Supabase đổi cấu hình) — lỗi im lặng nguy hiểm nhất |
| L5 | **Lưới dự phòng luôn chạy kể cả khi khoẻ**: lệnh in 60 giây (< TTL 2 phút), NVL/CO/tăng ca 5 phút | Mọi trường hợp tin bị rơi mà L2–L4 không phát hiện |
| L6 | **Nhận việc nguyên tử + hàng đợi tuần tự**: đổi `pending → printing` bằng `PATCH …&status=eq.pending` + `return=representation`, **chỉ in khi đúng 1 dòng trả về** | **In trùng** khi tin Realtime và vòng hỏi cùng thấy 1 lệnh (code hiện nay CHƯA chặn — phải vá trước) |
| L7 | **Gom tin (debounce) 10 giây** cho bảng sửa nhiều (tăng ca) — nhiều thay đổi liền nhau → 1 lần đồng bộ | Bão tin khi tổ trưởng sửa hàng loạt |
| L8 | **Cảnh báo + đo đếm**: ghi `dem-luot-goi.json` (số tin nhận, lượt hỏi, số lần rơi về dự phòng, phút ở dự phòng, kết quả canary). Ở dự phòng > 10 phút → nhắn Telegram (bot sẵn có). Bản tin sáng hiện các số này. Tiến trình chết → task `HansungbolPrintAgent` tự bật lại (đã có) | Biết sớm, không đợi người dùng báo |

Bảng `agent_heartbeat` còn dùng được cho app tăng ca hiện **"Máy in: trực tuyến / mất kết nối"** trước khi bấm In (mở rộng, chưa làm).

## 4. Ước lượng sau khi xong

| | Ban đầu (3 giây) | Hiện nay (10 giây) | Realtime + lưới dự phòng |
|---|---|---|---|
| Lượt API/ngày | 38.383 | ~15.600 | **~3.800** (in 1.440 · NVL/CO/tăng ca/kho 1.152 · dọn 288 · canary 144 · khác 766) |
| Log/tháng | 1,07 GB | ~0,55 GB | **~0,1 GB** + log Realtime (chưa đo — đo ở GĐ2) |
| Tin Realtime/tháng | — | — | vài nghìn ≪ hạn mức Free 2 triệu (mỗi thay đổi = 1 tin/người nghe; canary ~4.300) |
| Kết nối Realtime | — | — | 1 (hạn mức Free 200) |
| Lệnh in ra giấy | ≤ 3 giây | ≤ 10 giây | **< 1–2 giây**; khi đang dự phòng ≤ 10 giây |

## 5. Thay đổi trên Supabase (cần anh Hữu duyệt — quy tắc 5 câu 3)

```sql
-- (0) Điều kiện trước: bật RLS 3 bảng nvl_* (đề xuất B26) — nếu không, đưa vào Realtime là mở rộng bề mặt lộ dữ liệu
alter table nvl_day_slips   enable row level security;
alter table nvl_slip_lines  enable row level security;
alter table nvl_slip_events enable row level security;
-- (1) Bảng canary (1 dòng / agent), chỉ service_role dùng
create table if not exists agent_heartbeat (id text primary key, last_seen timestamptz not null default now(), info jsonb);
alter table agent_heartbeat enable row level security;
-- (2) Đưa các bảng vào Realtime
alter publication supabase_realtime add table print_jobs, agent_heartbeat;              -- GĐ2–3
alter publication supabase_realtime add table nvl_day_slips, co_day_slips,
  overtime_registrations, overtime_items, employees;                                     -- GĐ4
-- LÙI: alter publication supabase_realtime drop table <bảng>;  drop table agent_heartbeat;
```

- Không đổi dữ liệu, không đổi cột, không đổi app tăng ca. Lùi được ngay bằng câu `drop table` khỏi publication.
- `co-deleted.json` nằm ở Storage (Realtime không theo dõi Storage) → giữ hỏi 5 phút.
- Agent dùng khoá `service_role` (đã có, nằm ngoài Git) → bỏ qua RLS, nhận đủ tin. Khoá `anon` không nằm trong bundle (B26).

## 6. Triển khai theo giai đoạn — mỗi giai đoạn có tiêu chí qua cửa

| GĐ | Việc | Qua cửa khi |
|---|---|---|
| 0 | Vá L6 (nhận việc nguyên tử) ngay trên agent hiện tại | In thử 3 lệnh: không lệnh nào in 2 lần; đẩy 2 lượt nhận cùng lúc → chỉ 1 lượt được |
| 1 | Anh duyệt báo cáo 5 điểm → anh chạy SQL mục 5 (phần 0–1–2 cho print_jobs, agent_heartbeat) | Logs Explorer không lỗi; app tăng ca chạy bình thường |
| 2 | **Chạy bóng 1–2 ngày**: tiến trình agent thứ 2 chế độ CHỈ NGHE (không nhận/không in), ghi giờ nhận tin. Agent thật giữ nguyên | Tin nhận = 100 % lệnh in tạo ra; độ trễ trung vị < 2 giây; đo log Realtime; thử rút mạng → L2/L3/L4 bắt đúng |
| 3 | Chuyển agent thật sang Realtime cho lệnh in + lưới 60 giây | 1 tuần: 0 lệnh lỡ, 0 lệnh in trùng, canary ≥ 99 %, lượt API giảm như mục 4 |
| 4 | Mở rộng NVL · Coating · tăng ca (thêm bảng vào publication) | Phiếu về app chính ≤ 15 giây; lượt API ~3.800/ngày |
| 5 | Khung chung cho dự án mới + đèn "Máy in trực tuyến" trên app tăng ca | — |

## 7. Khung mở rộng cho dự án mới (GĐ5)

Trong agent chỉ có **một** mô-đun `realtime-hub` giữ kết nối + 8 lớp bảo vệ. Mỗi việc mới khai báo 1 dòng:

```js
dangKy({ bang: 'print_jobs', loc: 'status=eq.pending', xuLy: xuLyLenhIn, duPhongMoi: 60_000, gom: 0 });
dangKy({ bang: 'co_day_slips', xuLy: dongBoCo, duPhongMoi: 300_000, gom: 10_000 });
```

Việc mới trên app tăng ca (vd báo dừng máy, yêu cầu vật tư) chỉ cần: Vercel ghi bảng → thêm 1 dòng `dangKy` → được hưởng
nguyên 8 lớp bảo vệ, không phải viết lại phần kết nối/tự chữa.

## 8. Rủi ro còn lại

| Rủi ro | Mức | Chặn bằng |
|---|---|---|
| Kết nối "sống mà không nhận tin" | Trung bình | L4 canary 10 phút + L5 lưới 60 giây |
| In trùng | Cao nếu không vá | L6 — làm ở GĐ0, trước mọi thứ |
| Log Realtime phát sinh chưa biết | Chưa đo | Đo ở GĐ2; bất thường thì gỡ publication, về cách hỏi |
| Supabase đổi hành vi Realtime / thư viện | Thấp | L4 phát hiện, tự rơi về dự phòng (không tệ hơn hôm nay) |
| Code phức tạp hơn | Thấp | Tách riêng `realtime-hub`, giữ nguyên đường hỏi cũ làm dự phòng, bài kiểm rút mạng |

Nguồn: Supabase docs — Realtime Quotas · Postgres Changes · Manage Realtime Messages usage · Realtime heartbeat messages ·
Manage Logs Ingest usage (đọc 12/10/2026).
