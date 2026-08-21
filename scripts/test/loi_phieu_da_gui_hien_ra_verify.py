# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — LỖI APP CHÍNH TRẢ VỀ PHẢI HIỆN CẢ Ở PHIẾU ĐÃ GỬI.

App chính soi tồn NGAY khi nhận phiếu (`build_preview` trong ot_slip.py) rồi trả
`line_errors` ngược về; agent ghi vào Supabase. Nhưng trước bản vá 21/08/2026 màn
hình CHỈ vẽ lỗi cho phiếu ĐANG SOẠN — phiếu ĐÃ GỬI rơi xuống khối "phiếu cũ" mà
khối đó không vẽ lỗi.

Hậu quả thật: phiếu ot-2026-08-20-issue-nvl-1 mang lỗi "Cuộn ...MAN-12 không còn
ở kho Main" từ 20/08, anh Cường KHÔNG hề thấy.

BA điều phải đúng:
  1. ⭐ Nguyên văn câu lỗi của app chính hiện trên màn
  2. Có tiêu đề "App chính báo N dòng có vấn đề"
  3. Có chỉ dẫn ra: nhờ người duyệt Từ chối rồi tạo phiếu mới

⚠ Mọi số liệu ĐO TẠI CHỖ. Không có phiếu nào mang lỗi thì BỎ QUA (không phải lỗi).
🛑 KHÔNG bấm Lưu/Gửi. Đếm phiếu + dòng trước và sau, phải y nguyên.

    python scripts/test/loi_phieu_da_gui_hien_ra_verify.py http://127.0.0.1:3100
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


print(f"Đích: {GOC}\n")
print("0. Tìm phiếu ĐÃ GỬI (không còn sửa được) đang mang lỗi app chính trả về")

# Phiếu nằm ở khối "phiếu cũ" = KHÔNG phải phiếu đang soạn. Phiếu đang soạn chỉ
# có thể là 'draft'/'rejected' VÀ là phiếu seq lớn nhất trong ngày — nên chọn
# phiếu 'pending' hoặc 'approved' cho chắc chắn nó nằm ở khối cũ.
ung_vien = [
    s for s in sb_get("nvl_day_slips?select=uid,slip_date,kind,branch,status,seq,line_errors"
                      "&status=in.(pending,approved)&order=slip_date.desc&limit=200")
    if s.get("line_errors")
]
if not ung_vien:
    print("\n⏭ BỎ QUA — hiện không có phiếu đã gửi nào mang lỗi. Không có gì để đo.")
    sys.exit(0)

P = ung_vien[0]
LOI = P["line_errors"]
print(f"   ⭐ Phiếu: {P['uid']} · ngày {P['slip_date']} · {P['status']} · {len(LOI)} lỗi")
for e in LOI:
    print(f"      dòng {e.get('seq')} · {e.get('code')} : {e.get('error')}")


def hien_trang():
    return (len(sb_get("nvl_day_slips?select=id")), len(sb_get("nvl_slip_lines?select=id")))


truoc = hien_trang()
print(f"\n   🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

nguoi = sb_get("users?role=eq.qlsx&select=id,department&limit=1")
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM LỖI PHIẾU ĐÃ GỬI", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

TAB = "📤 Xuất kho" if P["kind"] == "issue" else "📥 Trả kho"
NHANH = "Nguyên liệu" if P["branch"] == "nvl" else "Phụ liệu"

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    print(f"\n1. Mở {TAB} → {NHANH} → ngày {P['slip_date']}")
    pg.goto(f"{GOC}/register", wait_until="load", timeout=90000)

    def mo_tab(ten: str, dau_hieu: str, so_lan: int = 6) -> bool:
        for _ in range(so_lan):
            pg.get_by_role("button", name=ten).click(timeout=30000)
            try:
                pg.get_by_text(dau_hieu).first.wait_for(timeout=25000)
                return True
            except Exception:  # noqa: BLE001
                pg.wait_for_timeout(1500)
        return False

    kiem(mo_tab(TAB, "Ghi chú phiếu"), f"chạm tab {TAB} → màn kho hiện ra")
    pg.get_by_role("button", name=NHANH, exact=True).click(timeout=30000)
    pg.wait_for_timeout(2500)
    pg.locator("input[type=date]").fill(P["slip_date"])
    pg.wait_for_timeout(4000)
    than = pg.content()

    print("\n2. ⭐ Nguyên văn câu lỗi của app chính")
    thieu = [e["error"] for e in LOI if e.get("error") and e["error"] not in than]
    kiem(not thieu, f"⭐ {len(LOI) - len(thieu)}/{len(LOI)} câu lỗi hiện đủ trên màn",
         f"chưa hiện: {thieu}" if thieu else "đủ")

    print("\n3. Tiêu đề cảnh báo")
    kiem(f"App chính báo {len(LOI)} dòng có vấn đề" in than,
         f"có tiêu đề 'App chính báo {len(LOI)} dòng có vấn đề'")

    print("\n4. Chỉ đúng đường ra")
    kiem("tạo phiếu mới" in than, "có chỉ dẫn: nhờ Từ chối rồi tạo phiếu mới")

    br.close()

sau = hien_trang()
print("\n5. 🛑 CHỐT AN TOÀN")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
