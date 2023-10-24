import BaseQueryBuilder from "./builder/base_query_builder";
import QueryBucket from "./query_bucket";

export default class APIQueryQueue {
  queue: QueryBucket[];
  queries: BaseQueryBuilder[];
  constructor(queries: BaseQueryBuilder[]) {
    this.queue = [];
    this.queries = queries;
  }

  dequeue(): void {
    this.queue.shift();
  }

  addQuery(query: BaseQueryBuilder): void {
    for (const bucket of this.queue) {
      if (bucket.canBeAdded(query.getUrl())) {
        bucket.add(query);
        return;
      }
    }
    const newBucket = new QueryBucket();
    newBucket.add(query);
    this.queue.push(newBucket);
  }

  constructQueue(queries: BaseQueryBuilder[]): void {
    queries.map(query => this.addQuery(query));
  }
}
