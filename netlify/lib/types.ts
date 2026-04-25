export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export type Subscriber = {
  email: string;
  status: SubscriberStatus;
  createdAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  confirmToken: string | null;
  unsubscribeToken: string;
};

export type State = {
  lastSentPubDate: string;
  sendingLockUntil: string | null;
};

export type RateLimitRecord = {
  attempts: number;
  windowStart: string;
};

export type Storage = {
  getSubscriber(email: string): Promise<Subscriber | null>;
  putSubscriber(s: Subscriber): Promise<void>;
  listSubscribers(): Promise<Subscriber[]>;
  findSubscriberByConfirmToken(token: string): Promise<Subscriber | null>;
  findSubscriberByUnsubscribeToken(token: string): Promise<Subscriber | null>;
  getState(): Promise<State | null>;
  putState(s: State): Promise<void>;
  getRateLimit(ip: string): Promise<RateLimitRecord | null>;
  putRateLimit(ip: string, r: RateLimitRecord): Promise<void>;
};

export type EmailSender = {
  sendConfirmation(args: {
    to: string;
    confirmUrl: string;
  }): Promise<void>;
  sendPostNotification(args: {
    to: string;
    postTitle: string;
    postDescription: string;
    postUrl: string;
    unsubscribeUrl: string;
  }): Promise<void>;
};

export type Clock = () => Date;

export type Deps = {
  storage: Storage;
  email: EmailSender;
  clock: Clock;
  siteUrl: string;
};
