import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import StoryList from '@/components/games/StoryList';

export const metadata = { title: 'Kể chuyện — Bé Học' };

export default async function KeChuyenPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <StoryList />;
}
