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
})