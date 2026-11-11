# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — tab 🎨 Kho sơn (anh Hữu chốt 11/11/2026), khổ điện thoại 390 px.

🛑 KHÔNG ghi Supabase: MỌI lệnh gọi /api/kho-son bị chặn NGAY TRONG TRÌNH DUYỆT (route.fulfill) — GET trả số tồn
giả lập dựng từ state THẬT app Coating (rev 433), POST/PATCH chỉ bị BẮT LẠI để soi nội dung gửi đi.
Đăng nhập: ký JWT tạm cho 1 tổ trưởng CO có thật (chỉ ĐỌC bảng users).

    python scripts/test/kho_son_browser_verify.py http://127.0.0.1:3100 <đường dẫn ton_gia.json>
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


r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/users?department=eq.CO&role=eq.leader&select=id&limit=1")
r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"])
r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
UID = json.loads(urllib.request.urlopen(r, timeout=60).read())[0]["id"]
token = ky({"userId": UID, "username": "kiemthu_ks", "fullName": "BÀI KIỂM KHO SƠN", "role": "leader", "department": "CO",
            "iat": int(time.time()), "exp": int(time.time()) + 3600})

PHIEU = []          # danh sách phiếu giả trả cho GET
BAT = []            # (method, body) các lệnh ghi bị bắt lại


def chan(route):
    rq = route.request
    if rq.method == "GET":
        return route.fulfill(json={"ton": TON, "phieu": PHIEU, "user_id": UID, "duoc_xuat": True})
    body = json.loads(rq.post_data or "{}")
    BAT.append((rq.method, body))
    if rq.method == "POST":
        PHIEU.insert(0, {"so_phieu": "XS-261111-01", "ngay": body["ngay"], "status": "pending", "version": 1,
                         "lines": [{**d, "line_id": f"XS-261111-01-{i + 1}"} for i, d in enumerate(body["lines"])],
                         "history": [], "cancel_reason": None, "created_by": UID, "created_by_name": "BÀI KIỂM KHO SƠN",
                         "sent_at": "2026-11-11T07:00:00Z", "synced_at": None, "main_version": None, "last_error": None})
        return route.fulfill(json={"ok": True, "so_phieu": "XS-261111-01"})
    return route.fulfill(json={"ok": True, "version": 2})


