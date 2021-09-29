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
     * @param {object} edge - BTE Edge object with input field provided
     */
    constructor(edge) {
        this.start = 0
        this.hasNext = false
        this.edge = edge;
    }

    getUrl() {
        return this.edge.query_operation.server + this.edge.query_operation.path;
    }

    _getUrl(edge, input) {
        let server = edge.query_operation.server;
        if (server.endsWith('/')) {
            server = server.substring(0, server.length - 1)
        };
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
        return edge.input;
    }

    /**
     * Construct TRAPI request body
     */
    _getRequestBody(edge, input) {
        let qg;
        if (typeof input === "object" && !Array.isArray(input)) {
            qg = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "ids": Array.isArray(input.ids) ? input.ids.map(id => nunjucks.renderString(id, input)) : [nunjucks.renderString(input.ids, input)],
                                "categories": Array.isArray(edge.association.input_type)
                                    ? edge.association.input_type.map(type => nunjucks.renderString("biolink:" + type, input))
                                    : ["biolink:" + edge.association.input_type]
                            },
                            "n1": {
                                "categories": Array.isArray(edge.association.output_type)
                                    ? edge.association.output_type.map(type => nunjucks.renderString("biolink:" + type, input))
                                    : ["biolink:" + edge.association.output_type]
                            }
                        },
                        "edges": {
                            "e01": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": Array.isArray(edge.association.predicate)
                                    ? edge.association.predicate.map(pred => nunjucks.renderString("biolink:" + pred, input))
                                    : ["biolink:" + edge.association.predicate]
                            }
                        }
                    }
                },
                "submitter": "infores:bte"
            }
        } else {
            qg = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "ids": Array.isArray(input) ? input : [input],
                                "categories": ["biolink:" + edge.association.input_type]
                            },
                            "n1": {
                                "categories": ["biolink:" + edge.association.output_type]
                            }
                        },
                        "edges": {
                            "e01": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["biolink:" + edge.association.predicate]
                            }
                        }
                    }
                },
                "submitter": "infores:bte"
            }
        }
        return qg;
    }

    /**
     * Construct the request config for Axios reqeust.
     */
    constructAxiosRequestConfig() {
        const input = this._getInput(this.edge);
        const config = {
            url: this._getUrl(this.edge, input),
            data: this._getRequestBody(this.edge, input),
            method: this.edge.query_operation.method,
            timeout: 10000,
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
        const config = this.constructAxiosRequestConfig(this.edge);
        return config;
    }

    getConfig() {
        if (this.hasNext === false) {
            return this.constructAxiosRequestConfig(this.edge);
        }
        return this.getNext();
    }
}
