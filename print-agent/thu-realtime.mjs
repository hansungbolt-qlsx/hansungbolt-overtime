// THỬ Realtime đầu-cuối (12/10/2026, GĐ1) — CHỈ chạm bảng agent_heartbeat (bảng riêng của agent).
// Nghe INSERT/UPDATE trên agent_heartbeat + print_jobs (chỉ nghe, KHÔNG nhận/không in), ghi 1 dòng vào
// agent_heartbeat id='thu-realtime', đo thời gian tin đẩy về. Không in khoá ra màn hình.
import 'dotenv/config';
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { heartbeatIntervalMs: 15000 },
});
let t0 = 0;
const xong = (ok, m) => { console.log(ok ? 'PASS' : 'FAIL', m); sb.removeAllChannels().then(() => process.exit(ok ? 0 : 1)); };
const ch = sb.channel('thu-gd1')
  .on('system', {}, (m) => console.log('  hệ thống:', JSON.stringify(m).slice(0, 300)))
  .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_heartbeat' }, (p) => {
    if (p.new?.id === 'thu-realtime') xong(true, `nhận tin agent_heartbeat sau ${Date.now() - t0} ms (event=${p.eventType})`);
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, (p) => {
    console.log(`  (có tin print_jobs ${p.eventType} — chỉ nghe, không xử lý)`);
  })
  .subscribe(async (status, err) => {
    console.log('  kênh:', status, err ? err.message : '');
    if (status === 'SUBSCRIBED') {
      await new Promise((r) => setTimeout(r, 3000));   // chờ máy chủ gắn xong theo dõi bảng
      t0 = Date.now();
      const { error } = await sb.from('agent_heartbeat')
        .upsert({ id: 'thu-realtime', last_seen: new Date().toISOString(), info: { thu: 'GĐ1 12/10/2026' } });
      if (error) xong(false, `ghi agent_heartbeat lỗi: ${error.message}`);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') xong(false, `kênh lỗi: ${status}`);
  });
setTimeout(() => xong(false, 'quá 30 giây không nhận được tin'), 30000);
