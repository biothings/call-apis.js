/**
 * @jest-environment node
 */

import qb from "../../src/builder/template_query_builder";
import path from "path";
import fs from "fs";

describe("test query builder class", () => {
  describe("test _getUrl function", () => {
    test("test if server url has a trailing slash", () => {
      const edge = {
        query_operation: {
          server: "https://google.com/",
          path: "/query",
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getUrl(edge, "hello");
      expect(res).toBe("https://google.com/query");
    });

    test("test if server url does not have a trailing slash", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/query",
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getUrl(edge, "hello");
      expect(res).toBe("https://google.com/query");
    });

    test("test if api has path parameters", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "1017",
            output: "json",
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getUrl(edge, "hello");
      expect(res).toBe("https://google.com/1017/query");
    });

    test("test if api has path parameters", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/{output}/query",
          path_params: ["geneid", "output"],
          params: {
            geneid: "{{queryInputs}}",
            output: "json",
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getUrl(edge, { queryInputs: "hello" });
      expect(res).toBe("https://google.com/hello/json/query");
    });

    test("if _getUrl nunjucks templates are filled", () => {
      const edge_path = path.resolve(__dirname, "../data/multi_input_edge.json");
      const edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));
      const builder = new qb(edge);
      const res = builder._getUrl(edge, {
        specialpath: "/querytest",
        id: "MONDO:0005252",
        fields: ["subject", "association"],
        queryInputs: ["abc", "def"],
      });
      expect(res).toEqual("https://biothings.ncats.io/text_mining_co_occurrence_kp/querytest");
    });
  });

  describe("Test _getInput function", () => {
    test("Test if API supports batch, but only one input provided as string", () => {
      const edge = {
        input: "kevin",
        query_operation: {
          supportBatch: true,
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getInput(edge);
      expect(res).toEqual(edge.input);
    });

    test("Test if API supports batch, and multiple inputs provided as an array", () => {
      const edge = {
        input: ["kevin", "xin"],
        query_operation: {
          supportBatch: true,
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getInput(edge);
      expect(res).toEqual(["kevin", "xin"]);
    });

    test("Test if API does not supports batch, and one input provided", () => {
      const edge = {
        input: "kevin",
        query_operation: {
          supportBatch: false,
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getInput(edge);
      expect(res).toEqual(edge.input);
    });
  });

  describe("Test _getParams function", () => {
    test("if no path parameter is involved", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          params: {
            geneid: "{{queryInputs}}",
            output: "json",
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getParams(edge, { queryInputs: "1017" });
      expect(res).toHaveProperty("geneid");
      expect(res.geneid).toEqual("1017");
    });

    test("if path parameter is involved", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "{inputs[0]}",
            output: "json",
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getParams(edge, "1017");
      expect(res).not.toHaveProperty("geneid");
      expect(res.output).toEqual("json");
    });

    test("if path parameter is involved, but input is in query params", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "hello",
            output: "{{queryInputs}}",
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getParams(edge, { queryInputs: "1017" });
      expect(res).not.toHaveProperty("geneid");
      expect(res.output).toEqual("1017");
    });

    test("if query params value is not string", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "hello",
            output: 1,
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getParams(edge, "1017");
      expect(res.output).toEqual(1);
    });

    test("if _getParams nunjucks templates are filled", () => {
      const edge_path = path.resolve(__dirname, "../data/multi_input_edge.json");
      const edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));

      const builder = new qb(edge);
      const res = builder._getParams(edge, {
        specialpath: "/querytest",
        id: "MONDO:0005252",
        fields: ["subject", "association"],
        queryInputs: ["abc", "def"],
      });
      expect(res).toEqual({
        fields: "subject,association",
        q: 'object.MONDO:"MONDO:0005252" AND subject.type:SmallMolecule',
        size: 1000,
      });
    });
  });

  describe("test _getRequestBody function", () => {
    test("test if request body is empty", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "hello",
            output: 1,
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getRequestBody(edge, "1017");
      expect(res).toBeUndefined;
    });

    test("test if request body is not empty", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          request_body: {
            body: {
              geneid: "hello",
              output: 1,
            },
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getRequestBody(edge, "1017");
      expect(res).toEqual("geneid=hello&output=1");
    });

    test("test if request body is not empty, and should be replaced with input", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          request_body: {
            body: {
              geneid: "hello",
              output: "{{queryInputs}}",
            },
          },
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const res = builder._getRequestBody(edge, { queryInputs: "1017" });
      expect(res).toEqual("geneid=hello&output=1017");
    });

    test("if nunjucks _getRequestBody templates are filled", () => {
      const edge_path = path.resolve(__dirname, "../data/multi_input_edge.json");
      const edge = JSON.parse(fs.readFileSync(edge_path, { encoding: "utf8" }));

      const builder = new qb(edge);
      const res = builder._getRequestBody(edge, {
        specialpath: "/querytest",
        id: "MONDO:0005252",
        fields: ["subject", "association"],
        queryInputs: ["abc", "def"],
      });
      expect(res).toEqual("q=MONDO:0005252&fields=subject,association");
    });
  });

  describe("test constructAxiosRequestConfig function", () => {
    test("test constructAxiosRequestConfig function", () => {
      const edge = {
        input: { queryInputs: ["1017"] },
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "{{queryInputs}}",
            output: "json",
          },
          method: "get",
        },
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      const res = builder.constructAxiosRequestConfig();
      expect(res.url).toEqual("https://google.com/1017/query");
      expect(res.params).not.toHaveProperty("geneid");
      expect(res.params.output).toEqual("json");
      expect(res.method).toEqual("get");
      expect(res.data).toBeUndefined;
    });
  });

  describe("test needPagniation function", () => {
    test("non biothings tagged api should return false", () => {
      const edge = {
        query_operation: {
          method: "get",
        },
        tags: ["translator"],
      };
      const response = {
        total: 1000,
        hits: new Array(400),
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      const res = builder.needPagination(response);
      expect(res).toBeFalsy();
    });

    test("biothings tagged api with post method should return false", () => {
      const edge = {
        query_operation: {
          method: "post",
          server: "mygene.info",
        },
        tags: ["translator", "biothings"],
      };
      const response = {
        total: 1000,
        hits: new Array(400),
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      const res = builder.needPagination(response);
      expect(res).toBeFalsy();
    });

    test("biothings tagged api with get method and needs pagniation should return true", () => {
      const edge = {
        query_operation: {
          method: "get",
        },
        tags: ["translator", "biothings"],
      };
      const response = {
        total: 1000,
        hits: new Array(400),
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      const res = builder.needPagination(response);
      expect(res).toBeTruthy();
    });

    test("biothings tagged api with get method and doesn't need pagniation should return false", () => {
      const edge = {
        query_operation: {
          method: "get",
        },
        tags: ["translator", "biothings"],
      };
      const response = {
        total: 1000,
        hits: new Array(1000),
      };
      // @ts-expect-error TODO: change after extracting APIEdge from query_graph_handler
      const builder = new qb(edge);
      const res = builder.needPagination(response);
      expect(res).toBeFalsy();
    });
  });
});
