/**
 * @jest-environment node
 */

import QueryBucket from "../../src/query_bucket";

describe("test query bucket class", () => {
  describe("test canBeAdded function", () => {
    test("test return true if item to be added is not in counter yet", () => {
      const bucket = new QueryBucket();
      const res = bucket.canBeAdded("k");
      expect(res).toBe(true);
    });

    test("test return true if item to be added has not reached max count yet", () => {
      const bucket = new QueryBucket();
      bucket.count = { k: bucket.MAX_CONCURRENT_API_QUERIES - 1 };
      const res = bucket.canBeAdded("k");
      expect(res).toBe(true);
    });

    test("test return false if item to be added has reached max count yet", () => {
      const bucket = new QueryBucket();
      bucket.count = { k: bucket.MAX_CONCURRENT_API_QUERIES };
      const res = bucket.canBeAdded("k");
      expect(res).toBe(false);
    });

    test("test return false if item to be added has exceeded max count yet", () => {
      const bucket = new QueryBucket();
      bucket.count = { k: bucket.MAX_CONCURRENT_API_QUERIES + 1 };
      const res = bucket.canBeAdded("k");
      expect(res).toBe(false);
    });
  });

  describe("test add function", () => {
    test("test if query has not been in the bucket before", () => {
      const bucket = new QueryBucket();
      const query = {
        getUrl() {
          return "hello";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      bucket.add(query);
      expect(bucket.count.hello).toEqual(1);
      expect(bucket.bucket).toHaveLength(1);
    });

    test("test if query has not been in the bucket before", () => {
      const bucket = new QueryBucket();
      const query = {
        getUrl() {
          return "hello";
        },
      };
      const query1 = {
        getUrl() {
          return "kitty";
        },
      };
      // @ts-expect-error partial data to test specific functionality
      bucket.add(query);
      // @ts-expect-error partial data to test specific functionality
      bucket.add(query);
      // @ts-expect-error partial data to test specific functionality
      bucket.add(query1);
      expect(bucket.count.hello).toEqual(2);
      expect(bucket.count.kitty).toEqual(1);
      expect(bucket.bucket).toHaveLength(3);
    });
  });

  describe("test getBucket function", () => {
    test("test getBucket function", () => {
      const bucket = new QueryBucket();
      // @ts-expect-error partial data to test specific functionality
      bucket.bucket = [1];
      expect(bucket.getBucket()).toEqual([1]);
    });
  });
});
