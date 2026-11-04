# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT THẬT — Ô CHỌN 3h / 4h / Khác TỪNG NHÂN VIÊN (anh Hữu 04/11/2026).

Mở form tổ trưởng HD trên khổ iPhone (390px), bấm thử như tổ trưởng, chụp ảnh.
🛑 KHÔNG ghi gì lên Supabase: nút "Gửi phiếu" / "Lưu phiếu" bị CHẶN NGAY TRONG TRÌNH DUYỆT
   (page.route → trả kết quả giả) — chỉ đọc xem app ĐỊNH gửi gì. Đọc Supabase (GET) để mượn
   id tổ trưởng + một phiếu thật cho màn Sửa (chỉ mở xem).

    npx next dev -p 3107   rồi   python scripts/test/gio_rieng_browser_verify.py http://localhost:3107 <thư mục ảnh>
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
if "vercel.app" in GOC:
    print("🛑 Bài này chỉ chạy trên máy chủ cục bộ"); sys.exit(1)

env = {}
for f in (".env.local", ".env"):
    p = ROOT / f
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"'))

dat = hong = 0


def kiem(ok, ten, them=""):
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}{f' — {them}' if them and not ok else ''}")
    dat += bool(ok); hong += (not ok)


def sb_get(path):
    r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path)
    r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"])
    r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())


def b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def ky_jwt(payload):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(env["JWT_SECRET"].encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64(sig)}"


tt = sb_get("users?role=eq.leader&department=eq.HD&select=id,username&limit=1")
if not tt:
    print("🛑 Không mượn được tổ trưởng HD"); sys.exit(1)
token = ky_jwt({"userId": tt[0]["id"], "username": "kiemthu", "fullName": "BÀI KIỂM GIỜ RIÊNG",
                "role": "leader", "department": "HD",
                "iat": int(time.time()), "exp": int(time.time()) + 3600})
phieu = sb_get("overtime_registrations?department=eq.HD&day_type=eq.weekday&shift=eq.PM"
               "&select=id,overtime_date&order=overtime_date.desc&limit=1")

from playwright.sync_api import sync_playwright  # noqa: E402

gui = []   # thân các lệnh ghi bị chặn


def chan(route):
    req = route.request
    if req.method in ("POST", "PATCH", "PUT", "DELETE"):
        gui.append({"method": req.method, "url": req.url, "body": json.loads(req.post_data or "null")})
        if req.method == "POST":
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": "gia-lap-00000000", "items_count": 0}))
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
    else:
        route.continue_()


def so_luong(nut):
    """'HD-01\\n8.250\\n071245-F14W-A' → 8250"""
    dong = [x.strip() for x in nut.inner_text().splitlines() if x.strip()]
    return int(dong[1].replace(".", ""))


