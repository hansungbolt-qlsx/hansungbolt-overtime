# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT THẬT — hộp hỏi khi rời màn mà còn dòng CHƯA LƯU.

Vá 14/08/2026: anh Cường mất 6 dòng S18A vì giỏ dòng đang gõ chỉ nằm trong bộ
nhớ trang — chạm tab là React tháo component, dòng chưa Lưu bay sạch, không một
lời cảnh báo. Nay chạm tab phải hỏi lại trước.

`canh_bao_chua_luu_verify.ts` đã kiểm PHẦN LÕI (hàm thuần). Bài này kiểm PHẦN
NỐI DÂY — thứ mà bài kia không với tới: cú chạm tab thật có bật hộp hỏi không,
bấm Huỷ có giữ được dòng không, và khung đỏ báo động giả đã tắt chưa.

🛑 KHÔNG CHẠM DỮ LIỆU THẬT — cam kết và có kiểm chứng:
  · Bài kiểm TUYỆT ĐỐI không bấm "Lưu phiếu" / "Gửi". Thêm dòng vào giỏ là việc
    thuần trong trình duyệt, không gửi gì lên Supabase — đúng bản chất lỗi đang
    vá: dòng chưa lưu thì chưa tồn tại ở đâu ngoài máy.
  · Trước và sau khi chạy đều ĐẾM lại số dòng + số sự kiện của phiếu thật hôm
    nay; lệch một đơn vị là bài kiểm HỎNG NGAY (xem `so_sanh_hien_trang`).

Cách chạy (mặc định bản production):
    python scripts/test/hop_hoi_roi_man_browser_verify.py [https://... | http://127.0.0.1:3000]
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

GOC = (sys.argv[1] if len(sys.argv) > 1 else "https://hansungbolt-overtime.vercel.app").rstrip("/")
REPO = Path(__file__).resolve().parents[2]

dat = 0
hong = 0


def kiem(ok: bool, ten: str, them: str = "") -> None:
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}" + (f" — {them}" if them else ""))
    if ok:
        dat += 1
    else:
        hong += 1


# ── cấu hình ───────────────────────────────────────────────────────────────
env: dict[str, str] = {}
for ln in (REPO / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in ln and not ln.strip().startswith("#"):
        k, v = ln.split("=", 1)
        env[k.strip()] = v.strip().strip("\"'")
SB, KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]


def sb_get(path: str):
    r = urllib.request.Request(f"{SB}/rest/v1/{path}",
                               headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(r, timeout=30) as f:
        return json.loads(f.read().decode())


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def ky_jwt(payload: dict) -> str:
    """JWT HS256 tự ký — khỏi thêm thư viện chỉ để làm một cái thẻ."""
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    p = b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(env["JWT_SECRET"].encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64(sig)}"


# ⚠ HAI KHOÁ BẮT BUỘC trong thẻ, thiếu một cái là bài kiểm chết không hiểu vì sao:
#   · role = 'qlsx'  — `app/register/page.tsx:18`: hai tab kho chỉ hiện khi
#     `isQlsx = session.role === 'qlsx'`. Thẻ mang 'admin' bị đẩy sang /dashboard.
#   · department      — cùng file: `if (!session.department) redirect('/login')`.
#     Thiếu nó thì /register → /login → /register → **ERR_TOO_MANY_REDIRECTS**,
#     mà thông báo lỗi chẳng nói gì về `department`. Đã mất công tìm một lần (14/08).
nguoi = sb_get("users?role=eq.qlsx&select=id,username,department&limit=1")
if not nguoi:
    print("🛑 Không có người dùng role 'qlsx' để mượn id"); sys.exit(1)
if not nguoi[0].get("department"):
    print("🛑 Người dùng qlsx không có `department` — trang sẽ đẩy về /login"); sys.exit(1)
now = int(time.time())
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM HỘP HỎI", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": now, "exp": now + 900})
print(f"Đích: {GOC}\nMượn id role qlsx: {nguoi[0]['username']} · bộ phận {nguoi[0]['department']}")


