/**
 * @jest-environment node
 */

const { default: axios } = require("axios");
const q = require("../src/query");
const resolved_ids = {
    "NCBIGene:1017": 'k',
    "CHEBI:1234": 'L'
}
jest.mock('biomedical_id_resolver', () => {
    // Works and lets you check for constructor calls:
    return jest.fn().mockImplementation(() => {
        return { resolve: () => resolved_ids };
    });
});
jest.mock('@biothings-explorer/api-response-transform', () => {
    // Works and lets you check for constructor calls:
    return jest.fn().mockImplementation((res) => {
        return { transform: () => [{ v: true }] };
    });
});

jest.mock('../src/query_queue', () => {
    // Works and lets you check for constructor calls:
    return jest.fn().mockImplementation((res) => {
        return {
            addQuery: () => { },
            constructQueue: () => { }
        };
    });
});

jest.mock('axios');

describe("Test query class", () => {
    describe("Test _merge function", () => {
        test("Failed promise should be excluded in the result", () => {
            const success = {
                status: "fulfilled",
                value: [{ id: 1 }]
            }
            const fail = {
                status: "rejected",
                reason: "bad request"
            }
            const caller = new q([]);
            const res = caller._merge([success, fail, fail]);
            expect(res).toHaveLength(1);
            expect(res[0]).toEqual(success.value[0]);
        })

        test("successful promise should be correctly merged", () => {
            const success1 = {
                status: "fulfilled",
                value: [{ id: 1 }]
            }
            const success2 = {
                status: "fulfilled",
                value: [{ id: 3 }]
            }
            const fail = {
                status: "rejected",
                reason: "bad request"
            }
            const caller = new q([]);
            const res = caller._merge([success1, success2, success1, fail, fail]);
            expect(res).toHaveLength(3);
            expect(res[0]).toEqual(success1.value[0]);
            expect(res[1]).toEqual(success2.value[0]);
            expect(res[2]).toEqual(success1.value[0]);
        })

        test("logs is correctly populated", () => {
            const success1 = {
                status: "fulfilled",
                value: [{ id: 1 }]
            }
            const success2 = {
                status: "fulfilled",
                value: [{ id: 3 }]
            }
            const fail = {
                status: "rejected",
                reason: "bad request"
            }
            const caller = new q([]);
            caller._merge([success1, success2, success1, fail, fail]);
            expect(caller.logs).toHaveLength(1);
            expect(caller.logs[0]).toHaveProperty("message", "call-apis: Total number of results returned for this query is 3")
        })
    })

    describe("Test _groupOutputIDsBySemanticType function", () => {
        test("Empty result should return an empty dict", () => {
            const caller = new q([]);
            const res = caller._groupOutputIDsBySemanticType([]);
            expect(res).toEqual({});
        })

        test("Output IDs are correctly grouped", () => {
            const caller = new q([]);
            const result = [
                {
                    $edge_metadata: {
                        output_type: 'Gene'
                    },
                    $output: {
                        original: "NCBIGene:1017"
                    }
                },
                {
                    $edge_metadata: {
                        output_type: 'Gene'
                    },
                    $output: {
                        original: "NCBIGene:1018"
                    }
                },
                {
                    $edge_metadata: {
                        output_type: 'Disease'
                    },
                    $output: {
                        original: "MONDO:1234"
                    }
                },
            ]
            const res = caller._groupOutputIDsBySemanticType(result);
            expect(res).toHaveProperty("Disease");
            expect(res.Disease).toEqual(['MONDO:1234']);
            expect(res).toHaveProperty("Gene");
            expect(res.Gene).toEqual(['NCBIGene:1017', 'NCBIGene:1018'])
        })
    })

    describe("test _annotate function", () => {
        test("check if annotated ids are correctly mapped", async () => {
            const res = [
                {
                    $edge_metadata: {
                        output_type: "Gene"
                    },
                    $output: {
                        original: "NCBIGene:1017"
                    }
                },
                {
                    $edge_metadata: {
                        output_type: "ChemicalSubstance"
                    },
                    $output: {
                        original: "CHEBI:1234"
                    }
                }
            ];
            const caller = new q([]);
            const annotatedResult = await caller._annotate(res);
            expect(annotatedResult).toHaveLength(2);
            expect(annotatedResult[0].$output).toHaveProperty('obj', 'k');
        })

        test("if set enabled equal to false, return the result itself", async () => {
            const res = [
                {
                    $edge_metadata: {
                        output_type: "Gene"
                    },
                    $output: {
                        original: "NCBIGene:1017"
                    }
                },
                {
                    $edge_metadata: {
                        output_type: "ChemicalSubstance"
                    },
                    $output: {
                        original: "CHEBI:1234"
                    }
                }
            ];
            const caller = new q([]);
            const annotatedResult = await caller._annotate(res, false);
            expect(annotatedResult).toEqual(res);
        })
    })

    describe("test _queryBucket function", () => {
        test("test _queryBucket function", async () => {
            const queries = [
                {
                    getConfig() {
                        return {};
                    },
                    needPagination(res) {
                        return false;
                    }
                }
            ];
            const mockRes = {
                data: {
                    gene: 1017
                }
            }
            axios.mockResolvedValue(mockRes);
            const caller = new q([]);
            caller.queue = {
                dequeue() {
                    return true;
                }
            };
            const res = await caller._queryBucket(queries);
            expect(res).toHaveLength(1);
            expect(res[0]).toHaveProperty('status', 'fulfilled');
            expect(res[0]).toHaveProperty('value', [{ v: true }])
        })
    })
})