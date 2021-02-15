/**
 * @jest-environment node
 */

const qb = require("../src/query_bucket");

describe("test query bucket class", () => {

    describe("test canBeAdded function", () => {
        test("test return true if item to be added is not in counter yet", () => {
            const bucket = new qb();
            const res = bucket.canBeAdded('k');
            expect(res).toBe(true)
        });

        test("test return true if item to be added has not reached max cnt yet", () => {
            const bucket = new qb();
            bucket.cnt = { "k": bucket.MAX_CONCURRENT_API_QUERIES - 1 }
            const res = bucket.canBeAdded('k');
            expect(res).toBe(true);
        });

        test("test return false if item to be added has reached max cnt yet", () => {
            const bucket = new qb();
            bucket.cnt = { "k": bucket.MAX_CONCURRENT_API_QUERIES }
            const res = bucket.canBeAdded('k');
            expect(res).toBe(false);
        });

        test("test return false if item to be added has exceeded max cnt yet", () => {
            const bucket = new qb();
            bucket.cnt = { "k": bucket.MAX_CONCURRENT_API_QUERIES + 1 }
            const res = bucket.canBeAdded('k');
            expect(res).toBe(false);
        });
    })

    describe("test add function", () => {
        test("test if query has not been in the bucket before", () => {
            const bucket = new qb();
            const query = {
                getUrl() {
                    return "hello";
                }
            }
            bucket.add(query);
            expect(bucket.cnt.hello).toEqual(1);
            expect(bucket.bucket).toHaveLength(1);
        })

        test("test if query has not been in the bucket before", () => {
            const bucket = new qb();
            const query = {
                getUrl() {
                    return "hello";
                }
            }
            const query1 = {
                getUrl() {
                    return "kitty"
                }
            }
            bucket.add(query);
            bucket.add(query);
            bucket.add(query1);
            expect(bucket.cnt.hello).toEqual(2);
            expect(bucket.cnt.kitty).toEqual(1);
            expect(bucket.bucket).toHaveLength(3);
        })
    })

    describe("test getBucket function", () => {
        test("test getBucket function", () => {
            const bucket = new qb();
            bucket.bucket = [1];
            expect(bucket.getBucket()).toEqual([1]);
        })
    })
})