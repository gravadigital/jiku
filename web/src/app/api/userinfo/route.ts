import { NextResponse } from 'next/server';
import { decodedToken } from '@/shared/utils/decoded-token';

const getDataFromUserInfo = async (token: string) => {
  const userInfoEndpoint = `${process.env.ZITADEL_ISSUER}/oidc/v1/userinfo`;

  const resp = await fetch(userInfoEndpoint, {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    method: 'GET',
  });

  return resp.json();
};

export const GET = async () => {
  const token = await decodedToken();

  if (!token || !token.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await getDataFromUserInfo(token.accessToken);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};
