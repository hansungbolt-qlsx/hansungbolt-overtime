import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import CountingGame from '@/components/games/CountingGame';

export const metadata = { title: 'Bé học đếm số' };

export default async function GamesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  // Chỉ admin qlsx — game cho bé, ẩn hoàn toàn với role khác
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <CountingGame />;
}
