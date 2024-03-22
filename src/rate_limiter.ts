import BaseQueryBuilder from "./builder/base_query_builder";
import { RedisClient } from "@biothings-explorer/utils";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");

// Default rate limit of 100 queries per second, which shouldn't ever be reached
// But just in case, this should keep multiple instances from overloading anyone
const DEFAULT_RATE_LIMIT = parseInt(
  process.env.DEFAULT_API_RATE_LIMIT ?? "6000",
);

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
    let usage: string;
    if (this.redisClient.clientEnabled) {
      try {
        usage = await new Promise((resolve, reject) => {
          setTimeout(() => reject(), 500);
          this.redisClient.client.getTimeout(apiKey).then(
            result => resolve(result),
            error => reject(error),
          );
        });
      } catch (error) {
        debug("Redis failed to respond to APIUsageCount query in time.");
      }
    }
    if (!usage) {
      usage = `${this.usage[apiKey] ?? 0}`;
    }
    return parseInt(usage) >= limit;
  }

  async count(query: BaseQueryBuilder): Promise<void> {
    const apiKey = `APIUsageCount:${query.APIEdge.association.api_name}`;
    if (this.redisClient.clientEnabled) {
      try {
        await new Promise<void>((resolve, reject) => {
          setTimeout(() => reject(), 500);
          this.redisClient.client.incrTimeout(apiKey).then(
            () =>
              this.redisClient.client.expireTimeout(apiKey, 60).then(
                () => {
                  setTimeout(() => {
                    this.redisClient.client.decrTimeout(apiKey).then(
                      () => null,
                      error => reject(error),
                    );
                  });
                  resolve();
                },
                error => reject(error),
              ),
            error => reject(error),
          );
        });
      } catch {
        debug("Redis failed to respond to APIUsageCount query in time.");
      }
    }
    if (typeof this.usage[apiKey] == "undefined") this.usage[apiKey] = 0;
    this.usage[apiKey] += 1;
    setTimeout(() => {
      this.usage[apiKey] -= 1;
    });
  }
}
