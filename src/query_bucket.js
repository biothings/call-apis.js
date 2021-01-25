module.exports = class QueryBucket {
    constructor() {
        this.cnt = {};
        this.bucket = [];
        this.MAX_CONCURRENT_API_QUERIES = 3
    }

    canBeAdded(url) {
        if (!(url in this.cnt) || this.cnt[url] < this.MAX_CONCURRENT_API_QUERIES) {
            return true;
        }
        return false;
    }

    add(query) {
        if (!(query.getUrl() in this.cnt)) {
            this.cnt[query.getUrl()] = 0;
        }
        this.cnt[query.getUrl()] += 1;
        this.bucket.push(query);
    }

    getBucket() {
        return this.bucket;
    }

}