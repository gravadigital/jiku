export interface Subscriber {
  id: string;
  name: string;
  /**
   * `null` para una identidad de servicio. A diferencia de `ProjectUser`, aca SI puede pasar:
   * el listado de suscriptores NO esta filtrado por `identityType`, y una identidad de servicio
   * puede quedar suscripta publicando `requirements.{id}.subscriptors.new` en el bus.
   */
  email: string | null;
}

export interface SubscribePayload {
  userId: string;
}

export interface UnsubscribePayload {
  userId: string;
}

export type SubscriptionErrorCode = 'already_subscribed' | 'no_permission' | 'user_not_found';

export interface ProjectUser {
  id: string;
  name: string;
  /**
   * NO es nullable, y la diferencia con `Subscriber` es deliberada: este es el SELECTOR de
   * personas (`GET /opus/projects/{projid}/users`), que la api filtra a `identityType: 'person'`
   * con un `where` dentro del include. Una identidad de servicio no puede aparecer aca, asi que
   * declararlo `string | null` agregaria un caso imposible.
   */
  email: string;
}
