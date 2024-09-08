/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
import nunjucks from "nunjucks";
import type { APIEdge, TemplatedInput } from "../types";
import BaseQueryBuilder from "./base_query_builder";
import nunjucksConfig from "./nunjucks_config";
import { BiothingsResponse, QueryParams } from "../types";
import { AxiosRequestConfig, Method } from "axios";
const env = nunjucks.configure({ autoescape: false });
nunjucksConfig(env);

export default class TemplateQueryBuilder extends BaseQueryBuilder {
  getUrl(): string {
    return this.APIEdge.query_operation.server + this.APIEdge.query_operation.path;
  }

  _getUrl(APIEdge: APIEdge, input: string | string[] | TemplatedInput): string {
    let server = APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = APIEdge.query_operation.path;
    if (Array.isArray(APIEdge.query_operation.path_params)) {
      APIEdge.query_operation.path_params.map(param => {
        const val = String(APIEdge.query_operation.params[param]);
        // cast input to any because nunjucks typing is a little broken
        path = nunjucks.renderString(
          path.replace("{" + param + "}", val),
          input as any,
        );
      });
    }
    return server + path;
  }

  /**
   * Construct input based on method and inputSeparator
   */
  _getInput(APIEdge: APIEdge): TemplatedInput {
    let baseInput = APIEdge.input as TemplatedInput;
    if (this.APIEdge.query_operation.paginated) {
      (baseInput as any).start = this.start;
    }
    return baseInput;
  }

  /**
   * Construct parameters for API calls
   */
  _getParams(APIEdge: APIEdge, input: string | string[] | TemplatedInput): QueryParams {
    const params: QueryParams = {};
    if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.query_operation.server.includes("biothings.ncats.io")
    ) {
      params.with_total = true;
    }
    Object.keys(APIEdge.query_operation.params).map(param => {
      if (
        Array.isArray(APIEdge.query_operation.path_params) &&
        APIEdge.query_operation.path_params.includes(param)
      ) {
        return;
      }
      if (typeof APIEdge.query_operation.params[param] === "string") {
        // cast input to any because nunjucks typing is a little broken
        params[param] = nunjucks.renderString(
          String(APIEdge.query_operation.params[param]),
          input as any,
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
  _getRequestBody(
    APIEdge: APIEdge,
    input: string | string[] | TemplatedInput,
  ): unknown {
    if (
      APIEdge.query_operation.request_body !== undefined &&
      "body" in APIEdge.query_operation.request_body
    ) {
      const body = APIEdge.query_operation.request_body.body;
      let data: unknown;
      if (APIEdge.query_operation.requestBodyType === "object") {
        // cast input to any because nunjucks typing is a little broken
        data = JSON.parse(nunjucks.renderString(body, input as any));
      } else {
        data = Object.keys(body).reduce((accumulator, key) => {
          // cast input to any because nunjucks typing is a little broken
          return (
            accumulator +
            key +
            "=" +
            nunjucks.renderString(body[key].toString(), input as any) +
            "&"
          );
        }, "");
        data = (data as string).substring(0, (data as string).length - 1);
      }
      return data;
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

  // util for pagination
  _getDescendantProp(obj: any, desc: string): any {
    let arr = desc.split(".");
    for (let i = 0; i < arr.length; i++) {
      obj = obj?.[arr[i]];
    }
    return obj;
  }

  needPagination(apiResponse: unknown): {paginationStart: number, paginationSize: number}  {
    if (this.APIEdge.query_operation.paginated) {
      let resCount = this._getDescendantProp(apiResponse, this.APIEdge.query_operation.paginationData.countField);
      if (Array.isArray(resCount)) resCount = resCount.length;
      let resTotal = this._getDescendantProp(apiResponse, this.APIEdge.query_operation.paginationData.totalField);
      let paginationSize = this.APIEdge.query_operation.paginationData.pageSize;
      if (resTotal > this.start + resCount) {
        this.hasNext = true;
        return {paginationStart: this.start + paginationSize, paginationSize};
      }
    }
    // TODO check for biothings pending, use smarter post method (also do config properly to use new parameter)
    else if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      if ((apiResponse as BiothingsResponse).max_total > this.start + 1000) {
        this.hasNext = true;
        return {paginationStart: this.start + 1000, paginationSize: 1000};
      }
    } else if (
      this.APIEdge.query_operation.method === "get" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      if (
        (apiResponse as BiothingsResponse).total >
        this.start + (apiResponse as BiothingsResponse).hits.length
      ) {
        if (this.start + (apiResponse as BiothingsResponse).hits.length < 10000) {
          this.hasNext = true;
          return {paginationStart: this.start + 1000, paginationSize: 1000};
        }
      }
    } else if (
      this.APIEdge.query_operation.method === "get" &&
      this.APIEdge.association != null &&  // abstract comparison for null and undefined
      this.APIEdge.association.api_name === "Monarch API"
    ) {
      if (
        (apiResponse as any).total >
        this.start + (apiResponse as any).items.length
      ) {
        if (this.start + (apiResponse as any).items.length < 10000) {
          this.hasNext = true;
          return {paginationStart: this.start + 500, paginationSize: 500};
        }
      }
    }
    this.hasNext = false;
    return {paginationStart: 0, paginationSize: 0};
  }

  getNext(): AxiosRequestConfig {
    if (this.APIEdge.query_operation.paginated) {
      this.start += this.APIEdge.query_operation.paginationData.pageSize;
      this.config = this.constructAxiosRequestConfig();
      return this.config;
    }
    const config = this.constructAxiosRequestConfig();
    if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      this.start = this.start + 1000;
      config.params.from = this.start;
    } 
    else if (
      this.APIEdge.query_operation.method === "get" &&
      this.APIEdge.association.api_name === "Monarch API"
    ) {
      this.start = this.start + 500;
      config.params.offset = this.start;
    }
    else {
      this.start = Math.min(this.start + 1000, 9999);
      config.params.from = this.start;
      if (config.params.size + this.start > 10000) {
        config.params.size = 10000 - this.start;
      }
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
