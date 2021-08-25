/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
const nunjucks = require("nunjucks");
const nunjucksConfig = require("./nunjucks_config");
const env = nunjucks.configure({ autoescape: false });
nunjucksConfig(env);
module.exports = class QueryBuilder {
  /**
   * Constructor for Query Builder
   * @param {object} edge - BTE Edge object with input field provided
   */
  constructor(edge) {
    this.start = 0;
    this.hasNext = false;
    this.edge = edge;
  }

  getUrl() {
    return this.edge.query_operation.server + this.edge.query_operation.path;
  }

  _getUrl(edge, input) {
    let server = edge.query_operation.server;
    if (server.endsWith("/")) {
      server = server.substring(0, server.length - 1);
    }
    let path = edge.query_operation.path;
    if (Array.isArray(edge.query_operation.path_params)) {
      if (typeof input === "object" && !Array.isArray(input)) {
        edge.query_operation.path_params.map(param => {
          const val = edge.query_operation.params[param];
          path = nunjucks.renderString(path.replace("{" + param + "}", val), input);
        });
      } else {
        edge.query_operation.path_params.map(param => {
          const val = edge.query_operation.params[param];
          path = path.replace("{" + param + "}", val).replace("{inputs[0]}", input);
        });
      }
    }
    return server + path;
  }

  /**
   * Construct input based on method and inputSeparator
   */
  _getInput(edge) {
    if (edge.query_operation.supportBatch === true) {
      if (Array.isArray(edge.input)) {
        return edge.input.join(edge.query_operation.inputSeparator);
      }
    }
    return edge.input;
  }

  /**
   * Construct parameters for API calls
   */
  _getParams(edge, input) {
    const params = {};
    Object.keys(edge.query_operation.params).map(param => {
      if (Array.isArray(edge.query_operation.path_params) && edge.query_operation.path_params.includes(param)) {
        return;
      }
      if (typeof edge.query_operation.params[param] === "string") {
        if (typeof input === "object" && !Array.isArray(input)) {
          params[param] = nunjucks.renderString(edge.query_operation.params[param], input);
        } else {
          params[param] = edge.query_operation.params[param].replace("{inputs[0]}", input);
        }
      } else {
        params[param] = edge.query_operation.params[param];
      }
    });
    return params;
  }

  /**
   * Construct request body for API calls
   */
  _getRequestBody(edge, input) {
    if (edge.query_operation.request_body !== undefined && "body" in edge.query_operation.request_body) {
      let body = edge.query_operation.request_body.body;
      let data;
      if (typeof input === "object" && !Array.isArray(input)) {
        data = Object.keys(body).reduce((accumulator, key) => {
          return accumulator + key + "=" + nunjucks.renderString(body[key].toString(), input) + "&";
        }, "");
      } else {
        data = Object.keys(body).reduce(
          (accumulator, key) => accumulator + key + "=" + body[key].toString().replace("{inputs[0]}", input) + "&",
          "",
        );
      }
      return data.substring(0, data.length - 1);
    }
  }

  /**
   * Construct the request config for Axios reqeust.
   */
  constructAxiosRequestConfig() {
    const input = this._getInput(this.edge);
    const config = {
      url: this._getUrl(this.edge, input),
      params: this._getParams(this.edge, input),
      data: this._getRequestBody(this.edge, input),
      method: this.edge.query_operation.method,
      timeout: 50000,
    };
    this.config = config;
    return config;
  }

  needPagination(apiResponse) {
    if (this.edge.query_operation.method === "get" && this.edge.tags.includes("biothings")) {
      if (apiResponse.total > this.start + apiResponse.hits.length) {
        this.hasNext = true;
        return true;
      }
    }
    this.hasNext = false;
    return false;
  }

  getNext() {
    this.start += 1000;
    const config = this.constructAxiosRequestConfig(this.edge);
    config.params.from = this.start;
    this.config = config;
    return config;
  }

  getConfig() {
    if (this.hasNext === false) {
      return this.constructAxiosRequestConfig(this.edge);
    }
    return this.getNext();
  }
};
