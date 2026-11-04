# -*- coding: utf-8 -*-
"""KIỂM SỐ GIỜ SAU TÊN Ở "TĂNG CA HÔM NAY" (anh Hữu 04/11/2026: "Nguyễn Văn Tùng (4h)").

CHỈ ĐỌC. Gọi /api/registrations/today-summary (máy chủ cục bộ, đọc Supabase thật) cho MỌI ngày có phiếu
trong 30 ngày, so giờ từng người với số TỰ TÍNH LẠI ĐỘC LẬP từ Supabase (không gọi lib của app):
MAX giờ trong từng ca (giờ dòng → giờ phiếu → 8h Chủ nhật / 3h) → cộng các ca.
Rồi mở thẻ trên trình duyệt (tổ trưởng RL, khổ 390px) xem tên có kèm "(Nh)".

    VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3107
    python scripts/test/tang_ca_hom_nay_gio_verify.py http://localhost:3107 <thư mục ảnh>
"""
import base64
import hashlib
import hmac
import io
import json
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[2]
GOC = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3107"
ANH = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")
ANH.mkdir(parents=True, exist_ok=True)
if "vercel.app" in GOC:
    print("🛑 Bài này chỉ chạy trên máy chủ cục bộ"); sys.exit(1)
env = {}
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1); env.setdefault(k.strip(), v.strip().strip('"'))

dat = hong = 0


def kiem(ok, ten, them=""):
    global dat, hong
    print(f"   {'✓' if ok else '✗'} {ten}{f' — {them}' if them and not ok else ''}")
    dat += bool(ok); hong += (not ok)


def sb(path):
    r = urllib.request.Request(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/" + path)
    r.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"]); r.add_header("Authorization", "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"])
    return json.loads(urllib.request.urlopen(r, timeout=60).read().decode())


b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")  # noqa: E731


def ky(p):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    q = b64(json.dumps(p, separators=(",", ":")).encode())
    return f"{h}.{q}.{b64(hmac.new(env['JWT_SECRET'].encode(), f'{h}.{q}'.encode(), hashlib.sha256).digest())}"


def token(role, dept):
    u = sb(f"users?role=eq.{role}&select=id&limit=1" + (f"&department=eq.{dept}" if dept else ""))
    return ky({"userId": u[0]["id"], "username": "kiemthu", "fullName": "KIỂM GIỜ HÔM NAY", "role": role,
               "department": dept, "iat": int(time.time()), "exp": int(time.time()) + 3600})


def api(path, tk):
    r = urllib.request.Request(GOC + path); r.add_header("Cookie", f"session={tk}")
    return json.loads(urllib.request.urlopen(r, timeout=180).read().decode())


regs = sb("overtime_registrations?overtime_date=gte.2026-10-05&select=id,overtime_date,day_type,shift,duration_hours,department")
ngay = sorted({r["overtime_date"] for r in regs})
print(f"1. Đối chiếu {len(ngay)} ngày ({ngay[0]} → {ngay[-1]}), {len(regs)} phiếu — admin xem mọi bộ phận")
tk_admin = token("admin", None)
o_dung = o_sai = hai_ca = 0
for d in ngay:
    rd = {r["id"]: r for r in regs if r["overtime_date"] == d}
    its = sb("overtime_items?registration_id=in.(" + ",".join(rd) + ")&select=employee_id,registration_id,duration_hours")
    ca = defaultdict(lambda: defaultdict(float))       # emp → ca → MAX
    for it in its:
        r = rd[it["registration_id"]]
        c = "PM" if r["day_type"] == "sunday" else ("AM" if r.get("shift") == "AM" else "PM")
        h = float(it["duration_hours"] if it["duration_hours"] is not None else
                  (r["duration_hours"] if r["duration_hours"] is not None else (8 if r["day_type"] == "sunday" else 3)))
        ca[it["employee_id"]][c] = max(ca[it["employee_id"]][c], h)
    ky_vong = {e: sum(m.values()) for e, m in ca.items()}
    hai_ca += sum(1 for m in ca.values() if len(m) > 1)
    tra = api(f"/api/registrations/today-summary?date={d}", tk_admin)
    for bp, ds in tra["departments"].items():
        for e in ds:
            if e.get("hours") == ky_vong.get(e["employee_id"]):
                o_dung += 1
            else:
                o_sai += 1
                print(f"      lệch {d} {bp} {e['employee_name']}: API {e.get('hours')} · tự tính {ky_vong.get(e['employee_id'])}")
kiem(o_sai == 0 and o_dung > 0, f"giờ từng người khớp số tự tính: {o_dung} dòng đúng · {o_sai} lệch (có {hai_ca} ô làm 2 ca)")

print("2. Hôm nay 04/11 (dữ liệu thật)")
tra = api("/api/registrations/today-summary?date=2026-11-04", tk_admin)
for bp, ds in tra["departments"].items():
    for e in ds:
        print(f"      {bp} {e['employee_name']}: {e['hours']}h")
hd = {e["employee_name"]: e["hours"] for e in tra["departments"]["HD"]}
kiem(len(hd) == 5 and set(hd.values()) == {4}, f"HD 5 người đều 4h (khớp phiếu c737456f) — {hd}")

print("3. Thẻ trên điện thoại — tổ trưởng RL")
from playwright.sync_api import sync_playwright  # noqa: E402
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for bp in ("RL", "HD"):
        ctx = br.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        ctx.add_cookies([{"name": "session", "value": token("leader", bp), "url": GOC}])
        pg = ctx.new_page()
        ghi = []
        pg.route("**/api/**", lambda rt: (ghi.append(rt.request.method), rt.abort()) if rt.request.method != "GET" else rt.continue_())
        pg.goto(f"{GOC}/register", wait_until="load", timeout=180000)
        pg.get_by_role("button", name="Tăng ca hôm nay").click(timeout=120000)
        pg.get_by_text("Ngày 04/11/2026").first.wait_for(timeout=60000)
        pg.wait_for_timeout(2500)
        ten = pg.locator("section ol li span.font-bold").all_inner_texts()
        print(f"      {bp}: {ten}")
        kiem(len(ten) > 0 and all(t.endswith("h)") for t in ten), f"{bp}: mọi tên trên thẻ kèm '(Nh)'")
        anh_ten = pg.evaluate("() => [...document.querySelectorAll('[aria-hidden=\"true\"] div')].map(e => e.innerText)"
                              ".filter(t => /^\\d+\\. .*\\(\\d+(,\\d)?h\\)$/.test(t))")
        kiem(len(anh_ten) == len(ten), f"{bp}: ảnh chia sẻ Zalo cũng kèm giờ ({len(anh_ten)} tên)")
        pg.locator("section", has=pg.get_by_text("Tăng ca hôm nay", exact=True)).first.screenshot(path=str(ANH / f"hom_nay_{bp}.png"))
        kiem(not ghi, f"{bp}: không có lệnh ghi")
        ctx.close()
    br.close()

print(f"\nKẾT QUẢ: {dat} đạt · {hong} hỏng · ảnh ở {ANH}")
sys.exit(1 if hong else 0)
