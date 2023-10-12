import BaseQueryBuilder from "./builder/base_query_builder";

export default class QueryBucket {
  count: {
    [queryURL: string]: number;
  };
  bucket: BaseQueryBuilder[];
  MAX_CONCURRENT_API_QUERIES: number;
  constructor() {
    this.count = {};
    this.bucket = [];
    this.MAX_CONCURRENT_API_QUERIES = 3;
  }

  canBeAdded(url: string): boolean {
    if (!(url in this.count) || this.count[url] < this.MAX_CONCURRENT_API_QUERIES) {
      return true;
    }
    return false;
  }

  add(query: BaseQueryBuilder): void {
    if (!(query.getUrl() in this.count)) {
      this.count[query.getUrl()] = 0;
    }
    this.count[query.getUrl()] += 1;
    this.bucket.push(query);
  }

  getBucket(): BaseQueryBuilder[] {
    return this.bucket;
  }
}
