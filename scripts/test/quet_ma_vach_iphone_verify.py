# Kiểm bộ quét (anh Hữu 09/11/2026): iPhone xin camera trong lần bấm · treo → báo sau 8 s · Android vẫn chạy
# Chạy: VERCEL_GIT_COMMIT_SHA=test-a npx next dev -p 3108  rồi  python scripts/test/quet_ma_vach_iphone_verify.py
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
SES = ky({"userId": "kiemthu-quet", "username": "kiemthu", "fullName": "KIỂM THỬ", "role": "qlsx", "department": "QLSX", "iat": now, "exp": now + 3600})
IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
AND = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
HOOK = """(() => { const md = navigator.mediaDevices; const orig = md.getUserMedia.bind(md);
  window.__gum = []; md.getUserMedia = (c) => { window.__gum.push({active: navigator.userActivation ? navigator.userActivation.isActive : null, t: performance.now()});
  if (window.__TREO) return new Promise(() => {});
  if (window.__DEN) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; return Promise.resolve(cv.captureStream(0)); }
  return orig(c); }; })();"""
ok = bad = 0
def ck(c, m, x=''):
    global ok, bad
    ok += bool(c); bad += (not c); print(('   ok ' if c else '   SAI ') + m, x if not c else '')
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    br = pw.chromium.launch(args=['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'])
    # 12/11/2026: 'iPhone KHÔNG RA HÌNH' = ca màn hình chính anh Hữu (cấp camera nhưng luồng không có khung hình)
    for ten, ua, treo in (('iPhone camera chạy', IOS, False), ('iPhone camera TREO', IOS, True),
                          ('iPhone KHÔNG RA HÌNH', IOS, 'den'), ('Android camera chạy', AND, False)):
        print('==', ten)
        ctx = br.new_context(user_agent=ua, viewport={'width': 390, 'height': 844}, permissions=['camera'])
        ctx.add_cookies([{'name': 'session', 'value': SES, 'url': GOC}])
        ctx.add_init_script(HOOK + ('window.__DEN=true;' if treo == 'den' else 'window.__TREO=true;' if treo else ''))
        pg = ctx.new_page()
        pg.route('**/api/**', lambda r: r.fulfill(status=200, content_type='application/json', body='{}') if r.request.method != 'GET' else r.continue_())
        pg.goto(f'{GOC}/register', wait_until='load', timeout=180000)
        pg.get_by_role('button', name=re.compile('Xuất kho')).first.click(timeout=120000)
        pg.get_by_role('button', name=re.compile('Quét tem')).first.click(timeout=60000)
        pg.wait_for_timeout(13000 if treo == 'den' else 9500 if treo else 4000)
        gum = pg.evaluate('window.__gum')
        body = pg.inner_text('body')
        if ua == IOS:
            ck(len(gum) >= 1 and gum[0]['active'] is True, 'iPhone: xin camera NGAY trong lần bấm (userActivation)', gum)
        if treo == 'den':
            ck('không ra hình' in body and 'Chụp ảnh tem' in body, 'không ra hình → KHÔNG treo, báo lỗi + gợi ý chụp ảnh', body[-400:])
            ck(len(gum) >= 2, 'đã tự xin lại camera (yêu cầu tối giản)', gum)
            ck(re.search(r'lần 1: luồng \w+', body) is not None, 'có chẩn đoán trạng thái luồng', re.findall(r'lần 1:[^)]*', body)[:1])
        elif treo:
            ck('chưa mở được camera sau 8 giây' in body, 'treo → báo lỗi sau 8 s')
            ck(re.search(r'\[iOS 18\.1 · (trình duyệt|mở như ứng dụng) · quyền camera: \w+\]', body) is not None, 'có dòng chẩn đoán máy', re.findall(r'\[.*?\]', body)[:3])
        else:
            ck('Đang mở camera' not in body and 'Không mở được' not in body and 'chưa mở được' not in body, 'camera mở được, không treo/lỗi')
            ck(pg.evaluate("(() => { const v = document.querySelector('video'); return !!(v && v.srcObject && v.videoWidth > 0); })()"), 'video có hình')
        pg.get_by_role('button', name=re.compile('Đóng')).first.click()
        pg.wait_for_timeout(500)
        ck(pg.evaluate("(() => { const v = document.querySelector('video'); return !v || !v.srcObject; })()"), 'đóng → tắt camera')
        ctx.close()
    br.close()
print(f'KẾT QUẢ: {ok} đạt · {bad} sai')
