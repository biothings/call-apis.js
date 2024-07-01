import Transformer, {
  BTEQueryObject,
} from "@biothings-explorer/api-response-transform";
import { Record } from "@biothings-explorer/types";
import Subquery from "./queries/subquery";
import os from "os";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import { Telemetry, LogEntry, StampedLog, TrapiLog, SerializableLog } from "@biothings-explorer/utils";
import axiosRetry from "axios-retry";
import { cacheLookup } from "@biothings-explorer/utils";
import { APIDefinition, QEdge, QueryHandlerOptions, RecordPackage, UnavailableAPITracker } from "@biothings-explorer/types";

const SUBQUERY_DEFAULT_TIMEOUT = parseInt(
  process.env.SUBQUERY_DEFAULT_TIMEOUT ?? "50000",
);

export interface QueryInfo {
  qEdgeID: string;
  hash: string;
  url: string;
  api_name: string;
  subject: string;
  object: string;
  predicate: string;
  ids: number;
}

export interface headers {
  [header: string]: string;
}

export default class APIQueryPool {
  size: number;
  usage: number;
  unavailableAPIs: UnavailableAPITracker;
  stop: boolean;
  constructor() {
    this.size = os.cpus().length * 8;
    this.usage = 0;
    this.unavailableAPIs = {};
  }

  _getTimeout(apiID: string, options: QueryHandlerOptions): number {
    const timeout =
      options.apiList?.include.find((api: APIDefinition) => api.id === apiID)
        ?.timeout ?? SUBQUERY_DEFAULT_TIMEOUT;
    return timeout;
  }

  getQueryConfig(
    query: Subquery,
    options: QueryHandlerOptions,
    logs: TrapiLog[],
  ): {
    queryConfig: AxiosRequestConfig;
    nInputs: number;
    queryInfo: QueryInfo;
    edgeOperation: string;
  } {
    let queryConfig: AxiosRequestConfig,
      nInputs: number,
      queryInfo: QueryInfo,
      edgeOperation: string;
    try {
      queryConfig = query.getConfig();
      if (Array.isArray(query.APIEdge.input)) {
        nInputs = query.APIEdge.input.length;
        // TemplatedInput
      } else if (typeof query.APIEdge.input === "object") {
        nInputs = Array.isArray(query.APIEdge.input.queryInputs)
          ? query.APIEdge.input.queryInputs.length
          : 1;
      } else {
        nInputs = 1;
      }

      // Put together additional shorthands
      queryInfo = {
        qEdgeID: query.APIEdge.reasoner_edge?.id,
        url: queryConfig.url,
        api_name: query.APIEdge.association.api_name,
        subject: query.APIEdge.association.input_type,
        object: query.APIEdge.association.output_type,
        predicate: query.APIEdge.association.predicate,
        ids: nInputs,
        hash: query.hash,
      };
      edgeOperation = [
        `${query.APIEdge.association.input_type}`,
        `${query.APIEdge.association.predicate}`,
        `${query.APIEdge.association.output_type}`,
      ].join(" > ");
      queryConfig.timeout = this._getTimeout(
        query.APIEdge.association.smartapi.id,
        options,
      );

      return {
        queryConfig,
        nInputs,
        queryInfo,
        edgeOperation,
      };
    } catch (error) {
      debug("Query configuration error, query skipped");
      logs.push(
        new LogEntry(
          "ERROR",
          null,
          `${(
            error as Error
          ).toString()} while configuring query. Query dump: ${JSON.stringify(
            query,
          )}`,
        ).getSerializeable(),
      );
      return undefined;
    }
  }

