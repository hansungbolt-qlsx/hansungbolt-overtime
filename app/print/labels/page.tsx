import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveDisplayName } from '@/lib/hd-employees';
import PrintClient from './PrintClient';

export default async function PrintLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const date = sp.date ?? '';
  if (!date) redirect('/dashboard');

  const { data } = await supabaseAdmin
    .from('material_label_photos')
    .select('id, storage_path')
    .eq('label_date', date)
    .order('uploaded_at', { ascending: true });

  const photos = await Promise.all(
    (data ?? []).map(async (p) => {
      const { data: signed } = await supabaseAdmin.storage
        .from('material-labels')
        .createSignedUrl(p.storage_path, 3600);
      const filename = p.storage_path.split('/').pop() ?? '';
      const parts = filename.replace(/\.[^.]+$/, '').split('__');
      const rawKey = parts.length >= 2 ? parts[1] : null;
      const employee_name = rawKey ? resolveDisplayName(rawKey) : null;
      return { id: p.id, url: signed?.signedUrl ?? null, employee_name };
    }),
  );

  return <PrintClient date={date} photos={photos} />;
}