# ── chốt an toàn: hiện trạng phiếu thật TRƯỚC khi chạy ─────────────────────
def hien_trang() -> tuple[int, int, str]:
    """Đếm TOÀN BỘ phiếu của hôm nay — mọi loại, mọi nhánh, mọi seq.

    ⚠ Bản đầu chỉ lấy `s[0]` của (hôm nay, issue, nvl) mà KHÔNG sắp thứ tự. Giữa
    lúc chạy, anh Cường gửi phiếu seq 1 rồi mở phiếu seq 2 ⇒ hai lần gọi có thể
    đọc HAI phiếu khác nhau, con số nhảy từ "24 dòng · 11 sự kiện" xuống
    "11 dòng · 2 sự kiện" trông y như mất dữ liệu. Chốt an toàn mà tự cho số
    ngẫu nhiên thì vô dụng — hoặc báo động giả, hoặc bỏ sót thật.
    """
    hom_nay = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7 * 3600))
    sl = sb_get(f"nvl_day_slips?slip_date=eq.{hom_nay}&select=id&order=id")
    if not sl:
        return (0, 0, "(chưa có phiếu nào hôm nay)")
    ids = ",".join(str(s["id"]) for s in sl)
    n = len(sb_get(f"nvl_slip_lines?slip_id=in.({ids})&select=id"))
    e = len(sb_get(f"nvl_slip_events?slip_id=in.({ids})&select=id"))
    return (n, e, f"{len(sl)} phiếu · {n} dòng · {e} sự kiện")


truoc = hien_trang()
print(f"Hiện trạng phiếu thật TRƯỚC khi kiểm: {truoc[2]}")

from playwright.sync_api import sync_playwright  # noqa: E402

