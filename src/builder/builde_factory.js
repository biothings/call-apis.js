const default_builder = require("./query_builder");
const trapi_builder = require("./trapi_query_builder");

const builder_factory = (edge) => {
    if ('tags' in edge && 'bte-trapi' in edge.tags) {
        return new trapi_builder(edge);
    }
    return new default_builder(edge);
}

module.exports = builder_factory;