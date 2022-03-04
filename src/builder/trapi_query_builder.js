/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
const nunjucks = require("nunjucks");
const nunjucksConfig = require("./nunjucks_config");
const env = nunjucks.configure({ autoescape: false });
nunjucksConfig(env);
module.exports = class TRAPIQueryBuilder {
    /**
     * Constructor for Query Builder
     * @param {object} APIEdge - BTE Edge object with input field provided
     */
    constructor(APIEdge) {
        this.start = 0
        this.hasNext = false
        this.APIEdge = APIEdge;
    }

    getUrl() {
        return this.APIEdge.query_operation.server + this.APIEdge.query_operation.path;
    }

    _getUrl(APIEdge, input) {
        let server = APIEdge.query_operation.server;
        if (server.endsWith('/')) {
            server = server.substring(0, server.length - 1)
        };
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
        return APIEdge.input;
    }

    /**
     * Construct TRAPI request body
     */
    _getRequestBody(APIEdge, input) {
        const qg = {
            "message": {
                "query_graph": {
                    "nodes": {
                        "n0": {
                            "ids": Array.isArray(input) ? input : [input],
                            "categories": ["biolink:" + APIEdge.association.input_type]
                        },
                        "n1": {
                            "categories": ["biolink:" + APIEdge.association.output_type]
                        }
                    },
                    "APIEdges": {
                        "e01": {
                            "subject": "n0",
                            "object": "n1",
                            "predicates": ["biolink:" + APIEdge.association.predicate]
                        }
                    }
                }
            },
            "submitter": "infores:bte"
        };
        return qg;
    }

    /**
     * Construct the request config for Axios reqeust.
     */
    constructAxiosRequestConfig() {
        const input = this._getInput(this.APIEdge);
        const config = {
            url: this._getUrl(this.APIEdge, input),
            data: this._getRequestBody(this.APIEdge, input),
            method: this.APIEdge.query_operation.method,
            timeout: 50000,
            headers: {
                'Content-Type': 'application/json'
            },
        }
        this.config = config;
        return config;
    }

    needPagination(apiResponse) {
        this.hasNext = false;
        return false
    }

    getNext() {
        const config = this.constructAxiosRequestConfig(this.APIEdge);
        return config;
    }

    getConfig() {
        if (this.hasNext === false) {
            return this.constructAxiosRequestConfig(this.APIEdge);
        }
        return this.getNext();
    }
}
