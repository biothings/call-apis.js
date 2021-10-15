const axios = require("axios");
const qb = require("./builder/builde_factory");
const queue = require("./query_queue");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");
const debug = require("debug")("bte:call-apis:query");
const LogEntry = require("./log_entry");


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

    async _queryBucket(queries) {
        const dryrun_only = process.env.DRYRUN === 'true';   //TODO: allow dryrun to be specified from the query parameter
        const res = await Promise.allSettled(queries.map(async query => {
            try {
                const query_config = query.getConfig();
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
                let log_msg = `Succesfully made the following query: ${JSON.stringify(query_config)}`;
                if (log_msg.length > 1000) {
                    log_msg = log_msg.substring(0, 1000) + "...";
                }
                debug(log_msg);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        `call-apis: ${log_msg}`,
                    ).getLog(),
                );
                const tf_obj = new tf.Transformer(res);
                const transformed = await tf_obj.transform();
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
                debug(
                    `Failed to make to following query: ${JSON.stringify(
                        query.config,
                    )}. The error is ${error.toString()}`,
                );
                if (error.response) {
                     debug(`The request failed with the following error response: ${JSON.stringify(error.response.data)}`);
                }
                this.logs.push(
                    new LogEntry(
                        "ERROR",
                        null,
                        `call-apis: Failed to make to following query: ${JSON.stringify(
                        query.config,
                        )}. The error is ${error.toString()}`,
                    ).getLog(),
                );
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
            ids[key] = [...ids[key]];
        }
        return ids;
    }

    /**
     * Add equivalent ids to all output using biomedical-id-resolver service
     */
    async _annotate(result, enable = true) {
        const groupedIDs = this._groupIDsBySemanticType(result);
        let res;
        if (enable === false) {
            res = resolver.generateInvalidBioentities(groupedIDs);
        } else {
            res = await resolver.resolveSRI(groupedIDs);
        }
        result.map(item => {
            if (item && item !== undefined) {
                item.$output.obj = res[item.$output.original];
                item.$input.obj = res[item.$input.original];
            }
        });
        return result;
    }

}
