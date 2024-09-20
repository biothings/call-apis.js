/**
 * @jest-environment node
 */

import TrapiSubquery from "../../src/queries/trapi_subquery";

describe("test trapi query builder class", () => {
  describe("test getConfig function", () => {
    test("test if server url has a trailing slash", () => {
      const edge = {
        query_operation: {
          server: "https://google.com/",
          path: "/query",
        },
        association: {
          input_type: "Pathway",
          output_type: "Gene",
          predicate: "related_to",
        },
        input: ["123", "456"],
      };
      const queryHandlerOptions: QueryHandlerOptions = {caching: false};
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const sq = new TrapiSubquery(edge, {});
      const res = sq.getConfig();
      expect(res).toHaveProperty("url", "https://google.com/query");
      expect(res.data.message.query_graph.nodes.n0.ids).toEqual(["123", "456"]);
      expect(res.data.message.query_graph.nodes.n0.categories).toContain("biolink:Pathway");
      expect(res.data.message.query_graph.nodes.n1.categories).toContain("biolink:Gene");
      expect(res.data.message.query_graph.edges.e01.predicates).toContain("biolink:related_to");
    });
  });
});
