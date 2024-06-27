import { AxiosRequestConfig, Method } from "axios";
import {
  QueryParams,
  APIEdge,
  BatchAPIEdge,
  NonBatchAPIEdge,
  BiothingsResponse,
  TemplatedInput,
} from "../types";
import { QueryHandlerOptions } from "@biothings-explorer/types";

/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
export default class Subquery {
  start: number;
  hasNext: boolean;
  APIEdge: APIEdge;
  delayUntil: Date;
  config: AxiosRequestConfig;
  options: QueryHandlerOptions;
  /**
   * Constructor for Query Builder
   * @param {object} APIEdge - BTE Edge object with input field provided
   */
  constructor(APIEdge: APIEdge, options: QueryHandlerOptions) {
    this.start = 0;
    this.hasNext = false;
    this.APIEdge = APIEdge;
    this.options = options;
  }

  get url(): string {
    return (
      this.APIEdge.query_operation.server + this.APIEdge.query_operation.path
    );
  }

  /**
   * Construct input based on method and inputSeparator
   */
  get input(): string | string[] | TemplatedInput {
    if (this.APIEdge.query_operation.supportBatch === true) {
      if (Array.isArray(this.APIEdge.input)) {
        return (this.APIEdge as BatchAPIEdge).input.join(
          this.APIEdge.query_operation.inputSeparator,
        );
      }
    }
    return (this.APIEdge as NonBatchAPIEdge).input;
  }

  /**
   * Construct parameters for API calls
   */
  get params(): QueryParams {
    const params: QueryParams = {};
    Object.keys(this.APIEdge.query_operation.params).map(param => {
      if (
        Array.isArray(this.APIEdge.query_operation.path_params) &&
        this.APIEdge.query_operation.path_params.includes(param)
      ) {
        return;
      }
      if (typeof this.APIEdge.query_operation.params[param] === "string") {
        params[param] = (
          this.APIEdge.query_operation.params[param] as string
        ).replace("{inputs[0]}", this.input as string);
      } else {
        params[param] = this.APIEdge.query_operation.params[param];
      }
    });
    return params;
  }

  /**
   * Construct request body for API calls
   */
  get requestBody(): unknown {
    if (
      this.APIEdge.query_operation.request_body !== undefined &&
      "body" in this.APIEdge.query_operation.request_body
    ) {
      const body = this.APIEdge.query_operation.request_body.body;
      const data = Object.keys(body).reduce(
        (accumulator, key) =>
          accumulator +
          key +
          "=" +
          body[key].toString().replace("{inputs[0]}", this.input) +
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
    const config = {
      url: this.url,
      params: this.params,
      data: this.requestBody,
      method: this.APIEdge.query_operation.method as Method,
    };
    this.config = config;
    return config;
  }

  needsPagination(apiResponse: unknown): number {
    if (
      this.APIEdge.query_operation.method === "get" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      if (
        (apiResponse as BiothingsResponse).total >
        this.start + (apiResponse as BiothingsResponse).hits.length
      ) {
        if (
          this.start + (apiResponse as BiothingsResponse).hits.length <
          10000
        ) {
          this.hasNext = true;
          return this.start + 1000;
        }
      }
    }
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
    if (this.hasNext !== false) {
      return this.getNext();
    }
    return this.constructAxiosRequestConfig();
  }
}