import { LogEntry, StampedLog, RedisClient, SerializableLog } from "@biothings-explorer/utils";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import subqueryFactory from "./queries/subquery_factory";
import TRAPISubquery from "./queries/trapi_subquery";
import SubQueryDispatcher from "./dispatcher";
import {
  Record,
  RecordPackage,
} from "@biothings-explorer/types";
import {
  ResolverOutput,
  SRIResolverOutput,
  generateInvalidBioentities,
  getAttributes,
  resolveSRI,
  ResolvableBioEntity,
} from "biomedical_id_resolver";
import Subquery from "./queries/subquery";
import async from "async";
import { APIEdge, QueryHandlerOptions } from "@biothings-explorer/types";

export * from "./types";
export { default as Subquery, FrozenSubquery } from "./queries/subquery";

const subqueryDispatcher = new SubQueryDispatcher();

export interface SubqueryResults {
  hash: string;
  records: RecordPackage;
  logs: SerializableLog[];
  apiUnavailable: boolean;
}

export interface SubqueryCallback {
  (results: SubqueryResults): void;
}

export class SubqueryRelay {
  subscriberMap: {
    [subqueryHash: string]: SubqueryCallback[];
  };
  constructor() {
    this.subscriberMap = {};
  }

  async subscribe(
    queries: Subquery[],
    options: QueryHandlerOptions,
    callback: SubqueryCallback,
  ) {
    debug(`Subquery relay received ${queries.length} subqueries.`);
    // Add all subqueries simultaneously
    await async.each(queries, async query => {
      const qHash = query.hash; // Avoid calculating hash repeatedly
      let newHash = false;
      if (!this.subscriberMap[qHash]) {
        this.subscriberMap[qHash] = [];
        newHash = true;
      }
      this.subscriberMap[qHash].push(callback);
      if (!newHash) {
        debug(
          `Subquery ${qHash} already in queue, subscribing (${Object.keys(this.subscriberMap[qHash]).length} subscribed)`,
        );
        // waiting for another execution
        return;
      }
      debug(`New subquery ${qHash} added to queue.`);

      const { hash, records, logs, apiUnavailable } =
        await subqueryDispatcher.execute(query, options);

      debug(
        `Subquery ${qHash} completes, returning records to ${Object.keys(this.subscriberMap[qHash]).length} subscribers`,
      );

      const packedRecords = Record.packRecords(records);

      for (const subscribedCallback of this.subscriberMap[qHash]) {
        subscribedCallback({
          hash,
          records: packedRecords,
          logs,
          apiUnavailable,
        });
      }
      delete this.subscriberMap[qHash];
    });
  }
}

export function constructQueries(
  APIEdges: APIEdge[],
  options: QueryHandlerOptions,
) {
  return APIEdges.map(edge => {
    const subQuery = subqueryFactory(edge, options);
    return subQuery;
  });
}