"""E2E Sản lượng COATING (anh Hữu 05/10/2026): app tăng ca (dev cục bộ :3011, Supabase THẬT)
→ "agent" giả lập → app chính BẢN SAO DB (:8099). KHÔNG ghi DB thật app chính.

Chạy (đã `npx next dev -p 3011` ở C:\\hansungbolt-overtime):
    python scripts/test/co_day_e2e_verify.py
Ngày thử 2026-01-02 (không trùng ngày làm việc thật). Phiếu thử bị XOÁ khỏi Supabase cuối test.
"""
from __future__ import annotations

import os, shutil, sys, tempfile, threading, time
from pathlib import Path
import requests

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
MAIN = Path(r"F:\0. Quản lý nguyên liệu\hsb-material-app")
OT = Path(r"C:\hansungbolt-overtime")
OTB = "http://127.0.0.1:3011"
DAY = "2026-01-02"

env = {}
for l in (OT / "print-agent/.env").read_text(encoding="utf-8").splitlines():
    if "=" in l and not l.strip().startswith("#"):
        k, v = l.split("=", 1); env[k.strip()] = v.strip()
SB = {"apikey": env["SUPABASE_SERVICE_KEY"], "Authorization": f"Bearer {env['SUPABASE_SERVICE_KEY']}"}

# ── app chính BẢN SAO trên :8099 ──
os.chdir(MAIN); sys.path.insert(0, str(MAIN))
from app import config as cfg  # noqa: E402
TMP = Path(tempfile.gettempdir()) / "hsb_co_e2e.db"
for s in ("", "-wal", "-shm"):
    p = Path(str(TMP) + s)
    if p.exists(): p.unlink()
shutil.copy2(Path(cfg.DB_PATH), TMP); cfg.DB_PATH = TMP; cfg.DB_URL = f"sqlite:///{TMP}"
from app.services import erp_sync_scheduler as _sch  # noqa: E402
_sch.scheduler_instance.start = lambda *a, **k: None
from app.db import SessionLocal, init_db  # noqa: E402
import app.db as DB  # noqa: E402
assert str(TMP) in str(DB.engine.url)
init_db()
from app.main import app  # noqa: E402
from app.models import CoDay  # noqa: E402
from app.services.agent_auth import agent_local_token  # noqa: E402
import uvicorn  # noqa: E402
srv = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=8099, log_level="warning"))
threading.Thread(target=srv.run, daemon=True).start()
MB = "http://127.0.0.1:8099"
for _ in range(100):
    try: requests.get(MB + "/login", timeout=1); break
    except Exception: time.sleep(0.2)
TOK = {"X-Agent-Token": agent_local_token()}

P = F = 0
def ck(ok, msg, *x):
    global P, F
    P += bool(ok); F += (not ok); print(("   ok  " if ok else "   SAI ") + msg, *(x if not ok else ()))

def login(u, p):
    s = requests.Session(); r = s.post(OTB + "/api/auth/login", json={"username": u, "password": p}); return s, r.status_code

def sb_slip():
    r = requests.get(f"{env['SUPABASE_URL']}/rest/v1/co_day_slips?work_date=eq.{DAY}&select=id,uid,status,synced_at,main_ref,last_error", headers=SB)
    j = r.json(); return j[0] if j else None

