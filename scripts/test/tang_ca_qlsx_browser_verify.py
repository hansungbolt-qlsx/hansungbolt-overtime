# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — FORM TĂNG CA QLSX (admin) GIỐNG CÁC BỘ PHẬN (anh Hữu 04/11/2026).

🛑 Không ghi gì: POST/PATCH/DELETE bị chặn trong trình duyệt; danh sách "phiếu đã có" giả lập.
    VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3107
    python scripts/test/tang_ca_qlsx_browser_verify.py http://localhost:3107 <thư mục ảnh>
"""
import base64
import hashlib
import hmac
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[2]
GOC = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3107"
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


def sb(path):
    r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path)
    r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"]); r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())


b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")  # noqa: E731


def ky(p):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    q = b64(json.dumps(p, separators=(",", ":")).encode())
    return f"{h}.{q}.{b64(hmac.new(env['JWT_SECRET'].encode(), f'{h}.{q}'.encode(), hashlib.sha256).digest())}"


ad = sb("users?role=eq.admin&select=id&limit=1")
token = ky({"userId": ad[0]["id"], "username": "kiemthu", "fullName": "BÀI KIỂM QLSX", "role": "admin",
            "department": None, "iat": int(time.time()), "exp": int(time.time()) + 3600})

TT = {"ds": []}
gui = []
hoi_ban = []


def chan(route):
    req = route.request
    if req.method in ("POST", "PATCH", "PUT", "DELETE"):
        gui.append({"method": req.method, "url": req.url, "body": json.loads(req.post_data or "null")})
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "gia-lap-q", "items_count": 2}))
    elif "/api/registrations/department" in req.url:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"registrations": TT["ds"]}))
    else:
        route.continue_()


def ban(route):
    hoi_ban.append(1)
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"v": "test-a"}))


from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.route("**/api/registrations**", chan)
    pg.route("**/api/version", ban)

    print("1. Form QLSX — ngày thường, ca chiều, chưa có phiếu (có phiếu RL cùng ngày: không tính)")
    TT["ds"] = [{"id": "rl-1", "department": "RL", "day_type": "weekday", "shift": "PM", "time_from": "16:30:00",
                 "time_to": "19:30:00", "duration_hours": 3, "status": "pending", "registered_by": None,
                 "created_at": "2026-11-04T04:29:50+00:00", "registered_by_name": "X", "items_count": 4}]
    pg.goto(f"{GOC}/dashboard/qlsx", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    kiem(len(hoi_ban) >= 1, "7) trang QLSX có bộ tự kiểm bản mới")
    kiem(pg.get_by_text(re.compile("đã có phiếu")).count() == 0, "1) phiếu RL cùng ngày KHÔNG làm báo trùng cho QLSX")
    pm = pg.get_by_role("button", name=re.compile("PM · Chiều")).inner_text()
    kiem("Bắt đầu 16:30" in pm and "19:30" not in pm, "5) nút PM 'Bắt đầu 16:30'", pm)
    t1 = pg.locator("div.rounded-xl", has=pg.get_by_text("Nhân viên 1", exact=True)).last
    hb = t1.get_by_role("button", name="3h", exact=True).bounding_box()
    kiem(hb and hb["height"] >= 31, f"3) nút 3h cao {hb and round(hb['height'])}px")
    t1.locator('button[aria-haspopup="listbox"]').click()
    hop = pg.get_by_role("dialog", name="Chọn nhân viên")
    do = hop.get_by_role("option").evaluate_all("els => els.map(e => ({h: e.clientHeight, cut: e.scrollWidth > e.clientWidth}))")
    kiem(len(do) > 0 and len({d["h"] for d in do}) == 1 and not any(d["cut"] for d in do), f"4) {len(do)} tên QLSX, mỗi tên một dòng")
    hop.get_by_role("option").nth(0).click()
    t1.locator("textarea").fill("Bài kiểm (bị chặn)")
    t1.get_by_role("button", name="Khác", exact=True).click()
    kiem(t1.get_by_placeholder("Số giờ").evaluate("e => getComputedStyle(e).fontSize") == "16px", "6) ô Khác chữ 16px")
    t1.get_by_role("button", name="4h", exact=True).click()
    pg.get_by_role("button", name="+ Thêm nhân viên").click()
    t2 = pg.locator("div.rounded-xl", has=pg.get_by_text("Nhân viên 2", exact=True)).last
    kiem(t2.get_by_text("16:30 – 20:30").is_visible(), "2) NV1 4h → NV2 mặc định 4h")
    t2.locator('button[aria-haspopup="listbox"]').click()
    pg.get_by_role("dialog", name="Chọn nhân viên").get_by_role("option").nth(1).click()
    t2.locator("textarea").fill("Bài kiểm (bị chặn)")
    t2.get_by_role("button", name="3h", exact=True).click()
    pg.screenshot(path=str(ANH / "qlsx_form.png"), full_page=True)
    pg.get_by_role("button", name=re.compile("^Gửi phiếu")).click()
    pg.wait_for_timeout(1500)
    post = [g for g in gui if g["method"] == "POST"]
    kiem(len(post) == 1 and post[0]["url"].endswith("/api/registrations/qlsx"), "   bấm Gửi → 1 lệnh POST QLSX (đã chặn)")
    if post:
        b = post[0]["body"]
        kiem([it.get("duration_hours") for it in b["items"]] == [4, 3] and b["shift"] == "PM",
             f"2) gói gửi đi: NV1 4h · NV2 3h — {[it.get('duration_hours') for it in b['items']]}")

    print("2. Đã có phiếu QLSX PM cùng ngày")
    gui.clear()
    TT["ds"] = [{"id": "qlsx-cu-1", "department": "QLSX", "day_type": "weekday", "shift": "PM", "time_from": "16:30:00",
                 "time_to": "19:30:00", "duration_hours": 3, "status": "pending", "registered_by": None,
                 "created_at": "2026-11-04T04:29:50+00:00", "registered_by_name": "ADMIN", "items_count": 2}]
    pg.goto(f"{GOC}/dashboard/qlsx", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    canh = pg.get_by_text(re.compile("bộ phận QLSX đã có phiếu Ngày thường · PM"))
    canh.wait_for(timeout=30000)
    kiem(canh.is_visible() and pg.get_by_text("Nhân viên 1", exact=True).count() == 0
         and pg.get_by_role("button", name=re.compile("^Gửi phiếu")).count() == 0, "1) cảnh báo + ẩn phần nhập + ẩn nút Gửi")
    kiem(pg.get_by_role("link", name="Sửa phiếu cũ").get_attribute("href") == "/dashboard/registrations/qlsx-cu-1/edit",
         "1) nút Sửa phiếu cũ đúng phiếu")
    pg.screenshot(path=str(ANH / "qlsx_canh_bao.png"), full_page=True)
    TT["ds"] = []
    pg.get_by_role("button", name="Xóa phiếu cũ").click()
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=30000)
    de = [g for g in gui if g["method"] == "DELETE"]
    kiem(len(de) == 1 and de[0]["url"].endswith("qlsx-cu-1"), "1) Xóa phiếu cũ → DELETE đúng phiếu (đã chặn), hiện lại form")
    br.close()

print(f"\nKẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
