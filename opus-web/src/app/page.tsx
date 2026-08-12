import { redirect } from 'next/navigation';
import { auth } from '@/features/auth/config/nextauth.config';

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  redirect('/projects');
}
