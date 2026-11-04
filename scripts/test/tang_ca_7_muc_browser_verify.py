# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — 7 MỤC SỬA APP TĂNG CA (anh Hữu 04/11/2026, chiều).

 1) Đã có phiếu cùng ca trong ngày → báo ngay, ẩn phần nhập, nút Sửa / Xóa phiếu cũ (theo bộ phận)
 2) Nhân viên 1 = 4h → ô sau mặc định 4h; 3h/Khác → 3h; ô đã tự bấm giữ nguyên (đăng ký + sửa phiếu)
 3) Nút 3h / 4h / Khác to hơn ~20%
 4) Danh sách chọn tên: mỗi tên một dòng
 5) Nút PM ghi "Bắt đầu 16:30" (không ghi 16:30 – 19:30 (3h))
 6) Ô nhập "Khác" chữ 16px (iPhone không tự phóng to)
 7) Mở / quay lại app → có bản mới thì tự tải lại (không tải theo thời gian); đang nhập dở → chỉ hiện thanh báo

🛑 KHÔNG ghi gì lên Supabase: mọi POST / PATCH / DELETE bị CHẶN NGAY TRONG TRÌNH DUYỆT (page.route).
   Danh sách "phiếu đã có" (GET /api/registrations/department) được GIẢ LẬP để thử cả có/không trùng ca;
   riêng mục "chỉ thấy bộ phận mình" đọc thật (GET). Màn Sửa mở phiếu thật nhưng Lưu bị chặn.

    VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3107
    python scripts/test/tang_ca_7_muc_browser_verify.py http://localhost:3107 <thư mục ảnh>
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
token = ky_jwt({"userId": tt[0]["id"], "username": "kiemthu", "fullName": "BÀI KIỂM 7 MỤC",
                "role": "leader", "department": "HD",
                "iat": int(time.time()), "exp": int(time.time()) + 3600})
phieu = sb_get("overtime_registrations?department=eq.HD&day_type=eq.weekday&shift=eq.PM"
               "&select=id,overtime_date&order=overtime_date.desc,created_at.desc&limit=1")

from playwright.sync_api import sync_playwright  # noqa: E402

gui = []                      # các lệnh ghi bị chặn
TT = {"gia_ds": True, "ds": [], "ban": "test-a", "ban_loi": False}
PHIEU_GIA = {"id": "11111111-2222-3333-4444-555555555555", "department": "HD", "day_type": "weekday",
             "shift": "PM", "time_from": "16:30:00", "time_to": "19:30:00", "duration_hours": 3,
             "status": "pending", "created_at": "2026-11-04T04:29:50+00:00", "registered_by": None,
             "registered_by_name": "TRẦN ANH TUẤN", "items_count": 27}


def chan(route):
    req = route.request
    if req.method in ("POST", "PATCH", "PUT", "DELETE"):
        gui.append({"method": req.method, "url": req.url, "body": json.loads(req.post_data or "null")})
        if req.method == "POST":
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"id": "gia-lap-00000000", "items_count": 0}))
        else:
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True}))
    elif "/api/registrations/department" in req.url and TT["gia_ds"]:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"registrations": TT["ds"]}))
    else:
        route.continue_()


def ban(route):
    if TT["ban_loi"]:
        route.abort()
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"v": TT["ban"]}))


def the_nv(pg, n):
    return pg.locator("div.rounded-xl", has=pg.get_by_text(f"Nhân viên {n}", exact=True)).last


def chon_nv(pg, the, i=None, ten=None):
    """Mở ô chọn tên mới → bấm tên thứ i (hoặc tên trùng `ten`). Trả về chữ của tên đã bấm."""
    the.locator('button[aria-haspopup="listbox"]').click()
    hop = pg.get_by_role("dialog", name="Chọn nhân viên")
    hop.wait_for(timeout=10000)
    o = hop.get_by_role("option")
    nut = o.nth(i) if ten is None else hop.get_by_role("option", name=ten, exact=True)
    chu = nut.inner_text().strip()
    nut.click()
    return chu


