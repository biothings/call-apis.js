import { Record } from "@biothings-explorer/api-response-transform";
import BaseQueryBuilder from "./builder/base_query_builder";
import APIQueryPool from "./query_pool";
import APIQueryQueue from "./query_queue";
import { QueryHandlerOptions, UnavailableAPITracker } from "./types";
import {
  LogEntry,
  StampedLog,
  Telemetry,
  RedisClient,
} from "@biothings-explorer/utils";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");

export default class SubQueryDispatcher {
  redisClient: RedisClient;
  options: QueryHandlerOptions;
  queue: APIQueryQueue;
  pool: APIQueryPool;
  records: Record[];
  currentlyDispatched: number;
  complete: (value: unknown) => void;
  unavailableAPIs: UnavailableAPITracker;
  maxRecords: number;
  globalMaxRecords: number;
  totalRecords: number;
  done: boolean;
  logs: StampedLog[];
  qEdgeID: string;
  constructor(
    queries: BaseQueryBuilder[],
    redisClient: RedisClient,
    unavailableAPIs: UnavailableAPITracker,
    options: QueryHandlerOptions = {},
  ) {
    this.qEdgeID = queries[0].APIEdge.reasoner_edge?.id;
    this.redisClient = redisClient;
    this.unavailableAPIs = unavailableAPIs;
    this.options = options;
    this.queue = new APIQueryQueue(queries, redisClient);
    this.pool = new APIQueryPool(options);
    this.records = [];
    this.currentlyDispatched = 0;
    this.maxRecords = parseInt(process.env.MAX_RECORDS_PER_EDGE) || 50000;
    this.globalMaxRecords = parseInt(process.env.MAX_RECORDS_TOTAL) || 100000;
    this.totalRecords = 0;
    this.done = false;
    this.logs = [];
  }

  async execute(): Promise<{ records: Record[]; logs: StampedLog[] }> {
    const promise: Promise<{ records: Record[]; logs: StampedLog[] }> =
      new Promise(resolve => {
        this.complete = ({
          records,
          logs,
        }: {
          records: Record[];
          logs: StampedLog[];
        }) => resolve({ records, logs });
      });
    for (let i = 0; i < this.pool.size; i++) {
      await this.queryPool();
    }
    return promise;
  }

  async queryPool(): Promise<void> {
    const query = await this.queue.getNext();
    if (!query) return;

    this.currentlyDispatched += 1;
    void this.pool.query(
      query,
      this.unavailableAPIs,
      async (logs, records, followUp) => {
        await this.onQueryComplete(logs, records, followUp);
      },
    );
  }

  checkMaxRecords(): boolean {
    return (
      (this.maxRecords > 0 && this.totalRecords >= this.maxRecords) ||
      (this.globalMaxRecords > 0 &&
        global.queryInformation?.totalRecords > this.globalMaxRecords)
    );
  }

  wrapup() {
    this.done = true;
    this.pool.stop = true;
  }

  async onQueryComplete(
    logs: StampedLog[],
    records?: Record[],
    followUp?: BaseQueryBuilder[],
  ): Promise<void> {
    if (this.done) return;
    if (logs) this.logs.push(...logs);
    if (records) {
      this.records.push(...records);

      const globalRecords = global.queryInformation?.totalRecords;
      if (global.queryInformation) {
        global.queryInformation.totalRecords = globalRecords
          ? globalRecords + records.length
          : records.length;
      }
    }
    if (followUp) this.queue.add(followUp);
    this.currentlyDispatched -= 1;
    if (
      this.checkMaxRecords() ||
      (this.queue.isEmpty && this.currentlyDispatched <= 0)
    ) {
      if (this.checkMaxRecords()) {
        const stoppedOnGlobalMax =
          this.globalMaxRecords > 0 &&
          global.queryInformation?.totalRecords >= this.globalMaxRecords;
        let message = [
          `Qedge ${this.qEdgeID}`,
          `obtained ${this.records.length} records,`,
          this.records.length === this.maxRecords ? "hitting" : "exceeding",
          `maximum of ${this.maxRecords}`,
          `Truncating records to ${this.maxRecords} and skipping remaining`,
          `${this.queue.length + this.currentlyDispatched}`,
          `queries for this edge.`,
          `Your query may be too general?`,
        ];
        if (stoppedOnGlobalMax) {
          message = message.slice(0, 2);
          message.push(
            ...[
              `totalling ${global.queryInformation.totalRecords} for this query.`,
              `This exceeds the per-query maximum of ${this.globalMaxRecords}.`,
              `For stability purposes, this query is terminated.`,
              `Please consider refining your query further.`,
            ],
          );
          debug(message.join(" "));
          this.logs.push(
            new LogEntry("WARNING", null, message.join(" ")).getLog(),
          );
          this.complete({ logs: this.logs });
          Telemetry.captureException(
            new Error(
              `Stopped on globalMaxRecords (exceeded ${this.globalMaxRecords})`,
            ),
          );
        }
      }
      this.wrapup();
      this.complete({
        records: this.records.slice(0, this.maxRecords),
        logs: this.logs,
      });
      return;
    }
    await this.queryPool();
  }
}
