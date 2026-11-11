# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — tab 🎨 Kho sơn (anh Hữu chốt 11/11/2026), khổ iPhone 390 px.

🛑 KHÔNG ghi Supabase: MỌI lệnh gọi /api/kho-son bị chặn NGAY TRONG TRÌNH DUYỆT (route.fulfill) — GET trả số tồn
giả lập dựng từ state THẬT app Coating, POST/PATCH chỉ bị BẮT LẠI để soi nội dung gửi đi.
Đăng nhập: ký JWT tạm cho 1 tổ trưởng CO + 1 tổ viên CO có thật (chỉ ĐỌC bảng users).
Next dev phải mở bằng http://localhost:3100 (127.0.0.1 bị Next chặn mã giao diện → bấm không ăn).

    python scripts/test/kho_son_browser_verify.py http://localhost:3100 <đường dẫn ton_gia.json>
"""
import base64
import hashlib
import hmac
import io
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[2]
GOC = sys.argv[1]
TON = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
ANH = Path(sys.argv[2]).parent
BLUE = next(p for p in TON["san_pham"] if p["product_id"] == "blue")
LO = BLUE["lo"]                                   # thứ tự xuất theo app chính

env = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        env.setdefault(k.strip(), v.strip().strip('"'))
dat = hong = 0


def kiem(ok, ten, them=""):
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}{f' — {them}' if them else ''}")
    dat, hong = dat + bool(ok), hong + (not ok)


def b64(b):
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def ky(payload):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{h}.{p}.{b64(hmac.new(env['JWT_SECRET'].encode(), f'{h}.{p}'.encode(), hashlib.sha256).digest())}"


def nguoi(role):
    r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + f"/rest/v1/users?department=eq.CO&role=eq.{role}&select=id&limit=1")
    r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"])
    r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
    uid = json.loads(urllib.request.urlopen(r, timeout=60).read())[0]["id"]
    return ky({"userId": uid, "username": f"kiemthu_ks_{role}", "fullName": f"BÀI KIỂM {role.upper()}", "role": role,
               "department": "CO", "iat": int(time.time()), "exp": int(time.time()) + 3600})


def hn(d):
    return f"{d[8:10]}/{d[5:7]}/{d[:4]}"


PHIEU = []
BAT = []


def chan_cho(duoc_xuat):
    def chan(route):
        rq = route.request
        if rq.method == "GET":
            return route.fulfill(json={"ton": TON, "phieu": PHIEU, "duoc_xuat": duoc_xuat})
        body = json.loads(rq.post_data or "{}")
        BAT.append((rq.method, body))
        if rq.method == "POST":
            PHIEU.insert(0, {"so_phieu": "XS-261112-01", "ngay": body["ngay"], "status": "pending", "version": 1,
                             "lines": [{**d, "line_id": f"XS-261112-01-{i + 1}"} for i, d in enumerate(body["lines"])],
                             "history": [], "cancel_reason": None, "created_by": "x", "created_by_name": "BÀI KIỂM",
                             "sent_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "synced_at": None,
                             "main_version": None, "last_error": None})
            return route.fulfill(json={"ok": True, "so_phieu": "XS-261112-01"})
        return route.fulfill(json={"ok": True, "version": 2})
    return chan


from playwright.sync_api import sync_playwright  # noqa: E402


def mo_tab(pg):
    for _ in range(6):
        pg.get_by_role("button", name="🎨 Kho sơn").click(timeout=60000)
        try:
            pg.get_by_text("Tồn kho", exact=True).wait_for(timeout=20000)
            return True
        except Exception:  # noqa: BLE001
            pg.wait_for_timeout(1500)
    return False


with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ───────────────────────── tổ trưởng
    ctx = br.new_context(viewport={"width": 390, "height": 860}, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "session", "value": nguoi("leader"), "url": GOC}])
    pg = ctx.new_page()
    pg.route("**/api/kho-son**", chan_cho(True))
    hoi = []
    pg.on("dialog", lambda d: (hoi.append(d.message), d.accept("thử đổi lô")))
    pg.goto(f"{GOC}/register", wait_until="load", timeout=120000)

    print("1. Tồn kho ghi rõ số thùng + hết hạn")
    kiem(mo_tab(pg), "mở tab Kho sơn")
    t = pg.inner_text("body")
    l0 = LO[0]
    kiem(f"Lô {l0['lot_no']}" in t and f"{int(l0['ton'])} thùng" in t and f"Hết hạn {hn(l0['han'])}" in t,
         f"lô ①: 'Lô {l0['lot_no']} · {int(l0['ton'])} thùng · Hết hạn {hn(l0['han'])}'")
    kiem(all(f"Lô {l['lot_no']}" in t for l in LO), f"đủ {len(LO)} lô sơn xanh")
    tol = next(p for p in TON["san_pham"] if p["product_id"] == "toluene")["lo"][0]
    kiem(f"Nhập {hn(tol['ngay_nhap'])}" in t, f"hoá chất không số lô → ghi ngày nhập {hn(tol['ngay_nhap'])}")
    w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    kiem(w[0] <= w[1], "không tràn ngang 390 px", str(w))
    pg.screenshot(path=str(ANH / "ks_m_1_ton.png"), full_page=True)

    print("2. Ngày xuất gọn dd/mm/yyyy")
    hom = time.strftime("%d/%m/%Y", time.gmtime(time.time() + 7 * 3600))
    kiem(hom in t and "thg" not in t, f"ngày xuất hiện '{hom}', không còn 'ngày … thg …'")

    print("3. Ô nhập 16 px (iPhone không phóng to) + chia lô FIFO + LOT nổi bật")
    o = pg.locator("input[inputmode]").first
    fs = [pg.locator("select").first.evaluate("e => getComputedStyle(e).fontSize"), o.evaluate("e => getComputedStyle(e).fontSize")]
    kiem(all(x == "16px" for x in fs), "chữ ô chọn vật tư + ô số lượng = 16 px", str(fs))
    pg.locator("select").first.select_option("blue")
    o = pg.get_by_placeholder("số thùng")
    o.fill("1.5")
    pg.get_by_role("button", name="Thêm").click()
    kiem(pg.get_by_text("Sơn xuất nguyên thùng").count() > 0, "1,5 thùng → báo xuất nguyên thùng")
    o.fill("7")
    pg.get_by_role("button", name="Thêm").click()
    pg.wait_for_timeout(300)
    sel = [pg.locator("select").nth(i).input_value() for i in range(1, pg.locator("select").count())]
    can, con = [], 7
    for l in LO:
        if con <= 0:
            break
        can.append(l["lot_id"])
        con -= min(int(l["ton"]), con)
    kiem(sel == can, f"7 thùng tự chia FIFO: {[l['lot_no'] for l in LO if l['lot_id'] in can]}", str(sel))
    fw = pg.locator("select").nth(1).evaluate("e => [getComputedStyle(e).fontWeight, getComputedStyle(e).fontSize]")
    kiem(int(fw[0]) >= 700 and fw[1] == "16px", "ô LOT xuất in đậm 16 px", str(fw))
    kiem("tự chọn lô cũ trước" in pg.inner_text("body"), "ghi rõ 'tự chọn lô cũ trước'")
    kiem(pg.locator("select").first.input_value() == "", "Thêm xong → ô chọn vật tư về '— Chọn vật tư —'")
    # Tailwind 4 trả màu viền dạng lab(…) — đỏ = trục a lớn (> 50); bóng mờ giữ dạng rgba(239, 68, 68, …)
    vien = [pg.locator(x).first.evaluate("e => [getComputedStyle(e).borderTopColor, getComputedStyle(e).boxShadow, getComputedStyle(e).borderTopWidth]")
            for x in ("select", "input[inputmode]")]
    do = lambda c: ("239, 68, 68" in c) or (c.startswith("lab(") and float(c[4:-1].split()[1]) > 50)
    kiem(all(do(v[0]) and v[2] == "2px" and "rgba(239, 68, 68, 0.15) 0px 0px 0px 4px" in v[1] for v in vien),
         "ô vật tư + ô số lượng viền đỏ 2 px, bóng đỏ mờ 4 px", str([v[0] for v in vien]))
    for _ in range(len(sel)):
        pg.get_by_role("button", name="Bỏ", exact=True).first.click()
    pg.locator("select").first.select_option("blue")
    pg.get_by_placeholder("số thùng").fill("1")
    pg.get_by_role("button", name="Thêm").click()
    pg.locator("select").nth(1).select_option(LO[2]["lot_id"])
    pg.wait_for_timeout(300)
    kiem(any("lô cũ hơn" in m for m in hoi), "đổi sang lô mới hơn → hỏi lý do", str(hoi))
    pg.screenshot(path=str(ANH / "ks_m_2_xuat.png"), full_page=True)
    pg.get_by_role("button", name="Gửi phiếu (1 dòng)").click()
    pg.get_by_text("Đã gửi XS-261112-01").wait_for(timeout=15000)
    m, b = BAT[-1]
    kiem(m == "POST" and b["lines"][0]["lot_id"] == LO[2]["lot_id"] and b["lines"][0]["doi_lo_ly_do"] == "thử đổi lô",
         "gửi đúng lô đã đổi + lý do")
    pg.wait_for_timeout(500)
    the = pg.locator("div.ring-2")
    kiem(the.count() == 1 and LO[2]["lot_no"] in the.inner_text(), "phiếu vừa gửi tô nổi (viền xanh) + có số LOT")
    lb = the.locator("b.underline").first.evaluate("e => [e.textContent, getComputedStyle(e).fontWeight]")
    kiem(lb[0] == LO[2]["lot_no"] and int(lb[1]) >= 700, f"LOT {LO[2]['lot_no']} in đậm, gạch chân", str(lb))
    pg.screenshot(path=str(ANH / "ks_m_3_phieu.png"), full_page=True)

    print("4. Sửa / Xoá (chữ 'Xoá' thay 'Huỷ')")
    kiem(pg.get_by_role("button", name="Huỷ", exact=True).count() == 0, "không còn nút 'Huỷ'")
    pg.get_by_role("button", name="Xoá", exact=True).click()
    pg.wait_for_timeout(600)
    m, b = BAT[-1]
    kiem(m == "PATCH" and b["action"] == "huy" and any("Xoá phiếu" in x for x in hoi),
         "bấm Xoá → hỏi 'Xoá phiếu …? Ghi lý do' → gửi lệnh xoá")
    kiem(pg.get_by_text("Đã xoá XS-261112-01").count() > 0, "báo 'Đã xoá …'")
    ctx.close()

    # ───────────────────────── tổ viên
    print("5. Tổ viên CO: chỉ xem")
    ctx = br.new_context(viewport={"width": 390, "height": 860}, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "session", "value": nguoi("worker"), "url": GOC}])
    pg = ctx.new_page()
    pg.route("**/api/kho-son**", chan_cho(False))
    pg.goto(f"{GOC}/register", wait_until="load", timeout=120000)
    kiem(mo_tab(pg), "tổ viên mở được tab Kho sơn (xem tồn)")
    pg.get_by_text("XS-261112-01", exact=True).click()
    pg.wait_for_timeout(400)
    t = pg.inner_text("body")
    kiem("Xuất sơn" not in t, "không có phần Xuất sơn")
    kiem(pg.get_by_role("button", name="Sửa", exact=True).count() == 0 and pg.get_by_role("button", name="Xoá", exact=True).count() == 0
         and "báo admin" not in t, "không có nút Sửa / Xoá, không hiện dòng nhắc quyền")
    ctx.close()
    br.close()

print(f"\nLệnh ghi bị chặn trong trình duyệt (không tới Supabase): {[(m, b.get('action', '')) for m, b in BAT]}")
print(f"KẾT QUẢ: {dat} đạt · {hong} hỏng")
sys.exit(1 if hong else 0)
