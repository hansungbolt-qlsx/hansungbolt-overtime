# Kiểm màn Đặt CĐ 80 — chọn nhanh thùng 70 đã về chưa xuất (anh Hữu 12/11/2026): gợi ý theo NCC, chọn tất cả /
# theo mã / từng thùng, thùng đang ở phiếu khác bị khoá, dòng gửi đi mang số thùng + kg = kg về, đổi NCC vẫn chọn được.
# Chạy: VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3108  rồi  python scripts/test/gc_chon_thung_70_verify.py
import sys, os, json, re, time, hmac, hashlib, base64
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:/hansungbolt-overtime'
env = {}
for f in ('.env.local', '.env'):
    p = os.path.join(ROOT, f)
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            if '=' in l and not l.strip().startswith('#'):
                k, v = l.strip().split('=', 1); env.setdefault(k, v.strip().strip('"'))
GOC = 'http://localhost:3108'
b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip('=')
def ky(p):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode()); q = b64(json.dumps(p, separators=(",", ":")).encode())
    return f"{h}.{q}.{b64(hmac.new(env['JWT_SECRET'].encode(), f'{h}.{q}'.encode(), hashlib.sha256).digest())}"
now = int(time.time())
SES = ky({"userId": "kiemthu-gc", "username": "qlsx", "fullName": "KIỂM THỬ", "role": "admin", "department": "QLSX", "iat": now, "exp": now + 3600})
GUONG = {"ncc": [{"ma": "VIK", "ten": "VIK", "cong_doan": "70", "dat_cuoi": "2026-11-11"},
                 {"ma": "NPT", "ten": "NPT", "cong_doan": "80", "dat_cuoi": "2026-11-11"},
                 {"ma": "TC", "ten": "TC", "cong_doan": "80", "dat_cuoi": "2026-11-09"}],
         "cho_dat": [{"saeji_no": "202610777", "cong_doan": "80", "ma_hang": "RL-MA", "ten_hang": "hàng R/L", "vao": 5000, "da_dat": 0}],
         "cho_ve": [],
         "thung_cho": [
             {"thung": "20261112-0001", "cd_sau": "80", "ngay_ve": "20261112", "saeji_no": "202610001", "ma_hang": "040120-T12W", "ten_hang": "A", "kg": 120, "ncc_goi_y": "NPT"},
             {"thung": "20261112-0002", "cd_sau": "80", "ngay_ve": "20261112", "saeji_no": "202610001", "ma_hang": "040120-T12W", "ten_hang": "A", "kg": 118, "ncc_goi_y": "NPT"},
             {"thung": "20261112-0003", "cd_sau": "80", "ngay_ve": "20261112", "saeji_no": "202610002", "ma_hang": "050120-Y52A", "ten_hang": "B", "kg": 95, "ncc_goi_y": "NPT"},
             {"thung": "20261111-0009", "cd_sau": "80", "ngay_ve": "20261111", "saeji_no": "202610003", "ma_hang": "040140-B62W", "ten_hang": "C", "kg": 115, "ncc_goi_y": "TC"},
             {"thung": "20261110-0005", "cd_sau": "80", "ngay_ve": "20261110", "saeji_no": "202610004", "ma_hang": "060200-FSEW-D", "ten_hang": "D", "kg": 77, "ncc_goi_y": "NPT"}]}
GIU = {"T:20261110-0005": "phieu-khac"}           # thùng này đang nằm trong phiếu đặt khác
ok = bad = 0
def ck(c, m, x=''):
    global ok, bad
    ok += bool(c); bad += (not c); print(('   ok ' if c else '   SAI ') + m, x if not c else '')
from playwright.sync_api import sync_playwright
gui = []
with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_cookies([{'name': 'session', 'value': SES, 'url': GOC}])
    pg = ctx.new_page()
    pg.route('**/api/gc-guong', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(GUONG)))
    def slips(r):
        if r.request.method == 'GET':
            return r.fulfill(status=200, content_type='application/json', body=json.dumps({"slips": [], "giu_cho": GIU}))
        gui.append(json.loads(r.request.post_data or '{}'))
        return r.fulfill(status=200, content_type='application/json', body=json.dumps({"ok": True, "uid": "GC-D-TEST"}))
    pg.route('**/api/gc-slips**', slips)
    pg.goto(f'{GOC}/dashboard/gia-cong', wait_until='load', timeout=180000)
    pg.get_by_text('Thùng 70 đã về').first.wait_for(timeout=120000)
    body = pg.inner_text('body')
    ck('5 thùng' in body, 'khung thùng 70 chờ xuất 80: đủ 5 thùng')
    ck('gợi ý TC' in body, 'mã gợi ý NCC khác có nhãn "gợi ý TC"')
    ck(pg.locator('text=(đang ở phiếu khác)').count() == 1, 'thùng giữ ở phiếu khác bị khoá')
    pg.get_by_role('button', name=re.compile('Chọn tất cả gợi ý NPT')).click()
    pg.wait_for_timeout(300)
    body = pg.inner_text('body')
    ck('Tổng: 3 dòng' in body and '333' in body, 'chọn tất cả gợi ý NPT → 3 thùng (bỏ thùng TC + thùng bị giữ), 120+118+95 = 333 kg',
       re.findall(r'Tổng:[^\n]*', body))
    # chọn theo MÃ: tích cả mã 040140-B62W (gợi ý TC) → chuyển sang NPT được
    pg.locator('label:has-text("040140-B62W") input[type=checkbox]').first.check()
    pg.wait_for_timeout(300)
    ck('Tổng: 4 dòng' in pg.inner_text('body'), 'chọn theo mã gợi ý TC vẫn đưa vào phiếu NPT (chuyển NCC)')
    # thêm dòng R/L bằng gõ số chỉ thị (như quét)
    pg.get_by_placeholder('hoặc gõ số chỉ thị').fill('202610777')
    pg.get_by_role('button', name='Thêm').click()
    pg.wait_for_timeout(300)
    for i, inp in enumerate(pg.locator('input[inputmode=numeric]').all()):
        if not inp.input_value():
            inp.fill('210')
    pg.get_by_role('button', name=re.compile('Lưu nháp')).click()
    pg.wait_for_timeout(1500)
    ck(len(gui) == 1, 'Lưu nháp gửi 1 lần', gui)
    if gui:
        b = gui[0]
        ls = b.get('lines', [])
        th = [l for l in ls if l.get('thung')]
        ck(b.get('cong_doan') == '80' and b.get('ncc') == 'NPT' and b.get('loai') == 'dat', 'phiếu ĐẶT · CĐ 80 · NPT', b)
        ck(sorted(l['thung'] for l in th) == ['20261111-0009', '20261112-0001', '20261112-0002', '20261112-0003'],
           '4 dòng mang đúng số thùng 70', th)
        ck(all(l['kg'] == {'20261112-0001': 120, '20261112-0002': 118, '20261112-0003': 95, '20261111-0009': 115}[l['thung']] for l in th),
           'kg mặc định = kg nhập 70')
        ck(any(l.get('saeji_no') == '202610777' and not l.get('thung') and l.get('kg') == 210 for l in ls),
           'dòng R/L quét thêm đi CHUNG phiếu', ls)
    pg.get_by_role('button', name=re.compile('^Bỏ chọn$')).click()
    pg.wait_for_timeout(300)
    ck('Tổng: 1 dòng' in pg.inner_text('body'), 'Bỏ chọn → chỉ bỏ thùng 70, giữ dòng R/L')
    ctx.close(); br.close()
print(f'KẾT QUẢ: {ok} đạt · {bad} sai')
