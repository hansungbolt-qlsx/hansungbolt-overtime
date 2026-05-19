import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth-server';
import { getStory } from '@/lib/games/storyData';
import StoryReader from '@/components/games/StoryReader';

export const metadata = { title: 'Kể chuyện — Bé Học' };

export default async function StoryReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.username !== 'qlsx') {
    redirect(session.role === 'admin' ? '/dashboard' : '/register');
  }
  const { id } = await params;
  const story = getStory(id);
  if (!story) notFound();
  return <StoryReader story={story} />;
}
