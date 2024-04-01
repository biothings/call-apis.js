/**
 * @jest-environment node
 */

import BaseQueryBuilder from "../../src/builder/base_query_builder";
import APIQueryQueue from "../../src/query_queue";

describe("Test Query Queue module", () => {
  describe("Test getNext function", () => {
    test("Test getNext function", async () => {
      // @ts-expect-error don't need full redisClient, just that it's disabled
      const queue = new APIQueryQueue([], { clientEnabled: false });
      queue.queue = [
        {
          APIEdge: {
            association: {
              api_name: "1",
            },
            query_operation: {
              server: "1",
            },
          },
        },
        {
          APIEdge: {
            association: {
              api_name: "2",
            },
            query_operation: {
              server: "2",
            },
          },
        },
      ] as unknown as BaseQueryBuilder[];
      const next = await queue.getNext();
      expect(next.APIEdge.association.api_name).toEqual("2");
    });

    test("Test getNext function if queue is empty", () => {
      const queue = new APIQueryQueue([]);
      queue.queue = [];
      queue.getNext();
      expect(queue.queue).toEqual([]);
    });
  });

  describe("Test add function", () => {
    test("Adding one item", () => {
      const queue = new APIQueryQueue([]);
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.add(query);
      expect(queue.queue).toHaveLength(1);
    });

    test("Adding multiple items", () => {
      const queue = new APIQueryQueue([]);
      // @ts-expect-error partial data to test specific functionality
      queue.add([1, 2, 3]);
      expect(queue.queue).toHaveLength(3);
    });
  });
});
