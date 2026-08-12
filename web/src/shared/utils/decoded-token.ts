import { auth } from '@/lib/auth';
import { TokenInfo } from '@/shared/types';

export async function decodedToken(): Promise<TokenInfo | null> {
  const session = await auth();
  if (!session) {
    return null;
  }
  return {
    user: session.user,
    accessToken: session.accessToken,
    expiresAt: new Date(session.expires).getTime(),
  } as TokenInfo;
}
