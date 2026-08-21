# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — CUỘN NẰM Ở PHIẾU CHƯA KHÉP PHẢI BỊ GIẤU ĐI.

Anh Hữu chốt 21/08/2026 sau sự cố 20/08: anh Giang duyệt phiếu 19/08 lúc 07:30
→ cuộn MAN-12 bị trừ bên app chính; bản chụp tồn trên điện thoại vẫn là bản cũ
(agent chưa được khởi động vì chưa ai đăng nhập máy) ⇒ 07:54 cuộn đó vẫn hiện
ra và được tick lần hai.

Trước bản vá, `usedCoilIds` chỉ loại cuộn của phiếu CÙNG NGÀY ⇒ cuộn nằm trong
phiếu CHỜ DUYỆT của hôm trước vẫn chọn được.

BỐN điều phải đúng:
  1. ⭐ Cuộn của phiếu CHƯA KHÉP (pending/draft) KHÔNG xuất hiện trong danh sách
  2. ⭐ Cuộn KHÔNG bị giữ thì VẪN PHẢI hiện — chốt chống "báo xanh giả" khi danh
     sách rỗng vì lý do khác (bài học 19/08: phép dò sai làm xanh giả)
  3. Số cuộn trên tiêu đề danh sách = tổng trong bản chụp TRỪ số bị giữ
  4. Có dòng "N cuộn đang nằm ở phiếu chờ duyệt — không chọn được"

⚠ MỌI CON SỐ ĐỀU ĐO TẠI CHỖ từ dữ liệu thật — không đóng cứng số nào (bài học
17/08: bài kiểm đóng cứng "12 cuộn" hỏng ngay khi dữ liệu đổi).

🛑 KHÔNG bấm Lưu/Gửi. Đếm phiếu + dòng trước và sau, phải y nguyên.

    python scripts/test/giu_cho_cuon_phieu_chua_khep_verify.py http://127.0.0.1:3100
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


# ─────────────────────────────────────────────────────────────────────────────
# ĐO DỮ LIỆU THẬT — chọn mã hàng làm phép thử ngay tại chỗ
# ─────────────────────────────────────────────────────────────────────────────
print(f"Đích: {GOC}\n")
print("0. Đo dữ liệu thật để chọn mã hàng làm phép thử")

mo = sb_get("nvl_day_slips?select=id,uid,status,slip_date"
            "&status=in.(pending,draft)&kind=eq.issue&branch=eq.nvl")
giu_theo_ma: dict[str, set[int]] = {}
nguon_giu: dict[int, str] = {}
for s in mo:
    for l in sb_get(f"nvl_slip_lines?slip_id=eq.{s['id']}&select=coil_id,material_code"):
        if l["coil_id"]:
            giu_theo_ma.setdefault(l["material_code"], set()).add(l["coil_id"])
            nguon_giu[l["coil_id"]] = f"{s['uid']} ({s['status']})"

snap = sb_get("nvl_stock_snapshot?part=eq.nvl_main&select=payload,pushed_at")[0]
coils = snap["payload"]
theo_ma: dict[str, list] = {}
for c in coils:
    theo_ma.setdefault(c["code"], []).append(c)
trong_ban_chup = {c["id"] for c in coils}

print(f"   Bản chụp tồn nvl_main: mốc {snap['pushed_at']} · {len(coils)} cuộn")
print(f"   Phiếu chưa khép (xuất/NVL): {len(mo)} · giữ chỗ "
      f"{sum(len(v) for v in giu_theo_ma.values())} cuộn")

# Mã tốt nhất để thử = có cuộn BỊ GIỮ **và** còn cuộn KHÔNG bị giữ (điều 2).
# ⚠ Bỏ qua cuộn bị giữ bởi phiếu NHÁP HÔM NAY: cuộn đó vốn đã bị `lines` loại
#   sẵn ở cả bản cũ lẫn bản mới ⇒ không phân biệt được vá hay chưa vá.
hom_nay_nhap = {s["id"] for s in mo if s["status"] == "draft"}
nhap_hom_nay_coils: set[int] = set()
for s in mo:
    if s["id"] in hom_nay_nhap and s["slip_date"] == time.strftime(
            "%Y-%m-%d", time.gmtime(time.time() + 7 * 3600)):
        for l in sb_get(f"nvl_slip_lines?slip_id=eq.{s['id']}&select=coil_id"):
            if l["coil_id"]:
                nhap_hom_nay_coils.add(l["coil_id"])

