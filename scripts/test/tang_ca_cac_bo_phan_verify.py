# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — 7 MỤC 04/11/2026 ÁP DỤNG CHO MỌI BỘ PHẬN CÓ TỔ TRƯỞNG (HD, RL, CO).

Anh Hữu 04/11/2026: "Áp dụng cho toàn bộ phần đăng ký tăng ca của các bộ phận". Tổ trưởng mọi bộ phận dùng
chung OvertimeForm → bài này đăng nhập lần lượt bằng tổ trưởng từng bộ phận và bấm thử các mục chính.
🛑 Không ghi gì: POST/PATCH/DELETE bị chặn trong trình duyệt; danh sách "phiếu đã có" giả lập (trừ mục
   "chỉ thấy bộ phận mình" đọc thật bằng GET).

    VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3107
    python scripts/test/tang_ca_cac_bo_phan_verify.py http://localhost:3107 <thư mục ảnh> [HD RL CO]
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
BO_PHAN = sys.argv[3:] or ["HD", "RL", "CO"]
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


from playwright.sync_api import sync_playwright  # noqa: E402

TT = {"ds": [], "gia": True}
gui = []
hoi_ban = []


def chan(route):
    req = route.request
    if req.method in ("POST", "PATCH", "PUT", "DELETE"):
        gui.append(req.method)
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
    elif "/api/registrations/department" in req.url and TT["gia"]:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"registrations": TT["ds"]}))
    else:
        route.continue_()


def ban(route):
    hoi_ban.append(1)
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"v": "test-a"}))


def the_nv(pg, n):
    return pg.locator("div.rounded-xl", has=pg.get_by_text(f"Nhân viên {n}", exact=True)).last


with sync_playwright() as pw:
    br = pw.chromium.launch()
    for bp in BO_PHAN:
        print(f"Bộ phận {bp}")
        tt = sb_get(f"users?role=eq.leader&department=eq.{bp}&select=id&limit=1")
        if not tt:
            kiem(False, f"{bp}: không có tổ trưởng"); continue
        token = ky_jwt({"userId": tt[0]["id"], "username": "kiemthu", "fullName": f"BÀI KIỂM {bp}",
                        "role": "leader", "department": bp,
                        "iat": int(time.time()), "exp": int(time.time()) + 3600})
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
        pg = ctx.new_page()
        pg.on("dialog", lambda d: d.accept())
        pg.route("**/api/registrations**", chan)
        pg.route("**/api/version", ban)
        TT["ds"] = []; TT["gia"] = True; gui.clear(); hoi_ban.clear()

        pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
        pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
        pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
        kiem(len(hoi_ban) >= 1, f"7) {bp}: trang có bộ tự kiểm bản mới (đã hỏi /api/version)")
        nut_pm = pg.get_by_role("button", name=re.compile("PM · Chiều")).inner_text()
        kiem("Bắt đầu 16:30" in nut_pm and "19:30" not in nut_pm, f"5) {bp}: nút PM 'Bắt đầu 16:30'", nut_pm)
        the1 = the_nv(pg, 1)
        hb = the1.get_by_role("button", name="3h", exact=True).bounding_box()
        kiem(hb and hb["height"] >= 31, f"3) {bp}: nút 3h cao {hb and round(hb['height'])}px")
        the1.locator('button[aria-haspopup="listbox"]').click()
        hop = pg.get_by_role("dialog", name="Chọn nhân viên")
        do = hop.get_by_role("option").evaluate_all(
            "els => els.map(e => ({h: e.clientHeight, cut: e.scrollWidth > e.clientWidth, t: e.innerText}))")
        kiem(len(do) > 0 and len({d["h"] for d in do}) == 1 and not any(d["cut"] for d in do),
             f"4) {bp}: {len(do)} tên, mỗi tên một dòng, không bị cắt")
        pg.screenshot(path=str(ANH / f"{bp}_danh_sach_ten.png"))
        hop.get_by_role("option").first.click()
        the1.get_by_role("button", name="Khác", exact=True).click()
        kiem(the1.get_by_placeholder("Số giờ").evaluate("e => getComputedStyle(e).fontSize") == "16px",
             f"6) {bp}: ô Khác chữ 16px")
        the1.get_by_role("button", name="4h", exact=True).click()
        pg.get_by_role("button", name="+ Thêm nhân viên").click()
        kiem(the_nv(pg, 2).get_by_text("16:30 – 20:30").is_visible(), f"2) {bp}: NV1 4h → NV2 mặc định 4h")
        the1.get_by_role("button", name="3h", exact=True).click()
        kiem(the_nv(pg, 2).get_by_text("16:30 – 19:30").is_visible(), f"2) {bp}: NV1 về 3h → NV2 theo 3h")

        TT["ds"] = [{"id": "11111111-2222-3333-4444-555555555555", "department": bp, "day_type": "weekday",
                     "shift": "PM", "time_from": "16:30:00", "time_to": "19:30:00", "duration_hours": 3,
                     "status": "pending", "registered_by": None,
                     "created_at": "2026-11-04T04:29:50+00:00", "registered_by_name": "TỔ TRƯỞNG",
                     "items_count": 5}]
        pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
        pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
        canh = pg.get_by_text(re.compile(rf"bộ phận {bp} đã có phiếu Ngày thường · PM"))
        canh.wait_for(timeout=30000)
        kiem(canh.is_visible() and pg.get_by_text("Nhân viên 1", exact=True).count() == 0,
             f"1) {bp}: đã có phiếu PM → cảnh báo + ẩn phần nhập")
        pg.screenshot(path=str(ANH / f"{bp}_canh_bao.png"), full_page=True)
        TT["gia"] = False
        that = pg.evaluate("async () => (await (await fetch('/api/registrations/department?date=2026-11-04')).json()).registrations")
        kiem({x["department"] for x in that} <= {bp}, f"1) {bp}: chỉ nhận phiếu bộ phận mình (thật, 04/11): "
             f"{sorted({x['department'] for x in that})}")
        kiem(not gui, f"   {bp}: không có lệnh ghi nào", str(gui))
        ctx.close()
    br.close()

print(f"\nKẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
