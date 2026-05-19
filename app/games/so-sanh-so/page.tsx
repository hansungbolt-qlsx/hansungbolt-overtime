import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import CompareNumberGame from '@/components/games/CompareNumberGame';

export const metadata = { title: 'Số lớn / Số bé — Bé Học' };

export default async function SoSanhSoPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  return <CompareNumberGame />;
}
