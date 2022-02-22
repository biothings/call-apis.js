const axios = require("axios");
const qb = require("./builder/builde_factory");
const queue = require("./query_queue");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");
const debug = require("debug")("bte:call-apis:query");
const LogEntry = require("./log_entry");
const { ResolvableBioEntity } = require("biomedical_id_resolver/built/bioentity/valid_bioentity");


async function delay_here(sec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, sec*1000);
    })
}

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

    async _queryBucket(queries, unavailableAPIs = {}) {
        const dryrun_only = process.env.DRYRUN === 'true';   //TODO: allow dryrun to be specified from the query parameter
        const res = await Promise.allSettled(queries.map(async query => {
            let query_config, n_inputs, query_info, edge_operation;
            try {
                query_config = query.getConfig();
                if (unavailableAPIs[query.edge.query_operation.server]) {
                    unavailableAPIs[query.edge.query_operation.server] += 1;
                    return undefined;
                }
                n_inputs = Array.isArray(query.edge.input) ? query.edge.input.length : 1;
                query_info = {
                    edge_id: query.edge.reasoner_edge.qEdge.id,
                    url: query_config.url,
                    subject: query.edge.association.input_type,
                    object: query.edge.association.output_type,
                    predicate: query.edge.association.predicate,
                    ids: n_inputs
                }
                edge_operation = `${query.edge.association.input_type} > ${query.edge.association.predicate} > ${query.edge.association.output_type}`
            } catch (error) {
                debug('Query configuration error, query skipped');
                this.logs.push(
                    new LogEntry(
                        "ERROR",
                        null,
                        `${error.toString()} while configuring query. Query dump: ${query.toString()}`
                    ).getLog()
                )
                return undefined;
            }
            try {
                const userAgent = `BTE/${process.env.NODE_ENV === 'production' ? 'prod' : 'dev'} Node/${process.version} ${process.platform}`
                query_config.headers = query_config.headers
                    ? { ...query_config.headers, "User-Agent": userAgent }
                    : { "User-Agent": userAgent }
                debug(query_config);
                if (query_config.url.includes("arax.ncats.io")) {
                    //delay 1s specifically for RTX KG2 at https://arax.ncats.io/api/rtxkg2/v1.2
                    // https://smart-api.info/registry?q=acca268be3645a24556b81cc15ce0e9a
                    debug("delay 1s for RTX KG2 KP...");
                    await delay_here(1);
                }
                const queryResponse = dryrun_only ? {data: []} : await axios(query_config);
                const res = {
                    response: queryResponse.data,
                    edge: query.edge,
                };
                if (query.needPagination(res.response)) {
                    this.logs.push(new LogEntry("DEBUG", null, "call-apis: This query needs to be paginated").getLog());
                    debug("This query needs to be paginated");
                }
                // const console_msg = `Succesfully made the following query: ${JSON.stringify(query_config)}`;
                const log_msg =  `call-apis: Successful ${query_config.method.toUpperCase()} ${query.edge.query_operation.server} (${n_inputs} ID${n_inputs > 1 ? 's' : ''}): ${edge_operation}`
                // if (log_msg.length > 1000) {
                //     log_msg = log_msg.substring(0, 1000) + "...";
                // }
                const tf_obj = new tf.Transformer(res);
                const transformed = await tf_obj.transform();
                debug(log_msg);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        log_msg,
                        {
                            type: "query",
                            hits: transformed.length,
                            ...query_info,
                        }
                    ).getLog(),
                );
                debug(`After transformation, BTE is able to retrieve ${transformed.length} hits!`);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        `call-apis: After transformation, BTE is able to retrieve ${transformed.length} hits!`,
                    ).getLog(),
                );
                return transformed;
            } catch (error) {
                if ((error.response && error.response.status >= 502) || error.code === 'ECONNABORTED') {
                    const errorMessage = `${query.edge.query_operation.server} appears to be unavailable. Queries to it will be skipped.`;
                    debug(errorMessage);
                    unavailableAPIs[query.edge.query_operation.server] = 1;
                }
                debug(
                    `Failed to make to following query: ${JSON.stringify(
                        query.config,
                    )}. The error is ${error.toString()}`,
                );

                const log_msg =  `call-apis: Failed ${query_config.method.toUpperCase()} ${query.edge.query_operation.server} (${n_inputs} ID${n_inputs > 1 ? 's' : ''}): ${edge_operation}: (${error.toString()})`
                this.logs.push(
                    new LogEntry(
                        "ERROR",
                        null,
                        log_msg,
                        {
                            type: "query",
                            error: error.toString(),
                            ...query_info,
                        }
                    ).getLog(),
                );
                if (error.response) {
                    debug(`The request failed with the following error response: ${JSON.stringify(error.response.data)}`);
                    this.logs.push(
                        new LogEntry(
                            "DEBUG",
                            null,
                            `Error response for above failure: ${JSON.stringify(error.response.data)}`
                        ).getLog()
                    );
               }
                return undefined;
            }
        }));
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
            return qb(edge);
        });
    }

    _constructQueue(queries) {
        this.queue = new queue(queries);
        this.queue.constructQueue(queries);
    }

    async query(resolveOutputIDs = true, unavailableAPIs = {}) {
        debug(`Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`).getLog());
        debug(`Number of BTE Edges received is ${this.edges.length}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Number of BTE Edges received is ${this.edges.length}`).getLog());
        let queryResult = [];
        const queries = this._constructQueries(this.edges);
        this._constructQueue(queries);
        while (this.queue.queue.length > 0) {
            const bucket = this.queue.queue[0].getBucket();
            let res = await this._queryBucket(bucket, unavailableAPIs);
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
        this.logs.push(
          new LogEntry(
            "DEBUG",
            null,
            `call-apis: Total number of results returned for this query is ${result.length}`,
          ).getLog(),
        );
        return result;
    }

    _groupOutputIDsBySemanticType(result) {
        const output_ids = {};
        result.map(item => {
            if (item && item.$edge_metadata) {
                const output_type = item.$edge_metadata.output_type;
                if (!(output_type in output_ids)) {
                    output_ids[output_type] = new Set();
                }
                output_ids[output_type].add(item.$output.original);
            }
        });
        for (const key in output_ids) {
            output_ids[key] = [...output_ids[key]];
        }
        return output_ids;
    }

    _groupIDsBySemanticType(result) {
        const ids = {};
        result.map(item => {
            if (item && item.$edge_metadata) {
                //INPUTS
                const input_type = item.$edge_metadata.input_type;
                if (!(input_type in ids)) {
                    ids[input_type] = new Set();
                }
                ids[input_type].add(item.$input.original);
                // OUTPUTS
                const output_type = item.$edge_metadata.output_type;
                if (!(output_type in ids)) {
                    ids[output_type] = new Set();
                }
                ids[output_type].add(item.$output.original);
            }
        });
        for (const key in ids) {
            //remove undefined ids
            let good_ids = [...ids[key]].filter(id => id !== undefined);
            ids[key] = good_ids;
        }
        return ids;
    }

    /**
     * Add equivalent ids to all entities using biomedical-id-resolver service
     */
    async _annotate(result, enable = true) {
        const groupedIDs = this._groupIDsBySemanticType(result);
        let res;
        let attributes;
        if (enable === false) {
            res = resolver.generateInvalidBioentities(groupedIDs);
        } else {
            res = await resolver.resolveSRI(groupedIDs);
            attributes = await resolver.getAttributes(groupedIDs);
        }
        result.map(item => {
            if (item && item !== undefined) {
                item.$output.obj = res[item.$output.original];
                item.$input.obj = res[item.$input.original];
            }
            //add attributes
            if (attributes && item && Object.hasOwnProperty.call(attributes, item.$input.original)) {
                if (item instanceof ResolvableBioEntity) {
                    item.$input.obj[0]['attributes'] = attributes[item.$input.original]
                }
            }
            if (attributes && item && Object.hasOwnProperty.call(attributes, item.$output.original)) {
                if (item instanceof ResolvableBioEntity){
                    item.$output.obj[0]['attributes'] = attributes[item.$output.original]
                }
            }
        });
        return result;
    }

}
