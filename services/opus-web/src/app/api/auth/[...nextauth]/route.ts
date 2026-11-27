// En v5 la ruta solo expone los handlers que arma NextAuth().
import { handlers } from '@/features/auth/config/nextauth.config';

export const { GET, POST } = handlers;
