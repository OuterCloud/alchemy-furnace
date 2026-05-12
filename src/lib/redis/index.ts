import { env } from "@/env";
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
