const q = require("../../src/query");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

describe("Integration test", () => {
    describe("Integration test using mygene.info gene to biological process association", () => {
        let edge;

        beforeEach(() => {
            const edge_path = path.resolve(__dirname, '../data/mygene_example_edge.json');
            edge = JSON.parse(fs.readFileSync(edge_path));
        })
        test("check response", async () => {
            const query = new q([edge]);
            const res = await query.query();
            expect([...res.reduce((set, record) => set.add(record.recordHash), new Set())]).toHaveLength(28);
        })
    })

    describe.skip("Integration test using text mining co-occurrence KP for disease to chemical association", () => {
        let edge;

        beforeEach(() => {
            const edge_path = path.resolve(__dirname, '../data/cooccurrence_example_edge.json');
            edge = JSON.parse(fs.readFileSync(edge_path));
        })
        test("check response", async () => {
            const query = new q([edge]);
            const res = await query.query(false);
            expect(res).toHaveLength(3762);
        })
    })

    describe("Integration test using fake error api query that should return 404 error", () => {
        let edge;

        beforeEach(() => {
            const edge_path = path.resolve(__dirname, '../data/fake_error_edge.json');
            edge = JSON.parse(fs.readFileSync(edge_path));
        })
        test("check response", async () => {
            const query = new q([edge]);
            const res = await query.query(false);
            expect(res).toHaveLength(0);
            expect(query.logs.some(log => log.level === 'ERROR' ? true : false)).toBeTruthy();
        })
    })

    describe("Integration test using mydisease superclass_of", () => {
        let edges;

        beforeEach(() => {
            const kg = require("@biothings-explorer/smartapi-kg");
            const meta_kg = new kg.default();
            meta_kg.constructMetaKGSync();
            edges = meta_kg.filter({ api_name: "MyDisease.info API", predicate: "superclass_of" });
            edges.map(op => op.input = ["MONDO:0002494"])
        })
        test("check response", async () => {
            const query = new q(edges);
            const res = await query.query(false);
            const mydisease_res = await axios.get("http://mydisease.info/v1/disease/MONDO:0002494?fields=mondo.children&dotfield=true");
            expect(res.length).toEqual(mydisease_res.data["mondo.children"].length)
        })
    })
})
