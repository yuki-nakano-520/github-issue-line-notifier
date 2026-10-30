import { messagingApi } from "@line/bot-sdk";

/** 1 回の通知で消費するメッセージ通数(1 人に 1 通) */
const MESSAGES_PER_NOTIFICATION = 1;

/**
 * 当月の残りメッセージ通数を求める。
 * 上限がない(type が none)場合は Infinity を返す。
 */
export const remainingQuota = (
  quota: messagingApi.MessageQuotaResponse,
  consumption: messagingApi.QuotaConsumptionResponse,
): number =>
  quota.type === "none"
    ? Number.POSITIVE_INFINITY
    : Math.max((quota.value ?? 0) - consumption.totalUsage, 0);

export type LineNotifier = {
  /** 当月の残り通数で、もう 1 回通知できるか */
  canNotify: () => Promise<boolean>;
  push: (text: string) => Promise<void>;
};

type LineNotifierOptions = {
  channelAccessToken: string;
  userId: string;
};

export const createLineNotifier = ({
  channelAccessToken,
  userId,
}: LineNotifierOptions): LineNotifier => {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken });

  return {
    canNotify: async () => {
      const [quota, consumption] = await Promise.all([
        client.getMessageQuota(),
        client.getMessageQuotaConsumption(),
      ]);
      return remainingQuota(quota, consumption) >= MESSAGES_PER_NOTIFICATION;
    },
    push: async (text) => {
      await client.pushMessage({
        to: userId,
        messages: [{ type: "text", text }],
      });
    },
  };
};
