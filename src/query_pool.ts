import Transformer, {
  BTEQueryObject,
  Record,
} from "@biothings-explorer/api-response-transform";
import BaseQueryBuilder from "./builder/base_query_builder";
import {
  APIDefinition,
  QueryHandlerOptions,
  UnavailableAPITracker,
} from "./types";
import os from "os";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import { Telemetry, LogEntry, StampedLog } from "@biothings-explorer/utils";
import axiosRetry from "axios-retry";

const SUBQUERY_DEFAULT_TIMEOUT = parseInt(
  process.env.SUBQUERY_DEFAULT_TIMEOUT ?? "50000",
);

export interface QueryInfo {
  qEdgeID: string;
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
  options: QueryHandlerOptions;
  stop: boolean;
  constructor(options: QueryHandlerOptions) {
    this.stop = false;
    this.options = options;
    this.size = os.cpus().length * 2;
    this.usage = 0;
  }

  _getTimeout(apiID: string): number {
    const timeout =
      this.options.apiList?.include.find(
        (api: APIDefinition) => api.id === apiID,
      )?.timeout ?? SUBQUERY_DEFAULT_TIMEOUT;
    return timeout;
  }

  getQueryConfig(
    query: BaseQueryBuilder,
    unavailableAPIs: UnavailableAPITracker,
    logs: StampedLog[],
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
      // Skip if query API has been marked unavailable
      if (unavailableAPIs[query.APIEdge.query_operation.server]?.skip) {
        unavailableAPIs[
          query.APIEdge.query_operation.server
        ].skippedQueries += 1;
        return undefined;
      }
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
      };
      edgeOperation = [
        `${query.APIEdge.association.input_type}`,
        `${query.APIEdge.association.predicate}`,
        `${query.APIEdge.association.output_type}`,
      ].join(" > ");
      queryConfig.timeout = this._getTimeout(
        query.APIEdge.association.smartapi.id,
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
        ).getLog(),
      );
      return undefined;
    }
  }

  async query(
    query: BaseQueryBuilder,
    unavailableAPIs: UnavailableAPITracker,
    finish: (
      logs?: StampedLog[],
      records?: Record[],
      followUp?: BaseQueryBuilder[],
    ) => Promise<void>,
  ) {
    // Check if pool has been stopped due to limit hit (save some computation)
    if (this.stop) {
      await finish();
      return;
    }
    const logs: StampedLog[] = [];
    const followUp: BaseQueryBuilder[] = [];

    const dryrun_only = process.env.DRYRUN === "true";
    const span = Telemetry.startSpan({ description: "apiCall" });
    span?.setData("apiName", query.APIEdge.association.api_name);

    const queryConfigAttempt = this.getQueryConfig(
      query,
      unavailableAPIs,
      logs,
    );

    if (!queryConfigAttempt) {
      span?.finish();
      await finish(logs);
      return;
    }

    const { queryConfig, nInputs, queryInfo, edgeOperation } =
      queryConfigAttempt;

    debug(queryConfig);

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

      // Check if pool has been stopped due to limit hit (save some computation)
      if (this.stop) {
        await finish();
        return;
      }

      const queryResponse = dryrun_only
        ? { data: [] }
        : await axios(queryConfig);

      // Check if pool has been stopped due to limit hit (save some computation)
      if (this.stop) {
        await finish();
        return;
      }

      const finishTime = performance.now();
      debug("query success, transforming hits->records...");
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

      const queryNeedsPagination = query.needPagination(
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
          logs.push(new LogEntry("WARNING", null, log).getLog());
        }
        followUp.push(query);
      }
      const transformSpan = Telemetry.startSpan({
        description: "transformRecords",
      });
      // have to go through unknown for now to avoid conversion warnings
      // TODO eventually fix this when we pull out more types
      const transformer = new Transformer(
        unTransformedHits as unknown as BTEQueryObject,
        this.options,
      );
      const transformedRecords = (await transformer.transform()).filter(
        record => {
          return record !== undefined;
        },
      );
      transformSpan.finish();

      if (global.queryInformation?.queryGraph) {
        const globalRecords = global.queryInformation.totalRecords;
        global.queryInformation.totalRecords = globalRecords
          ? globalRecords + transformedRecords.length
          : transformedRecords.length;
      }
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
        }).getLog(),
      );

      // end span
      span?.finish();
      await finish(logs, transformedRecords, followUp);
    } catch (error) {
      // TODO add method for followup to explicitely have a delay?
      if (
        axios.isAxiosError(error) &&
        (error.response?.status >= 502 || error.code === "ECONNABORTED")
      ) {
        const errorMessage = [
          `${query.APIEdge.query_operation.server}`,
          `appears to be unavailable. Queries to it will be skipped.`,
        ].join(" ");
        debug(errorMessage);
        unavailableAPIs[query.APIEdge.query_operation.server] = {
          skip: true,
          skippedQueries: 0,
        };
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

        followUp.push(query);
      }

      debug(
        [
          `Failed to make to following query:`,
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
        ).getLog(),
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
          ).getLog(),
        );
      }
      Telemetry.captureException(error as Error);

      span?.finish();
      await finish(logs, undefined, followUp);
    }
  }
}
