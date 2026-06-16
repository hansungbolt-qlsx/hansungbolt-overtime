import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// Vercel cron job — keeps the 3 most recent days of label photos
// (today + 2 previous days); deletes anything older.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cutoff = today − 2 days, in Vietnam time (UTC+7).
  // Keep label_date >= cutoff (today, yesterday, the day before); delete older.
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const cutoff = new Date(vnNow.getTime() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .lt('label_date', cutoff);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ deleted: 0 });

  const paths = data.map((p) => p.storage_path);
  await supabaseAdmin.storage.from('material-labels').remove(paths);

  const { error: delErr } = await supabaseAdmin
    .from('material_label_photos')
    .delete()
    .lt('label_date', cutoff);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ deleted: data.length });
}
