import { AxiosRequestConfig, Method } from "axios";
import { QueryParams, APIEdge } from "../types";

/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
export default class BaseQueryBuilder {
  start: number;
  hasNext: boolean;
  APIEdge: APIEdge;
  delayUntil: Date;
  config: AxiosRequestConfig;
  /**
   * Constructor for Query Builder
   * @param {object} APIEdge - BTE Edge object with input field provided
   */
  constructor(APIEdge: APIEdge) {
    this.start = 0;
    this.hasNext = false;
    this.APIEdge = APIEdge;
  }

  getUrl(): string {
    return this.APIEdge.query_operation.server + this.APIEdge.query_operation.path;
  }

  _getUrl(APIEdge: APIEdge, input: typeof APIEdge.input): string {
    return;
  }

  /**
   * Construct input based on method and inputSeparator
   */
  _getInput(APIEdge: APIEdge): unknown {
    // Specific behavior changed in subclasses
    return;
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
  _getRequestBody(APIEdge: APIEdge, input: typeof APIEdge.input): unknown {
    // implemented in subclasses
    return;
  }

  /**
   * Construct the request config for Axios reqeust.
   */
  constructAxiosRequestConfig(): AxiosRequestConfig {
    const input = this._getInput(this.APIEdge);
    const config = {
      url: this._getUrl(this.APIEdge, input as string),
      params: this._getParams(this.APIEdge, input as string),
      data: this._getRequestBody(this.APIEdge, input as string),
      method: this.APIEdge.query_operation.method as Method,
    };
    this.config = config;
    return config;
  }

  needPagination(apiResponse: unknown): number {
    // implemented in subclasses
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
