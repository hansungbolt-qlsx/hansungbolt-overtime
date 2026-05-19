import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import CompareCountGame from '@/components/games/CompareCountGame';

export const metadata = { title: 'Nhiều hơn / Ít hơn — Bé Học' };

export default async function NhieuItPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <CompareCountGame />;
}
