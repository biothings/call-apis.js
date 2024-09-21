import { APIEdge, TrapiQuery, TrapiResponse } from "@biothings-explorer/types";
import { AxiosRequestConfig, Method } from "axios";
import Subquery, { FrozenSubquery } from "./subquery";

/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
export default class TrapiSubquery extends Subquery {
  start: number;
  hasNext: boolean;
  APIEdge: APIEdge;

  get url(): string {
    let server = this.APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = this.APIEdge.query_operation.path;
    if (Array.isArray(this.APIEdge.query_operation.path_params)) {
      this.APIEdge.query_operation.path_params.map(param => {
        const val = String(this.APIEdge.query_operation.params[param]);
        path = path
          .replace("{" + param + "}", val)
          .replace("{inputs[0]}", String(this.input));
      });
    }
    return server + path;
  }
  /**
   * Construct input based on method and inputSeparator
   */
  get input(): string[] {
    return this.APIEdge.input as string[];
  }

  /**
   * Construct TRAPI request body
   */
  get requestBody(): TrapiQuery {
    const queryBody: TrapiQuery = {
      message: {
        query_graph: {
          nodes: {
            n0: {
              ids: Array.isArray(this.input) ? this.input : [this.input],
              categories: ["biolink:" + this.APIEdge.association.input_type],
            },
            n1: {
              categories: ["biolink:" + this.APIEdge.association.output_type],
            },
          },
          edges: {
            e01: {
              subject: "n0",
              object: "n1",
              predicates: ["biolink:" + this.APIEdge.association.predicate],
            },
          },
        },
      },
      submitter: "infores:bte",
    };
    const qualifierConstraints = this.APIEdge.reasoner_edge?.getQualifierConstraints?.();
    if (qualifierConstraints) {
      queryBody.message.query_graph.edges.e01.qualifier_constraints =
        qualifierConstraints;
    }
    if (this.options.caching === false) {
      queryBody.bypass_cache = true;
    }
    const xmaturityMap = {
      ci: "staging",
      test: "test",
      prod: "prod",
      dev: "dev",
    };
    if (process.env.INSTANCE_ENV)
      queryBody.submitter += `; bte-${xmaturityMap[process.env.INSTANCE_ENV]}`;
    if (this.options.submitter)
      queryBody.submitter += `; subquery for client "${this.options.submitter}"`;
    return queryBody;
  }

  /**
   * Construct the request config for Axios reqeust.
   */
  constructAxiosRequestConfig(): AxiosRequestConfig {
    const config = {
      url: this.url,
      data: this.requestBody,
      method: this.APIEdge.query_operation.method as Method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    this.config = config;
    return config;
  }

  needsPagination(apiResponse: TrapiResponse): {paginationStart: number, paginationSize: number}  {
    this.hasNext = false;
    return {paginationStart: 0, paginationSize: 0};
  }

  getNext(): AxiosRequestConfig {
    const config = this.constructAxiosRequestConfig();
    return config;
  }

  freeze(): FrozenSubquery {
    return {
      type: "trapi",
      start: this.start,
      hasNext: this.hasNext,
      delayUntil: this.delayUntil,
      APIEdge: this.APIEdge,
      options: this.options,
    };
  }
}