from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 390, "height": 860})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()
    pg.route("**/api/kho-son**", chan)
    hoi = []
    pg.on("dialog", lambda d: (hoi.append(d.message), d.accept("thử đổi lô")))

    print("1. Mở tab Kho sơn")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=120000)
    for _ in range(6):
        pg.get_by_role("button", name="🎨 Kho sơn").click(timeout=60000)
        try:
            pg.get_by_text("Tồn kho", exact=True).wait_for(timeout=20000)
            break
        except Exception:  # noqa: BLE001
            pg.wait_for_timeout(1500)
    than, t0 = pg.content(), pg.inner_text("body")
    kiem("593SB · ND Blue" in t0 and "Main 19 thùng" in t0, "tồn sơn xanh: Main 19 thùng")
    kiem("344,66 kg" in t0, "quy kg: 19 × 18,14 = 344,66 kg")
    kiem("① 4825022: 6" in pg.inner_text("body"), "lô ① = 4825022 (HSD sớm nhất) 6 thùng")
    kiem("080130-ZM6R-D" in than, "cảnh báo mã chưa có định mức")
    w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    kiem(w[0] <= w[1], "không tràn ngang ở 390 px", str(w))
    pg.screenshot(path=str(ANH / "kho_son_1_ton.png"), full_page=True)

    print("2. Xuất: chia lô cũ trước, chặn số lẻ, đổi lô bắt lý do")
    chon = pg.locator("select").first
    chon.select_option("blue")
    o = pg.get_by_placeholder("số thùng")
    o.fill("1.5")
    pg.get_by_role("button", name="Thêm").click()
    kiem(pg.get_by_text("Sơn xuất nguyên thùng").count() > 0, "1,5 thùng → báo xuất nguyên thùng")
    o.fill("7")
    pg.get_by_role("button", name="Thêm").click()
    pg.wait_for_timeout(300)
    t = pg.inner_text("body")
    kiem("Gửi phiếu (2 dòng)" in t, "7 thùng tự chia 2 lô (6 + 1)")
    kiem("6 thùng (108,84 kg)" in t and "1 thùng (18,14 kg)" in t, "mỗi dòng hiện kg: 6 thùng = 108,84 kg, 1 thùng = 18,14 kg")
    chon.select_option("toluene")
    pg.get_by_placeholder("lít").fill("10,5")
    pg.get_by_role("button", name="Thêm").click()
    pg.wait_for_timeout(300)
    # đổi lô dòng 2 (0426022, 1 thùng) sang 0726001 → còn lô 0426022 cũ hơn chưa hết → phải hỏi lý do
    pg.locator("select").nth(2).select_option(label="0726001 · HSD 09/02/2027")
    pg.wait_for_timeout(300)
    kiem(any("lô cũ hơn" in m for m in hoi), "đổi sang lô mới hơn → hỏi lý do", str(hoi))
    kiem("Đổi lô: thử đổi lô" in pg.inner_text("body"), "lý do đổi lô hiện trên dòng")
    pg.screenshot(path=str(ANH / "kho_son_2_xuat.png"), full_page=True)
    pg.get_by_role("button", name="Gửi phiếu (3 dòng)").click()
    pg.get_by_text("Đã gửi XS-261111-01").wait_for(timeout=15000)
    m, b = BAT[-1]
    kiem(m == "POST" and [(d["product_id"], d["lot_id"], d["qty"]) for d in b["lines"]] ==
         [("blue", "L4825022", 6), ("blue", "L0726001", 1), ("toluene", next(l["lot_id"] for l in TON["san_pham"][2]["lo"]), 10.5)],
         "nội dung gửi đúng: 6 thùng lô ①, 1 thùng lô đổi, 10,5 lít", json.dumps(b["lines"], ensure_ascii=False)[:200])
    kiem(b["lines"][1]["doi_lo_ly_do"] == "thử đổi lô", "lý do đổi lô gửi kèm")

    print("3. Phiếu đã gửi: trừ tạm tồn + sửa / huỷ")
    t = pg.inner_text("body")
    kiem("⏳ Chờ đồng bộ" in t, "phiếu hiện ⏳ Chờ đồng bộ")
    kiem("Main 12 thùng" in t.replace("\n", " ") or "Main 12" in t, "tồn trừ tạm ngay: 19 − 7 = 12 thùng")
    pg.get_by_text("XS-261111-01", exact=True).click()
    pg.get_by_role("button", name="Sửa", exact=True).click()
    pg.get_by_placeholder("Lý do sửa (bắt buộc)").fill("đếm lại")
    pg.get_by_role("button", name="Lưu sửa").click()
    pg.wait_for_timeout(800)
    m, b = BAT[-1]
    kiem(m == "PATCH" and b["action"] == "sua" and b["version"] == 1 and b["reason"] == "đếm lại" and len(b["lines"]) == 3,
         "Sửa → PATCH sua v1 + lý do + đủ dòng")
    if pg.get_by_role("button", name="Huỷ", exact=True).count() == 0:
        pg.get_by_text("XS-261111-01", exact=True).click()
    pg.get_by_role("button", name="Huỷ", exact=True).click()
    pg.wait_for_timeout(800)
    m, b = BAT[-1]
    kiem(m == "PATCH" and b["action"] == "huy" and b["reason"], "Huỷ → hỏi lý do → PATCH huy")
    pg.screenshot(path=str(ANH / "kho_son_3_phieu.png"), full_page=True)
    br.close()

print(f"\nLệnh ghi bị chặn trong trình duyệt (không tới Supabase): {[(m, b.get('action', '')) for m, b in BAT]}")
print(f"KẾT QUẢ: {dat} đạt · {hong} hỏng")
sys.exit(1 if hong else 0)
