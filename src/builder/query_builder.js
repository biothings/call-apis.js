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
    * @param {object} APIEdge - BTE Edge object with input field provided
    */
    constructor(APIEdge) {
        this.start = 0;
        this.hasNext = false;
        this.APIEdge = APIEdge;
    }

    getUrl() {
        return this.APIEdge.query_operation.server + this.APIEdge.query_operation.path;
    }

    _getUrl(APIEdge, input) {
        let server = APIEdge.query_operation.server;
        if (server.includes('biothings.ncats.io')) {
            server.replace('biothings.ncats.io', 'biothings.ci.transltr.io');
        } else if (server.includes('pending.biothings.io')) {
            server.replace('pending.biothings.io', 'biothings.ci.transltr.io');
        }
        if (server.endsWith("/")) {
            server = server.substring(0, server.length - 1);
        }
        let path = APIEdge.query_operation.path;
        if (Array.isArray(APIEdge.query_operation.path_params)) {
            APIEdge.query_operation.path_params.map(param => {
                const val = APIEdge.query_operation.params[param];
                path = path.replace("{" + param + "}", val).replace("{inputs[0]}", input);
            });
        }
        return server + path;
    }

    /**
    * Construct input based on method and inputSeparator
    */
    _getInput(APIEdge) {
        if (APIEdge.query_operation.supportBatch === true) {
            if (Array.isArray(APIEdge.input)) {
                return APIEdge.input.join(APIEdge.query_operation.inputSeparator);
            }
        }
        return APIEdge.input;
    }

    /**
    * Construct parameters for API calls
    */
    _getParams(APIEdge, input) {
        const params = {};
        Object.keys(APIEdge.query_operation.params).map(param => {
            if (Array.isArray(APIEdge.query_operation.path_params) && APIEdge.query_operation.path_params.includes(param)) {
                return;
            }
            if (typeof APIEdge.query_operation.params[param] === "string") {
                params[param] = APIEdge.query_operation.params[param].replace("{inputs[0]}", input);
            } else {
                params[param] = APIEdge.query_operation.params[param];
            }
        });
        return params;
    }

    /**
    * Construct request body for API calls
    */
    _getRequestBody(APIEdge, input) {
        if (APIEdge.query_operation.request_body !== undefined && "body" in APIEdge.query_operation.request_body) {
            let body = APIEdge.query_operation.request_body.body;
            let data;
            data = Object.keys(body).reduce(
                (accumulator, key) => accumulator + key + "=" + body[key].toString().replace("{inputs[0]}", input) + "&",
                "",
                );
                return data.substring(0, data.length - 1);
            }
        }

    /**
    * Construct the request config for Axios reqeust.
    */
    constructAxiosRequestConfig() {
        const input = this._getInput(this.APIEdge);
        const config = {
            url: this._getUrl(this.APIEdge, input),
            params: this._getParams(this.APIEdge, input),
            data: this._getRequestBody(this.APIEdge, input),
            method: this.APIEdge.query_operation.method,
        };
        this.config = config;
        return config;
    }

    needPagination(apiResponse) {
        if (this.APIEdge.query_operation.method === "get" && this.APIEdge.tags.includes("biothings")) {
            if (apiResponse.total > this.start + apiResponse.hits.length) {
                if (this.start + apiResponse.hits.length < 10000) {
                    this.hasNext = true;
                    return true;
                }
            }
        }
        this.hasNext = false;
        return false;
  }

    getNext() {
        this.start = Math.min(this.start + 1000, 9999);
        const config = this.constructAxiosRequestConfig(this.APIEdge);
        config.params.from = this.start;
        if (config.params.size + this.start > 10000) {
            config.params.size = 10000 - this.start;
        }
        this.config = config;
        return config;
    }

    getConfig() {
        if (this.hasNext === false) {
            return this.constructAxiosRequestConfig();
        }
        return this.getNext();
    }
};
