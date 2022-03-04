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
 * Make API Queries based on input BTE Edges, collect and align the records into BioLink Model
 */
module.exports = class APIQueryDispatcher {
    /**
     * Construct inputs for APIQueryDispatcher
     * @param {array} APIEdges - an array of BTE edges with input added
     */
    constructor(APIEdges) {
        this.APIEdges = APIEdges;
        this.logs = [];
    }

    async _queryBucket(queries) {
        const dryrun_only = process.env.DRYRUN === 'true';   //TODO: allow dryrun to be specified from the query parameter
        const res = await Promise.allSettled(queries.map(async query => {
            let query_config, n_inputs, query_info, edge_operation;
            try {
                query_config = query.getConfig();
                n_inputs = Array.isArray(query.APIEdge.input) ? query.APIEdge.input.length : 1;
                query_info = {
                    edge_id: query.APIEdge.reasoner_edge.qEdge.id,
                    url: query_config.url,
                    subject: query.APIEdge.association.input_type,
                    object: query.APIEdge.association.output_type,
                    predicate: query.APIEdge.association.predicate,
                    ids: n_inputs
                }
                edge_operation = `${query.APIEdge.association.input_type} > ${query.APIEdge.association.predicate} > ${query.APIEdge.association.output_type}`
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
                const unTransformedHits = {
                    response: queryResponse.data,
                    edge: query.APIEdge,
                };
                if (query.needPagination(unTransformedHits.response)) {
                    this.logs.push(new LogEntry("DEBUG", null, "call-apis: This query needs to be paginated").getLog());
                    debug("This query needs to be paginated");
                }
                // const console_msg = `Succesfully made the following query: ${JSON.stringify(query_config)}`;
                const log_msg =  `call-apis: Successful ${query_config.method.toUpperCase()} ${query_config.url} (${n_inputs} ID${n_inputs > 1 ? 's' : ''}): ${edge_operation}`
                // if (log_msg.length > 1000) {
                //     log_msg = log_msg.substring(0, 1000) + "...";
                // }
                const tf_obj = new tf.Transformer(unTransformedHits);
                const transformedRecords = await tf_obj.transform();
                debug(log_msg);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        log_msg,
                        {
                            type: "query",
                            hits: transformedRecords.length,
                            ...query_info,
                        }
                    ).getLog(),
                );
                debug(`After transformation, BTE is able to retrieve ${transformedRecords.length} records!`);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        `call-apis: After transformation, BTE is able to retrieve ${transformedRecords.length} records!`,
                    ).getLog(),
                );
                return transformedRecords;
            } catch (error) {
                debug(
                    `Failed to make to following query: ${JSON.stringify(
                        query.config,
                    )}. The error is ${error.toString()}`,
                );

                const log_msg =  `call-apis: Failed ${query_config.method.toUpperCase()} ${query_config.url} (${n_inputs} ID${n_inputs > 1 ? 's' : ''}): ${edge_operation}: (${error.toString()})`
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

    _constructQueries(APIEdges) {
        return APIEdges.map(edge => {
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
        debug(`Number of BTE Edges received is ${this.APIEdges.length}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Number of API Edges received is ${this.APIEdges.length}`).getLog());
        let queryRecords = [];
        const queries = this._constructQueries(this.APIEdges);
        this._constructQueue(queries);
        while (this.queue.queue.length > 0) {
            const bucket = this.queue.queue[0].getBucket();
            let newHits = await this._queryBucket(bucket);
            queryRecords = [...queryRecords, ...newHits];
            this._checkIfNext(bucket);
        }
        debug("query completes.")
        const mergedRecords = this._merge(queryRecords);
        debug("Start to use id resolver module to annotate output ids.")
        const annotatedRecords = await this._annotate(mergedRecords, resolveOutputIDs);
        debug("id annotation completes");
        debug("Query completes");
        this.logs.push(new LogEntry("DEBUG", null, "call-apis: Query completes").getLog());
        return annotatedRecords;
    }

    /**
     * Merge the records into a single array from Promise.allSettled
     */
    _merge(queryRecords) {
        let mergedRecords = [];
        queryRecords.map(record => {
            if (record.status === "fulfilled" && !(record.value === undefined)) {
                mergedRecords = [...mergedRecords, ...record.value];
            }
        });
        debug(`Total number of records returned for this query is ${mergedRecords.length}`)
        this.logs.push(
          new LogEntry(
            "DEBUG",
            null,
            `call-apis: Total number of records returned for this query is ${mergedRecords.length}`,
          ).getLog(),
        );
        return mergedRecords;
    }

    _groupOutputIDsBySemanticType(record
        ) {
        const output_ids = {};
        record
        .map(item => {
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

    _groupCuriesBySemanticType(records) {
        const curies = {};
        records.map(record => {
            if (record && record.$edge_metadata) {
                //INPUTS
                const input_type = record.$edge_metadata.input_type;
                if (!(input_type in curies)) {
                    curies[input_type] = new Set();
                }
                curies[input_type].add(record.$input.original);
                // OUTPUTS
                const output_type = record.$edge_metadata.output_type;
                if (!(output_type in curies)) {
                    curies[output_type] = new Set();
                }
                curies[output_type].add(record.$output.original);
            }
        });
        for (const semanticType in curies) {
            //remove undefined curies
            let good_curies = [...curies[semanticType]].filter(id => id !== undefined);
            curies[semanticType] = good_curies;
        }
        return curies;
    }

    /**
     * Add equivalent ids to all entities using biomedical-id-resolver service
     */
    async _annotate(records, resolveOutputIDs = true) {
        const groupedCuries = this._groupCuriesBySemanticType(records);
        let res;
        let attributes;
        if (resolveOutputIDs === false) {
            res = resolver.generateInvalidBioentities(groupedCuries);
        } else {
            res = await resolver.resolveSRI(groupedCuries);
            attributes = await resolver.getAttributes(groupedCuries);
        }
        records.map(record => {
            if (record && record !== undefined) {
                record.$output.obj = res[record.$output.original];
                record.$input.obj = res[record.$input.original];
            }
            //add attributes
            if (attributes && record && Object.hasOwnProperty.call(attributes, record.$input.original)) {
                if (record instanceof ResolvableBioEntity) {
                    record.$input.obj[0]['attributes'] = attributes[record.$input.original]
                }
            }
            if (attributes && record && Object.hasOwnProperty.call(attributes, record.$output.original)) {
                if (record instanceof ResolvableBioEntity){
                    record.$output.obj[0]['attributes'] = attributes[record.$output.original]
                }
            }
        });
        return records;
    }

}
