# -*- coding: utf-8 -*-
"""BÀI KIỂM TRÌNH DUYỆT — BẢN CHỤP TỒN KHÔNG ĐÁNG TIN THÌ PHẢI BÁO ĐỎ.

Sự cố 20/08: 07:30 app chính trừ cuộn MAN-12; agent chưa được khởi động (chưa ai
đăng nhập máy) nên KHÔNG đẩy tồn; 07:54 anh Cường tick lại cuộn đó. Màn hình lúc
ấy có hiện "tồn lúc 16:36" — ĐÚNG SỰ THẬT nhưng chữ xám 11px, không có ngày,
không màu ⇒ không ai đọc ra đó là bản chụp của CHIỀU HÔM TRƯỚC.

🛑 KHÔNG được báo theo TUỔI của `pushed_at`: agent chỉ đẩy khi tồn ĐỔI, nên mốc
cũ hàng giờ là chuyện hợp lệ. Báo theo tuổi = báo giả = "đỏ mất thiêng".

Hai điều kiện DUY NHẤT làm đỏ (cả hai không báo giả được):
  ① NHỊP TIM tắt — agent ghi đè catalog DCCD mỗi 10 phút VÔ ĐIỀU KIỆN
  ② mốc tồn KHÁC NGÀY hôm nay — agent luôn đẩy 1 phát ngay khi khởi động

Bài kiểm GIẢ LẬP câu trả lời của máy chủ ngay trong trình duyệt (chặn gói mốc rồi
sửa) — KHÔNG đụng một byte nào của dữ liệu thật.

BỐN cảnh phải đúng:
  1. Máy chủ khoẻ            → KHÔNG có băng đỏ, vẫn thấy chữ "tồn lúc HH:MM"
  2. Nhịp tim tắt 3 giờ      → băng đỏ "MÁY CHỦ ĐANG NGỪNG ĐẨY TỒN"
  3. Mốc tồn của HÔM QUA     → băng đỏ "ĐANG XEM TỒN KHO CỦA NGÀY dd/mm"
  4. Mốc cũ 2 giờ NHƯNG nhịp tim còn thở → KHÔNG được đỏ (chống báo giả)

🛑 KHÔNG bấm Lưu/Gửi. Đếm phiếu + dòng trước và sau, phải y nguyên.

    python scripts/test/ton_khong_dang_tin_bao_do_verify.py http://127.0.0.1:3100
"""
import base64
import hashlib
import hmac
import io
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
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


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def hien_trang():
    return (len(sb_get("nvl_day_slips?select=id")), len(sb_get("nvl_slip_lines?select=id")))


print(f"Đích: {GOC}\n")
truoc = hien_trang()
print(f"🛑 Chốt an toàn TRƯỚC: {truoc[0]} phiếu · {truoc[1]} dòng")

nguoi = sb_get("users?role=eq.qlsx&select=id,department&limit=1")
token = ky_jwt({"userId": nguoi[0]["id"], "username": "kiemthu",
                "fullName": "BÀI KIỂM TỒN KHÔNG ĐÁNG TIN", "role": "qlsx",
                "department": nguoi[0]["department"],
                "iat": int(time.time()), "exp": int(time.time()) + 3600})

now = datetime.now(timezone.utc)
# Giờ VN hôm qua — dùng để dựng chuỗi "dd/mm" mà màn hình phải in ra
hom_qua_vn = (now + timedelta(hours=7) - timedelta(days=1)).strftime("%d/%m")

CANH = [
    # (tên, lệch nhịp tim (phút), lệch mốc tồn (phút), phải đỏ?, chuỗi phải có)
    ("1. Máy chủ khoẻ", 2, 5, False, "tồn lúc "),
    ("2. Nhịp tim tắt 3 giờ", 180, 5, True, "MÁY CHỦ ĐANG NGỪNG ĐẨY TỒN"),
    ("3. Mốc tồn của HÔM QUA", 2, 24 * 60, True, "TỒN KHO CỦA NGÀY " + hom_qua_vn),
    ("4. Mốc cũ 2 giờ, nhịp tim còn thở", 2, 120, False, "tồn lúc "),
]

from playwright.sync_api import sync_playwright  # noqa: E402

with sync_playwright() as pw:
    br = pw.chromium.launch()

    for ten, lech_nhip, lech_moc, phai_do, chuoi in CANH:
        print(f"\n{ten}  (nhịp tim −{lech_nhip}′ · mốc tồn −{lech_moc}′)")
        # Ngữ cảnh MỚI mỗi cảnh → localStorage sạch, không mang bộ nhớ đệm sang.
        ctx = br.new_context(viewport={"width": 460, "height": 900})
        ctx.add_cookies([{"name": "session", "value": token, "url": GOC}])
        pg = ctx.new_page()

        # ⚠ Playwright gọi hàm chặn với (route, request) — hàm phải nhận ĐÚNG 1
        #   tham số, nếu không `request` sẽ đè lên tham số mặc định phía sau.
        def tao_bo_chan(dn: int, dm: int):
            def gia_lap(route):
                if "meta=1" not in route.request.url:
                    route.continue_()
                    return
                res = route.fetch()
                try:
                    d = res.json()
                except Exception:  # noqa: BLE001
                    route.continue_()
                    return
                d["agent_at"] = iso(now - timedelta(minutes=dn))
                for p in (d.get("parts") or {}).values():
                    if isinstance(p, dict):
                        p["pushed_at"] = iso(now - timedelta(minutes=dm))
                route.fulfill(status=200, content_type="application/json",
                              body=json.dumps(d, ensure_ascii=False))
            return gia_lap

        pg.route("**/api/nvl-stock**", tao_bo_chan(lech_nhip, lech_moc))
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
        pg.get_by_role("button", name="Nguyên liệu", exact=True).click(timeout=30000)
        pg.wait_for_timeout(4000)
        than = pg.content()

        co_do = "MÁY CHỦ ĐANG NGỪNG ĐẨY TỒN" in than or "TỒN KHO CỦA NGÀY" in than
        kiem(ok_tab, "   mở được màn Xuất kho")
        kiem(co_do == phai_do,
             f"   {'PHẢI đỏ' if phai_do else 'KHÔNG được đỏ'} → {'đỏ' if co_do else 'không đỏ'}")
        kiem(chuoi in than, f"   có câu {chuoi!r}")

        ctx.close()

    br.close()

sau = hien_trang()
print("\n🛑 CHỐT AN TOÀN")
kiem(truoc == sau, "phiếu và dòng y nguyên",
     f"{truoc[0]} phiếu · {truoc[1]} dòng → {sau[0]} phiếu · {sau[1]} dòng")

print(f"\n{'=' * 64}")
print(f"✅ ĐẠT {dat}/{dat} phép kiểm" if hong == 0 else f"🛑 HỎNG {hong}, đạt {dat}")
print("=" * 64)
sys.exit(0 if hong == 0 else 1)
