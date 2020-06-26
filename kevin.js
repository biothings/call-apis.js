const qb = require("./query_builder");
const axios = require("axios");
const qd = require("./index");

const edge = {
    "input": ["C1332824", "C1332823", "123"],
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
};

const edge1 = {
    "input": ["223"],
    "query_operation": {
        "params": {
            "fields": "associated_with"
        },
        "request_body": {
            "body": {
                "q": "{inputs[0]}",
                "scopes": "hgnc"
            },
            "header": "application/x-www-form-urlencoded"
        },
        "path": "/query",
        "path_params": [],
        "method": "post",
        "server": "https://biothings.ncats.io/cord_gene",
        "tags": [
            "gene",
            "annotation",
            "query",
            "translator",
            "biothings"
        ],
        "supportBatch": true,
        "inputSeparator": ","
    },
    "association": {
        "input_id": "HGNC",
        "input_type": "Gene",
        "output_id": "DOID",
        "output_type": "Disease",
        "predicate": "related_to",
        "source": "Translator Text Mining Provider",
        "api_name": "CORD Gene API",
        "smartapi": {
            "id": "6bc54230a6fa7693b2cd113430387ca7",
            "meta": {
                "ETag": "5e7512d15d24b57b52cb15604aaa6c24192f48ef00da9732f23aab3707b2061b",
                "github_username": "kevinxin90",
                "timestamp": "2020-04-29T00:00:40.725359",
                "uptime_status": "good",
                "uptime_ts": "2020-06-12T00:05:25.251375",
                "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/cord/cord_gene.yml"
            }
        }
    },
    "response_mapping": {
        "related_to": {
            "HGNC": "associated_with.hgnc",
            "pmc": "associated_with.pmc"
        }
    },
    "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b"
};

const edge2 = {
    "input": ["238", "239", "240"],
    "query_operation": {
        "params": {
            "fields": "associated_with"
        },
        "request_body": {
            "body": {
                "q": "{inputs[0]}",
                "scopes": "hgnc"
            },
            "header": "application/x-www-form-urlencoded"
        },
        "path": "/query",
        "path_params": [],
        "method": "post",
        "server": "https://biothings.ncats.io/cord_gene",
        "tags": [
            "gene",
            "annotation",
            "query",
            "translator",
            "biothings"
        ],
        "supportBatch": true,
        "inputSeparator": ","
    },
    "association": {
        "input_id": "HGNC",
        "input_type": "Gene",
        "output_id": "HGNC",
        "output_type": "Gene",
        "predicate": "related_to",
        "source": "Translator Text Mining Provider",
        "api_name": "CORD Gene API",
        "smartapi": {
            "id": "6bc54230a6fa7693b2cd113430387ca7",
            "meta": {
                "ETag": "5e7512d15d24b57b52cb15604aaa6c24192f48ef00da9732f23aab3707b2061b",
                "github_username": "kevinxin90",
                "timestamp": "2020-04-29T00:00:40.725359",
                "uptime_status": "good",
                "uptime_ts": "2020-06-12T00:05:25.251375",
                "url": "https://raw.githubusercontent.com/NCATS-Tangerine/translator-api-registry/master/cord/cord_gene.yml"
            }
        }
    },
    "response_mapping": {
        "related_to": {
            "HGNC": "associated_with.hgnc",
            "pmc": "associated_with.pmc"
        }
    },
    "id": "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b"
};




const qqq = async () => {
    let qd1 = new qd([edge, edge1, edge2]);
    let res = await qd1.query();
    console.log(qd1.result.slice(-1)[0]);
}

const q = async () => {
    let res = await axios(a.config);
    console.log(res.data);
}

const qq = async () => {
    let res = await axios({
        method: 'post',
        url: 'https://biothings.ncats.io/semmedgene/query',
        data: 'q=C1332823, C1332824, 123&scopes=umls',
        params: {
            fields: 'name,umls,positively_regulates',
            size: '5'
        }
    });
    console.log(res.data);
};

qqq();