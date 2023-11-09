import QueryBuilder from "./query_builder";
import TRAPIQueryBuilder from "./trapi_query_builder";
import TemplateQueryBuilder from "./template_query_builder";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import type { APIEdge } from "../types";

function builderFactory(
  APIEdge: APIEdge,
): TRAPIQueryBuilder | TemplateQueryBuilder | QueryBuilder {
  if ("tags" in APIEdge && APIEdge.tags.includes("bte-trapi")) {
    debug(`using trapi builder now`);
    return new TRAPIQueryBuilder(APIEdge);
  } else if (APIEdge.query_operation.useTemplating) {
    debug("using template builder");
    return new TemplateQueryBuilder(APIEdge);
  }
  debug("using default builder");
  return new QueryBuilder(APIEdge);
}

export default builderFactory;
