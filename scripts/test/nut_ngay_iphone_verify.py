# Nút chọn ngày (DateButton): chạm trúng ô date thật, đổi ngày danh sách phiếu nhảy theo — anh Hữu 10/10/2026 (iPhone không lùi ngày được).
# Chạy: npx next build && npx next start -p 3012, rồi python scripts/test/nut_ngay_iphone_verify.py
import sys, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:3012'
req = urllib.request.Request(BASE + '/api/auth/login', data=json.dumps({'username': 'nguyenduchieu', 'password': 'hd123'}).encode(),
                             headers={'content-type': 'application/json'})
res = urllib.request.urlopen(req)
cks = [h.split(';')[0].split('=', 1) for k, h in res.headers.items() if k.lower() == 'set-cookie']
ok = bad = 0
def ck(c, m, x=''):
    global ok, bad
    if c: ok += 1; print('   ok ', m)
    else: bad += 1; print('   SAI', m, x)
with sync_playwright() as p:
    b = p.chromium.launch()
    for ten, opt in (('điện thoại', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)),
                     ('máy tính', dict(viewport={'width': 1366, 'height': 900}))):
        print('==', ten)
        ctx = b.new_context(**opt)
        ctx.add_cookies([{'name': n, 'value': v, 'url': BASE} for n, v in cks])
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/register'); pg.wait_for_timeout(2500)
        lbls = pg.locator('label:has(input[type=date])')
        ck(lbls.count() >= 2, f'có {lbls.count()} nút ngày')
        ck(pg.locator('button[aria-label="Đổi ngày"]').count() == 0, 'không còn lớp nút đè lên ô ngày')
        for i in range(lbls.count()):
            bb = lbls.nth(i).bounding_box()
            for fx, fy in ((0.15, 0.5), (0.5, 0.5), (0.9, 0.5)):
                tag = pg.evaluate('([x,y]) => { const e = document.elementFromPoint(x,y); return e && e.tagName + ":" + (e.type||"") }',
                                  [bb['x'] + bb['width'] * fx, bb['y'] + bb['height'] * fy])
                ck(tag == 'INPUT:date', f'nút ngày {i+1}: chạm ở {int(fx*100)}% trúng ô ngày thật', tag)
        inp = pg.locator('input[type=date]').nth(1)
        if ten == 'điện thoại':
            inp.tap()
        else:
            inp.click()
        pg.wait_for_timeout(300)
        inp.fill('2026-10-09'); pg.wait_for_timeout(2500)
        sec = pg.locator('section').filter(has_text='Danh sách phiếu tăng ca').inner_text()
        ck('09-10-2026' in sec and 'Ngày 09/10/2026' in sec, 'đổi ngày → tiêu đề + nút hiện 09/10')
        ck('Sửa' in sec and 'Xóa' in sec and '3 dòng' in sec, 'hiện phiếu 09/10 có nút Sửa/Xóa', sec[:200])
        ck(not errs, 'không lỗi trang', errs)
        ctx.close()
    b.close()
print(f'== {ok}/{ok+bad} PASS ==')