def an_hien(pg, trang_thai):
    pg.evaluate("""(st) => { Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => st});
                     document.dispatchEvent(new Event('visibilitychange')); }""", trang_thai)


with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ── 7a. /api/version không cần đăng nhập ─────────────────────────────────────────────
    print("7a. /api/version")
    ctx0 = br.new_context()
    r = ctx0.request.get(f"{GOC}/api/version")
    kiem(r.status == 200 and r.json().get("v") == "test-a", "không đăng nhập vẫn đọc được mã bản (test-a)", f"{r.status} {r.text()[:80]}")
    kiem("no-store" in (r.headers.get("cache-control") or ""), "không cho lưu đệm", r.headers.get("cache-control"))
    ctx0.close()

    ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()
    pg.on("dialog", lambda d: d.accept())
    pg.route("**/api/registrations**", chan)
    pg.route("**/api/version", ban)

    # ── Mục 3, 4, 5, 6, 2 trên form đăng ký (không có phiếu trùng) ──────────────────────
    print("Form đăng ký — ngày thường, ca chiều, chưa có phiếu")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    nut_pm = pg.get_by_role("button", name=re.compile("PM · Chiều"))
    kiem("Bắt đầu 16:30" in nut_pm.inner_text() and "19:30" not in nut_pm.inner_text(),
         "5) nút PM ghi 'Bắt đầu 16:30', không còn 16:30 – 19:30", nut_pm.inner_text())
    kiem("16:30 – 06:00" not in pg.get_by_role("button", name=re.compile("AM · Sáng")).inner_text()
         and "06:00 – 07:30" in pg.get_by_role("button", name=re.compile("AM · Sáng")).inner_text(),
         "   nút AM giữ nguyên 06:00 – 07:30")
    kiem(pg.get_by_text(re.compile("Chọn 3h / 4h / Khác cho từng người")).is_visible(), "   có dòng nhắc chọn giờ từng người")
    the1 = the_nv(pg, 1)
    hb = the1.get_by_role("button", name="3h", exact=True).bounding_box()
    kiem(hb and hb["height"] >= 31, f"3) nút 3h cao {hb and round(hb['height'])}px (bản cũ 26px, +20% ≈ 31px)")
    fs = the1.get_by_role("button", name="4h", exact=True).evaluate("e => getComputedStyle(e).fontSize")
    kiem(fs == "14px", f"3) chữ nút 14px (bản cũ 12px) — {fs}")

    # Mục 4: danh sách tên
    the1.locator('button[aria-haspopup="listbox"]').click()
    hop = pg.get_by_role("dialog", name="Chọn nhân viên")
    hop.wait_for(timeout=10000)
    do = hop.get_by_role("option").evaluate_all("""els => els.map(e => ({
        h: e.clientHeight, ws: getComputedStyle(e).whiteSpace,
        cut: e.scrollWidth > e.clientWidth, t: e.innerText }))""")
    cao = {d["h"] for d in do}
    kiem(len(do) > 0 and len(cao) == 1, f"4) {len(do)} tên, mọi dòng cùng chiều cao {cao} → không tên nào xuống dòng")
    kiem(all(d["ws"] == "nowrap" for d in do), "4) kiểu chữ không xuống dòng (nowrap)")
    kiem(not [d["t"] for d in do if d["cut"]], "4) không tên nào bị cắt ở khổ 390px", str([d["t"] for d in do if d["cut"]]))
    kiem(hop.get_by_role("option").first.evaluate("e => getComputedStyle(e).fontSize") == "16px", "4) chữ tên 16px")
    pg.screenshot(path=str(ANH / "4_danh_sach_ten.png"))
    ten1 = hop.get_by_role("option").nth(0).inner_text().strip()
    hop.get_by_role("option").nth(0).click()
    kiem(not hop.is_visible() and ten1 in the1.locator('button[aria-haspopup="listbox"]').inner_text(),
         f"4) bấm tên → đóng khung, ô hiện '{ten1}'")

    # Mục 6
    the1.get_by_role("button", name="Khác", exact=True).click()
    o = the1.get_by_placeholder("Số giờ")
    kiem(o.evaluate("e => getComputedStyle(e).fontSize") == "16px", "6) ô nhập Khác chữ 16px (iPhone không tự phóng to)")
    o.fill("3,5")
    kiem(the1.get_by_text("16:30 – 20:00").is_visible(), "   Khác 3,5 → 16:30 – 20:00")

    # Mục 2 — form đăng ký
    the1.locator("div.max-h-\\[220px\\] div.grid button").first.click()
    pg.get_by_role("button", name="+ Thêm nhân viên").click()
    the2 = the_nv(pg, 2)
    kiem(the2.get_by_text("16:30 – 19:30").is_visible(), "2) NV1 = Khác → NV2 mặc định 3h")
    the1.get_by_role("button", name="4h", exact=True).click()
    kiem(the2.get_by_text("16:30 – 20:30").is_visible(), "2) đổi NV1 sang 4h → NV2 (chưa tự bấm) theo 4h")
    pg.get_by_role("button", name="+ Thêm nhân viên").click()
    the3 = the_nv(pg, 3)
    kiem(the3.get_by_text("16:30 – 20:30").is_visible(), "2) NV1 = 4h → NV3 thêm mới mặc định 4h")
    the2.get_by_role("button", name="Khác", exact=True).click()
    the2.get_by_placeholder("Số giờ").fill("2,5")
    the1.get_by_role("button", name="3h", exact=True).click()
    kiem(the3.get_by_text("16:30 – 19:30").is_visible(), "2) NV1 về 3h → NV3 (chưa tự bấm) về 3h")
    kiem(the2.get_by_text("16:30 – 19:00").is_visible(), "2) NV2 đã tự bấm Khác 2,5 → giữ nguyên")
    the1.get_by_role("button", name="4h", exact=True).click()
    kiem(the3.get_by_text("16:30 – 20:30").is_visible() and the2.get_by_text("16:30 – 19:00").is_visible(),
         "2) NV1 lại 4h → NV3 theo 4h, NV2 vẫn 2,5h")
    chon_nv(pg, the2, 1); the2.locator("div.max-h-\\[220px\\] div.grid button").first.click()
    chon_nv(pg, the3, 2); the3.locator("div.max-h-\\[220px\\] div.grid button").first.click()
    pg.screenshot(path=str(ANH / "2_ba_nguoi.png"), full_page=True)
    pg.get_by_role("button", name=re.compile("^Gửi phiếu PM")).click()
    pg.wait_for_timeout(1200)
    post = [g for g in gui if g["method"] == "POST"]
    kiem(len(post) == 1, "   bấm Gửi → 1 lệnh POST (đã chặn)")
    if post:
        gio = [it.get("duration_hours") for it in post[0]["body"]["items"]]
        kiem(gio == [4, 2.5, 4], f"2) gói gửi đi: NV1 4h · NV2 2,5h · NV3 4h — {gio}")

    # ── Mục 1: đã có phiếu cùng ca ──────────────────────────────────────────────────────
    print("1. Đã có phiếu PM cùng ngày")
    gui.clear()
    TT["ds"] = [PHIEU_GIA]
    pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    pg.get_by_role("button", name="Ngày thường").click(timeout=120000)
    canh = pg.get_by_text(re.compile(r"bộ phận HD đã có phiếu Ngày thường · PM"))
    canh.wait_for(timeout=30000)
    kiem(canh.is_visible(), "1) hiện cảnh báo 'đã có phiếu Ngày thường · PM' ngay khi chọn ngày/ca")
    kiem(pg.get_by_text(re.compile(r"Trần Anh Tuấn \(27 dòng\)")).is_visible(), "1) ghi rõ người gửi + số dòng")
    kiem(pg.get_by_text("Nhân viên 1", exact=True).count() == 0, "1) ẩn phần nhập nhân viên")
    kiem(pg.get_by_role("button", name=re.compile("^Gửi phiếu")).count() == 0, "1) ẩn nút Gửi phiếu")
    sua = pg.get_by_role("link", name="Sửa phiếu cũ")
    kiem(sua.get_attribute("href") == f"/dashboard/registrations/{PHIEU_GIA['id']}/edit", "1) nút Sửa phiếu cũ trỏ đúng phiếu")
    pg.screenshot(path=str(ANH / "1_canh_bao_trung_ca.png"), full_page=True)
    pg.get_by_role("button", name=re.compile("AM · Sáng")).click()
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=30000)
    kiem(canh.count() == 0, "1) chuyển ca AM (chưa có phiếu AM) → hết cảnh báo, hiện form")
    pg.get_by_role("button", name=re.compile("PM · Chiều")).click()
    canh.wait_for(timeout=10000)
    TT["ds"] = []      # sau khi xóa, máy chủ trả danh sách rỗng
    pg.get_by_role("button", name="Xóa phiếu cũ").click()
    pg.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=30000)
    de = [g for g in gui if g["method"] == "DELETE"]
    kiem(len(de) == 1 and de[0]["url"].endswith(PHIEU_GIA["id"]), "1) Xóa phiếu cũ → 1 lệnh DELETE đúng phiếu (đã chặn)")
    kiem(canh.count() == 0 and pg.get_by_role("button", name=re.compile("^Gửi phiếu")).count() == 1,
         "1) xóa xong → hết cảnh báo, hiện lại form để đăng ký")

    # 1) chỉ bộ phận mình — đọc THẬT (GET) danh sách phiếu ngày có cả HD lẫn CO
    TT["gia_ds"] = False
    that = pg.evaluate("async () => (await (await fetch('/api/registrations/department?date=2026-11-04')).json()).registrations")
    bp = sorted({x["department"] for x in that})
    kiem(bp == ["HD"], f"1) tổ trưởng HD chỉ nhận phiếu HD (ngày 04/11 có cả HD + CO) — nhận {bp}")
    TT["gia_ds"] = True

    # ── Mục 7: tự tải bản mới ──────────────────────────────────────────────────────────
    print("7. Tự tải bản mới")
    pg.close()
    TT["ds"] = []; TT["ban"] = "test-a"; TT["ban_loi"] = False
    p7 = ctx.new_page()
    p7.on("dialog", lambda d: d.accept())
    p7.route("**/api/registrations**", chan)
    p7.route("**/api/version", ban)
    tai = {"n": 0}
    p7.on("load", lambda _: tai.__setitem__("n", tai["n"] + 1))
    p7.clock.install()
    p7.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    p7.get_by_role("button", name="Ngày thường").wait_for(timeout=120000)
    p7.wait_for_timeout(2500)
    kiem(tai["n"] == 1, f"7) cùng bản → không tự tải lại (lần tải {tai['n']})")
    an_hien(p7, "hidden"); p7.clock.fast_forward("02:00"); an_hien(p7, "visible"); p7.wait_for_timeout(2500)
    kiem(tai["n"] == 1, "7) rời app 2 phút, cùng bản → không tải lại")
    an_hien(p7, "hidden"); p7.clock.fast_forward("02:00:00"); an_hien(p7, "visible")
    p7.wait_for_timeout(3000)
    kiem(tai["n"] == 1, f"7) rời app 2 giờ, cùng bản → KHÔNG tải lại (bỏ luật 10 phút) (lần tải {tai['n']})")
    TT["ban"] = "test-b"
    an_hien(p7, "hidden"); p7.clock.fast_forward("00:30"); an_hien(p7, "visible")
    p7.wait_for_timeout(5000)
    kiem(tai["n"] == 2, f"7) có bản mới (test-b) → quay lại app là tự tải lại 1 lần (lần tải {tai['n']})")
    p7.wait_for_timeout(3000)
    kiem(tai["n"] == 2 and p7.get_by_text(re.compile("Đã có bản mới của app")).is_visible(),
         "7) chống lặp: tải rồi mà máy chủ vẫn báo khác → không tải nữa, hiện thanh báo")
    p7.close()

    p8 = ctx.new_page()      # tab mới (sessionStorage mới)
    p8.route("**/api/registrations**", chan)
    p8.route("**/api/version", ban)
    tai8 = {"n": 0}
    p8.on("load", lambda _: tai8.__setitem__("n", tai8["n"] + 1))
    TT["ban"] = "test-a"
    p8.clock.install()
    p8.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    p8.get_by_role("button", name="Ngày thường").click(timeout=120000)
    p8.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=60000)
    chon_nv(p8, the_nv(p8, 1), 0)
    TT["ban"] = "test-c"
    an_hien(p8, "hidden"); p8.clock.fast_forward("11:00"); an_hien(p8, "visible")
    p8.wait_for_timeout(4000)
    kiem(tai8["n"] == 1, f"7) đang nhập dở + có bản mới → KHÔNG tự tải lại (lần tải {tai8['n']})")
    kiem(p8.get_by_text(re.compile("Đã có bản mới của app")).is_visible(), "7) đang nhập dở → hiện thanh báo + nút Tải lại")
    kiem(the_nv(p8, 1).locator('button[aria-haspopup="listbox"]').inner_text().strip() != "— Chọn nhân viên —",
         "7) dữ liệu đang nhập còn nguyên")
    p8.screenshot(path=str(ANH / "7_thanh_bao_ban_moi.png"))
    p8.close()

    p9 = ctx.new_page()
    p9.route("**/api/registrations**", chan)
    p9.route("**/api/version", ban)
    tai9 = {"n": 0}
    p9.on("load", lambda _: tai9.__setitem__("n", tai9["n"] + 1))
    TT["ban"] = "test-a"; TT["ban_loi"] = False
    p9.clock.install()
    p9.goto(f"{GOC}/register", wait_until="load", timeout=180000)
    p9.get_by_role("button", name="Ngày thường").wait_for(timeout=120000)
    p9.wait_for_timeout(1500)
    TT["ban_loi"] = True
    an_hien(p9, "hidden"); p9.clock.fast_forward("11:00"); an_hien(p9, "visible")
    p9.wait_for_timeout(3000)
    kiem(tai9["n"] == 1, "7) mất mạng (không hỏi được máy chủ) → không tải lại (tránh trang lỗi)")
    TT["ban_loi"] = False; TT["ban"] = "test-d"
    p9.evaluate("() => window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: true}))")
    p9.wait_for_timeout(5000)
    kiem(tai9["n"] == 2, f"7) trang khôi phục từ bộ nhớ (mở lại tab) + có bản mới → tự tải lại (lần tải {tai9['n']})")
    p9.close()
    TT["ban_loi"] = False

    # ── Mục 2 + 4 + 5 trên màn Sửa phiếu thật (Lưu bị chặn) ─────────────────────────────
    if phieu:
        print(f"Sửa phiếu thật {phieu[0]['overtime_date']} ({phieu[0]['id'][:8]}) — chỉ xem, Lưu bị chặn")
        gui.clear()
        pe = ctx.new_page()
        pe.on("dialog", lambda d: d.accept())
        pe.route("**/api/registrations**", chan)
        pe.goto(f"{GOC}/dashboard/registrations/{phieu[0]['id']}/edit", wait_until="load", timeout=180000)
        pe.get_by_text("Nhân viên 1", exact=True).wait_for(timeout=120000)
        nut_pm = pe.get_by_role("button", name=re.compile("PM · Chiều"))
        kiem("Bắt đầu 16:30" in nut_pm.inner_text(), "5) màn Sửa: nút PM ghi 'Bắt đầu 16:30'")
        n_the = pe.get_by_text(re.compile(r"^Nhân viên \d+$")).count()
        ten_tren_phieu = [the_nv(pe, k).locator('button[aria-haspopup="listbox"]').inner_text().strip()
                          for k in range(1, n_the + 1)]
        e1 = the_nv(pe, 1)
        gio1_cu = "16:30 – 20:30" if e1.get_by_text("16:30 – 20:30").is_visible() else "khác"
        e1.get_by_role("button", name="3h", exact=True).click()
        pe.get_by_role("button", name="+ Thêm nhân viên").click()
        a = the_nv(pe, n_the + 1)
        kiem(a.get_by_text("16:30 – 19:30").is_visible(), "2) Sửa: NV1 = 3h → ô mới mặc định 3h")
        e1.get_by_role("button", name="4h", exact=True).click()
        kiem(a.get_by_text("16:30 – 20:30").is_visible(), "2) Sửa: NV1 đổi 4h → ô mới (chưa tự bấm) theo 4h")
        e1.get_by_role("button", name="3h", exact=True).click()
        kiem(a.get_by_text("16:30 – 19:30").is_visible(), "2) Sửa: NV1 về 3h → ô mới về 3h")
        # Ô mới A chọn người ĐÃ có trên phiếu (NV2) → lấy giờ đang lưu của người đó, không theo NV1
        nv2 = ten_tren_phieu[1] if n_the > 1 else None
        if nv2:
            chon_nv(pe, a, ten=nv2)
            gio_nv2 = "16:30 – 20:30" if the_nv(pe, 2).get_by_text("16:30 – 20:30").is_visible() else None
            kiem(gio_nv2 is not None and a.get_by_text(gio_nv2).is_visible(),
                 f"2) Sửa: ô mới chọn người đã có trên phiếu → giờ của chính người đó ({gio_nv2})")
            a.get_by_role("button", name=re.compile("Công việc khác")).click()
            a.get_by_placeholder("VD: Vệ sinh máy lạnh").fill("Bài kiểm (bị chặn)")
        # Ô mới B chọn người CHƯA có trên phiếu → theo NV1 (3h)
        pe.get_by_role("button", name="+ Thêm nhân viên").click()
        b = the_nv(pe, n_the + 2)
        b.locator('button[aria-haspopup="listbox"]').click()
        hop = pe.get_by_role("dialog", name="Chọn nhân viên")
        moi = [t.strip() for t in hop.get_by_role("option").all_inner_texts() if t.strip() not in ten_tren_phieu]
        hop.get_by_role("option", name=moi[0], exact=True).click()
        b.get_by_role("button", name=re.compile("Công việc khác")).click()
        b.get_by_placeholder("VD: Vệ sinh máy lạnh").fill("Bài kiểm (bị chặn)")
        kiem(b.get_by_text("16:30 – 19:30").is_visible(), f"2) Sửa: ô mới người mới ({moi[0]}) theo NV1 = 3h")
        pe.screenshot(path=str(ANH / "2_sua_phieu.png"), full_page=True)
        pe.get_by_role("button", name=re.compile("^Lưu phiếu")).click()
        pe.wait_for_timeout(2000)
        pt = [g for g in gui if g["method"] == "PATCH"]
        kiem(len(pt) == 1, "   bấm Lưu → 1 lệnh PATCH (đã chặn, không tới máy chủ)")
        if pt:
            its = pt[0]["body"]["items"]
            co_gio = {}
            for it in its:
                co_gio.setdefault(it["employee_id"], set()).add(it.get("duration_hours"))
            print("      giờ gửi theo người:", {k[:8]: sorted(v, key=str) for k, v in co_gio.items()})
            khac = [it for it in its if it.get("is_other") and not it.get("id")]
            kiem(len(khac) == 2, f"   2 dòng Công việc khác mới ({len(khac)})")
            gio_moi = [it.get("duration_hours") for it in khac]
            kiem(sorted(gio_moi, key=str) == sorted([None, 3], key=str),
                 f"2) Sửa: người đã có → không gửi giờ (máy chủ giữ giờ cũ); người mới → 3h — {gio_moi}")
        pe.close()
    br.close()

print(f"\nKẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
