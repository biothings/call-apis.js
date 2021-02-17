const q = require("../../src/query");
const fs = require("fs");
const path = require("path");

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
            expect(res).toHaveLength(27);
        })
    })
})