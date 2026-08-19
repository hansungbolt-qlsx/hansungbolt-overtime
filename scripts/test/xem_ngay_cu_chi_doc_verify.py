# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — XEM NGÀY CŨ LÀ CHỈ ĐỌC, NÓI RÕ, KHÔNG GÀI BẪY.

Anh Hữu chốt 19/08/2026 sau khi anh Cường mất công sáng 19/08: về ngày 18/08,
xoá 16 dòng, rồi không tìm thấy nút Gửi — vì ô soạn CỐ Ý ẩn theo ngày.

Bốn điều phải đúng khi đang xem NGÀY CŨ:
  1. KHÔNG có nút "Xoá" nào (xoá xong không lưu được thì đừng cho xoá)
  2. Tiêu đề KHÔNG được chứa chữ "hôm nay"
  3. Phiếu BỊ TỪ CHỐI phải có thông báo "chỉ xem, muốn sửa thì tạo phiếu mới"
  4. Nút "↩ Về hôm nay" đã BỎ HẲN

🛑 KHÔNG bấm Lưu/Gửi. Không ghi một dòng nào lên Supabase.

    python scripts/test/xem_ngay_cu_chi_doc_verify.py http://127.0.0.1:3100
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
NGAY_CU = "2026-08-18"          # ngày có phiếu phụ liệu BỊ TỪ CHỐI

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


nguoi = sb_get("users?role=eq.qlsx&select=id,username,department&limit=1")
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM XEM NGÀY CŨ", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

# Chốt an toàn: đếm phiếu ngày đó TRƯỚC và SAU, phải y nguyên.
def hien_trang():
    sl = sb_get(f"nvl_day_slips?slip_date=eq.{NGAY_CU}&select=id")
    ids = ",".join(str(s["id"]) for s in sl) or "0"
    n = len(sb_get(f"nvl_slip_lines?slip_id=in.({ids})&select=id"))
    return (len(sl), n)


truoc = hien_trang()
print(f"Đích: {GOC}")
print(f"Phiếu ngày {NGAY_CU} TRƯỚC khi kiểm: {truoc[0]} phiếu · {truoc[1]} dòng\n")

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    print("1. Mở màn Xuất kho → nhánh Phụ liệu → chọn ngày cũ")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=90000)
    # ⚠ Bấm được chữ CHƯA đủ: React chưa gắn sự kiện thì click chạy không lỗi mà
    #   KHÔNG GÌ XẢY RA (bài học 14/08). Bấm rồi KIỂM đã sang thật chưa.
    def mo_tab(ten: str, dau_hieu: str, so_lan: int = 6) -> bool:
        for _ in range(so_lan):
            pg.get_by_role("button", name=ten).click(timeout=30000)
            try:
                pg.get_by_text(dau_hieu).first.wait_for(timeout=25000)
                return True
            except Exception:  # noqa: BLE001
                pg.wait_for_timeout(1500)
        return False

    kiem(mo_tab("📤 Xuất kho", "Ghi chú phiếu"), "chạm tab Xuất kho → màn kho hiện ra")
    pg.get_by_role("button", name="Phụ liệu").click(timeout=30000)
    pg.wait_for_timeout(3000)
    pg.locator("input[type=date]").fill(NGAY_CU)
    pg.wait_for_timeout(4000)
    than = pg.content()
    kiem(f"{NGAY_CU[8:]}/{NGAY_CU[5:7]}" in than, "đang xem đúng ngày cũ",
         f"{NGAY_CU[8:]}/{NGAY_CU[5:7]}")

    print("\n2. ⭐ KHÔNG được có nút Xoá nào")
    n_xoa = pg.get_by_role("button", name="Xoá", exact=True).count()
    kiem(n_xoa == 0, "⭐ 0 nút Xoá — không gài bẫy xoá-rồi-không-lưu-được",
         f"{n_xoa} nút")

    print("\n3. ⭐ Tiêu đề KHÔNG được chứa chữ 'hôm nay'")
    kiem("Phiếu hôm nay" not in than, "⭐ không còn 'Phiếu hôm nay'")
    kiem(f"Phiếu ngày {NGAY_CU[8:]}/{NGAY_CU[5:7]}" in than
         or "Phiếu mới #" in than, "tiêu đề nêu ĐÚNG ngày đang xem")

    print("\n4. ⭐ Thông báo phiếu BỊ TỪ CHỐI")
    kiem("bị từ chối và là phiếu của ngày cũ" in than,
         "⭐ có câu 'chỉ xem, không sửa được'")
    kiem("tạo phiếu mới" in than, "chỉ đúng đường ra: tạo phiếu mới")
    kiem("không trừ tồn kho" in than, "trấn an: phiếu cũ không trừ tồn")

    print("\n5. ⭐ Nút '↩ Về hôm nay' đã BỎ HẲN")
    kiem(pg.get_by_role("button", name="↩ Về hôm nay").count() == 0,
         "⭐ không còn nút Về hôm nay")
    kiem(pg.locator("input[type=date]").count() == 1,
         "vẫn còn ô ngày để tự chọn về hôm nay")

    br.close()

sau = hien_trang()
print("\n6. 🛑 CHỐT AN TOÀN")
kiem(truoc == sau, "phiếu ngày cũ y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
