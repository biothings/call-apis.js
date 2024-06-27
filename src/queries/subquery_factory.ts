import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import type { APIEdge } from "../types";
import TrapiSubquery from "./trapi_subquery";
import TemplateSubquery from "./template_subquery";
import Subquery from "./subquery";
import { QueryHandlerOptions } from "@biothings-explorer/types";

function subqueryFactory(
  APIEdge: APIEdge,
  options: QueryHandlerOptions
): Subquery {
  if ("tags" in APIEdge && APIEdge.tags.includes("bte-trapi")) {
    debug(`using trapi builder now`);
    return new TrapiSubquery(APIEdge, options);
  } else if (APIEdge.query_operation.useTemplating) {
    debug("using template builder");
    return new TemplateSubquery(APIEdge, options);
  }
  debug("using default builder");
  return new Subquery(APIEdge, options);
}

export default subqueryFactory;