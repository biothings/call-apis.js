/**
 * @jest-environment node
 */

import qq from "../../src/query_queue";
import qb from "../../src/query_bucket";

describe("Test Query Queue module", () => {
  describe("Test dequeue function", () => {
    test("Test dequeue function", () => {
      const queue = new qq([]);
      // @ts-expect-error testing functionality that doesn't require QueryBucket
      queue.queue = [1, 2];
      queue.dequeue();
      expect(queue.queue).toEqual([2]);
    });

    test("Test dequeue function if queue is empty", () => {
      const queue = new qq([]);
      queue.queue = [];
      queue.dequeue();
      expect(queue.queue).toEqual([]);
    });
  });

  describe("Test addQuery function", () => {
    test("Create a new bucket with the query when queue is empty", () => {
      const queue = new qq([]);
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.addQuery(query);
      expect(queue.queue).toHaveLength(1);
      expect(queue.queue[0]).toBeInstanceOf(qb);
      expect(queue.queue[0].bucket).toHaveLength(1);
      expect(queue.queue[0].bucket[0]).toEqual(query);
    });

    test("Create a new bucket when query exceeds maximum in a bucket", () => {
      const queue = new qq([]);
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.addQuery(query);
      expect(queue.queue).toHaveLength(1);
      // @ts-expect-error partial data to test specific functionality
      queue.addQuery(query);
      expect(queue.queue).toHaveLength(1);
      // @ts-expect-error partial data to test specific functionality
      queue.addQuery(query);
      expect(queue.queue).toHaveLength(1);
      // @ts-expect-error partial data to test specific functionality
      queue.addQuery(query);
      expect(queue.queue).toHaveLength(2);
      expect(queue.queue[1]).toBeInstanceOf(qb);
      expect(queue.queue[0].bucket).toHaveLength(3);
      expect(queue.queue[1].bucket).toHaveLength(1);
      expect(queue.queue[0].bucket[0]).toEqual(query);
    });
  });

  describe("Test constructQueue function", () => {
    test("Test with query size of 1", () => {
      const queue = new qq([]);
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.constructQueue([query]);
      expect(queue.queue).toHaveLength(1);
    });

    test("Test input with mixed queries", () => {
      const queue = new qq([]);
      const query1 = {
        getUrl() {
          return "hello";
        },
      };
      const query2 = {
        getUrl() {
          return "hello kitty";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      queue.constructQueue([query1, query2, query1, query1, query2, query1]);
      expect(queue.queue).toHaveLength(2);
      expect(queue.queue[0].bucket).toHaveLength(5);
      expect(queue.queue[1].bucket).toHaveLength(1);
    });
  });
});
