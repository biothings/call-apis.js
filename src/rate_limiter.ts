import BaseQueryBuilder from "./builder/base_query_builder";
import { RedisClient } from "./types";

// Default rate limit of 100 queries per second, which shouldn't ever be reached
// But just in case, this should keep multiple instances from overloading anyone
const DEFAULT_RATE_LIMIT = parseInt(process.env.DEFAULT_API_RATE_LIMIT ?? "6000");

export default class RateCounter {
  redisClient: RedisClient;
  usage: {
    [api: string]: number;
  };
  constructor(redisClient: RedisClient) {
    this.redisClient = redisClient;
    this.usage = {};
  }

  async atLimit(query: BaseQueryBuilder): Promise<boolean> {
    const apiKey = `APIUsageCount:${query.APIEdge.association.api_name}`;
    const limit =
      query.APIEdge.association["x-trapi"]?.rate_limit ?? DEFAULT_RATE_LIMIT;
    if (this.redisClient.clientEnabled) {
      const usage = (await this.redisClient.client.getTimeout(apiKey)) ?? "0";
      return parseInt(usage) >= limit;
    }
    return (this.usage[apiKey] ?? 0) > limit;
  }

  async count(query: BaseQueryBuilder): Promise<void> {
    const apiKey = `APIUsageCount:${query.APIEdge.association.api_name}`;
    if (this.redisClient.clientEnabled) {
      await this.redisClient.client.incrTimeout(apiKey);
      await this.redisClient.client.expireTimeout(apiKey, 60);
      setTimeout(async () => {
        await this.redisClient.client.decrTimeout(apiKey);
      });
      return;
    }
    if (typeof this.usage[apiKey] == "undefined") this.usage[apiKey] = 0;
    this.usage[apiKey] += 1;
    setTimeout(() => {
      this.usage[apiKey] -= 1;
    });
  }
}
