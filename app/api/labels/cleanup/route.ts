import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Vercel cron job — giữ 2 ngày gần nhất (hôm nay + hôm qua — user rút từ 3
// ngày 13/7 để tiết kiệm egress/storage gói Free); xóa cũ hơn (kèm thumbnail).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cutoff = hôm nay − 1 ngày theo giờ VN (giữ hôm nay + hôm qua, xóa cũ hơn)
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const cutoff = new Date(vnNow.getTime() - 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .lt('label_date', cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ deleted: 0 });

  const paths = data.flatMap((p) => [p.storage_path, `${p.storage_path}.thumb.jpg`]);
  await supabaseAdmin.storage.from('material-labels').remove(paths);

  const { error: delErr } = await supabaseAdmin
    .from('material_label_photos')
    .delete()
    .lt('label_date', cutoff);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ deleted: data.length });
}
