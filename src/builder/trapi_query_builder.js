/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
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
            edge.query_operation.path_params.map(param => {
                const val = edge.query_operation.params[param];
                path = path.replace("{" + param + "}", val).replace("{inputs[0]}", input);
            });
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
        const qg = {
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
            timeout: 30000,
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