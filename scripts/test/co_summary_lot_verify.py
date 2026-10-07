"""Tổng hợp sản lượng (app tăng ca) — anh Hữu chốt 07/10/2026:
  · cột Mã hàng CHỈ mã, không tên hàng
  · bấm số LOT → mở danh sách chi tiết từng LOT: LOT NO · Trọng lượng (Kg) · Số lượng (EA) — chỉ 3 cột
CHỈ ĐỌC (không ghi gì): đọc phiếu thật của 1 ngày đã có dữ liệu.
Chạy: python scripts/test/co_summary_lot_verify.py [base] [YYYY-MM-DD]   (mặc định http://localhost:3011 · 2026-10-06)
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3011").rstrip("/")
DAY = sys.argv[2] if len(sys.argv) > 2 else "2026-10-06"
P = F = 0


def ck(ok, msg, extra=""):
    global P, F
    if ok: P += 1
    else: F += 1
    print(("   ok   " if ok else "   SAI  ") + msg + ("" if ok else f" — {extra}"))


s = requests.Session()
r = s.post(BASE + "/api/auth/login", json={"username": "nguyenduchieu", "password": "hd123"})
s.headers["cookie"] = (r.headers.get("set-cookie") or "").split(";")[0]; s.cookies.clear()
ck(r.status_code == 200, "đăng nhập tổ trưởng CO")

print("A. API /api/co-summary", DAY)
j = s.get(BASE + f"/api/co-summary?date={DAY}").json()
lines = s.get(BASE + f"/api/co-days?date={DAY}").json()["lines"]
b86 = next(b for b in j["stages"] if b["stage"] == "86")
ck(b86["n_lot"] == len(lines) and len(lines) > 0, f"khối CO: {b86['n_lot']} LOT = số dòng phiếu {len(lines)}")
for it in b86["items"]:
    lots = it.get("lots") or []
    ck(len(lots) == it["n_lot"], f"{it['item_code']}: {len(lots)} dòng chi tiết = {it['n_lot']} LOT")
    ck(abs(sum(x["kg"] for x in lots) - it["kg"]) < 1e-6, f"  Σ kg chi tiết = {it['kg']}")
    ck(all(set(x) == {"lot", "kg", "ea"} for x in lots), "  mỗi LOT đúng 3 thông tin lot · kg · ea")
    ck(all("-" in x["lot"] for x in lots), "  LOT đúng định dạng xi mạ (có gạch)", [x["lot"] for x in lots])
    if it["g_ea"]:
        ck(all(x["ea"] == round(x["kg"] * 1000 / it["g_ea"]) for x in lots), f"  EA từng LOT = kg×1000÷{it['g_ea']}")
        ck(sum(x["ea"] for x in lots) == it["ea"], f"  Σ EA từng LOT {sum(x['ea'] for x in lots):,} = EA dòng mã {it['ea']:,} (khớp tuyệt đối)")
ck(b86["total_ea"] == sum(i["ea"] or 0 for i in b86["items"]), f"Tổng EA khối CO {b86['total_ea']:,} = Σ EA các mã")
mine = {l["lot_no"]: l for l in lines}
for raw in ("2610030154", "2609240006", "2609240001"):
    if raw in mine:
        allots = [x["lot"] for it in b86["items"] for x in it["lots"]]
        ck(any(x.startswith(f"{raw[:6]}-{raw[6:]}-") for x in allots), f"LOT gõ tay cũ {raw} hiện nhãn chuẩn")

print("B. Trình duyệt (chỉ xem)")
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 420, "height": 900})
    ctx.request.post(BASE + "/api/auth/login", data={"username": "nguyenduchieu", "password": "hd123"})
    page = ctx.new_page()
    page.goto(BASE + "/register")
    page.get_by_role("button", name="Tổng hợp sản lượng").first.click()
    # về đúng ngày cần xem bằng nút ←
    from datetime import date
    for _ in range((date.today() - date.fromisoformat(DAY)).days):
        page.get_by_label("Ngày trước").click()
    blk = page.locator("div.overflow-hidden", has_text="Công đoạn CO (86)").first
    blk.locator("tbody").first.wait_for()
    it0 = b86["items"][0]
    ck(blk.get_by_text(it0["item_code"], exact=True).count() >= 1, f"có mã {it0['item_code']}")
    names = [i["item_name"] for i in b86["items"] if i["item_name"]]
    ck(all(blk.get_by_text(n, exact=True).count() == 0 for n in names), "không còn hiện tên hàng", names)
    btn = blk.get_by_role("button", name=f"{it0['n_lot']} ▾").first
    btn.click()
    sub = blk.locator("table table").first
    sub.wait_for()
    heads = [h.inner_text().strip() for h in sub.locator("th").all()]
    ck(heads == ["LOT NO", "Trọng lượng (Kg)", "Số lượng (EA)"], "bảng chi tiết đúng 3 cột", heads)
    ck(sub.locator("tbody tr").count() == it0["n_lot"], f"{it0['n_lot']} dòng LOT")
    ck(it0["lots"][0]["lot"] in sub.inner_text(), f"có LOT {it0['lots'][0]['lot']}")
    shot = Path(tempfile.gettempdir()) / "co_summary_lot.png"
    page.screenshot(path=str(shot), full_page=True); print("   ảnh:", shot)
    # Vừa chiều ngang (anh Hữu 07/10/2026): không phần tử nào tràn ngang, cả khi mở chi tiết, ở 3 cỡ điện thoại
    for w in (320, 360, 375, 390):
        page.set_viewport_size({"width": w, "height": 900})
        page.wait_for_timeout(200)
        over = page.evaluate("""() => {
          const doc = document.documentElement.scrollWidth > window.innerWidth;
          const bad = [...document.querySelectorAll('table')].filter(t => t.scrollWidth > t.parentElement.clientWidth + 1).length;
          return {doc, bad};
        }""")
        ck(not over["doc"] and over["bad"] == 0, f"rộng {w}px (đang mở chi tiết): không tràn ngang", over)
        if w >= 360:
            # mã hàng nằm 1 dòng (chiều cao ô mã ≈ 1 dòng chữ) ở cỡ điện thoại thường
            # đếm số dòng chữ thật trong ô mã (số mức 'top' khác nhau của các mảnh chữ)
            hs = page.evaluate("""() => [...document.querySelectorAll('tbody > tr > td:first-child.font-bold')].map(td => {
                                     const r = document.createRange(); r.selectNodeContents(td);
                                     const tops = new Set([...r.getClientRects()].map(x => Math.round(x.top)));
                                     return [td.innerText, tops.size]; })""")
            ck(all(n == 1 for _, n in hs), f"  rộng {w}px: mã hàng không xuống dòng", hs)
    page.set_viewport_size({"width": 375, "height": 900})
    page.screenshot(path=str(Path(tempfile.gettempdir()) / "co_summary_375.png"), full_page=True)
    blk.get_by_role("button", name=f"{it0['n_lot']} ▴").first.click()
    ck(blk.locator("table table").count() == 0, "bấm lại → đóng chi tiết")
    br.close()

print(f"\nKẾT QUẢ: {P} đạt · {F} sai")
sys.exit(1 if F else 0)
