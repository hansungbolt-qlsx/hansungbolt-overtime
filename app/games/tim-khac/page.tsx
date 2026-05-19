import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import FindDifferentGame from '@/components/games/FindDifferentGame';

export const metadata = { title: 'Tìm cái khác — Bé Học' };

export default async function TimKhacPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <FindDifferentGame />;
}