  async query(
    query: Subquery,
    options: QueryHandlerOptions,
    finish: ({
      logs,
      records,
      fromCache,
      followUp,
      apiUnavailable,
    }: {
      logs?: SerializableLog[];
      records?: Record[];
      fromCache?: boolean;
      followUp?: Subquery;
      apiUnavailable?: boolean;
    }) => Promise<void>,
  ) {
    const hash = query.hash;
    const logs: SerializableLog[] = [];
    let followUp: Subquery;
    let apiUnavailable: boolean;

    const dryrun_only = process.env.DRYRUN === "true";
    const span = Telemetry.startSpan({ description: "apiCall" });
    span?.setData("apiName", query.APIEdge.association.api_name);

    const queryConfigAttempt = this.getQueryConfig(query, options, logs);

    if (!queryConfigAttempt) {
      span?.finish();
      await finish({
        logs
      });
      return;
    }

    const { queryConfig, nInputs, queryInfo, edgeOperation } =
      queryConfigAttempt;

    // Skip if query API has been marked unavailable
    if (this.unavailableAPIs[query.APIEdge.query_operation.server]?.skip) {
      this.unavailableAPIs[
        query.APIEdge.query_operation.server
      ].skippedQueries += 1;
      apiUnavailable = true;
      const message = [
        `Subquery ${query.APIEdge.query_operation.server}`,
        `(${nInputs} ID${nInputs > 1 ? "s" : ""}):`,
        `skipped as it has been temporarily marked unavailable.`,
      ].join(" ");
      debug(message);
      logs.push(
        new LogEntry("WARNING", null, message, {
          type: "query",
          error: true,
          ...queryInfo
        }).getSerializeable(),
      );
      await finish({ logs, apiUnavailable });
      return;
    }

    if (options.caching ?? true) {
      const records = await this.cacheLookup(hash, query.APIEdge.reasoner_edge);
      if (records) {
        span?.setData("queryBody", queryConfig.data);
        const log_msg = [
          `Successful cache retrieval for subquery`,
          query.APIEdge.query_operation.server,
          `(${nInputs} ID${nInputs > 1 ? "s" : ""}):`,
          `${edgeOperation} (retrieved ${records.length}`,
          `record${records.length === 1 ? "" : "s"}).`,
        ].join(" ");
        debug(log_msg);
        logs.push(
          new LogEntry("DEBUG", null, log_msg, {
            type: "cacheHit",
            hits: records.length,
            ...queryInfo,
          }).getSerializeable(),
        );

        span?.finish();
        await finish({
          records,
          logs,
          fromCache: true,
        });
        return;
      }
    }

    debug(JSON.stringify({ hash, ...queryConfig }));

    try {
      const userAgent = [
        `BTE/${process.env.NODE_ENV === "production" ? "prod" : "dev"}`,
        `Node/${process.version}`,
        `${process.platform}`,
      ].join(" ");
      (queryConfig.headers as headers) = queryConfig.headers
        ? { ...(queryConfig.headers as headers), "User-Agent": userAgent }
        : { "User-Agent": userAgent };

      span?.setData("queryBody", queryConfig.data);

      const startTime = performance.now();

      // @ts-expect-error Some weird typing mismatch that doesn't break anything
      axiosRetry(axios, {
        retries: 3,
        retryDelay: axiosRetry.exponentialDelay,
        retryCondition: err => {
          return (
            axiosRetry.isNetworkOrIdempotentRequestError(err) ||
            err.response?.status >= 500
          );
        },
      });

      const queryResponse = dryrun_only
        ? { data: [] }
        : await axios(queryConfig);

      const finishTime = performance.now();
      debug("Subquery success, transforming hits->records...");
      const timeElapsed = Math.round(
        finishTime - startTime > 1000
          ? (finishTime - startTime) / 1000
          : finishTime - startTime,
      );
      const timeUnits = finishTime - startTime > 1000 ? "s" : "ms";

      const unTransformedHits = {
        response: queryResponse.data as AxiosResponse,
        edge: query.APIEdge,
      };

      const queryNeedsPagination = query.needsPagination(
        unTransformedHits.response,
      );
      if (queryNeedsPagination) {
        const log = `Query requires pagination, will re-query to window ${queryNeedsPagination}-${
          queryNeedsPagination + 1000
        }: ${query.APIEdge.query_operation.server} (${nInputs} ID${
          nInputs > 1 ? "s" : ""
        })`;
        debug(log);
        if (queryNeedsPagination >= 9000) {
          const log = `Biothings query reaches 10,000 max: ${
            query.APIEdge.query_operation.server
          } (${nInputs} ID${nInputs > 1 ? "s" : ""})`;
          debug(log);
          logs.push(new LogEntry("WARNING", null, log).getSerializeable());
        }
        followUp = query;
      }
      const transformSpan = Telemetry.startSpan({
        description: "transformRecords",
      });
      // have to go through unknown for now to avoid conversion warnings
      // TODO eventually fix this when we pull out more types
      const transformer = new Transformer(
        unTransformedHits as unknown as BTEQueryObject,
        options,
      );
      const transformedRecords = (await transformer.transform()).filter(
        record => {
          return record !== undefined;
        },
      );
      transformSpan.finish();

      // if (global.queryInformation?.queryGraph) {
      //   const globalRecords = global.queryInformation.totalRecords;
      //   global.queryInformation.totalRecords = globalRecords
      //     ? globalRecords + transformedRecords.length
      //     : transformedRecords.length;
      // }
      const log_msg = [
        `Successful ${queryConfig.method.toUpperCase()}`,
        query.APIEdge.query_operation.server,
        `(${nInputs} ID${nInputs > 1 ? "s" : ""}):`,
        `${edgeOperation} (obtained ${transformedRecords.length}`,
        `record${transformedRecords.length === 1 ? "" : "s"},`,
        `took ${timeElapsed}${timeUnits})`,
      ].join(" ");

      debug(log_msg);
      logs.push(
        new LogEntry("DEBUG", null, log_msg, {
          type: "query",
          hits: transformedRecords.length,
          ...queryInfo,
        }).getSerializeable(),
      );

      // end span
      span?.finish();
      await finish({
        logs,
        records: transformedRecords,
        followUp,
      });
    } catch (error) {
      // TODO add method for followup to explicitely have a delay?
      if (
        axios.isAxiosError(error) &&
        (error.response?.status >= 502 || error.code === "ECONNABORTED")
      ) {
        // Assume API is unavailable, stop trying to reach it for 30 seconds
        const errorMessage = [
          `${query.APIEdge.query_operation.server}`,
          `appears to be unavailable. Queries to it will be skipped.`,
        ].join(" ");
        debug(errorMessage);
        this.unavailableAPIs[query.APIEdge.query_operation.server] = {
          skip: true,
          skippedQueries: 0,
        };
        apiUnavailable = true;
        setTimeout(() => {
          delete this.unavailableAPIs[query.APIEdge.query_operation.server];
        }, 30000);
      } else if (axios.isAxiosError(error) && error.response?.status === 429) {
        debug(
          [
            `${query.APIEdge.query_operation.server}`,
            `has rate-limited BTE.`,
            `Queries to it will be skipped until the provided time.`,
          ].join(" "),
        );
        const retryAfter = (error.response.headers as headers)["retry-after"];
        query.delayUntil = retryAfter
          ? isNaN(parseInt(retryAfter))
            ? new Date(retryAfter)
            : new Date(Date.now() + parseInt(retryAfter) * 1000)
          : new Date(Date.now() + 10000); // default wait for 10 seconds

        followUp = query;
      }

      debug(
        [
          `Failed to make to following subquery:`,
          `${JSON.stringify(query.config)}.`,
          `The error is ${(error as Error).toString()}`,
          `with ${(error as Error).stack}`,
        ].join(" "),
      );
      logs.push(
        new LogEntry(
          "ERROR",
          null,
          [
            `call-apis: Failed ${queryConfig.method.toUpperCase()}`,
            `${query.APIEdge.query_operation.server}`,
            `(${nInputs} ID${nInputs > 1 ? "s" : ""}):`,
            `${edgeOperation}: (${(error as Error).toString()})`,
          ].join(" "),
          {
            type: "query",
            error: (error as Error).toString(),
            ...queryInfo,
          },
        ).getSerializeable(),
      );
      if (axios.isAxiosError(error)) {
        debug(
          `The request failed with the following error response: ${JSON.stringify(
            error.response?.data,
          )}`,
        );
        logs.push(
          new LogEntry(
            "DEBUG",
            null,
            `Error response for above failure: ${JSON.stringify(
              error.response?.data,
            )}`,
          ).getSerializeable(),
        );
      }
      Telemetry.captureException(error as Error);

      span?.finish();
      await finish({
        logs,
        followUp,
        apiUnavailable,
      });
    }
  }

  async cacheLookup(hash: string, qEdge: QEdge): Promise<Record[] | null> {
    debug(`Checking for cached records for subquery ${hash}...`);
    const recordPackage = await cacheLookup(hash);
    const records = recordPackage
      ? Record.unpackRecords(recordPackage as RecordPackage, qEdge)
      : null;
    return records;
  }
}
