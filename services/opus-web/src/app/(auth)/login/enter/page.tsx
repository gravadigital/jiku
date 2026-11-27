import { redirect } from 'next/navigation';
import { presentInApi } from '@/features/auth/services/authApi';

export default async function LoginEnterPage() {
  await presentInApi();
  redirect('/');
}
