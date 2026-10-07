"""CO BẮT BUỘC LOT xi mạ (anh Hữu chốt 07/10/2026): quét được LOT có trong danh sách mới nhập tiếp,
LOT không có → chặn + báo "Không có LOT này". AB (công đoạn 84) vẫn cho gõ tay.
Gốc lỗi 06/10: quét/gõ lúc danh sách LOT ĐANG tải → app coi là gõ tay (3 dòng CO có trên ERP mà hiện số thô).

Chạy (đã `npx next dev --webpack -p 3011` ở C:\\hansungbolt-overtime):
    python scripts/test/co_lot_bat_buoc_verify.py [base]
A. API — ghi THẬT Supabase nhưng CHỈ ngày giả 2020-01-02, xoá sạch cuối bài, KHÔNG Gửi.
B. Trình duyệt — chỉ gõ, KHÔNG bấm Thêm (không ghi gì).
"""
from __future__ import annotations

import sys, tempfile, time
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3011").rstrip("/")
DAY = "2020-01-02"
P = F = 0


def ck(ok, msg, extra=""):
    global P, F
    if ok: P += 1
    else: F += 1
    print(("   ok   " if ok else "   SAI  ") + msg + ("" if ok else f" — {extra}"))


def login(u, p):
    s = requests.Session()
    r = s.post(BASE + "/api/auth/login", json={"username": u, "password": p})
    # bản build production đặt cookie Secure → requests không gửi qua http; gắn tay như ab_day_live_verify.mjs
    s.cookies.clear()
    s.headers["cookie"] = (r.headers.get("set-cookie") or "").split(";")[0]
    return s, r.status_code


leader, st = login("nguyenduchieu", "hd123")
ck(st == 200, "đăng nhập tổ trưởng CO")
worker, st = login("nguyenchitrung", "hd123")
ck(st == 200, "đăng nhập tổ viên CO")

cat = worker.get(BASE + "/api/co-lots?stage=86").json()
items = cat["items"]; lots = cat["lots"]
ck(len(lots) > 500, f"danh sách LOT CO: {len(lots)} LOT")
good = lots[0]; key = good[0]; it = items[good[3]]
label = f"{key[:6]}-{key[6:]}-{good[1]}"
BAD = "2001019999"
ck(BAD not in {x[0] for x in lots}, "LOT giả không có trong danh sách")

try:
    print("A. API (ngày giả", DAY, ")")
    g = worker.get(BASE + f"/api/co-days?date={DAY}").json()
    ck(g.get("slip") is None, "ngày giả chưa có phiếu", g.get("slip"))
    emp = g["employees"][0]["id"]

    def add(lot_no, stage="86", **kw):
        line = {"machine": "CO-01" if stage == "86" else "AB-01", "lot_no": lot_no, "weight_kg": 12.5, "employee_id": emp, "note": "TEST tự động — xoá ngay"}
        line.update(kw)
        return worker.post(BASE + "/api/co-days", json={"date": DAY, "stage": stage, "line": line})

    r = add(BAD, matched=False, item_code="040120-T12W-6D", saeji="202001001")
    ck(r.status_code == 400 and "Không có LOT này" in r.json().get("error", ""), "CO: LOT không có (gõ tay) → 400 'Không có LOT này'", r.text[:160])
    r = add(BAD, matched=True, lot_label="200101-9999-NPT", item_code="X")
    ck(r.status_code == 400, "CO: LOT không có mà giả matched=true → vẫn 400", r.text[:160])
    r = add(label, lot_label="SAI", item_code="SAI-MA", saeji="999999999", lot_weight_kg=1, matched=False)
    ok = r.status_code == 200
    ln = r.json().get("line", {}) if ok else {}
    ck(ok and ln.get("lot_no") == key and ln.get("lot_label") == label and ln.get("item_code") == it[0]
       and ln.get("saeji") == good[2] and float(ln.get("lot_weight_kg")) == float(good[4]) and ln.get("matched") is True
       and float(ln.get("weight_kg")) == 12.5,
       "CO: LOT có (quét nhãn có gạch) → 200, chỉ thị/mã/kg ERP lấy từ danh sách, bỏ số điện thoại gửi, kg nhập giữ 12,5", r.text[:300])
    lid = ln.get("id")
    r = worker.patch(BASE + f"/api/co-days/lines/{lid}", json={"line": {"machine": "CO-02", "lot_no": BAD, "weight_kg": 10, "employee_id": emp, "matched": False, "item_code": "X"}})
    ck(r.status_code == 400 and "Không có LOT này" in r.text, "CO: Sửa dòng sang LOT không có → 400", r.text[:160])
    r = worker.patch(BASE + f"/api/co-days/lines/{lid}", json={"line": {"machine": "CO-02", "lot_no": key, "weight_kg": 10, "employee_id": emp}})
    after = [x for x in worker.get(BASE + f"/api/co-days?date={DAY}").json()["lines"] if x["id"] == lid]
    ck(r.status_code == 200 and after and after[0]["machine"] == "CO-02" and after[0]["lot_label"] == label, "CO: Sửa dòng LOT có → 200, đã đổi máy", r.text[:160])
    r = add("2001010001", stage="84", matched=False, lot_label=None, item_code="040120-T12W-6D", saeji="202001001")
    ck(r.status_code == 200 and r.json()["line"]["matched"] is False, "AB: LOT gõ tay vẫn cho lưu (không đổi)", r.text[:160])
    ab_lid = r.json().get("line", {}).get("id")
    # Xoá dòng: chỉ tổ trưởng (anh Hữu 07/10/2026) — tổ viên 403 cả CO lẫn AB, dòng còn nguyên; tổ trưởng 200
    for l_id, nm in ((lid, "CO"), (ab_lid, "AB")):
        r = worker.delete(BASE + f"/api/co-days/lines/{l_id}")
        ck(r.status_code == 403 and "tổ trưởng" in r.text, f"{nm}: tổ viên xoá dòng → 403", f"{r.status_code} {r.text[:120]}")
    still = [x["id"] for x in worker.get(BASE + f"/api/co-days?date={DAY}").json()["lines"]]
    ck(lid in still, "dòng CO vẫn còn sau lệnh xoá của tổ viên")
    r = leader.delete(BASE + f"/api/co-days/lines/{ab_lid}")
    ck(r.status_code == 200, "tổ trưởng xoá dòng → 200", r.text[:120])
