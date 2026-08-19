# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT THẬT — GÓI VỀ MUỘN KHÔNG ĐƯỢC ĐỔ ĐẦY RỔ.

Dựng lại đúng sự cố 18/08/2026: phiếu `ot-2026-08-18-issue-aux-1` sinh ra mang
**16 dòng NGUYÊN LIỆU**. Màn Xuất kho luôn mở ở nhánh Nguyên liệu và nạp một gói
NẶNG; bấm ngay sang Phụ liệu thì gói phụ liệu (nhẹ) về trước, gói nguyên liệu về
sau và **đổ dòng NVL vào rổ vừa dốc**.

CÁCH DỰNG LẠI: chặn đường mạng của `/api/nvl-slips?...branch=nvl...` rồi cho nó
về CHẬM. Không cần mạng thật chập chờn — đó cũng đúng bản chất lỗi.

🛑 BÀI NÀY KHÔNG BAO GIỜ BẤM "Lưu"/"Gửi" — chỉ đọc màn hình. Không ghi một dòng
   nào lên Supabase.

    python scripts/test/doi_nhanh_ve_muon_browser_verify.py            # bản CHƯA vá (production)
    python scripts/test/doi_nhanh_ve_muon_browser_verify.py http://127.0.0.1:3100
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
CHAM_GIAY = 4.0        # gói nguyên liệu về muộn bao nhiêu giây

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


# Thẻ phải có role='qlsx' VÀ `department`, nếu không `/register` đá về /login
# (bẫy đã mất công tìm một lần ngày 14/08 — xem `hop_hoi_roi_man_browser_verify.py`).
nguoi = sb_get("users?role=eq.qlsx&select=id,username,department&limit=1")
if not nguoi or not nguoi[0].get("department"):
    print("🛑 Không mượn được người dùng qlsx có bộ phận")
    sys.exit(1)
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM GÓI VỀ MUỘN", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

from playwright.sync_api import sync_playwright  # noqa: E402

XUAT = "📤 Xuất kho"
print(f"Đích: {GOC}")
print(f"Mượn id qlsx: {nguoi[0]['username']} · bộ phận {nguoi[0]['department']}\n")

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    cham = {"n": 0}

    def lam_cham(route):
        """Gói của nhánh NGUYÊN LIỆU về muộn — đúng bản chất sự cố 18/08."""
        if "branch=nvl" in route.request.url:
            cham["n"] += 1
            time.sleep(CHAM_GIAY)
        route.continue_()

    pg.route("**/api/nvl-slips?**", lam_cham)

    print("1. Mở màn Xuất kho (luôn khởi động ở nhánh Nguyên liệu)")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=90000)
    pg.get_by_role("button", name=XUAT).click(timeout=60000)
    kiem(True, "đã chạm tab Xuất kho")

    print(f"\n2. BẤM NGAY sang Phụ liệu, không đợi gói nguyên liệu ({CHAM_GIAY}s) về")
    pg.get_by_role("button", name="Phụ liệu").click(timeout=30000)
    kiem(pg.get_by_role("button", name="Phụ liệu").count() > 0, "đã bấm nhánh Phụ liệu")

    print(f"\n3. Đợi {CHAM_GIAY + 3:.0f}s cho gói nguyên liệu về muộn hạ cánh")
    pg.wait_for_timeout(int((CHAM_GIAY + 3) * 1000))
    kiem(cham["n"] > 0, "gói nhánh nguyên liệu ĐÃ bị làm chậm", f"{cham['n']} lượt")

    print("\n4. ⭐ RỔ CỦA MÀN PHỤ LIỆU CÓ BỊ ĐỔ DÒNG NGUYÊN LIỆU KHÔNG")
    # ⚠ PHÉP DÒ ĐẦU TIÊN CỦA TÔI SAI và đã báo XANH GIẢ trên bản CHƯA vá: nó dò
    #   SỐ CUỘN trong HTML. Nhưng màn PHỤ LIỆU **không vẽ cột số cuộn** — dòng NVL
    #   nằm trong rổ mà nhìn không thấy. Đó cũng đúng là lý do anh Cường không
    #   phát hiện ngày 18/08. Phép dò đúng là **ĐẾM SỐ DÒNG** ở tiêu đề rổ.
    import re
    than = pg.content()
    m = re.search(r"—\s*(\d+)\s*dòng", than)
    n_ro = int(m.group(1)) if m else -1
    kiem("Phụ liệu" in than, "màn đang ở nhánh Phụ liệu")
    kiem(m is not None, "đọc được số dòng trong rổ", f"{n_ro} dòng")
    kiem(n_ro == 0, "⭐ RỔ PHỤ LIỆU RỖNG — gói nguyên liệu về muộn đã bị VỨT",
         f"rổ đang có {n_ro} dòng"
         + (" ← ĐÚNG LỖI 18/08" if n_ro > 0 else ""))

    br.close()

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
