const axios = require("axios");
const qb = require("./builder/builde_factory");
const queue = require("./query_queue");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");
const debug = require("debug")("bte:call-apis:query");
const LogEntry = require("./log_entry");
const { ResolvableBioEntity } = require("biomedical_id_resolver/built/bioentity/valid_bioentity");
const { performance } = require('perf_hooks');
const { globalTimeout, timeoutByAPI } = require('./config/timeouts');
const qgh = require("@biothings-explorer/query_graph_handler");

async function delay_here(sec) {
    return new Promise(resolve => {
        setTimeout(resolve, sec * 1000);
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
    constructor(APIEdges, options) {
        this.APIEdges = APIEdges;
        this.logs = [];
        this.options = options;
        this.totalRecords = 0;
        this.maxRecords = parseInt(process.env.MAX_RECORDS_PER_EDGE) || 30000;
        this.globalMaxRecords = parseInt(process.env.MAX_RECORDS_TOTAL) || 60000;
        this.stoppedOnMax = false
        this.nextPageQueries = 0;
    }

    async _queryBucket(queries, unavailableAPIs = {}) {
        const dryrun_only = process.env.DRYRUN === 'true';
        const res = await Promise.allSettled(queries.map(async query => {
            if (this.checkMaxRecords()) {
                return;
            }
            let query_config, n_inputs, query_info, edge_operation;
            try {
                query_config = query.getConfig();
                if (unavailableAPIs[query.APIEdge.query_operation.server]?.skip) {
                    unavailableAPIs[query.APIEdge.query_operation.server].skippedQueries += 1;
                    return undefined;
                }
                if (Array.isArray(query.APIEdge.input)) {
                    n_inputs = query.APIEdge.input.length;
                } else if (query.APIEdge.input.hasOwnProperty('queryInputs')) {
                    n_inputs = Array.isArray(query.APIEdge.input.queryInputs)
                        ? query.APIEdge.input.queryInputs.length
                        : 1;
                } else {
                    n_inputs = 1;
                }

                query_info = {
                    qEdgeID: query.APIEdge.reasoner_edge?.qEdge?.id,
                    url: query_config.url,
                    api_name: query.APIEdge.association.api_name,
                    subject: query.APIEdge.association.input_type,
                    object: query.APIEdge.association.output_type,
                    predicate: query.APIEdge.association.predicate,
                    ids: n_inputs
                }
                edge_operation = `${query.APIEdge.association.input_type} > ${query.APIEdge.association.predicate} > ${query.APIEdge.association.output_type}`
                query_config.timeout = this._getTimeout(query.APIEdge.association.smartapi.id)
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
                if (query.APIEdge.association['x-trapi']?.rate_limit) {
                    await this._rateLimit(query_info.api_name, query.APIEdge.association['x-trapi'].rate_limit);
                }
                const startTime = performance.now();
                const queryResponse = dryrun_only ? {data: []} : await axios(query_config);
                debug('query success, transforming hits->records...');
                const finishTime = performance.now();
                const timeElapsed = Math.round(
                    finishTime - startTime > 1000
                        ? (finishTime - startTime) / 1000
                        : finishTime - startTime
                );
                const timeUnits = finishTime - startTime > 1000 ? "s" : "ms";
                const unTransformedHits = {
                    response: queryResponse.data,
                    edge: query.APIEdge,
                };
                const tf_obj = new tf.Transformer(unTransformedHits, this.options);
                const transformedRecords = await tf_obj.transform();

                // const console_msg = `Succesfully made the following query: ${JSON.stringify(query_config)}`;
                const definedRecords = transformedRecords.filter(record => {return record !== undefined});
                this.totalRecords += definedRecords.length;
                if (global.queryInformation?.queryGraph) {
                    const globalRecords = global.queryInformation.totalRecords;
                    global.queryInformation.totalRecords = globalRecords
                        ? globalRecords + definedRecords.length
                        : definedRecords.length;
                }
                const log_msg = [
                    `Successful ${query_config.method.toUpperCase()}`,
                    query.APIEdge.query_operation.server,
                    `(${n_inputs} ID${n_inputs > 1 ? "s" : ""}):`,
                    `${edge_operation} (obtained ${definedRecords.length}`,
                    `record${definedRecords.length === 1 ? "" : "s"},`,
                    `took ${timeElapsed}${timeUnits})`
                ].join(' ');

                if (query.start > 0) this.nextPageQueries -= 1;

                const queryNeedsPagination = query.needPagination(unTransformedHits.response);
                if (queryNeedsPagination) {
                    const log = `Query requires pagination, will re-query to window ${queryNeedsPagination}-${queryNeedsPagination + 1000}: ${query.APIEdge.query_operation.server} (${n_inputs} ID${n_inputs > 1 ? "s" : ""})`
                    debug(log);
                    if (queryNeedsPagination >= 9000) {
                        const log = `Biothings query reaches 10,000 max: ${query.APIEdge.query_operation.server} (${n_inputs} ID${n_inputs > 1 ? "s" : ""})`
                        debug(log);
                        this.logs.push(new LogEntry("WARNING", null, log).getLog());
                    }
                }
                debug(log_msg);
                this.logs.push(
                    new LogEntry(
                        "DEBUG",
                        null,
                        log_msg,
                        {
                            type: "query",
                            hits: definedRecords.length,
                            ...query_info,
                        }
                    ).getLog(),
                );
                return definedRecords;
            } catch (error) {
                if ((error.response && error.response.status >= 502) || error.code === 'ECONNABORTED') {
                    const errorMessage = `${query.APIEdge.query_operation.server} appears to be unavailable. Queries to it will be skipped.`;
                    debug(errorMessage);
                    unavailableAPIs[query.APIEdge.query_operation.server] = { skip: true, skippedQueries: 0 };
                } else if (error.response && error.response.status === 429) {
                    debug(`${query.APIEdge.query_operation.server} has rate-limited BTE. Queries to it will be skipped until the provided time.`);
                    unavailableAPIs[query.APIEdge.query_operation.server] = {skip: true, skippedQueries: 0}
                    const delay = error.response.headers['retry-after']
                        ? isNaN(parseInt(error.response.headers['retry-after']))
                            ? (new Date(error.response.headers['retry-after'])).getTime()-Date.now()
                            : parseInt(error.response.headers['retry-after']) * 1000
                        : 6000;  // default wait for a minute
                    setTimeout(() => unavailableAPIs[query.APIEdge.query_operation.server].skip = false, delay)
                }
                debug(
                    `Failed to make to following query: ${JSON.stringify(
                        query.config,
                    )}. The error is ${error.toString()}`,
                );

                const log_msg =  `call-apis: Failed ${query_config.method.toUpperCase()} ${query.APIEdge.query_operation.server} (${n_inputs} ID${n_inputs > 1 ? 's' : ''}): ${edge_operation}: (${error.toString()})`
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

    async _rateLimit(api, count) {
        if (qgh.redisClient.clientEnabled) {
            const usage = await qgh.redisClient.client.incrTimeout(`APIUsageCount:${api}`);
            await qgh.redisClient.client.expireTimeout(`APIUsageCount:${api}`, 60);
            if (usage >= count) {
                await qgh.redisClient.client.decrTimeout(`APIUsageCount:${api}`);
                debug(`API ${api} is rate-limited and is at maximum (${count}) requests per minute. Checking again in ${60000 / count}ms`);
                return new Promise(resolve => {
                    setTimeout(async () => {
                        await this._rateLimit(api, count);
                        resolve();
                    }, 60000 / count);
                });
            } else {
                debug(`Rate-limited API ${api} is free to use (${usage || 0}/${count}), querying...`);
                setTimeout(async () => {
                    await qgh.redisClient.client.decrTimeout(`APIUsageCount:${api}`);
                    await qgh.redisClient.client.expireTimeout(`APIUsageCount:${api}`, 60);
                }, 60000);
            }
        } else {
            debug(`API ${api} is rate-limited. Using naive strategy (waiting ${60000 / count}ms)...`)
            return new Promise(resolve => setTimeout(resolve, 60000 / count));
        }
    }

    _getTimeout(apiID) {
      if (timeoutByAPI[apiID] !== undefined) return timeoutByAPI[apiID]
      return globalTimeout
    }

    _checkIfNext(queries) {
        queries.map(query => {
            if (query.hasNext === true) {
                this.queue.addQuery(query)
                this.nextPageQueries += 1;
            }
        })
    }

    _constructQueries(APIEdges) {
        return APIEdges.map(edge => {
            const built = qb(edge);
            built.addSubmitter?.(this.options.submitter);
            return built;
        });
    }

    _constructQueue(queries) {
        this.queue = new queue(queries);
        this.queue.constructQueue(queries);
    }

    checkMaxRecords() {
        return (
          (this.maxRecords > 0 && this.totalRecords >= this.maxRecords) ||
          (this.globalMaxRecords > 0 && global.queryInformation?.totalRecords > this.globalMaxRecords)
        );
    }

    async query(resolveOutputIDs = true, unavailableAPIs = {}) {
        debug(`Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`)
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: Resolving ID feature is turned ${(resolveOutputIDs) ? 'on' : 'off'}`).getLog());
        debug(`Number of API Edges received is ${this.APIEdges.length}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: ${this.APIEdges.length} planned queries for edge ${this.APIEdges[0].reasoner_edge?.qEdge?.id}`).getLog());
        let queryResponseRecords = [];
        const queries = this._constructQueries(this.APIEdges);
        this._constructQueue(queries);
        const startTime = performance.now();
        while (this.queue.queue.length > 0) {
            const bucket = this.queue.queue[0].getBucket();
            let newResponseRecords = await this._queryBucket(bucket, unavailableAPIs);
            queryResponseRecords = [...queryResponseRecords, ...newResponseRecords];
            this._checkIfNext(bucket);

            // Handle cases of too many records
            if (!this.checkMaxRecords()) continue;
            const stoppedOnGlobalMax = this.globalMaxRecords > 0 && global.queryInformation?.totalRecords >= this.globalMaxRecords;
            const remainingSubQueries = this.queue.queue.reduce((count, bucket) => {
                return bucket.bucket ?
                    count + bucket.bucket.length
                    : count + bucket.length;
            }, 0);
            let message = [
                `QEdge ${this.APIEdges[0].reasoner_edge?.qEdge?.id}`,
                `obtained ${this.totalRecords} records,`,
                this.totalRecords === this.maxRecords ? "hitting" : "exceeding",
                `maximum of ${this.maxRecords}.`,
                `Skipping remaining ${remainingSubQueries}`,
                `(${remainingSubQueries - this.nextPageQueries} planned/${this.nextPageQueries} paged)`,
                `queries for this edge.`,
                `Your query may be too general?`,
            ];
            if (stoppedOnGlobalMax) {
                message = message.slice(0, 2);
                message.push(...[
                    `totalling ${global.queryInformation.totalRecords} for this query.`,
                    `This exceeds the per-query maximum of ${this.globalMaxRecords}.`,
                    `For stability purposes, this query is terminated.`,
                    `Please consider refining your query further.`,
                ]);
            }
            debug(message.join(" "));
            this.logs.push(new LogEntry("WARNING", null, message.join(" ")).getLog());
            this.queue.queue = [];
            if (!(process.env.SLACK_OAUTH && process.env.SLACK_CHANNEL)) {
                if (stoppedOnGlobalMax) return;
                break;
            }
            try {
                let server;
                switch (process.env.INSTANCE_ENV ?? '') {
                    case 'dev':
                        server = 'api.bte.ncats.io';
                        break;
                    case 'ci':
                        server = 'bte.ci.transltr.io';
                        break;
                    case 'test':
                        server = 'bte.test.transltr.io';
                        break;
                    default:
                        server = `bte.transltr.io`;
                }
                message.pop();
                message.unshift([
                    `${server}: Attached query`,
                    global.queryInformation.isCreativeMode
                        ? ` (creative mode, template ${global.queryInformation.creativeTemplate}) `
                        : ``,
                    global.queryInformation.jobID
                        ? ` (ID: <https://${server}/v1/check_query_status/${global.queryInformation.jobID}|${global.queryInformation.jobID}>)`
                        : ' (synchronous)',
                    global.queryInformation.callback_url
                        ? ` (callback: ${global.queryInformation.callback_url}): `
                        : global.queryInformation.jobID ? ` (no callback provided): ` : `: `,
                    '\n\n',
                ].join(''));
                const content = JSON.stringify(global.queryInformation.queryGraph, null, 2);
                // don't try more than 1MB
                if (Buffer.byteLength(content, 'utf8') > 1000000000) break;
                const data = new URLSearchParams({
                    channels: process.env.SLACK_CHANNEL,
                    filename: "query_graph.json",
                    title: "query_graph.json",
                    filetype: "json",
                    content: content,
                    initial_comment: message.join(' '),
                });
                await axios({
                    url: `https://slack.com/api/files.upload`,
                    method: 'post',
                    headers: {
                        "Content-type": "application/x-www-form-urlencoded",
                        Authorization: `Bearer ${process.env.SLACK_OAUTH}`,
                    },
                    data,
                });
            } catch (e) {
                debug(`Logging to Slack failed. due to error ${e}`);
            }
            if (stoppedOnGlobalMax) return;
            break;
        }
        const finishTime = performance.now();
        const timeElapsed = Math.round(
            finishTime - startTime > 1000
                ? (finishTime - startTime) / 1000
                : finishTime - startTime
        );
        const timeUnits = finishTime - startTime > 1000 ? "s" : "ms";
        debug("query completes.")
        const mergedRecords = this._merge(queryResponseRecords);
        debug("Start to use id resolver module to annotate output ids.")
        const annotatedRecords = await this._annotate(mergedRecords, resolveOutputIDs);
        debug("id annotation completes");
        debug(`qEdge queries complete in ${timeElapsed}${timeUnits}`);
        this.logs.push(new LogEntry("DEBUG", null, `call-apis: qEdge queries complete in ${timeElapsed}${timeUnits}`).getLog());
        return annotatedRecords;
    }

    /**
     * Merge the records into a single array from Promise.allSettled
     */
    _merge(queryResponseRecords) {
        let mergedRecords = [];
        queryResponseRecords.map(responseRecords => { // value is an array of records
            if (responseRecords.status === "fulfilled" && !(responseRecords.value === undefined)) {
                mergedRecords = [...mergedRecords, ...responseRecords.value];
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

    // Deprecated
    _groupOutputIDsBySemanticType(records
        ) {
        const output_ids = {};
        records
        .map(record => {
            if (record && record.association) {
                const output_type = record.association.output_type;
                if (!(output_type in output_ids)) {
                    output_ids[output_type] = new Set();
                }
                output_ids[output_type].add(record.object.original);
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
            if (record && record.association) {
                //INPUTS
                const input_type = record.association.input_type;
                if (!(input_type in curies)) {
                    curies[input_type] = new Set();
                }
                curies[input_type].add(record.subject.original);
                // OUTPUTS
                const output_type = record.association.output_type;
                if (!(output_type in curies)) {
                    curies[output_type] = new Set();
                }
                curies[output_type].add(record.object.original);
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
                record.object.normalizedInfo = res[record.object.original];
                record.subject.normalizedInfo = res[record.subject.original];
            }
            //add attributes
            if (attributes && record && Object.hasOwnProperty.call(attributes, record.subject.original)) {
                if (record instanceof ResolvableBioEntity) {
                    record.subject.normalizedInfo[0].attributes = attributes[record.subject.original]
                }
            }
            if (attributes && record && Object.hasOwnProperty.call(attributes, record.object.original)) {
                if (record instanceof ResolvableBioEntity){
                    record.object.normalizedInfo[0].attributes = attributes[record.object.original]
                }
            }
        });
        return records;
    }

}
