# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — LƯU XONG PHẢI NẠP LẠI CẢ TỒN, KHÔNG CHỈ PHIẾU.

Trước bản vá 21/08/2026, `save()` chỉ gọi `loadSlip()`. Tồn chỉ nạp lúc mở màn /
đổi nhánh / đổi ngày ⇒ ngày làm 3–4 đợt thì đợt sau vẫn dùng bản chụp của đợt đầu.

🛑 AN TOÀN TUYỆT ĐỐI — KHÔNG GHI MỘT BYTE NÀO LÊN MÁY CHỦ:
   · CHẶN NGAY TRONG TRÌNH DUYỆT mọi lệnh không phải GET tới /api/** :
       - POST /api/nvl-slips  → tự trả lời "đã lưu" GIẢ, gói không hề rời máy
       - mọi lệnh ghi khác    → HUỶ THẲNG
   · Đếm phiếu + dòng trước và sau, phải y nguyên.

Phép đo: sau khi bấm Lưu, đếm số lượt gọi `/api/nvl-stock...meta=1`.
   bản CHƯA vá : không tăng
   bản ĐÃ vá   : tăng ít nhất 1

    python scripts/test/luu_xong_nap_lai_ton_verify.py http://127.0.0.1:3100
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
GOC = sys.argv[1] if len(sys.argv) > 1 else "https://hansungbolt-overtime.vercel.app"

env = {}
for f in (".env.local", ".env"):
    p = ROOT / f
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env.setdefault(k.strip(), v.strip().strip('"'))

dat = 0
hong = 0


def kiem(ok: bool, ten: str, them: str = "") -> None:
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}{f' — {them}' if them else ''}")
    if ok:
        dat += 1
    else:
        hong += 1


def sb_get(path: str):
    r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path)
    r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"])
    r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def ky_jwt(payload: dict) -> str:
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(env["JWT_SECRET"].encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64(sig)}"


def hien_trang():
    return (len(sb_get("nvl_day_slips?select=id")), len(sb_get("nvl_slip_lines?select=id")))


print(f"Đích: {GOC}\n")

# Chọn mã còn cuộn để tick — đo tại chỗ, không đóng cứng.
snap = sb_get("nvl_stock_snapshot?part=eq.nvl_main&select=payload")[0]["payload"]
from collections import Counter  # noqa: E402
dem = Counter(c["code"] for c in snap)
MA = dem.most_common(1)[0][0]
print(f"Mã đem thử (nhiều cuộn nhất trong bản chụp): {MA} · {dem[MA]} cuộn")

truoc = hien_trang()
print(f"🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

nguoi = sb_get("users?role=eq.qlsx&select=id,department&limit=1")
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM LƯU XONG NẠP TỒN", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

n_meta = 0
n_ghi_bi_chan = 0
n_ghi_bi_huy = 0

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    # ── LƯỚI CHẶN GHI — dựng TRƯỚC khi mở trang ────────────────────────────
    def chan(route):
        global n_ghi_bi_chan, n_ghi_bi_huy, n_meta
        req = route.request
        if req.method == "GET":
            if "/api/nvl-stock" in req.url and "meta=1" in req.url:
                n_meta += 1
            route.continue_()
            return
        if req.method == "POST" and "/api/nvl-slips" in req.url:
            n_ghi_bi_chan += 1
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps({"ok": True, "uid": "KIEM-THU-GIA",
                                           "n_lines": 1, "seq": 1}))
            return
        n_ghi_bi_huy += 1
        route.abort()

    pg.route("**/api/**", chan)
    # ⚠ BẮT ĐƯỢC 21/08 chiều: app bật `window.confirm` CẢNH BÁO AN TOÀN khi mã
    #   không nằm trong KHSX hôm nay (và khi mã đang có dòng ở phiếu xuất tạm).
    #   Playwright mặc định TỰ BẤM HUỶ ⇒ dòng không vào giỏ ⇒ bài kiểm báo đỏ oan.
    #   Người thật sẽ bấm OK, nên bài kiểm phải bấm OK.
    pg.on("dialog", lambda d: d.accept())

    print("\n1. Mở màn Xuất kho → Nguyên liệu")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=90000)
    ok_tab = False
    for _ in range(6):
        pg.get_by_role("button", name="📤 Xuất kho").click(timeout=30000)
        try:
            pg.get_by_text("Ghi chú phiếu").first.wait_for(timeout=25000)
            ok_tab = True
            break
        except Exception:  # noqa: BLE001
            pg.wait_for_timeout(1500)
    kiem(ok_tab, "mở được màn Xuất kho")
    pg.get_by_role("button", name="Nguyên liệu", exact=True).click(timeout=30000)
    pg.wait_for_timeout(4000)

    print(f"\n2. Chọn mã {MA} rồi tick 1 cuộn")
    pg.get_by_placeholder("Gõ mã / tên / size…").fill(MA)
    pg.wait_for_timeout(1500)
    pg.locator("button", has_text=MA).first.click(timeout=30000)
    pg.wait_for_timeout(2500)
    o = pg.locator("input[type=checkbox]").first
    o.check(timeout=30000)
    pg.wait_for_timeout(800)
    pg.get_by_role("button", name="➕ Thêm vào phiếu").first.click(timeout=30000)
    pg.wait_for_timeout(2000)
    # Đếm ĐÚNG giỏ đang soạn, không dò chữ "1 dòng" chung chung (khối phiếu cũ
    #   cũng in "N dòng" ⇒ dò lỏng là xanh giả).
    co_dong = pg.get_by_role("button", name="💾 Lưu phiếu").first.is_enabled()
    kiem(co_dong, "giỏ đã có dòng để Lưu (nút Lưu đã bật)")

    print("\n3. Bấm Lưu (gói bị chặn trong trình duyệt, KHÔNG ra khỏi máy)")
    truoc_meta = n_meta
    pg.get_by_role("button", name="💾 Lưu phiếu").first.click(timeout=30000)
    pg.wait_for_timeout(6000)
    tang = n_meta - truoc_meta

    kiem(n_ghi_bi_chan >= 1, "lệnh Lưu ĐÃ bị chặn lại trong trình duyệt",
         f"{n_ghi_bi_chan} lệnh")
    kiem(tang >= 1, "⭐ sau khi Lưu có nạp lại TỒN", f"{tang} lượt hỏi mốc tồn")

    br.close()

sau = hien_trang()
print("\n4. 🛑 CHỐT AN TOÀN")
kiem(n_ghi_bi_huy == 0, "không có lệnh ghi lạ nào", f"{n_ghi_bi_huy} lệnh bị huỷ")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
