import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import CountingGame from '@/components/games/CountingGame';

export const metadata = { title: 'Đếm số — Bé Học' };

export default async function DemSoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <CountingGame />;
}
