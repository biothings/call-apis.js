/**
 * @jest-environment node
 */

const query_dispatcher = require("../index");

describe("test query dispatcher", () => {
    let edges, qd;

    beforeEach(() => {
    });

    test("test query results", async () => {
        edges = [
            {
                "input": ["C1332824", "C1332823", "123"],
                "original_input": {
                    "kkk": "C1332824"
                },
                "query_operation": {
                    "params": {
                        "fields": "positively_regulates"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "umls"
                        }
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "https://biothings.ncats.io/semmedgene",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings",
                        "semmed"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "UMLS",
                    "input_type": "Gene",
                    "output_id": "UMLS",
                    "output_type": "Gene",
                    "predicate": "positively_regulates",
                    "source": "SEMMED",
                    "api_name": "SEMMED Gene API",
                    "smartapi": {
                        "id": "81955d376a10505c1c69cd06dbda3047",
                        "meta": {
                            "ETag": "f94053bc78b3c2f0b97f7afd52d7de2fe083b655e56a53090ad73e12be83673b",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:53:40.804575",
                            "uptime_status": "good",
                            "uptime_ts": "2020-06-12T00:04:31.404599",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/semmed/semmed_gene.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "positively_regulates": {
                        "pmid": "positively_regulates.pmid",
                        "umls": "positively_regulates.umls"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b"
            }
        ];
        qd = new query_dispatcher(edges);
        await qd.query();
        expect(qd.result.length).toBeGreaterThan(1);
        expect(qd.result[0]).toHaveProperty('id');
        expect(qd.result[0]).toHaveProperty('$output_id_mapping');
        expect(qd.result[0]).toHaveProperty('$input');
        expect(qd.result[0]).toHaveProperty('$output');
        expect(qd.result[0]).toHaveProperty('provided_by');
        expect(qd.result[0]).toHaveProperty('api');
    })

    test("test query disease to variant", async () => {
        edges = [
            {
                "input": ["C0008780"],
                "query_operation": {
                    "params": {
                        "fields": "disgenet.variants_related_to_disease"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "mondo.xrefs.umls, disgenet.xrefs.umls"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "UMLS",
                    "input_type": "Disease",
                    "output_id": "DBSNP",
                    "output_type": "SequenceVariant",
                    "predicate": "related_to",
                    "source": "disgenet",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "DBSNP": "disgenet.variants_related_to_disease.rsid",
                        "pubmed": "disgenet.variants_related_to_disease.pubmed"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            }
        ]
        qd = new query_dispatcher(edges);
        await qd.query();
        expect(qd.result.length).toBeGreaterThan(1);
        expect(qd.result[0]).toHaveProperty('id');
        expect(qd.result[0]).toHaveProperty('$output_id_mapping');
        expect(qd.result[0]).toHaveProperty('$input');
        expect(qd.result[0]).toHaveProperty('$output');
        expect(qd.result[0]).toHaveProperty('provided_by');
        expect(qd.result[0]).toHaveProperty('api');
    })

    test("test query multiple edges", async () => {
        edges = [
            {
                "input": ["C0008780"],
                "query_operation": {
                    "params": {
                        "fields": "disgenet.genes_related_to_disease.gene_id"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "mondo.xrefs.umls, disgenet.xrefs.umls"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "UMLS",
                    "input_type": "Disease",
                    "output_id": "NCBIGene",
                    "output_type": "Gene",
                    "predicate": "related_to",
                    "source": "disgenet",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "NCBIGene": "disgenet.genes_related_to_disease.gene_id"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            },
            {
                "input": ["C0008780"],
                "query_operation": {
                    "params": {
                        "fields": "disgenet.variants_related_to_disease"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "mondo.xrefs.umls, disgenet.xrefs.umls"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "UMLS",
                    "input_type": "Disease",
                    "output_id": "DBSNP",
                    "output_type": "SequenceVariant",
                    "predicate": "related_to",
                    "source": "disgenet",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "DBSNP": "disgenet.variants_related_to_disease.rsid",
                        "pubmed": "disgenet.variants_related_to_disease.pubmed"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            },
            {
                "input": ["244400"],
                "query_operation": {
                    "params": {
                        "fields": "hpo.phenotype_related_to_disease"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "hpo.omim"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "OMIM",
                    "input_type": "Disease",
                    "output_id": "HP",
                    "output_type": "PhenotypicFeature",
                    "predicate": "related_to",
                    "source": "hpo",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "HP": "hpo.phenotype_related_to_disease.hpo_id",
                        "evidence": "hpo.phenotype_related_to_disease.evidence"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            },
            {
                "input": ["D002925"],
                "query_operation": {
                    "params": {
                        "fields": "ctd.chemical_related_to_disease"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "mondo.xrefs.mesh, disgenet.xrefs.mesh"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "MESH",
                    "input_type": "Disease",
                    "output_id": "MESH",
                    "output_type": "ChemicalSubstance",
                    "predicate": "related_to",
                    "source": "ctd",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "MESH": "ctd.chemical_related_to_disease.mesh_chemical_id",
                        "pubmed": "ctd.chemical_related_to_disease.pubmed"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            },
            {
                "input": ["D002925"],
                "query_operation": {
                    "params": {
                        "fields": "ctd.bp_related_to_disease"
                    },
                    "request_body": {
                        "body": {
                            "q": "{inputs[0]}",
                            "scopes": "mondo.xrefs.mesh, disgenet.xrefs.mesh"
                        },
                        "header": "application/x-www-form-urlencoded"
                    },
                    "path": "/query",
                    "path_params": [],
                    "method": "post",
                    "server": "http://mydisease.info/v1",
                    "tags": [
                        "disease",
                        "annotation",
                        "query",
                        "translator",
                        "biothings"
                    ],
                    "supportBatch": true,
                    "inputSeparator": ","
                },
                "association": {
                    "input_id": "MESH",
                    "input_type": "Disease",
                    "output_id": "GO",
                    "output_type": "BiologicalProcess",
                    "predicate": "related_to",
                    "source": "ctd",
                    "api_name": "mydisease.info API",
                    "smartapi": {
                        "id": "671b45c0301c8624abbd26ae78449ca2",
                        "meta": {
                            "ETag": "8a3ddbc3f740369fa6f6c26b4dbb0e62a214445e416e6982fca329013679fa60",
                            "github_username": "kevinxin90",
                            "timestamp": "2020-05-27T16:55:43.146979",
                            "uptime_status": "good",
                            "uptime_ts": "2020-07-15T00:05:37.171323",
                            "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/mydisease.info/smartapi.yaml"
                        }
                    }
                },
                "response_mapping": {
                    "related_to": {
                        "GO": "ctd.bp_related_to_disease.go_id",
                        "name": "ctd.bp_related_to_disease.go_name"
                    }
                },
                "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b",
                "tags": [
                    "disease",
                    "annotation",
                    "query",
                    "translator",
                    "biothings"
                ]
            }
        ]
        qd = new query_dispatcher(edges);
        await qd.query();
        expect(qd.result.length).toBeGreaterThan(1);
        expect(qd.result[0]).toHaveProperty('id');
        expect(qd.result[0]).toHaveProperty('$output_id_mapping');
        expect(qd.result[0]).toHaveProperty('$input');
        expect(qd.result[0]).toHaveProperty('$output');
        expect(qd.result[0]).toHaveProperty('provided_by');
        expect(qd.result[0]).toHaveProperty('api');
    })
})


