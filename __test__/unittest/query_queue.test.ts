/**
 * @jest-environment node
 */

import Subquery from "../../src/queries/subquery";
import APIQueryQueue, { SubqueryBundle } from "../../src/query_queue";

describe("Test Query Queue module", () => {
  describe("Test getNext function", () => {
    test("Test getNext function", async () => {
      const queue = new APIQueryQueue();
      queue.queue = [
        {
          query: {
            APIEdge: {
              association: {
                api_name: "1",
              },
              query_operation: {
                server: "1",
              },
            },
          },
          options: {}
        },
        {
          query: {
            APIEdge: {
              association: {
                api_name: "2",
              },
              query_operation: {
                server: "2",
              },
            },
          },
          options: {}
        },
      ] as unknown as SubqueryBundle[];
      const next = await queue.getNext();
      expect(next.query.APIEdge.association.api_name).toEqual("2");
    });

    test("Test getNext function if queue is empty", () => {
      const queue = new APIQueryQueue();
      queue.queue = [];
      queue.getNext();
      expect(queue.queue).toEqual([]);
    });
  });

  describe("Test add function", () => {
    test("Adding one item", () => {
      const queue = new APIQueryQueue();
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.add(query);
      expect(queue.queue).toHaveLength(1);
    });
  });
});