hop_thoai: list[str] = []
tra_loi = {"nhan": False}          # False = bấm Huỷ (ở lại) · True = bấm OK (vẫn đi)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 420, "height": 900})
    ctx.add_cookies([{
        "name": "session", "value": token,
        "url": GOC,
    }])
    pg = ctx.new_page()

    def tren_hop_thoai(d):
        hop_thoai.append(d.message)
        (d.accept if tra_loi["nhan"] else d.dismiss)()

    pg.on("dialog", tren_hop_thoai)
    pg.goto(f"{GOC}/register", wait_until="load", timeout=60000)
    # ⚠ PHẢI chờ React gắn sự kiện xong mới bấm được. Bản đầu dùng
    #   `wait_until='domcontentloaded'` rồi bấm ngay: nút CÓ đó, `click()` chạy
    #   không lỗi, nhưng onClick chưa gắn nên KHÔNG GÌ XẢY RA — trang vẫn nằm ở
    #   tab Kế hoạch SX và bài kiểm chết ở bước sau, không hiểu vì sao (14/08).
    pg.get_by_text("Kế hoạch sản xuất").first.wait_for(timeout=60000)
    pg.wait_for_timeout(2000)

    def mo_tab(ten: str, dau_hieu: str, so_lan: int = 3) -> bool:
        """Chạm tab rồi KIỂM đã sang thật chưa; chưa thì bấm lại.
        Không tự kiểm là bài kiểm báo đạt trong khi chưa từng rời tab cũ."""
        for _ in range(so_lan):
            pg.get_by_role("button", name=ten).click(timeout=30000)
            try:
                pg.get_by_text(dau_hieu).first.wait_for(timeout=25000)
                return True
            except Exception:  # noqa: BLE001 — thử lại, React có thể chưa sẵn sàng
                pg.wait_for_timeout(1500)
        return False

    # Dấu hiệu RIÊNG của màn kho (không xuất hiện ở tab nào khác)
    DAU_KHO = "Ghi chú phiếu"

    try:
        print("\n1. Vào tab Xuất kho")
        kiem(mo_tab("📤 Xuất kho", DAU_KHO), "chạm tab Xuất kho → màn kho hiện ra")
        # Phần thêm dòng chỉ hiện khi đã có mốc máy chủ (nạp phiếu xong)
        pg.get_by_text("Mã nguyên liệu").first.wait_for(timeout=60000)
        kiem(True, "phiếu hôm nay đã nạp xong (phần thêm dòng đã mở)")

        print("\n2. ⭐ KHUNG ĐỎ BÁO ĐỘNG GIẢ phải TẮT khi nạp bình thường")
        do = pg.get_by_text("Chưa tải được phiếu hôm nay")
        kiem(do.count() == 0,
             "không còn khung đỏ 'Chưa tải được phiếu hôm nay'", f"{do.count()} khung")

        print("\n3. Giỏ SẠCH → chạm tab khác phải KHÔNG hỏi gì")
        hop_thoai.clear()
        sang = mo_tab("📥 Trả kho", DAU_KHO)
        kiem(len(hop_thoai) == 0,
             "⭐ giỏ sạch thì KHÔNG bật hộp thoại (hỏi bừa là mất thiêng)",
             f"{len(hop_thoai)} hộp")
        kiem(sang, "và chuyển tab được bình thường")
        kiem(mo_tab("📤 Xuất kho", DAU_KHO), "quay lại tab Xuất kho")
        pg.get_by_text("Mã nguyên liệu").first.wait_for(timeout=60000)

        print("\n4. Thêm 1 dòng vào giỏ (KHÔNG bấm Lưu)")
        ma = None
        for c in sb_get("nvl_stock_snapshot?part=eq.nvl_main&select=payload")[0]["payload"]:
            if float(c.get("kg") or 0) > 0:
                ma = str(c["code"]); break
        if not ma:
            print("🛑 Gói tồn không có cuộn nào để tick"); sys.exit(1)
        pg.get_by_placeholder("Gõ mã / tên / size…").fill(ma)
        pg.wait_for_timeout(600)
        pg.get_by_role("button").filter(has_text=ma).first.click()
        pg.get_by_text("Chọn cuộn").first.wait_for(timeout=30000)
        pg.locator("input[type=checkbox]").first.check()
        pg.get_by_role("button", name="➕ Thêm vào phiếu").click()
        pg.get_by_text("Đã thêm vào phiếu").first.wait_for(timeout=15000)
        kiem(True, f"đã thêm 1 dòng mã {ma} vào giỏ (chưa lưu)")

        print("\n5. ⭐ Chạm tab Trả kho → PHẢI hỏi lại; bấm HUỶ thì Ở LẠI")
        hop_thoai.clear()
        tra_loi["nhan"] = False
        pg.get_by_role("button", name="📥 Trả kho").click()
        pg.wait_for_timeout(1500)
        kiem(len(hop_thoai) == 1, "🔴 có bật hộp hỏi đúng 1 lần", f"{len(hop_thoai)} hộp")
        kiem(any("CHƯA LƯU" in m for m in hop_thoai),
             "nội dung nói rõ là còn dòng chưa lưu",
             (hop_thoai[0][:60] + "…") if hop_thoai else "(không có)")
        kiem(pg.get_by_text("Mã nguyên liệu").count() > 0,
             "🔴 bấm Huỷ → VẪN Ở màn xuất kho, không bị chuyển tab")
        kiem(pg.get_by_placeholder("Gõ mã / tên / size…").count() > 0,
             "giỏ chưa bị dốc — phần thêm dòng còn nguyên")

        print("\n6. Chạm lại + bấm OK → phải cho đi (không chặn cứng)")
        hop_thoai.clear()
        tra_loi["nhan"] = True
        pg.get_by_role("button", name="📥 Trả kho").click()
        pg.wait_for_timeout(3000)
        kiem(len(hop_thoai) == 1, "có hỏi lại", f"{len(hop_thoai)} hộp")
        kiem(pg.get_by_text("➕ Trả kho nguyên liệu").count() > 0,
             "🔴 đã sang tab Trả kho thật — mạng chập không nhốt được ai")
    except Exception as e:  # noqa: BLE001
        kiem(False, f"LỖI khi chạy: {type(e).__name__}", str(e)[:200])
        pg.screenshot(path=str(REPO / "scripts" / "test" / "_hong.png"))
        print(f"      ↳ đã chụp màn hình: scripts/test/_hong.png")
    finally:
        br.close()

# ── chốt an toàn: phiếu thật KHÔNG được đổi một đơn vị nào ─────────────────
print("\n7. 🛑 CHỐT AN TOÀN — phiếu thật hôm nay phải NGUYÊN VẸN")
sau = hien_trang()
kiem(sau[0] == truoc[0] and sau[1] == truoc[1],
     "số dòng và số sự kiện y nguyên",
     f"trước {truoc[2]}  →  sau {sau[2]}")

print("\n" + "=" * 62)
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 62)
sys.exit(0 if hong == 0 else 1)
