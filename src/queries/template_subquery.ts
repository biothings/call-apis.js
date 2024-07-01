/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
import nunjucks from "nunjucks";
import nunjucksConfig from "./nunjucks_config";
import { BiothingsResponse, QueryParams, TemplatedInput } from "../types";
import { AxiosRequestConfig } from "axios";
import Subquery, { FrozenSubquery } from "./subquery";
const env = nunjucks.configure({ autoescape: false });
nunjucksConfig(env);

export default class TemplateSubquery extends Subquery {
  get url(): string {
    let server = this.APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = this.APIEdge.query_operation.path;
    if (Array.isArray(this.APIEdge.query_operation.path_params)) {
      this.APIEdge.query_operation.path_params.map(param => {
        const val = String(this.APIEdge.query_operation.params[param]);
        path = nunjucks.renderString(
          path.replace("{" + param + "}", val),
          this.input as any,
        );
      });
    }
    return server + path;
  }

  /**
   * Construct input based on method and inputSeparator
   */
  get input(): TemplatedInput {
    return this.APIEdge.input as TemplatedInput;
  }

  /**
   * Construct parameters for API calls
   */
  get params(): QueryParams {
    const params: QueryParams = {};
    if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.query_operation.server.includes("biothings.ncats.io")
    ) {
      params.with_total = true;
    }
    Object.keys(this.APIEdge.query_operation.params).map(param => {
      if (
        Array.isArray(this.APIEdge.query_operation.path_params) &&
        this.APIEdge.query_operation.path_params.includes(param)
      ) {
        return;
      }
      if (typeof this.APIEdge.query_operation.params[param] === "string") {
        params[param] = nunjucks.renderString(
          String(this.APIEdge.query_operation.params[param]),
          this.input as TemplatedInput,
        );
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
      let data: unknown;
      if (this.APIEdge.query_operation.requestBodyType === "object") {
        data = JSON.parse(nunjucks.renderString(body, this.input as TemplatedInput));
      } else {
        data = Object.keys(body).reduce((accumulator, key) => {
          return (
            accumulator +
            key +
            "=" +
            nunjucks.renderString(body[key].toString(), this.input as TemplatedInput) +
            "&"
          );
        }, "");
        data = (data as string).substring(0, (data as string).length - 1);
      }
      return data;
    }
  }

  needsPagination(apiResponse: unknown): number {
    // TODO check for biothings pending, use smarter post method (also do config properly to use new parameter)
    if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      if ((apiResponse as BiothingsResponse).max_total > this.start + 1000) {
        this.hasNext = true;
        return this.start + 1000;
      }
    } else if (
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
    this.hasNext = false;
    return 0;
  }

  getNext(): AxiosRequestConfig {
    const config = this.constructAxiosRequestConfig();
    if (
      this.APIEdge.query_operation.method === "post" &&
      this.APIEdge.tags.includes("biothings")
    ) {
      this.start = this.start + 1000;
      config.params.from = this.start;
    } else {
      this.start = Math.min(this.start + 1000, 9999);
      config.params.from = this.start;
      if (config.params.size + this.start > 10000) {
        config.params.size = 10000 - this.start;
      }
    }
    this.config = config;
    return config;
  }

  
  freeze(): FrozenSubquery {
    return {
      type: "template",
      start: this.start,
      hasNext: this.hasNext,
      delayUntil: this.delayUntil,
      APIEdge: this.APIEdge,
      options: this.options,
    };
  }
}