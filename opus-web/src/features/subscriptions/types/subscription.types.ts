export interface Subscriber {
  id: string;
  name: string;
  email: string;
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
  email: string;
}
