const axios = require("axios");
const qb = require("./query_builder");
const queue = require("./query_queue");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");
const { transform } = require("lodash");
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
            this.logs.push(new LogEntry("DEBUG", null, `call-apis: Making the following query ${JSON.stringify(query.config)}`).getLog())
            debug(`Making the following query ${JSON.stringify(query.config)}`)
            return axios(query.config)
                .then(res => ({
                    response: res.data,
                    edge: query.edge
                }))
                .then(res => {
                    if (query.needPagination(res.response)) {
                        this.logs.push(new LogEntry("DEBUG", null, "call-apis: This query needs to be paginated"));
                        debug("This query needs to be paginated")
                        query.getNext();
                    }
                    debug(`Succesfully made the following query: ${JSON.stringify(query.config)}`)
                    this.logs.push(new LogEntry("DEBUG", null, `call-apis: Succesfully made the following query: ${JSON.stringify(query.config)}`));
                    let tf_obj = new tf(res);
                    let transformed = tf_obj.transform();
                    debug(`After transformation, BTE is able to retrieve ${transformed.length} hits!`)
                    this.logs.push(new LogEntry("DEBUG", null, `call-apis: After transformation, BTE is able to retrieve ${transformed.length} hits!`));
                    return transformed
                })
                .catch(error => {
                    debug(`Failed to make to following query: ${JSON.stringify(query.config)}. The error is ${error.toString()}`)
                    this.logs.push(new LogEntry("ERROR", null, `call-apis: Failed to make to following query: ${JSON.stringify(query.config)}. The error is ${error.toString()}`));
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
        return edges.map(edge => new qb(edge));

    }

    _constructQueue(queries) {
        this.queue = new queue(queries);
        this.queue.constructQueue(queries);
    }

    async query(resolveOutputIDs = true) {
        debug(`Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`));
        debug(`Number of BTE Edges received is ${this.edges.length}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Number of BTE Edges received is ${this.edges.length}`));
        this.queryResult = [];
        const queries = this._constructQueries(this.edges);
        this._constructQueue(queries);
        while (this.queue.queue.length > 0) {
            const bucket = this.queue.queue[0].getBucket();
            let res = await this._queryBucket(bucket);
            this.queryResult = [...this.queryResult, ...res];
            this._checkIfNext(bucket);
        }
        this.merge();
        await this.annotate(resolveOutputIDs);
        debug("Query completes");
        this.logs.push(new LogEntry("DEBUG", null, "call-apis: Query completes"));
    }

    // async query() {
    //     this.queryResult = await Promise.allSettled(this.edges.map(edge => {
    //         if (edge === undefined) {
    //             return undefined
    //         }
    //         let qbo = new qb(edge);
    //         return axios(qbo.config)
    //             .then(res => ({
    //                 response: res.data,
    //                 edge: edge
    //             }))
    //             .then(res => {
    //                 if (qbo.hasNext(res.response)) {
    //                     qbo.getNext();
    //                 }
    //                 let tf_obj = new tf(res);
    //                 let transformed = tf_obj.transform();
    //                 return transformed
    //             })
    //             .catch(error => {
    //                 return undefined;
    //             });
    //     }));
    //     this.merge();
    //     await this.annotate();
    // }

    /**
     * Merge the results into a single array from Promise.allSettled
     */
    merge() {
        this.result = [];
        this.queryResult.map(res => {
            if (!(res.value === undefined)) {
                this.result = [...this.result, ...res.value];
            }
        });
        debug(`Total number of results returned for this query is ${this.result.length}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Total number of results returned for this query is ${this.result.length}`));
    }

    /**
     * Add equivalent ids to all output using biomedical-id-resolver service
     */
    async annotate(enable = true) {
        let res = {};
        if (enable === true) {
            let output_ids = {};
            this.result.map(item => {
                let output_type = item["$association"]["output_type"];
                if (!(output_type in output_ids)) {
                    output_ids[output_type] = [];
                }
                output_ids[output_type].push(item["$output"]);
            });
            res = await resolver(output_ids);
        }
        this.result.map(item => {
            if (item.$output in res) {
                item.$output_id_mapping = {
                    resolved: res[item.$output],
                    original: item.$output
                };
                item.label = res[item.$output].id.label;
                item.id = item.$output = res[item.$output].id.identifier;
            } else {
                item.label = item.id = item.$output;
            }
        });
    }

}