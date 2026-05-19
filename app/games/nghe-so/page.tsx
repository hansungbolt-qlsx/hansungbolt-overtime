import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import NumberListenGame from '@/components/games/NumberListenGame';

export const metadata = { title: 'Nghe & chọn số — Bé Học' };

export default async function NgheSoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <NumberListenGame />;
}
