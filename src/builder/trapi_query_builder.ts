import type { APIEdge, TrapiResponse } from "../types";
import { AxiosRequestConfig, Method } from "axios";
import { TrapiRequest } from "../types";
import BaseQueryBuilder from "./base_query_builder";

/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
export default class TRAPIQueryBuilder extends BaseQueryBuilder {
  start: number;
  hasNext: boolean;
  APIEdge: APIEdge;
  originalSubmitter: string;

  _getUrl(APIEdge: APIEdge, input: string | string[]): string {
    let server = APIEdge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = APIEdge.query_operation.path;
    if (Array.isArray(APIEdge.query_operation.path_params)) {
      APIEdge.query_operation.path_params.map(param => {
        const val = String(APIEdge.query_operation.params[param]);
        path = path
          .replace("{" + param + "}", val)
          .replace("{inputs[0]}", String(input));
      });
    }
    return server + path;
  }
  /**
   * Construct input based on method and inputSeparator
   */
  _getInput(APIEdge: APIEdge): string[] {
    return APIEdge.input as string[];
  }

  addSubmitter(submitter: string): void {
    this.originalSubmitter = submitter;
  }

  /**
   * Construct TRAPI request body
   */
  _getRequestBody(APIEdge: APIEdge, input: string | string[]): TrapiRequest {
    const queryGraph: TrapiRequest = {
      message: {
        query_graph: {
          nodes: {
            n0: {
              ids: Array.isArray(input) ? input : [input],
              categories: ["biolink:" + APIEdge.association.input_type],
            },
            n1: {
              categories: ["biolink:" + APIEdge.association.output_type],
            },
          },
          edges: {
            e01: {
              subject: "n0",
              object: "n1",
              predicates: ["biolink:" + APIEdge.association.predicate],
            },
          },
        },
      },
      submitter: "infores:bte",
    };
    const qualifierConstraints = APIEdge.reasoner_edge?.getQualifierConstraints?.();
    if (qualifierConstraints) {
      queryGraph.message.query_graph.edges.e01.qualifier_constraints =
        qualifierConstraints;
    }
    const xmaturityMap = {
      ci: "staging",
      test: "test",
      prod: "prod",
      dev: "dev",
    };
    if (process.env.INSTANCE_ENV)
      queryGraph.submitter += `; bte-${xmaturityMap[process.env.INSTANCE_ENV]}`;
    if (this.originalSubmitter)
      queryGraph.submitter += `; subquery for client "${this.originalSubmitter}"`;
    return queryGraph;
  }

  /**
   * Construct the request config for Axios reqeust.
   */
  constructAxiosRequestConfig(): AxiosRequestConfig {
    const input = this._getInput(this.APIEdge);
    const config = {
      url: this._getUrl(this.APIEdge, input),
      data: this._getRequestBody(this.APIEdge, input),
      method: this.APIEdge.query_operation.method as Method,
      headers: {
        "Content-Type": "application/json",
      },
    };
    this.config = config;
    return config;
  }

  needPagination(apiResponse: TrapiResponse): number {
    this.hasNext = false;
    return 0;
  }

  getNext(): AxiosRequestConfig {
    const config = this.constructAxiosRequestConfig();
    return config;
  }

  getConfig(): AxiosRequestConfig {
    if (this.hasNext === false) {
      return this.constructAxiosRequestConfig();
    }
    return this.getNext();
  }
}
