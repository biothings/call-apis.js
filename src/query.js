const axios = require("axios");
const qb = require("./query_builder");
const queue = require("./query_queue");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");
const debug = require("debug")("call-apis:query");
const LogEntry = require("./log_entry");


/**
 * Make API Queries based on input BTE Edges, collect and align the results into BioLink Model
 */
module.exports = class APIQueryDispathcer {
    /**
     * Construct inputs for APIQueryDispatcher
     * @param {array} edges - an array of BTE edges with input added
     */
    constructor(edges) {
        this.edges = edges;
        this.logs = [];
    }

    async _queryBucket(queries) {
        const res = await Promise.allSettled(queries.map(query => {
            this.logs.push(new LogEntry("DEBUG", null, `call-apis: Making the following query ${JSON.stringify(query.getConfig())}`).getLog())
            debug(`Making the following query ${JSON.stringify(query.getConfig())}`)
            return axios(query.getConfig())
                .then(res => ({
                    response: res.data,
                    edge: query.edge
                }))
                .then(res => {
                    if (query.needPagination(res.response)) {
                        this.logs.push(new LogEntry("DEBUG", null, "call-apis: This query needs to be paginated").getLog());
                        debug("This query needs to be paginated")
                    }
                    debug(`Succesfully made the following query: ${JSON.stringify(query.getConfig())}`)
                    this.logs.push(new LogEntry("DEBUG", null, `call-apis: Succesfully made the following query: ${JSON.stringify(query.config)}`).getLog());
                    const tf_obj = new tf(res);
                    const transformed = tf_obj.transform();
                    debug(`After transformation, BTE is able to retrieve ${transformed.length} hits!`)
                    this.logs.push(new LogEntry("DEBUG", null, `call-apis: After transformation, BTE is able to retrieve ${transformed.length} hits!`).getLog());
                    return transformed
                })
                .catch(error => {
                    debug(`Failed to make to following query: ${JSON.stringify(query.config)}. The error is ${error.toString()}`);
                    if (error.response) {
                        debug(`The request failed with the following error response: ${JSON.stringify(error.response.data)}`)
                    }
                    this.logs.push(new LogEntry("ERROR", null, `call-apis: Failed to make to following query: ${JSON.stringify(query.config)}. The error is ${error.toString()}`).getLog());
                    return undefined;
                });
        }))
        this.queue.dequeue()
        return res;
    }

    _checkIfNext(queries) {
        queries.map(query => {
            if (query.hasNext === true) {
                this.queue.addQuery(query)
            }
        })
    }

    _constructQueries(edges) {
        return edges.map(edge => {
            return new qb(edge);
        });
    }

    _constructQueue(queries) {
        this.queue = new queue(queries);
        this.queue.constructQueue(queries);
    }

    async query(resolveOutputIDs = true) {
        debug(`Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`).getLog());
        debug(`Number of BTE Edges received is ${this.edges.length}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Number of BTE Edges received is ${this.edges.length}`).getLog());
        let queryResult = [];
        const queries = this._constructQueries(this.edges);
        this._constructQueue(queries);
        while (this.queue.queue.length > 0) {
            const bucket = this.queue.queue[0].getBucket();
            let res = await this._queryBucket(bucket);
            queryResult = [...queryResult, ...res];
            this._checkIfNext(bucket);
        }
        debug("query completes.")
        const mergedResult = this._merge(queryResult);
        debug("Start to use id resolver module to annotate output ids.")
        const annotatedResult = await this._annotate(mergedResult, resolveOutputIDs);
        debug("id annotation completes");
        debug("Query completes");
        this.logs.push(new LogEntry("DEBUG", null, "call-apis: Query completes").getLog());
        return annotatedResult;
    }

    /**
     * Merge the results into a single array from Promise.allSettled
     */
    _merge(queryResult) {
        let result = [];
        queryResult.map(res => {
            if (res.status === "fulfilled" && !(res.value === undefined)) {
                result = [...result, ...res.value];
            }
        });
        debug(`Total number of results returned for this query is ${result.length}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Total number of results returned for this query is ${result.length}`).getLog());
        return result;
    }

    _groupOutputIDsBySemanticType(result) {
        const output_ids = {};
        result.map(item => {
            const output_type = item.$edge_metadata.output_type;
            if (!(output_type in output_ids)) {
                output_ids[output_type] = [];
            }
            output_ids[output_type].push(item.$output.original);
        })
        return output_ids;
    }

    /**
     * Add equivalent ids to all output using biomedical-id-resolver service
     */
    async _annotate(result, enable = true) {
        if (enable === false) {
            return result;
        }
        const grpedIDs = this._groupOutputIDsBySemanticType(result);
        const biomedical_resolver = new resolver();
        const res = await biomedical_resolver.resolve(grpedIDs);
        result.map(item => {
            item.$output.obj = res[item.$output.original];
        });
        return result;
    }

}