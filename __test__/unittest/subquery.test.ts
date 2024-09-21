/**
 * @jest-environment node
 */

import Subquery from "../../src/queries/subquery";

describe("test query builder class", () => {
  describe("test _getUrl function", () => {
    test("test if server url has a trailing slash", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/query",
        },
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.url;
      expect(res).toBe("https://google.com/query");
    });

    test("test if server url does not have a trailing slash", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/query",
        },
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.url;
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
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.url;
      expect(res).toBe("https://google.com/1017/query");
    });

    test("test if api has path parameters", () => {
      const edge = {
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/{output}/query",
          path_params: ["geneid", "output"],
          params: {
            geneid: "{inputs[0]}",
            output: "json",
          },
        },
        input: "hello"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.url;
      expect(res).toBe("https://google.com/hello/json/query");
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
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.input;
      expect(res).toEqual(edge.input);
    });

    test("Test if API supports batch, and multiple inputs provided as an array", () => {
      const edge = {
        input: ["kevin", "xin"],
        query_operation: {
          supportBatch: true,
        },
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.input;
      expect(res).toEqual("kevin,xin");
    });

    test("Test if API does not supports batch, and one input provided", () => {
      const edge = {
        input: "kevin",
        query_operation: {
          supportBatch: false,
        },
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const sq = new Subquery(edge);
      const res = sq.input;
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
            geneid: "{inputs[0]}",
            output: "json",
          },
        },
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.params;
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
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.params;
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
            output: "{inputs[0]}",
          },
        },
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.params;
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
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.params;
      expect(res.output).toEqual(1);
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
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.requestBody;
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
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.requestBody;
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
              output: "{inputs[0]}",
            },
          },
        },
        input: "1017"
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.requestBody;
      expect(res).toEqual("geneid=hello&output=1017");
    });
  });

  describe("test constructAxiosRequestConfig function", () => {
    test("test constructAxiosRequestConfig function", () => {
      const edge = {
        input: "1017",
        query_operation: {
          server: "https://google.com",
          path: "/{geneid}/query",
          path_params: ["geneid"],
          params: {
            geneid: "{inputs[0]}",
            output: "json",
          },
          method: "get",
        },
        association: {
          smartapi: {
            id: "dummy"
          }
        }
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge, {});
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
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.needsPagination(response);
      expect(res).toMatchObject({
        paginationStart: 0,
        paginationSize: 0
      });
    });

    test("biothings tagged api with post method should return false", () => {
      const edge = {
        query_operation: {
          method: "post",
        },
        tags: ["translator", "biothings"],
      };
      const response = {
        total: 1000,
        hits: new Array(400),
      };
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.needsPagination(response);
      expect(res).toMatchObject({
        paginationStart: 0,
        paginationSize: 0
      });
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
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.needsPagination(response);
      expect(res).not.toMatchObject({
        paginationStart: 0,
        paginationSize: 0
      });
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
      // @ts-expect-error TODO: change after APIEdge split from query_graph_handler
      const builder = new Subquery(edge);
      const res = builder.needsPagination(response);
      expect(res).toMatchObject({
        paginationStart: 0,
        paginationSize: 0
      });
    });
  });
});
