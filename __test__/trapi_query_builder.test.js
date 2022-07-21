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
            expect(res.data.message.query_graph.nodes.n0.ids).toEqual(['123', '456']);
            expect(res.data.message.query_graph.nodes.n0.categories).toContain('biolink:Pathway');
            expect(res.data.message.query_graph.nodes.n1.categories).toContain('biolink:Gene');
            expect(res.data.message.query_graph.edges.e01.predicates).toContain('biolink:related_to');
        })
    })
})
