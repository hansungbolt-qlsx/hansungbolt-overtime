import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Vercel cron job — deletes all label photos from previous days
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Today in Vietnam time (UTC+7)
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const today = vnNow.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .lt('label_date', today);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ deleted: 0 });

  const paths = data.map((p) => p.storage_path);
  await supabaseAdmin.storage.from('material-labels').remove(paths);

  const { error: delErr } = await supabaseAdmin
    .from('material_label_photos')
    .delete()
    .lt('label_date', today);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ deleted: data.length });
}
