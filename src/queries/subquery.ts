import { AxiosRequestConfig, Method } from "axios";
import { QueryHandlerOptions, QEdge, QEdgeInfo, APIDefinition, APIEdge, NonBatchAPIEdge, BatchAPIEdge, QueryParams, BiothingsResponse, TemplatedInput } from "@biothings-explorer/types";
import crypto from "crypto";
import stringify from "json-stable-stringify";

const SUBQUERY_DEFAULT_TIMEOUT = parseInt(
  process.env.SUBQUERY_DEFAULT_TIMEOUT ?? "50000",
);

export interface FrozenAPIEdge extends Omit<APIEdge, "reasoner_edge"> {
  reasoner_edge: QEdgeInfo;
}

export interface FrozenSubquery {
  type: string;
  start: number;
  hasNext: boolean;
  delayUntil: Date;
  APIEdge: FrozenAPIEdge;
  options: QueryHandlerOptions;
}

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
    let server = this.APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = this.APIEdge.query_operation.path;
    if (Array.isArray(this.APIEdge.query_operation.path_params)) {
      this.APIEdge.query_operation.path_params.map(param => {
        const val = String(this.APIEdge.query_operation.params[param]);
        path = path.replace("{" + param + "}", val).replace("{inputs[0]}", this.input as string);
      });
    }
    return server + path;
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

  get timeout(): number {
    const apiID = this.APIEdge.association.smartapi.id;
    const timeout =
      this.options.apiList?.include.find(
        (api: APIDefinition) => api.id === apiID,
      )?.timeout ?? SUBQUERY_DEFAULT_TIMEOUT;
    return timeout;
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
      timeout: this.timeout,
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

  get hash(): string {
    return crypto
      .createHash("md5")
      .update(stringify(this.constructAxiosRequestConfig()))
      .digest("hex");
  }

  freeze(): FrozenSubquery {
    return {
      type: "base",
      start: this.start,
      hasNext: this.hasNext,
      delayUntil: this.delayUntil,
      options: this.options,
      APIEdge: {
        ...this.APIEdge,
        reasoner_edge: this.APIEdge.reasoner_edge.freeze(),
      },
    };
  }

  static async unfreeze(frozenSubquery: FrozenSubquery): Promise<Subquery> {
    const { default: template } = await import("./template_subquery");
    const { default: trapi } = await import("./trapi_subquery");
    const mapping = {
      base: Subquery,
      template,
      trapi,
    };
    const apiEdge: APIEdge = {
      ...frozenSubquery.APIEdge,
      reasoner_edge: new QEdge(frozenSubquery.APIEdge.reasoner_edge),
    };
    const subquery = new mapping[frozenSubquery.type](apiEdge, frozenSubquery.options);
    subquery.start = frozenSubquery.start;
    subquery.hasNext = frozenSubquery.hasNext;
    subquery.delayUntil = frozenSubquery.delayUntil;
    return subquery;
  }
}