# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — MÁY DỪNG RL: nhắc 15:30 + nhóm RL/SM/CT + nhãn tự chép (anh Hữu 06/11/2026).

🛑 Không ghi gì, không chạm machine_stop_reasons thật:
   · MỌI lệnh /api/stop-reasons bị chặn ngay trong trình duyệt, trả dữ liệu GIẢ (máy chủ thử không
     bao giờ chạy phần tự chép) · POST/PATCH/PUT/DELETE khác cũng bị chặn.
   · Giờ trình duyệt đặt giả (Playwright clock) để thử mốc 15:30 / Chủ nhật.
    VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3108
    python scripts/test/may_dung_rl_browser_verify.py http://localhost:3108 <thư mục ảnh>
"""
import base64
import hashlib
import hmac
import io
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[2]
GOC = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3108"
ANH = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
ANH.mkdir(parents=True, exist_ok=True)
if "vercel.app" in GOC:
    print("🛑 Bài này chỉ chạy trên máy chủ cục bộ"); sys.exit(1)
env = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env.setdefault(k.strip(), v.strip().strip('"'))

dat = hong = 0


def kiem(ok, ten, them=""):
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}{f' — {them}' if them and not ok else ''}")
    dat += bool(ok); hong += (not ok)


b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")  # noqa: E731


def ky(p):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    q = b64(json.dumps(p, separators=(",", ":")).encode())
    return f"{h}.{q}.{b64(hmac.new(env['JWT_SECRET'].encode(), f'{h}.{q}'.encode(), hashlib.sha256).digest())}"


def phien(role, dept, ten):
    now = int(time.time())
    return ky({"userId": "kiemthu-may-dung", "username": "kiemthu", "fullName": ten, "role": role,
               "department": dept, "iat": now, "exp": now + 3600})


VN = timezone(timedelta(hours=7))
MAY_RL = ["RL-02", "RL-03", "RL-24", "SM-01", "SM-06", "SM-2A", "CT-01", "CT-02"]
LY_DO = [
    {"stop_date": "2026-11-07", "machine_code": "RL-24", "department": "RL", "reason_code": "NP", "reason_text": None,
     "created_by_name": "Tự động từ 06/11", "updated_at": "2026-11-07T00:30:00+00:00", "dismissed": False},
    {"stop_date": "2026-11-07", "machine_code": "SM-06", "department": "RL", "reason_code": "MT", "reason_text": "Hư bơm",
     "created_by_name": "Tổ trưởng RL", "updated_at": "2026-11-07T02:05:00+00:00", "dismissed": False},
]
gui, hoi = [], []


def stop_api(route):
    req = route.request
    hoi.append(req.method + " " + req.url)
    if req.method != "GET":
        gui.append({"method": req.method, "body": json.loads(req.post_data or "null")})
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
        return
    route.fulfill(status=200, content_type="application/json", body=json.dumps(
        {"date": "2026-11-07", "reasons": LY_DO, "machines": [{"code": c, "department": "RL"} for c in MAY_RL]}))


def chan(route):
    if route.request.method in ("POST", "PATCH", "PUT", "DELETE"):
        gui.append({"method": route.request.method, "url": route.request.url})
        route.fulfill(status=200, content_type="application/json", body="{}")
    else:
        route.continue_()


from playwright.sync_api import sync_playwright  # noqa: E402


def mo(br, role, dept, gio):
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_cookies([{"name": "session", "value": phien(role, dept, f"KIỂM THỬ {dept}"), "url": GOC}])
    pg = ctx.new_page()
    pg.clock.set_fixed_time(gio)
    pg.on("dialog", lambda d: d.accept())
    pg.route("**/api/**", chan)
    pg.route("**/api/stop-reasons**", stop_api)
    pg.route("**/api/version", lambda r: r.fulfill(status=200, content_type="application/json", body='{"v":"test-a"}'))
    pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    pg.get_by_role("button", name=re.compile("Máy dừng hôm nay")).wait_for(timeout=120000)
    pg.wait_for_timeout(800)
    return ctx, pg


BANG = re.compile("Chưa kiểm tra danh sách máy dừng hôm nay")
T7_1545 = datetime(2026, 11, 7, 15, 45, tzinfo=VN)

with sync_playwright() as pw:
    br = pw.chromium.launch()

    print("1. Tổ trưởng RL 15:45 thứ Bảy, chưa mở tab → băng đỏ + chấm đỏ")
    ctx, pg = mo(br, "leader", "RL", T7_1545)
    tab = pg.get_by_role("button", name=re.compile("Máy dừng hôm nay"))
    kiem(pg.get_by_text(BANG).is_visible(), "băng đỏ hiện")
    kiem("hạn 16:00" in pg.get_by_text(BANG).inner_text(), "ghi hạn 16:00")
    kiem(tab.locator('[aria-label="Chưa kiểm tra"]').count() == 1, "chấm đỏ trên tab")
    pg.screenshot(path=str(ANH / "rl_nhac.png"), full_page=True)

    print("2. Bấm băng → mở tab Máy dừng, tắt nhắc; nhóm RL/SM/CT + nhãn tự chép")
    pg.get_by_text(BANG).click()
    pg.get_by_text("Máy RL", exact=False).first.wait_for(timeout=30000)
    pg.wait_for_timeout(500)
    kiem(pg.get_by_text(BANG).count() == 0, "băng đỏ tắt")
    kiem(tab.locator('[aria-label="Chưa kiểm tra"]').count() == 0, "chấm đỏ tắt")
    tieu_de = pg.locator("div.text-xs.font-bold.text-brand-navy").all_inner_texts()
    tieu_de = [t.split()[1] for t in tieu_de if t.startswith("Máy ")]
    kiem(tieu_de == ["RL", "SM", "CT"], f"3 nhóm theo thứ tự RL → SM → CT: {tieu_de}")
    kiem(pg.get_by_text(re.compile(r"Máy RL\s*· 3 máy · đang dừng 1")).count() == 1, "đếm nhóm RL: 3 máy, dừng 1")
    o24 = pg.get_by_role("button", name=re.compile("^RL-24"))
    # 07/11/2026: ô máy gọn (lưới 5 cột) — tự chép hiện "↻ <lý do ngắn>", đầy đủ ở bảng Đối chiếu
    kiem(o24.inner_text().splitlines()[-1].strip() == "↻ Không KH", "ô RL-24 ghi ↻ Không KH", o24.inner_text())
    kiem("↻" not in pg.get_by_role("button", name=re.compile("^SM-06")).inner_text(), "ô SM-06 (tổ trưởng ghi) không có ↻")
    bang = pg.locator("table").inner_text()
    kiem("↻ Tự động từ 06/11" in bang and "Tổ trưởng RL" in bang, "bảng đối chiếu: ↻ Tự động từ 06/11 / Tổ trưởng RL")
    pg.get_by_text("ℹ Cách ghi máy dừng").click()  # 07/11/2026: lời hướng dẫn gập lại
    kiem(pg.get_by_text(re.compile("tự chép sang hôm nay")).is_visible(), "lời hướng dẫn RL")
    kiem(pg.get_by_text(re.compile("điền sẵn tự động")).count() == 0, "không hiện lời KHSX của HD")
    pg.screenshot(path=str(ANH / "rl_may_dung.png"), full_page=True)

    print("3. Bấm RL-24 → Máy có chạy — bỏ → gửi đúng lệnh (đã chặn)")
    o24.click()
    pg.get_by_role("button", name="Máy có chạy — bỏ").click()
    pg.wait_for_timeout(800)
    post = [g for g in gui if g["method"] == "POST"]
    kiem(len(post) == 1 and post[0].get("body") == {"date": "2026-11-07", "machine_code": "RL-24", "reason_code": None},
         f"POST bỏ RL-24 ngày 07/11: {post}")

    print("4. Tải lại trang cùng ngày → không nhắc nữa (đã ghi nhớ)")
    pg.reload(wait_until="load")
    pg.get_by_role("button", name=re.compile("Máy dừng hôm nay")).wait_for(timeout=60000)
    pg.wait_for_timeout(800)
    kiem(pg.get_by_text(BANG).count() == 0, "không nhắc lại")
    print("   … sang ngày hôm sau 15:45 (cùng máy) → nhắc lại")
    pg.clock.set_fixed_time(datetime(2026, 11, 9, 15, 45, tzinfo=VN))
    pg.reload(wait_until="load")
    pg.get_by_role("button", name=re.compile("Máy dừng hôm nay")).wait_for(timeout=60000)
    pg.wait_for_timeout(800)
    kiem(pg.get_by_text(BANG).is_visible(), "ngày mới nhắc lại")
    ctx.close()

    print("5. Các trường hợp KHÔNG nhắc")
    for ten, role, dept, gio in (
        ("RL 15:29", "leader", "RL", datetime(2026, 11, 7, 15, 29, tzinfo=VN)),
        ("RL Chủ nhật 16:00", "leader", "RL", datetime(2026, 11, 8, 16, 0, tzinfo=VN)),
        ("HD 16:00", "leader", "HD", datetime(2026, 11, 7, 16, 0, tzinfo=VN)),
        ("Nhân viên RL 16:00", "worker", "RL", datetime(2026, 11, 7, 16, 0, tzinfo=VN)),
    ):
        try:
            ctx, pg = mo(br, role, dept, gio)
            kiem(pg.get_by_text(BANG).count() == 0, f"{ten}: không nhắc")
            ctx.close()
        except Exception as e:  # nhân viên không có tab Máy dừng → mo() chờ tab sẽ hết giờ
            if role == "worker":
                ctx2 = br.new_context(viewport={"width": 390, "height": 844})
                ctx2.add_cookies([{"name": "session", "value": phien(role, dept, "KIỂM THỬ NV"), "url": GOC}])
                p2 = ctx2.new_page(); p2.clock.set_fixed_time(gio)
                p2.route("**/api/**", chan); p2.route("**/api/stop-reasons**", stop_api)
                p2.goto(f"{GOC}/register", wait_until="load", timeout=180000); p2.wait_for_timeout(3000)
                kiem(p2.get_by_text(BANG).count() == 0 and p2.get_by_role("button", name=re.compile("Máy dừng")).count() == 0,
                     f"{ten}: không tab, không nhắc")
                ctx2.close()
            else:
                kiem(False, ten, str(e)[:200])

    print("6. Tổ trưởng HD: chỉ 1 nhóm → không tiêu đề nhóm, lời KHSX giữ nguyên")
    MAY_RL[:] = ["HD-01", "HD-02"]; LY_DO[:] = []
    ctx, pg = mo(br, "leader", "HD", datetime(2026, 11, 7, 10, 0, tzinfo=VN))
    pg.get_by_role("button", name=re.compile("Máy dừng hôm nay")).click()
    pg.get_by_role("button", name=re.compile("^HD-01")).wait_for(timeout=30000)
    kiem(pg.get_by_text(re.compile(r"^Máy HD")).count() == 0, "không tiêu đề nhóm")
    pg.get_by_text("ℹ Cách ghi máy dừng").click()
    kiem(pg.get_by_text(re.compile("điền sẵn tự động")).is_visible(), "lời KHSX của HD")
    ctx.close()
    br.close()

ghi_that = [h for h in hoi if not h.startswith("GET")]
print(f"\n(lệnh tới /api/stop-reasons: {len(hoi)} — tất cả trả giả trong trình duyệt)")
print(f"KẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
