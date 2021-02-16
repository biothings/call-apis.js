/**
 * Build API queries serving as input for Axios library based on BTE Edge info
 */
module.exports = class QueryBuilder {
    /**
     * Constructor for Query Builder
     * @param {object} edge - BTE Edge object with input field provided
     */
    constructor(edge) {
        this.start = 0
        this.hasNext = false
        this.edge = edge;
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
            if (typeof edge.query_operation.params[param] === 'string') {
                params[param] = edge.query_operation.params[param].replace("{inputs[0]}", input);
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
            const data = Object.keys(body).reduce((accumulator, key) => accumulator + key + '=' + body[key].toString().replace('{inputs[0]}', input) + '&', '');
            return data.substring(0, data.length - 1)
        }
    }

    /**
     * Construct the request config for Axios reqeust.
     */
    getAxiosRequestConfig() {
        const input = this._getInput(this.edge);
        return {
            url: this._getUrl(this.edge, input),
            params: this._getParams(this.edge, input),
            data: this._getRequestBody(this.edge, input),
            method: this.edge.query_operation.method,
            timeout: 50000
        }
    }

    needPagination(apiResponse) {
        if (this.edge.query_operation.method === "get" && this.edge.tags.includes("biothings")) {
            if (apiResponse.total > this.start + apiResponse.hits.length) {
                this.hasNext = true;
                return true
            }
        }
        this.hasNext = false;
        return false
    }

    getNext() {
        this.start += 1000;
        const config = this.getAxiosRequestConfig(this.edge);
        config.params.from = this.start;
        return config;
    }
}