try:
    print("A. Catalog LOT: app chính → app tăng ca")
    cat = requests.get(MB + "/api/ot/co-lots", headers=TOK, timeout=120).json()
    ck(cat["ok"] and cat["count"] > 1000, f"app chính trả {cat['count']} LOT")
    adm, st = login(env["LOGIN_USERNAME"], env["LOGIN_PASSWORD"]); ck(st == 200, "đăng nhập admin (agent)")
    r = adm.post(OTB + "/api/co-lots", json=cat); ck(r.status_code == 200, "agent đẩy catalog lên app tăng ca", r.text[:150])
    co, st = login("nguyenchihieu", "hd123"); ck(st == 200, "nhân viên CO nguyenchihieu đăng nhập")
    g = co.get(OTB + "/api/co-lots").json()
    ck(len(g.get("lots", [])) == cat["count"], "điện thoại tải đủ catalog")
    l1, l2 = cat["lots"][0], cat["lots"][1]

    print("B. Nhập phiếu (nhân viên CO)")
    old = sb_slip()
    ck(old is None, f"ngày thử {DAY} chưa có phiếu thật", old)
    d = co.get(OTB + f"/api/co-days?date={DAY}").json()
    emps = d["employees"]; ck(len(emps) == 4 and d["machines"] == ["CO-01", "CO-02", "CO-03"], "4 nhân viên + 3 máy CO")
    def add(lot, mc, kg, emp, note="", **kw):
        return co.post(OTB + "/api/co-days", json={"date": DAY, "line": {
            "machine": mc, "lot_no": kw.get("scan", lot["lot"]), "lot_label": lot.get("label"), "vendor": lot.get("vendor"),
            "saeji": lot.get("saeji"), "item_code": lot.get("item"), "item_name": lot.get("name"),
            "lot_weight_kg": lot.get("kg"), "weight_kg": kg, "lot_qty": lot.get("qty"),
            "employee_id": emp, "note": note, "matched": kw.get("matched", True)}})
    r = add(l1, "CO-01", l1["kg"], emps[0]["id"]); ck(r.status_code == 200, "thêm dòng 1 (kg mặc định LOT)", r.text[:150])
    r = add(l2, "CO-02", 12.5, emps[1]["id"], "sửa kg", scan="*" + l2["label"] + "*"); ck(r.status_code == 200 and r.json()["line"]["lot_no"] == l2["lot"], "thêm dòng 2 quét có dấu * + nhãn → chuẩn hoá LOT", r.text[:150])
    ck(add(l1, "CO-09", 5, emps[0]["id"]).status_code == 400, "máy lạ bị chặn")
    ck(add(l1, "CO-01", 0, emps[0]["id"]).status_code == 400, "kg 0 bị chặn")
    ck(add(l1, "CO-01", 5, None).status_code == 400, "thiếu nhân viên bị chặn")
    d = co.get(OTB + f"/api/co-days?date={DAY}").json()
    ck(d["slip"]["status"] == "draft" and len(d["lines"]) == 2, "phiếu draft, 2 dòng")
    lid = d["lines"][1]["id"]
    r = co.patch(OTB + f"/api/co-days/lines/{lid}", json={"line": {**{k: d["lines"][1][k] for k in ("machine", "lot_no", "lot_label", "vendor", "saeji", "item_code", "item_name", "lot_weight_kg", "lot_qty", "employee_id", "note", "matched")}, "weight_kg": 13.25}})
    ck(r.status_code == 200, "sửa kg dòng 2 → 13,25")
    pr = co.get(OTB + f"/print/co-day?date={DAY}")
    ptxt = pr.text.replace("<!-- -->", "")
    ck(pr.status_code == 200 and "KẾT QUẢ COATING NGÀY 02/01/2026" in ptxt and l1["label"] in ptxt and "13.3" in ptxt, "trang in bảng kết quả render (2 LOT, kg sửa)", ptxt[ptxt.find("KẾT"):ptxt.find("KẾT")+80])
    pj = co.post(OTB + "/api/print-jobs", json={"type": "co_day", "ref_id": "x"}); ck(pj.status_code == 400, "lệnh in co_day sai ngày → 400")

    print("C. Gửi → agent → app chính")
    r = co.post(OTB + "/api/co-days/send", json={"date": DAY}); ck(r.status_code == 200 and r.json()["n_lines"] == 2, "bấm Gửi", r.text[:120])
    ck(sb_slip()["status"] == "pending", "Supabase: pending")
    sync = adm.get(OTB + "/api/co-days/sync").json()["slips"]
    mine = [s for s in sync if s["work_date"] == DAY]
    ck(len(mine) == 1 and len(mine[0]["lines"]) == 2, "agent lấy được phiếu thử", [s["work_date"] for s in sync])
    s = mine[0]
    up = requests.post(MB + "/api/ot/co-day", headers=TOK, json={"uid": s["uid"], "work_date": s["work_date"], "sent_by_name": s["sent_by_name"], "lines": s["lines"]}).json()
    ck(up.get("ok") and up["n_lines"] == 2 and abs(up["total_kg"] - (l1["kg"] + 13.25)) < 1e-6, "app chính (bản sao) nhận 2 dòng, tổng kg đúng", up)
    r = adm.post(OTB + "/api/co-days/sync", json={"uid": s["uid"], "ok": True, "main_ref": str(up["id"])}); ck(r.status_code == 200, "agent ghi kết quả về")
    ck(sb_slip()["status"] == "received", "Supabase: received")
    ck(all(x["work_date"] != DAY for x in adm.get(OTB + "/api/co-days/sync").json()["slips"]), "đã nhận thì không đẩy lại")
    with SessionLocal() as db:
        cd = db.query(CoDay).filter_by(uid=s["uid"]).one()
        ck(len(cd.lines) == 2 and {l.lot_no for l in cd.lines} == {l1["lot"], l2["lot"]} and any(l.weight_kg == 13.25 and l.lot_weight_kg == l2["kg"] for l in cd.lines), "DB app chính: LOT + kg sửa + kg ERP lưu đủ")
    tv = requests.Session();
    print("D. Sửa sau khi gửi → về draft → gửi lại ghi đè")
    r = co.delete(OTB + f"/api/co-days/lines/{lid}"); ck(r.status_code == 200, "xoá dòng 2 sau khi gửi")
    ck(sb_slip()["status"] == "draft" and sb_slip()["synced_at"] is None, "phiếu tự về draft")
    co.post(OTB + "/api/co-days/send", json={"date": DAY})
    s = [x for x in adm.get(OTB + "/api/co-days/sync").json()["slips"] if x["work_date"] == DAY][0]
    up = requests.post(MB + "/api/ot/co-day", headers=TOK, json={"uid": s["uid"], "work_date": s["work_date"], "sent_by_name": s["sent_by_name"], "lines": s["lines"]}).json()
    with SessionLocal() as db:
        cd = db.query(CoDay).filter_by(uid=s["uid"]).one()
        ck(up.get("ok") and len(cd.lines) == 1 and cd.n_resend == 2, "gửi lại: app chính còn 1 dòng (ghi đè)")
    adm.post(OTB + "/api/co-days/sync", json={"uid": s["uid"], "ok": True, "main_ref": str(up["id"])})

    print("F. Xoá: app chính xoá → trả về app tăng ca → app tăng ca xoá hẳn")
    ck(sb_slip()["status"] == "received", "trước khi xoá: received")
    r = co.delete(OTB + f"/api/co-days?date={DAY}"); ck(r.status_code == 409, "app tăng ca CHẶN xoá khi app chính còn giữ", r.text[:100])
    from app.models import User as _U
    from app.services.auth import hash_password as _hp
    with SessionLocal() as db:
        if not db.query(_U).filter_by(username="_t_co_adm").first():
            db.add(_U(username="_t_co_adm", password_hash=_hp("test1234"), full_name="T", role="admin", is_admin=True, is_active=True)); db.commit()
    ms = requests.Session(); ms.post(MB + "/login", data={"username": "_t_co_adm", "password": "test1234"}, allow_redirects=False)
    ck("Xoá phiếu" in ms.get(MB + f"/tv/daily/co?date={DAY}").text, "trang TV có nút Xoá phiếu (admin)")
    r = ms.post(MB + "/tv/daily/co/delete", data={"date": DAY}, allow_redirects=False)
    ck(r.status_code == 303, "app chính xoá phiếu", r.status_code)
    ck("Chưa có phiếu" in ms.get(MB + f"/tv/daily/co?date={DAY}").text, "TV ẩn phiếu đã xoá")
    with SessionLocal() as db:
        cd = db.query(CoDay).filter_by(uid=f"CO-{DAY.replace('-', '')}").one()
        ck(cd.deleted_at is not None and len(cd.lines) == 1, "app chính xoá MỀM (giữ dòng để truy vết)")
    dl = requests.get(MB + "/api/ot/co-day-deleted", headers=TOK).json()["items"]
    mine = [x for x in dl if x["work_date"] == DAY]; ck(len(mine) == 1, "agent thấy phiếu đã xoá")
    adm.post(OTB + "/api/co-days/sync", json={"uid": mine[0]["uid"], "returned": True, "returned_by": mine[0]["deleted_by"]})
    requests.post(MB + "/api/ot/co-day-deleted/ack", headers=TOK, json={"uid": mine[0]["uid"]})
    sl = sb_slip(); ck(sl["status"] == "draft" and "App chính đã xoá" in (sl["last_error"] or ""), "app tăng ca: phiếu về Đang ghi + ghi chú", sl)
    ck(all(x["work_date"] != DAY for x in requests.get(MB + "/api/ot/co-day-deleted", headers=TOK).json()["items"]), "ack xong không báo lại")
    ck(all(x["work_date"] != DAY for x in adm.get(OTB + "/api/co-days/sync").json()["slips"]), "phiếu bị xoá trả về KHÔNG bị vét gửi lại")
    r = co.delete(OTB + f"/api/co-days?date={DAY}"); ck(r.status_code == 200, "app tăng ca xoá hẳn phiếu", r.text[:100])
    ck(sb_slip() is None, "Supabase sạch phiếu ngày thử")

    print("E. Quyền")
    ld, _ = login("nguyenduchieu", "hd123")
    ck(ld.get(OTB + f"/api/co-days?date={DAY}").status_code == 200, "tổ trưởng CO xem được")
    ck(co.get(OTB + "/api/co-days/sync").status_code == 403, "nhân viên CO không gọi được cổng agent")
    hd, st = login("phamtuanvu", "hd123")
    if st == 200:
        ck(hd.get(OTB + f"/api/co-days?date={DAY}").status_code == 403, "nhân viên HD bị chặn Sản lượng CO")
finally:
    sl = sb_slip()
    if sl:
        requests.delete(f"{env['SUPABASE_URL']}/rest/v1/co_day_slips?id=eq.{sl['id']}", headers=SB)
    ck(sb_slip() is None, "đã XOÁ phiếu thử khỏi Supabase")
    srv.should_exit = True

print(f"\n{'PASS' if F == 0 else 'FAIL'} — {P} ok · {F} sai (app chính bản sao {TMP})")
sys.exit(1 if F else 0)
