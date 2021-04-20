/**
 * @jest-environment node
 */

const qb = require("../src/builder/trapi_query_builder");

describe("test trapi query builder class", () => {

    describe("test getConfig function", () => {
        test("test if server url has a trailing slash", () => {
            const edge = {
                query_operation: {
                    server: "https://google.com/",
                    path: "/query"
                },
                association: {
                    input_type: 'Pathway',
                    output_type: 'Gene',
                    predicate: 'related_to'
                },
                input: ['123', '456']
            }
            const builder = new qb(edge);
            const res = builder.getConfig();
            expect(res).toHaveProperty('url', 'https://google.com/query');
            expect(res).toHaveProperty('timeout', 3000);
            expect(res.data.message.query_graph.nodes.n0.id).toEqual(['123', '456']);
            expect(res.data.message.query_graph.nodes.n0.category).toEqual('biolink:Pathway');
            expect(res.data.message.query_graph.nodes.n1.category).toEqual('biolink:Gene');
            expect(res.data.message.query_graph.edges.e01.predicate).toEqual('biolink:related_to');
        })
    })
})