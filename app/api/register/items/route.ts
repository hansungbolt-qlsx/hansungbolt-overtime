import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'leader') {
    return NextResponse.json({ error: 'Chưa đăng nhập hoặc không có quyền' }, { status: 401 });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const equipmentCode = url.searchParams.get('equipment_code');
  if (!date || !equipmentCode) {
    return NextResponse.json({ error: 'Thiếu date hoặc equipment_code' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('daily_plans')
    .select('item_code, item_name')
    .eq('plan_date', date)
    .eq('equipment_code', equipmentCode);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const seen = new Set<string>();
  const items: Array<{ item_code: string; item_name: string | null }> = [];
  for (const row of data ?? []) {
    if (seen.has(row.item_code)) continue;
    seen.add(row.item_code);
    items.push({ item_code: row.item_code, item_name: row.item_name });
  }

  return NextResponse.json({ items });
}
