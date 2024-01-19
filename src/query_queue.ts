import BaseQueryBuilder from "./builder/base_query_builder";
import RateCounter from "./rate_limiter";
import { RedisClient } from "@biothings-explorer/utils";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");

export default class APIQueryQueue {
  queue: BaseQueryBuilder[];
  rateCounter: RateCounter;
  constructor(queries: BaseQueryBuilder[], redisClient?: RedisClient) {
    this.queue = [...queries];
    this.rateCounter = new RateCounter(redisClient);
  }

  get length() {
    return this.queue.length;
  }

  get isEmpty() {
    return this.queue.length === 0;
  }

  add(query: BaseQueryBuilder | BaseQueryBuilder[]) {
    if (!Array.isArray(query)) query = [query];
    this.queue.unshift(...query);
  }

  async getNext(): Promise<BaseQueryBuilder> {
    const query = this.queue.pop();
    if (!query) return;
    const queryDelayed = query.delayUntil && query.delayUntil >= new Date();
    if ((await this.rateCounter.atLimit(query)) || queryDelayed) {
      debug(
        [
          `query to ${query.APIEdge.query_operation.server}`,
          `rate-limited or delayed, will-retry after rest of sub-query queue`,
        ].join(" "),
      );
      this.queue.unshift(query);
      return new Promise(resolve => {
        setImmediate(async () => {
          resolve(await this.getNext());
        });
      });
    }
    return query;
  }
}
