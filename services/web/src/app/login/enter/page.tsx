import { redirect } from 'next/navigation';
import { presentInApi } from '@/features/auth';

export const dynamic = 'force-dynamic';

export default async function LoginEnter() {
  await presentInApi();
  redirect('/');
}
