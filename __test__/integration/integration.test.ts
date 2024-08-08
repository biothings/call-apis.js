import { SubqueryRelay, SubqueryResults, constructQueries } from "../../src/index";
import { RedisClient } from "@biothings-explorer/utils";
import fs from "fs";
import path from "path";
import axios from "axios";

import MetaKG from "@biothings-explorer/smartapi-kg";
import { APIEdge, QueryHandlerOptions, Record } from "@biothings-explorer/types";
const meta_kg = new MetaKG();
meta_kg.constructMetaKGSync();

jest.mock("axios");

function runQuery(edges: APIEdge[], opts: QueryHandlerOptions): Promise<{ records: Record[], logs: any[] }> {
  const queries = constructQueries(edges, opts);
  const totalCount = queries.length;
  const response: { records: Record[], logs: any[] } = { records: [], logs: [] };
  let currentCount = 0;
  const relay = new SubqueryRelay();
  return new Promise(resolve => {
    relay.subscribe(queries, opts, x => {
      const [associations, ...frozenRecords] = x.records;
      frozenRecords.forEach((record: any) => {
        const association = associations[record.association];
        response.records.push(new Record(record, undefined, association, undefined));
      });
      x.logs.forEach(log => response.logs.push(log));
      currentCount += 1;
      if (currentCount >= totalCount) {
        resolve(response);
      }
    });
  });
}

describe("Integration test", () => {
  describe("Integration test using mygene.info gene to biological process association", () => {
    let edge;

    beforeEach(() => {
      const edge_path = path.resolve(__dirname, "../data/mygene_example_edge.json");
      edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));

      // mocking API calls
      const normalized_info_path = path.resolve(__dirname, "../data/api_results/mygene_normalized_nodes.json");
      (axios.post as jest.Mock).mockResolvedValue({
        data: JSON.parse(fs.readFileSync(normalized_info_path, { encoding: "utf8" })),
      });

      const result_path = path.resolve(__dirname, "../data/api_results/mygene_query_result.json");
      // @ts-expect-error Axios mocking is annoying >_>
      axios.mockResolvedValue({ data: JSON.parse(fs.readFileSync(result_path, { encoding: "utf8" })) });
    });
    test("check response", async () => {
      const res = await runQuery([edge], {});
      expect([...res.records.reduce((set, record) => set.add(record.recordHash), new Set())]).toHaveLength(28);
    });
  });

  describe.skip("Integration test using text mining co-occurrence KP for disease to chemical association", () => {
    let edge;

    beforeEach(() => {
      const edge_path = path.resolve(__dirname, "../data/cooccurrence_example_edge.json");
      edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));
    });
    test("check response", async () => {
      const res = await runQuery([edge], {});
      expect(res.records).toHaveLength(3762);
    });
  });

  describe("Integration test using fake error api query that should return 404 error", () => {
    let edge;

    beforeEach(() => {
      const edge_path = path.resolve(__dirname, "../data/fake_error_edge.json");
      edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));
    });
    test("check response", async () => {
      const res = await runQuery([edge], {});
      expect(res.records).toHaveLength(0);
      expect(res.logs.some(log => (log.level === "ERROR" ? true : false))).toBeTruthy();
    });
  });

  describe("Integration test using mydisease superclass_of", () => {
    let edges;

    beforeEach(() => {
      edges = meta_kg.filter({ api_name: "MyDisease.info API", predicate: "superclass_of" }).map(e => ({
        ...e,
        input: { queryInputs: "MONDO:0002494" },
        input_resolved_identifiers: {},
        original_input: { "MONDO:0002494": "MONDO:0002494" }
      }));

      // mocking API calls
      const normalized_info_path = path.resolve(__dirname, "../data/api_results/mydisease_normalized_nodes.json");
      (axios.post as jest.Mock).mockResolvedValue({
        data: JSON.parse(fs.readFileSync(normalized_info_path, { encoding: "utf8" })),
      });

      const get_result_path = path.resolve(__dirname, "../data/api_results/mydisease_get_result.json");
      (axios.get as jest.Mock).mockResolvedValue({
        data: JSON.parse(fs.readFileSync(get_result_path, { encoding: "utf8" })),
      });

      const post_result_path = path.resolve(__dirname, "../data/api_results/mydisease_post_result.json");
      // @ts-expect-error Axios mocking is annoying >_>
      axios.mockResolvedValue({ data: JSON.parse(fs.readFileSync(post_result_path, { encoding: "utf8" })) });
    });
    test("check response", async () => {
      const res = await runQuery(edges, {});
      const mydisease_res = await axios.get(
        "http://mydisease.info/v1/disease/MONDO:0002494?fields=mondo.children&dotfield=true",
      );
      expect(res.records.length).toEqual(mydisease_res.data["mondo.children"].length);
    });
  });
});
