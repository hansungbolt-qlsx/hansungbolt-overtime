import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// PATCH /api/print-jobs/[id] — agent update status
// Body: { status: 'printing' | 'done' | 'error', error_message?: string }
// Auth: Bearer AGENT_SECRET
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get('authorization') ?? '';
  const secret = process.env.AGENT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'AGENT_SECRET chưa được cấu hình' },
      { status: 500 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Sai AGENT_SECRET' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Body JSON không hợp lệ' }, { status: 400 });
  }

  const { status, error_message } = body as {
    status?: string;
    error_message?: string;
  };
  if (
    status !== 'printing' &&
    status !== 'done' &&
    status !== 'error'
  ) {
    return NextResponse.json(
      { error: 'status phải là printing / done / error' },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = { status };
  if (status === 'printing') patch.started_at = new Date().toISOString();
  if (status === 'done' || status === 'error')
    patch.finished_at = new Date().toISOString();
  if (status === 'error' && error_message) patch.error_message = error_message;

  const { error } = await supabaseAdmin
    .from('print_jobs')
    .update(patch)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
