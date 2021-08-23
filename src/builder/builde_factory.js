const default_builder = require("./query_builder");
const trapi_builder = require("./trapi_query_builder");
const debug = require("debug")("bte:call-apis:query");


const builder_factory = (edge) => {
    if ('tags' in edge && edge.tags.includes('bte-trapi')) {
        debug(`using trapi builder now`)
        return new trapi_builder(edge);
    }
    debug('using default builder')
    return new default_builder(edge);
}

module.exports = builder_factory;
