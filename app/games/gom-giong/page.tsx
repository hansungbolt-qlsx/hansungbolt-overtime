import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import GroupSameGame from '@/components/games/GroupSameGame';

export const metadata = { title: 'Gom nhóm giống — Bé Học' };

export default async function GomGiongPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <GroupSameGame />;
}
