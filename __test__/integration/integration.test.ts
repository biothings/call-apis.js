import APIQueryDispatcher from "../../src/index";
import { RedisClient } from "@biothings-explorer/utils";
import fs from "fs";
import path from "path";
import axios from "axios";

import MetaKG from "@biothings-explorer/smartapi-kg";
const meta_kg = new MetaKG();
meta_kg.constructMetaKGSync();

jest.mock("axios");

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
      const query = new APIQueryDispatcher([edge], {}, { redisClient: { clientEnabled: false } } as unknown as RedisClient);
      const res = await query.query();
      expect([...res.reduce((set, record) => set.add(record.recordHash), new Set())]).toHaveLength(28);
    });
  });

  describe.skip("Integration test using text mining co-occurrence KP for disease to chemical association", () => {
    let edge;

    beforeEach(() => {
      const edge_path = path.resolve(__dirname, "../data/cooccurrence_example_edge.json");
      edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));
    });
    test("check response", async () => {
      const query = new APIQueryDispatcher([edge], {}, { redisClient: { clientEnabled: false } } as unknown as RedisClient);
      const res = await query.query(false);
      expect(res).toHaveLength(3762);
    });
  });

  describe("Integration test using fake error api query that should return 404 error", () => {
    let edge;

    beforeEach(() => {
      const edge_path = path.resolve(__dirname, "../data/fake_error_edge.json");
      edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));
    });
    test("check response", async () => {
      const query = new APIQueryDispatcher([edge], {}, { redisClient: { clientEnabled: false } } as unknown as RedisClient);
      const res = await query.query(false);
      expect(res).toHaveLength(0);
      expect(query.logs.some(log => (log.level === "ERROR" ? true : false))).toBeTruthy();
    });
  });

  describe("Integration test using mydisease superclass_of", () => {
    let edges;

    beforeEach(() => {
      edges = meta_kg.filter({ api_name: "MyDisease.info API", predicate: "superclass_of" });
      edges.map(op => (op.input = ["MONDO:0002494"]));

      // mocking API calls
      const get_result_path = path.resolve(__dirname, "../data/api_results/mydisease_get_result.json");
      (axios.get as jest.Mock).mockResolvedValue({
        data: JSON.parse(fs.readFileSync(get_result_path, { encoding: "utf8" })),
      });

      const post_result_path = path.resolve(__dirname, "../data/api_results/mydisease_post_result.json");
      // @ts-expect-error Axios mocking is annoying >_>
      axios.mockResolvedValue({ data: JSON.parse(fs.readFileSync(post_result_path, { encoding: "utf8" })) });
    });
    test("check response", async () => {
      const query = new APIQueryDispatcher(edges, {}, { redisClient: { clientEnabled: false } } as unknown as RedisClient);
      const res = await query.query(false);
      const mydisease_res = await axios.get(
        "http://mydisease.info/v1/disease/MONDO:0002494?fields=mondo.children&dotfield=true",
      );
      expect(res.length).toEqual(mydisease_res.data["mondo.children"].length);
    });
  });
});
