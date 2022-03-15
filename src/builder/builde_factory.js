const default_builder = require("./query_builder");
const trapi_builder = require("./trapi_query_builder");
const template_builder = require("./template_query_builder")
const debug = require("debug")("bte:call-apis:query");


const builder_factory = (APIEdge) => {
    if ('tags' in APIEdge && APIEdge.tags.includes('bte-trapi')) {
        debug(`using trapi builder now`)
        return new trapi_builder(APIEdge);
    } else if (APIEdge.query_operation.useTemplating) {
        debug("using template builder");
        return new template_builder(APIEdge);
    }
    debug('using default builder')
    return new default_builder(APIEdge);
}

module.exports = builder_factory;
