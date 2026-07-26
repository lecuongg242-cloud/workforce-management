import { redirect } from 'next/navigation';
import { getSession } from '@/lib/actions/auth';

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  }

  redirect('/auth/login');
}
