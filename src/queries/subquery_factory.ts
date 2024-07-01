import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import TrapiSubquery from "./trapi_subquery";
import TemplateSubquery from "./template_subquery";
import Subquery from "./subquery";
import { APIEdge, QueryHandlerOptions } from "@biothings-explorer/types";

function subqueryFactory(
  apiEdge: APIEdge,
  options: QueryHandlerOptions
): Subquery {
  if ("tags" in apiEdge && apiEdge.tags.includes("bte-trapi")) {
    debug(`using trapi builder now`);
    return new TrapiSubquery(apiEdge, options);
  } else if (apiEdge.query_operation.useTemplating) {
    debug("using template builder");
    return new TemplateSubquery(apiEdge, options);
  }
  debug("using default builder");
  return new Subquery(apiEdge, options);
}

export default subqueryFactory;