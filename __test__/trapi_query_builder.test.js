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
            expect(res.data.message.query_graph.nodes.n0.ids).toEqual(['123', '456']);
            expect(res.data.message.query_graph.nodes.n0.categories).toContain('biolink:Pathway');
            expect(res.data.message.query_graph.nodes.n1.categories).toContain('biolink:Gene');
            expect(res.data.message.query_graph.edges.e01.predicates).toContain('biolink:related_to');
        })
    })

    describe("test mustache support", () => {
        test("if _getUrl mustache templates are filled", () => {
            const edge = {
                query_operation: {
                    server: "https://google.com/",
                    path: "{path}",
                    path_params: ["path"],
                    params: {path: "{{{specialpath}}}"}
                },
                association: {
                    input_type: "Pathway",
                    output_type: "Gene",
                    predicate: "related_to",
                },
                input: {params: {path: {specialpath: "/querytest"}}},
            };
            const builder = new qb(edge);
            const res = builder._getUrl(edge, edge.input);
            expect(res).toEqual("https://google.com/querytest");
        })

        test("if _getBody mustache templates are filled", () => {
            const edge = {
                query_operation: {
                    server: "https://google.com/",
                    path: "/query"
                },
                association: {
                    input_type: ['Pathway', 'SomethingElse', '{{SpecialInput}}'],
                    output_type: 'Gene',
                    predicate: 'related_to'
                },
                input: {
                    body: {
                        ids: ['123', '456'],
                        SpecialInput: "TestSuccess"
                    }
                }
            }
            const builder = new qb(edge);
            const res = builder._getRequestBody(edge, edge.input);
            expect(res).toEqual({
                message: {
                    query_graph: {
                    nodes: {
                        n0: {
                        ids: ['123', '456'],
                        categories: ['biolink:Pathway', 'biolink:SomethingElse', 'biolink:TestSuccess'],
                        },
                        n1: {
                        categories: ['biolink:Gene'],
                        },
                    },
                    edges: {
                        e01: {
                        subject: "n0",
                        object: "n1",
                        predicates: ['biolink:related_to'],
                        },
                    },
                    },
                },
            });
        })
    })
})
