# -*- coding: utf-8 -*-
"""BÀI KIỂM — PHỤ LIỆU CŨNG PHẢI GIỮ CHỖ NHƯ NGUYÊN LIỆU (21/08/2026 chiều).

Lớp giữ chỗ làm sáng 21/08 chỉ áp cho CUỘN ⇒ chỉ nguyên liệu. Phụ liệu KHÔNG có
lot/cuộn, chỉ có MÃ HÀNG + SỐ LƯỢNG, và cửa chặn bên client chỉ cộng `lines`
(giỏ ĐANG GÕ) rồi so với tồn ⇒ số lượng nằm ở phiếu CHỜ DUYỆT không được trừ,
xuất chồng được — đúng kịch bản 20/08 nhưng cho phụ liệu.

Bài kiểm hai phần:

  PHẦN A — MÁY CHỦ (chạy trên dữ liệu THẬT đang sống)
    A1. GET /api/nvl-slips trả về khoá `held_aux_qty`
    A2. ⭐ Phiếu của CHÍNH NGÀY đang xem KHÔNG được nằm trong `held_*`
        (client đã tự tính qua `lines`/`past`; đếm hai nơi thì phụ liệu bị TRỪ
        HAI LẦN ⇒ chặn oan người dùng)

  PHẦN B — MÀN HÌNH (giả lập câu trả lời máy chủ ngay trong trình duyệt)
    B1. ⭐ Vượt tồn KHI ĐÃ TRỪ phần bị giữ  → PHẢI CHẶN, báo "phiếu chờ duyệt đang giữ"
    B2. ⭐ Trong hạn mức còn lại            → PHẢI CHO QUA (chống chặn oan)
    B3. Có dòng "🔒 … đang nằm ở phiếu chờ duyệt — còn dùng được …"

🛑 KHÔNG ghi một byte nào: chặn mọi lệnh không phải GET ngay trong trình duyệt,
   đếm phiếu + dòng trước/sau phải y nguyên.

    python scripts/test/giu_cho_phu_lieu_verify.py http://127.0.0.1:3100
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


def sb(path: str):
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
    return (len(sb("nvl_day_slips?select=id")), len(sb("nvl_slip_lines?select=id")))


hom_nay = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7 * 3600))
print(f"Đích: {GOC}\nHôm nay (giờ VN): {hom_nay}\n")

nguoi = sb("users?role=eq.qlsx&select=id,department&limit=1")[0]
token = ky_jwt({"userId": nguoi["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM GIỮ CHỖ PHỤ LIỆU", "role": "qlsx",
                "department": nguoi["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

truoc = hien_trang()
print(f"🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

# Mã phụ liệu đem thử: tồn lớn nhất, đo tại chỗ (cấm đóng cứng).
aux = sb("nvl_stock_snapshot?part=eq.aux&select=payload")[0]["payload"]
co_ton = sorted([m for m in aux if (m.get("stock") or 0) > 0],
                key=lambda m: -(m.get("stock") or 0))
if not co_ton:
    print("\n⏭ BỎ QUA — không có mã phụ liệu nào còn tồn. Không có gì để đo.")
    sys.exit(0)
MA = co_ton[0]["code"]
TON = float(co_ton[0]["stock"])
DVI = co_ton[0].get("unit") or "EA"
GIU = round(TON * 0.6, 3)          # giả lập: 60% tồn đang nằm ở phiếu chờ duyệt
CON = TON - GIU                    # phần còn dùng được
print(f"Mã đem thử: {MA} · tồn {TON:g} {DVI} · giả lập bị giữ {GIU:g} → còn {CON:g}\n")


def api(path: str):
    r = urllib.request.Request(GOC + path)
    r.add_header("Cookie", "session=" + token)
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())


print("PHẦN A — MÁY CHỦ (dữ liệu thật)")
d_aux = api(f"/api/nvl-slips?kind=issue&branch=aux&date={hom_nay}")
d_nvl = api(f"/api/nvl-slips?kind=issue&branch=nvl&date={hom_nay}")
kiem("held_aux_qty" in d_aux, "A1. có khoá `held_aux_qty` trong câu trả lời")
kiem(d_aux.get("held_partial") is False, "A1b. `held_partial` = false (đếm chắc chắn)")

# A2 — phiếu của CHÍNH NGÀY đang xem không được nằm trong held.
coil_hom_nay = {l["coil_id"] for s in (d_nvl.get("slips") or [])
                for l in (s.get("lines") or []) if l.get("coil_id")}
held_nvl = set(d_nvl.get("held_coil_ids") or [])
trung = coil_hom_nay & held_nvl
kiem(not trung,
     f"A2. ⭐ {len(coil_hom_nay)} cuộn của phiếu HÔM NAY không bị đếm hai lần",
     f"đếm trùng: {sorted(trung)}" if trung else "sạch")

qty_hom_nay = {}
for s in (d_aux.get("slips") or []):
    for l in (s.get("lines") or []):
        ma = (l.get("material_code") or "").strip()
        if ma:
            qty_hom_nay[ma] = qty_hom_nay.get(ma, 0) + float(l.get("qty") or 0)
ha = d_aux.get("held_aux_qty") or {}
trung_aux = [m for m, q in qty_hom_nay.items() if ha.get(m)]
kiem(not trung_aux,
     f"A2b. {len(qty_hom_nay)} mã phụ liệu của phiếu HÔM NAY không bị đếm hai lần",
     f"đếm trùng: {trung_aux}" if trung_aux else "sạch")

print("\nPHẦN B — MÀN HÌNH (giả lập máy chủ trả về phần bị giữ)")
n_ghi = 0
from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    def chan(route):
        global n_ghi
        req = route.request
        if req.method != "GET":
            n_ghi += 1
            route.abort()
            return
        if "/api/nvl-slips?" in req.url and "branch=aux" in req.url:
            res = route.fetch()
            try:
                d = res.json()
            except Exception:  # noqa: BLE001
                route.continue_()
                return
            d["held_aux_qty"] = {**(d.get("held_aux_qty") or {}), MA: GIU}
            d["held_partial"] = False
            route.fulfill(status=200, content_type="application/json",
                          body=json.dumps(d, ensure_ascii=False))
            return
        route.continue_()

    pg.route("**/api/**", chan)
    pg.goto(f"{GOC}/register", wait_until="load", timeout=90000)
    ok = False
    for _ in range(6):
        pg.get_by_role("button", name="📤 Xuất kho").click(timeout=30000)
        try:
            pg.get_by_text("Ghi chú phiếu").first.wait_for(timeout=25000)
            ok = True
            break
        except Exception:  # noqa: BLE001
            pg.wait_for_timeout(1500)
    kiem(ok, "mở được màn Xuất kho")
    pg.get_by_role("button", name="Phụ liệu", exact=True).click(timeout=30000)
    pg.wait_for_timeout(4000)
    def chon_ma():
        """Chọn lại mã — sau mỗi lần Thêm vào phiếu, form tự dọn nên phải chọn lại."""
        o = pg.get_by_placeholder("Gõ mã / tên / quy cách…")
        o.fill("")
        pg.wait_for_timeout(300)
        o.fill(MA)
        pg.wait_for_timeout(1500)
        pg.locator("button", has_text=MA).first.click(timeout=30000)
        pg.wait_for_timeout(2000)

    chon_ma()
    kiem("đang nằm ở phiếu chờ duyệt" in pg.content(),
         f"B3. có dòng 🔒 báo phần đang bị giữ ({GIU:g} {DVI})")

    def thu(so: float, ten: str, phai_chan: bool) -> str:
        chon_ma()
        pg.locator("input[inputmode=decimal]").first.fill(str(so))
        pg.wait_for_timeout(400)
        pg.get_by_role("button", name="➕ Thêm vào phiếu").first.click(timeout=30000)
        pg.wait_for_timeout(1200)
        than = pg.content()
        bi_chan = "Vượt tồn kho" in than
        kiem(bi_chan == phai_chan, ten, "bị chặn" if bi_chan else "cho qua")
        return than

    # B1 — số nằm GIỮA (còn dùng được) và (tồn): bản CHƯA vá cho qua, bản ĐÃ vá chặn
    giua = round(CON + (TON - CON) / 2, 3)
    than = thu(giua, f"B1. ⭐ xin {giua:g} > còn dùng được {CON:g} → PHẢI CHẶN", True)
    kiem("Vượt tồn kho" in than and "phiếu chờ duyệt đang giữ" in than,
         "B1b. câu báo lỗi nói RÕ vì sao: 'phiếu chờ duyệt đang giữ'")

    # B2 — số NHỎ hơn phần còn lại: KHÔNG được chặn oan
    nho = max(1, round(CON * 0.3, 3))
    thu(nho, f"B2. ⭐ xin {nho:g} ≤ còn dùng được {CON:g} → PHẢI CHO QUA", False)

    br.close()

sau = hien_trang()
print("\n🛑 CHỐT AN TOÀN")
kiem(n_ghi == 0, "không gửi lệnh ghi nào", f"{n_ghi} lệnh bị chặn")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
