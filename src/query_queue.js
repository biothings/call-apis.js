const QueryBucket = require("./query_bucket");

module.exports = class APIQueryQueue {
    constructor(queries) {
        this.queue = [];
        this.queries = queries;
    }

    dequeue() {
        this.queue.shift();
    }

    addQuery(query) {
        for (let bucket of this.queue) {
            if (bucket.canBeAdded(query.getUrl())) {
                bucket.add(query);
                return;
            }
        }
        const newBucket = new QueryBucket();
        newBucket.add(query);
        this.queue.push(newBucket);
    }

    constructQueue(queries) {
        queries.map(query => this.addQuery(query));
    }
}