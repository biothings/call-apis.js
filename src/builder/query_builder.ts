import type { APIEdge, BatchAPIEdge, NonBatchAPIEdge } from "../types";
import { AxiosRequestConfig, Method } from "axios";
import { BiothingsResponse, QueryParams } from "../types";
import BaseQueryBuilder from "./base_query_builder";

/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
export default class QueryBuilder extends BaseQueryBuilder {
  start: number;
  hasNext: boolean;
  APIEdge: APIEdge;
  config: AxiosRequestConfig;

  getUrl(): string {
    return this.APIEdge.query_operation.server + this.APIEdge.query_operation.path;
  }

  _getUrl(APIEdge: APIEdge, input: string): string {
    let server = APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = APIEdge.query_operation.path;
    if (Array.isArray(APIEdge.query_operation.path_params)) {
      APIEdge.query_operation.path_params.map(param => {
        const val = String(APIEdge.query_operation.params[param]);
        path = path.replace("{" + param + "}", val).replace("{inputs[0]}", input);
      });
    }
    return server + path;
  }

  /**
   * Construct input based on method and inputSeparator
   */
  _getInput(APIEdge: APIEdge): string {
    if (APIEdge.query_operation.supportBatch === true) {
      if (Array.isArray(APIEdge.input)) {
        return (APIEdge as BatchAPIEdge).input.join(
          APIEdge.query_operation.inputSeparator,
        );
      }
    }
    return (APIEdge as NonBatchAPIEdge).input;
  }

  /**
   * Construct parameters for API calls
   */
  _getParams(APIEdge: APIEdge, input: string): QueryParams {
    const params: QueryParams = {};
    Object.keys(APIEdge.query_operation.params).map(param => {
      if (
        Array.isArray(APIEdge.query_operation.path_params) &&
        APIEdge.query_operation.path_params.includes(param)
      ) {
        return;
      }
      if (typeof APIEdge.query_operation.params[param] === "string") {
        params[param] = (APIEdge.query_operation.params[param] as string).replace(
          "{inputs[0]}",
          input,
        );
      } else {
        params[param] = APIEdge.query_operation.params[param];
      }
    });
    return params;
  }

  /**
   * Construct request body for API calls
   */
  _getRequestBody(APIEdge: APIEdge, input: string): string {
    if (
      APIEdge.query_operation.request_body !== undefined &&
      "body" in APIEdge.query_operation.request_body
    ) {
      const body = APIEdge.query_operation.request_body.body;
      const data = Object.keys(body).reduce(
        (accumulator, key) =>
          accumulator +
          key +
          "=" +
          body[key].toString().replace("{inputs[0]}", input) +
          "&",
        "",
      );
      return data.substring(0, data.length - 1);
    }
  }

  /**
   * Construct the request config for Axios reqeust.
   */
  constructAxiosRequestConfig(): AxiosRequestConfig {
    const input = this._getInput(this.APIEdge);
    const config = {
      url: this._getUrl(this.APIEdge, input),
      params: this._getParams(this.APIEdge, input),
      data: this._getRequestBody(this.APIEdge, input),
      method: this.APIEdge.query_operation.method as Method,
    };
    this.config = config;
    return config;
  }

  needPagination(apiResponse: unknown): number {
    if (
      this.APIEdge.query_operation.method === "get" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      if (
        (apiResponse as BiothingsResponse).total >
        this.start + (apiResponse as BiothingsResponse).hits.length
      ) {
        if (this.start + (apiResponse as BiothingsResponse).hits.length < 10000) {
          this.hasNext = true;
          return this.start + 1000;
        }
      }
    }
    this.hasNext = false;
    return 0;
  }

  getNext(): AxiosRequestConfig {
    this.start = Math.min(this.start + 1000, 9999);
    const config = this.constructAxiosRequestConfig();
    config.params.from = this.start;
    if (config.params.size + this.start > 10000) {
      config.params.size = 10000 - this.start;
    }
    this.config = config;
    return config;
  }

  getConfig(): AxiosRequestConfig {
    if (this.hasNext === false) {
      return this.constructAxiosRequestConfig();
    }
    return this.getNext();
  }
}