ung_vien = []
for ma, ids in giu_theo_ma.items():
    bi_giu = {i for i in ids if i in trong_ban_chup and i not in nhap_hom_nay_coils}
    tat_ca = theo_ma.get(ma, [])
    con_lai = [c for c in tat_ca if c["id"] not in bi_giu]
    if bi_giu and con_lai:
        ung_vien.append((len(bi_giu), ma, bi_giu, tat_ca, con_lai))
ung_vien.sort(reverse=True)

if not ung_vien:
    print("\n⏭ BỎ QUA — hiện KHÔNG có mã nào vừa có cuộn bị giữ vừa còn cuộn tự do.")
    print("   Không có gì để đo. Đây KHÔNG phải lỗi.")
    sys.exit(0)

_, MA, BI_GIU, TAT_CA, CON_LAI = ung_vien[0]


def dinh_danh(c: dict) -> str:
    """Chuỗi hiện trên màn hình: ưu tiên Lot No, không có thì số cuộn."""
    return (c.get("lot_no") or c.get("coil_no") or "").strip()


ten_bi_giu = sorted({dinh_danh(c) for c in TAT_CA if c["id"] in BI_GIU} - {""})
ten_con_lai = sorted({dinh_danh(c) for c in TAT_CA if c["id"] not in BI_GIU} - {""})
# Cuộn tự do có định danh TRÙNG với cuộn bị giữ thì không dùng làm chứng cứ
ten_con_lai = [t for t in ten_con_lai if t not in ten_bi_giu]
MONG_DOI = len(TAT_CA) - len(BI_GIU)

print(f"\n   ⭐ Mã đem thử: {MA}")
print(f"      trong bản chụp : {len(TAT_CA)} cuộn")
print(f"      bị giữ chỗ     : {len(BI_GIU)} cuộn  → {', '.join(ten_bi_giu)}")
for i in sorted(BI_GIU):
    print(f"          {i}  ← {nguon_giu.get(i, '?')}")
print(f"      PHẢI còn hiện  : {MONG_DOI} cuộn")


def hien_trang():
    sl = sb_get("nvl_day_slips?select=id")
    ln = sb_get("nvl_slip_lines?select=id")
    return (len(sl), len(ln))


truoc = hien_trang()
print(f"\n   🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

nguoi = sb_get("users?role=eq.qlsx&select=id,username,department&limit=1")
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM GIỮ CHỖ CUỘN", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    print("\n1. Mở màn Xuất kho → nhánh Nguyên liệu")
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
    pg.get_by_role("button", name="Nguyên liệu", exact=True).click(timeout=30000)
    pg.wait_for_timeout(3000)

    print(f"\n2. Gõ mã {MA} rồi chọn")
    pg.get_by_placeholder("Gõ mã / tên / size…").fill(MA)
    pg.wait_for_timeout(1500)
    # Danh sách gợi ý → bấm đúng dòng của mã này
    chon = pg.locator("button", has_text=MA).first
    chon.click(timeout=30000)
    pg.wait_for_timeout(3000)
    than = pg.content()

    print("\n3. ⭐ Cuộn nằm ở phiếu CHƯA KHÉP phải BIẾN MẤT")
    lot = [t for t in ten_bi_giu if t in than]
    kiem(not lot, f"⭐ 0/{len(ten_bi_giu)} cuộn bị giữ còn hiện trên màn",
         f"còn lộ: {', '.join(lot)}" if lot else "sạch")

    print("\n4. ⭐ Cuộn KHÔNG bị giữ thì VẪN PHẢI hiện (chống báo xanh giả)")
    thieu = [t for t in ten_con_lai if t not in than]
    kiem(ten_con_lai and not thieu,
         f"⭐ {len(ten_con_lai) - len(thieu)}/{len(ten_con_lai)} cuộn tự do vẫn chọn được",
         f"mất oan: {', '.join(thieu)}" if thieu else "đủ")

    print("\n5. Số cuộn trên tiêu đề danh sách")
    kiem(f"({MONG_DOI} cuộn" in than,
         f"tiêu đề ghi đúng ({MONG_DOI} cuộn)",
         f"tổng {len(TAT_CA)} − giữ {len(BI_GIU)}")

    print("\n6. Dòng nhắc người dùng")
    kiem("cuộn đang nằm ở phiếu chờ duyệt" in than,
         "có dòng 'N cuộn đang nằm ở phiếu chờ duyệt — không chọn được'")

    br.close()

sau = hien_trang()
print("\n7. 🛑 CHỐT AN TOÀN")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