finally:
    for stg in ("86", "84"):
        r = leader.delete(BASE + f"/api/co-days?date={DAY}&stage={stg}")
        print(f"   dọn ngày giả stage {stg}: {r.status_code}")
    for stg in ("86", "84"):
        ck(worker.get(BASE + f"/api/co-days?date={DAY}&stage={stg}").json().get("slip") is None, f"đã xoá sạch phiếu giả stage {stg}")

print("B0. Nút Xoá dòng theo vai trò (ngày có phiếu thật, CHỈ XEM — không bấm)")
REAL = "2026-10-07"
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for user, role, want in (("nguyenchitrung", "tổ viên", 0), ("nguyenduchieu", "tổ trưởng", None)):
        ctx = br.new_context(viewport={"width": 420, "height": 900})
        ctx.request.post(BASE + "/api/auth/login", data={"username": user, "password": "hd123"})
        pg = ctx.new_page(); pg.goto(BASE + "/register")
        pg.get_by_role("button", name="Sản lượng CO").first.click()
        pg.get_by_text("Kết quả ngày").first.wait_for()
        pg.wait_for_timeout(1500)
        n_sua = pg.get_by_role("button", name="Sửa", exact=True).count()
        n_xoa = pg.get_by_role("button", name="Xoá", exact=True).count()
        if want == 0:
            ck(n_xoa == 0, f"{role}: không có nút Xoá dòng (Sửa: {n_sua})", n_xoa)
        else:
            ck(n_xoa == n_sua, f"{role}: có Xoá ở mọi dòng ({n_xoa}/{n_sua})", (n_xoa, n_sua))
        ctx.close()
    br.close()

print("B. Trình duyệt (chỉ gõ, không bấm Thêm)")
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 420, "height": 900})
    lr = ctx.request.post(BASE + "/api/auth/login", data={"username": "nguyenchitrung", "password": "hd123"})
    ck(lr.ok, "trình duyệt đăng nhập tổ viên CO")
    page = ctx.new_page()

    # Làm chậm tải danh sách LOT 3 giây — đúng tình huống gốc lỗi 06/10
    def slow(route):
        time.sleep(3); route.continue_()
    page.route("**/api/co-lots**", slow)
    page.goto(BASE + "/register")
    page.get_by_role("button", name="Sản lượng CO").first.click()
    box = page.get_by_placeholder("LOT NO xi mạ (quét hoặc gõ 10 số)")
    box.wait_for()
    add_btn = page.get_by_role("button", name="Thêm dòng")
    kg_box = page.locator("input[inputmode=decimal]")
    ck(add_btn.is_disabled() and kg_box.is_disabled(), "chưa quét LOT: nút Thêm + ô kg bị khoá")
    t0 = time.time()
    box.fill(key)                      # gõ ngay khi danh sách CHƯA tải xong
    page.get_by_text(label).first.wait_for(timeout=15000)
    ck(time.time() - t0 >= 2.5, f"LOT gõ lúc danh sách đang tải → chờ tải xong rồi khớp ({time.time()-t0:.1f}s)")
    ck(not add_btn.is_disabled() and not kg_box.is_disabled() and float(kg_box.input_value()) == float(good[4]),
       f"LOT khớp: mở khoá, kg = kg ERP ({kg_box.input_value()})")
    ck(page.get_by_text("Không có LOT này").count() == 0, "LOT khớp: không báo lỗi")

    box.fill(BAD)
    page.get_by_text("Không có LOT này").first.wait_for(timeout=15000)
    ck(add_btn.is_disabled() and kg_box.is_disabled() and kg_box.input_value() == "", "LOT không có: báo 'Không có LOT này', khoá nút Thêm + ô kg, xoá kg LOT trước", kg_box.input_value())
    ck(page.get_by_placeholder("Mã hàng").count() == 0, "CO: không còn ô gõ tay mã hàng")
    shot = Path(tempfile.gettempdir()) / "co_khong_co_lot.png"
    page.screenshot(path=str(shot), full_page=True)
    print("   ảnh:", shot)

    box.fill("261003-0154-NPT")        # LOT vụ 06/10
    page.get_by_text("261003-0154-NPT").first.wait_for(timeout=15000)
    ck(not add_btn.is_disabled(), "LOT vụ 06/10 (261003-0154-NPT) khớp danh sách")

    page.get_by_role("button", name="Sản lượng AB").first.click()
    box2 = page.get_by_placeholder("LOT NO xi mạ (quét hoặc gõ 10 số)")
    box2.fill("2001010001")
    page.get_by_placeholder("Mã hàng").first.wait_for(timeout=15000)
    ck(page.get_by_text("Không có LOT này").count() == 0 and not page.get_by_role("button", name="Thêm dòng").is_disabled(),
       "AB: LOT không có → vẫn hiện ô gõ tay, không khoá (không đổi)")
    br.close()

print(f"\nKẾT QUẢ: {P} đạt · {F} sai")
sys.exit(1 if F else 0)
