# -*- coding: utf-8 -*-
"""BÀI KIỂM — PHIẾU VỪA GỬI TRONG NGÀY THÌ CUỘN CỦA NÓ PHẢI BIẾN MẤT.

Anh Hữu yêu cầu 21/08/2026: *"tự làm bài kiểm tra phiếu gửi chờ duyệt thì tồn
cuộn đó hiện lên như thế nào."*

Khác `giu_cho_cuon_phieu_chua_khep_verify.py`: bài kia đo phiếu chưa khép của
NGÀY KHÁC; bài này đo phiếu **VỪA GỬI HÔM NAY** (trạng thái `pending`).

⭐ VÌ SAO BÀI NÀY QUAN TRỌNG DÙ TRÔNG "HIỂN NHIÊN":
Chiều 21/08 máy chủ được sửa để **BỎ phiếu của chính ngày đang xem** khỏi
`held_coil_ids` — lý do: client đã tự tính phần đó qua `lines`/`past`, đếm hai
nơi thì phụ liệu bị TRỪ HAI LẦN ⇒ chặn oan. Nhưng nếu `past` vì lý do nào đó
KHÔNG che phiếu hôm nay nữa thì **cuộn sẽ lọt ra chọn lại được mà không ai biết**.
Bài này chính là lưới đỡ cho chỗ đó.

BỐN điều phải đúng:
  1. ⭐ Cuộn của phiếu VỪA GỬI hôm nay KHÔNG hiện trong DANH SÁCH TICK ĐƯỢC
     (⚠ phải dò đúng danh sách đó — khối "phiếu cũ" cũng in "Lot: xxx" nên dò
      cả trang sẽ BÁO ĐỎ GIẢ; đã dính đúng bẫy này ngày 21/08)
  2. ⭐ Cuộn KHÔNG nằm trong phiếu nào thì VẪN PHẢI hiện (chống báo xanh giả)
  3. Số cuộn trên tiêu đề = tổng trong bản chụp − số đang bị giữ
  4. Phiếu vừa gửi PHẢI hiện ở khối lịch sử với nhãn "Chờ duyệt" — người dùng
     phải nhìn thấy cuộn của mình đi đâu, chứ không phải nó biến mất im lặng

ℹ️ Dòng "🔒 N cuộn đang nằm ở phiếu chờ duyệt" CỐ Ý **không** hiện cho phiếu
   hôm nay: phiếu đó đang nằm ngay trên màn hình ở khối lịch sử, người dùng
   thấy rồi. Dòng 🔒 dành cho cuộn bị giữ bởi phiếu của NGÀY KHÁC — thứ không
   nhìn thấy được. Điều 4 thay thế nó.

⚠ Số đo TẠI CHỖ, không đóng cứng. Không có phiếu `pending` nào thì BỎ QUA.
🛑 KHÔNG bấm Lưu/Gửi. Đếm phiếu + dòng trước và sau, phải y nguyên.

    python scripts/test/phieu_vua_gui_giau_cuon_verify.py http://127.0.0.1:3100
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


hom_nay = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 7 * 3600))
print(f"Đích: {GOC}\nHôm nay (giờ VN): {hom_nay}\n")
print("0. Tìm phiếu XUẤT NVL vừa gửi HÔM NAY (pending)")

ps = sb(f"nvl_day_slips?slip_date=eq.{hom_nay}&kind=eq.issue&branch=eq.nvl"
        "&status=eq.pending&select=id,uid,status")
if not ps:
    print("\n⏭ BỎ QUA — hôm nay chưa có phiếu xuất NVL nào ở trạng thái chờ duyệt.")
    print("   Không có gì để đo. Đây KHÔNG phải lỗi.")
    sys.exit(0)

P = ps[0]
dong = sb(f"nvl_slip_lines?slip_id=eq.{P['id']}&select=coil_id,coil_no,material_code")
snap = sb("nvl_stock_snapshot?part=eq.nvl_main&select=payload,pushed_at")[0]
byid = {c["id"]: c for c in snap["payload"]}
theo_ma: dict[str, list] = {}
for c in snap["payload"]:
    theo_ma.setdefault(c["code"], []).append(c)

giu: dict[str, set] = {}
for l in dong:
    if l["coil_id"] and l["coil_id"] in byid:
        giu.setdefault(l["material_code"], set()).add(l["coil_id"])

print(f"   ⭐ Phiếu: {P['uid']} · {P['status']} · {len(dong)} dòng")
print(f"   Bản chụp tồn: mốc {snap['pushed_at']} · {len(snap['payload'])} cuộn")
print(f"   Giữ chỗ {sum(len(v) for v in giu.values())} cuộn trên {len(giu)} mã")

# Mã tốt nhất: có cuộn bị giữ VÀ còn cuộn tự do (để chạy được điều 2)
ung_vien = []
for ma, ids in giu.items():
    tat_ca = theo_ma.get(ma, [])
    con_lai = [c for c in tat_ca if c["id"] not in ids]
    if ids and con_lai:
        ung_vien.append((len(ids), ma, ids, tat_ca, con_lai))
ung_vien.sort(reverse=True)
if not ung_vien:
    print("\n⏭ BỎ QUA — không mã nào vừa có cuộn bị giữ vừa còn cuộn tự do.")
    sys.exit(0)

_, MA, BI_GIU, TAT_CA, CON_LAI = ung_vien[0]


def dinh_danh(c: dict) -> str:
    return (c.get("lot_no") or c.get("coil_no") or "").strip()


ten_giu = sorted({dinh_danh(c) for c in TAT_CA if c["id"] in BI_GIU} - {""})
ten_tu_do = sorted({dinh_danh(c) for c in TAT_CA if c["id"] not in BI_GIU} - {""})
ten_tu_do = [t for t in ten_tu_do if t not in ten_giu]
MONG_DOI = len(TAT_CA) - len(BI_GIU)
print(f"\n   Mã đem thử: {MA} · tổng {len(TAT_CA)} cuộn · bị giữ {len(BI_GIU)} "
      f"→ phải còn hiện {MONG_DOI}")
print(f"      cuộn bị giữ: {', '.join(ten_giu)}")


def hien_trang():
    return (len(sb("nvl_day_slips?select=id")), len(sb("nvl_slip_lines?select=id")))


truoc = hien_trang()
print(f"\n   🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

nguoi = sb("users?role=eq.qlsx&select=id,department&limit=1")[0]
token = ky_jwt({"userId": nguoi["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM PHIẾU VỪA GỬI", "role": "qlsx",
                "department": nguoi["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

n_ghi = 0
from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": 460, "height": 900})
    ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
    pg = ctx.new_page()

    def chan(route):
        global n_ghi
        if route.request.method != "GET":
            n_ghi += 1
            route.abort()      # 🛑 tuyệt đối không cho ghi
            return
        route.continue_()

    pg.route("**/api/**", chan)

    print("\n1. Mở màn Xuất kho → Nguyên liệu")
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
    pg.get_by_role("button", name="Nguyên liệu", exact=True).click(timeout=30000)
    pg.wait_for_timeout(4500)
    than0 = pg.content()

    print("\n2. ⭐ Phiếu vừa gửi phải HIỆN RA cho người dùng thấy")
    kiem("Đã gửi — chờ duyệt" in than0,
         "⭐ khối lịch sử có phiếu nhãn '📤 Đã gửi — chờ duyệt'")
    kiem("Muốn sửa phiếu này thì nhờ người duyệt bấm Từ chối" in than0,
         "có chỉ dẫn muốn sửa thì nhờ Từ chối")

    print(f"\n3. Gõ mã {MA} rồi chọn")
    pg.get_by_placeholder("Gõ mã / tên / size…").fill(MA)
    pg.wait_for_timeout(1500)
    pg.locator("button", has_text=MA).first.click(timeout=30000)
    pg.wait_for_timeout(3000)
    than = pg.content()
    # ⚠ BẪY ĐÃ DÍNH 21/08: KHÔNG được dò tên cuộn trên CẢ TRANG. Khối "phiếu cũ"
    #   cũng in "Lot: xxx" cho từng dòng của CHÍNH phiếu vừa gửi ⇒ dò cả trang là
    #   BÁO ĐỎ GIẢ (bản chưa vá lẫn đã vá đều "hỏng"). Chỉ dò trong DANH SÁCH TICK
    #   ĐƯỢC: mỗi cuộn chọn được là một <li> có ô tích bên trong.
    o_tick = pg.locator("li:has(input[type=checkbox])")
    danh_sach = " | ".join(o_tick.all_text_contents())
    print(f"   (danh sách tick được: {o_tick.count()} dòng)")

    print("\n4. ⭐ Cuộn của phiếu VỪA GỬI phải BIẾN MẤT")
    lot = [t for t in ten_giu if t in danh_sach]
    kiem(not lot, f"⭐ 0/{len(ten_giu)} cuộn đã gửi còn chọn được",
         f"CÒN LỘ: {', '.join(lot)}" if lot else "sạch")

    print("\n5. ⭐ Cuộn tự do VẪN PHẢI hiện (chống báo xanh giả)")
    thieu = [t for t in ten_tu_do if t not in danh_sach]
    kiem(bool(ten_tu_do) and not thieu,
         f"⭐ {len(ten_tu_do) - len(thieu)}/{len(ten_tu_do)} cuộn tự do vẫn chọn được",
         f"mất oan: {', '.join(thieu)}" if thieu else "đủ")

    print("\n6. Số cuộn trên tiêu đề danh sách")
    kiem(f"({MONG_DOI} cuộn" in than, f"tiêu đề ghi đúng ({MONG_DOI} cuộn)",
         f"tổng {len(TAT_CA)} − giữ {len(BI_GIU)}")

    br.close()

sau = hien_trang()
print("\n7. 🛑 CHỐT AN TOÀN")
kiem(n_ghi == 0, "không gửi lệnh ghi nào", f"{n_ghi} lệnh bị chặn")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
