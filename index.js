const axios = require("axios");
const qb = require("./query_builder");
const tf = require("@biothings-explorer/api-response-transform");
const resolver = require("biomedical_id_resolver");

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
    }

    /**
     * Make API calls and parse the response.
     */
    query = async () => {
        this.queryResult = await Promise.allSettled(this.edges.map(edge => {
            let qbo = new qb(edge);
            return axios(qbo.config)
                .then(res => ({
                    response: res.data,
                    edge: edge
                }))
                .then(res => {
                    let tf_obj = new tf(res);
                    return tf_obj.transform();
                })
                .catch(error => {
                    //console.log(error);
                    return undefined;
                });
        }));
        this.merge();
        await this.annotate();
    }

    /**
     * Merge the results into a single array from Promise.allSettled
     */
    merge = () => {
        this.result = [];
        this.queryResult.map(res => {
            if (!(res.value === undefined)) {
                this.result = [...this.result, ...res.value];
            }
        });
    }

    /**
     * Add equivalent ids to all output using biomedical-id-resolver service
     */
    annotate = async () => {
        let output_ids = {};
        this.result.map(item => {
            let output_type = item["$association"]["output_type"];
            if (!(output_type in output_ids)) {
                output_ids[output_type] = [];
            }
            output_ids[output_type].push(item["$output"]);
        });
        let res = await resolver(output_ids);
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