with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()
    pg.route("**/api/registrations**", chan)

    print("1. Form đăng ký — ngày thường, ca chiều")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    the1 = pg.locator("div.rounded-xl", has=pg.get_by_text("Nhân viên 1", exact=True)).last
    kiem(the1.get_by_role("button", name="3h", exact=True).is_visible(), "có nút 3h")
    kiem(the1.get_by_role("button", name="4h", exact=True).is_visible(), "có nút 4h")
    kiem(the1.get_by_role("button", name="Khác", exact=True).is_visible(), "có nút Khác")
    kiem(the1.get_by_text("16:30 – 19:30").is_visible(), "mặc định 3h → 16:30 – 19:30")
    pg.screenshot(path=str(ANH / "1_mac_dinh_3h.png"))

    sel = the1.locator("select")
    sel.select_option(index=1)
    may = the1.locator("div.max-h-\\[220px\\] div.grid button").first
    q3 = so_luong(may)
    may.click()
    the1.get_by_role("button", name="4h", exact=True).click()
    kiem(the1.get_by_text("16:30 – 20:30").is_visible(), "bấm 4h → 16:30 – 20:30")
    q4 = so_luong(may)
    kiem(abs(q4 / q3 - 3.5 / 2.5) < 0.01 if q3 else False, f"SL dự kiến 3h→4h tăng theo 2,5h→3,5h ({q3}→{q4})")
    pg.screenshot(path=str(ANH / "2_chon_4h.png"))

    the1.get_by_role("button", name="Khác", exact=True).click()
    o = the1.get_by_placeholder("Số giờ")
    kiem(o.is_visible(), "bấm Khác → hiện ô nhập số giờ")
    o.fill("3,5")
    kiem(the1.get_by_text("16:30 – 20:00").is_visible(), "Khác 3,5 → 16:30 – 20:00")
    o.fill("7,5")
    kiem(the1.get_by_text("Số giờ không hợp lệ").is_visible(), "Khác 7,5 → báo không hợp lệ")
    pg.screenshot(path=str(ANH / "3_khac_sai.png"))
    pg.get_by_role("button", name=re.compile("^Gửi phiếu")).click()
    pg.wait_for_timeout(500)
    kiem(len(gui) == 0, "số giờ sai → không gửi đi")
    kiem(pg.get_by_text(re.compile("số giờ \"Khác\" chưa đúng")).is_visible(), "hiện lỗi cho tổ trưởng")
    o.fill("2,5")
    kiem(the1.get_by_text("16:30 – 19:00").is_visible(), "Khác 2,5 → 16:30 – 19:00")

    pg.get_by_role("button", name="+ Thêm nhân viên").click()
    the2 = pg.locator("div.rounded-xl", has=pg.get_by_text("Nhân viên 2", exact=True)).last
    the2.locator("select").select_option(index=2)
    the2.locator("div.max-h-\\[220px\\] div.grid button").first.click()
    kiem(the2.get_by_text("16:30 – 19:30").is_visible(), "nhân viên 2 mặc định 3h")
    pg.screenshot(path=str(ANH / "4_hai_nguoi.png"), full_page=True)
    pg.get_by_role("button", name=re.compile("^Gửi phiếu PM")).click()
    pg.wait_for_timeout(1000)
    post = [g for g in gui if g["method"] == "POST"]
    kiem(len(post) == 1, "bấm Gửi → 1 lệnh POST (đã chặn, không tới máy chủ)")
    if post:
        b = post[0]["body"]
        gio = sorted({(it["employee_id"][:8], it.get("duration_hours")) for it in b["items"]}, key=lambda x: x[1])
        kiem([g[1] for g in gio] == [2.5, 3], "gói gửi đi: người 1 = 2,5h · người 2 = 3h", str(gio))
        kiem(b["shift"] == "PM" and b["day_type"] == "weekday", "ca PM ngày thường")

    print("2. Ca sáng / Chủ nhật — không có ô chọn giờ")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    pg.get_by_role("button", name=re.compile("AM · Sáng")).click()
    kiem(pg.get_by_role("button", name="4h", exact=True).count() == 0, "ca sáng: không có nút 4h")
    pg.get_by_role("button", name="Chủ nhật").click()
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    kiem(pg.get_by_role("button", name="4h", exact=True).count() == 0, "Chủ nhật: không có nút 4h")

    if phieu:
        print(f"3. Màn Sửa phiếu thật {phieu[0]['overtime_date']} (chỉ xem, Lưu bị chặn)")
        gui.clear()
        pg.goto(f"{GOC}/dashboard/registrations/{phieu[0]['id']}/edit", wait_until="load", timeout=180000)
        pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=120000)
        n_the = pg.get_by_text(re.compile(r"^Nhân viên \d+$")).count()
        kiem(pg.get_by_role("button", name="Khác", exact=True).count() == n_the, f"mỗi người 1 ô chọn giờ ({n_the})")
        pg.screenshot(path=str(ANH / "5_sua_phieu.png"))
        the = pg.locator("div.rounded-xl", has=pg.get_by_text("Nhân viên 1", exact=True)).last
        the.get_by_role("button", name="4h", exact=True).click()
        pg.get_by_role("button", name=re.compile("^Lưu phiếu")).click()
        pg.wait_for_timeout(1500)
        pt = [g for g in gui if g["method"] == "PATCH"]
        kiem(len(pt) == 1, "bấm Lưu → 1 lệnh PATCH (đã chặn)")
        if pt:
            its = pt[0]["body"]["items"]
            co = {it["employee_id"] for it in its if "duration_hours" in it}
            kiem(len(co) == 1 and all(it["duration_hours"] == 4 for it in its if "duration_hours" in it),
                 "chỉ người vừa bấm 4h mang số giờ; người khác không gửi (máy chủ giữ giờ cũ)", str(co))
    br.close()

print(f"\nKẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
