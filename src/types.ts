import { SmartAPIKGOperationObject } from "@biothings-explorer/smartapi-kg";
import { SmartAPISpec } from "@biothings-explorer/smartapi-kg";
import { Record } from "@biothings-explorer/api-response-transform";
import { StampedLog } from "@biothings-explorer/utils";
import { SRIBioEntity } from "biomedical_id_resolver";

/* TODO: most of these are temporarily pulled from other packages
 * Instead, they should be pulled out into a new package ('@biothings-explorer/types' or similar).
 * This would allow for greater flexibility in package structure/type importing
 */

export interface QueryParams {
  [paramName: string]: unknown;
}

export interface BiothingsResponse {
  total: number;
  hits: unknown[];
  max_total?: number;
}

export interface TrapiQNode {
  ids?: string[];
  categories?: string[];
  is_set?: boolean;
  constraints?: TrapiAttributeConstraint[];
}

export interface TrapiQEdge {
  knowledge_type?: string;
  predicates?: string[];
  subject: string;
  object: string;
  attribute_constraints?: TrapiAttributeConstraint[];
  qualifier_constraints?: TrapiQualifierConstraint[];
}

export interface TrapiQueryGraph {
  nodes: {
    [QNodeID: string]: TrapiQNode;
  };
  edges: {
    [QEdgeID: string]: TrapiQEdge;
  };
}

export interface TrapiSource {
  resource_id: string;
  resource_role: string;
  upstream_resource_ids?: string[];
}

export interface TrapiKGNodes {
  [nodeID: string]: TrapiKGNode;
}

export interface TrapiKGEdges {
  [edgeID: string]: TrapiKGEdge;
}

export interface TrapiKnowledgeGraph {
  nodes: TrapiKGNodes;
  edges: TrapiKGEdges;
}

export interface TrapiKGEdge {
  predicate: string;
  subject: string;
  object: string;
  attributes?: TrapiAttribute[];
  qualifiers?: TrapiQualifier[];
  sources: TrapiSource[];
}

export interface TrapiKGNode {
  categories: string[];
  name: string;
  attributes?: TrapiAttribute[];
}

export interface TrapiAttribute {
  attribute_type_id: string;
  original_attribute_name?: string;
  value: string | string[] | number | number[];
  value_type_id?: string;
  attribute_source?: string | null;
  value_url?: string | null;
  attributes?: TrapiAttribute;
  [additionalProperties: string]:
  | string
  | string[]
  | null
  | TrapiAttribute
  | number
  | number[];
}

export interface TrapiQualifier {
  qualifier_type_id: string;
  qualifier_value: string | string[];
}

export interface TrapiQualifierConstraint {
  qualifier_set: TrapiQualifier[];
}

export interface TrapiAttributeConstraint {
  id: string;
  name: string;
  not: boolean;
  operator: string;
  value: string | string[] | number | number[];
}

export interface TrapiNodeBinding {
  id: string;
  query_id?: string;
  attributes?: TrapiAttribute[];
}

export interface TrapiEdgeBinding {
  id: string;
  attributes?: TrapiAttribute[];
}

export interface TrapiAnalysis {
  resource_id?: string;
  score?: number;
  edge_bindings: {
    [qEdgeID: string]: TrapiEdgeBinding[];
  };
  support_graphs?: string[];
  scoring_method?: string;
  attributes?: TrapiAttribute[];
}

export interface TrapiAuxiliaryGraph {
  edges: string[];
  attributes?: TrapiAttribute[];
}

export interface TrapiPfocrFigure {
  figureUrl: string;
  pmc: string;
  matchedCuries: string[];
  score: number;
}

export interface TrapiResult {
  node_bindings: {
    [qNodeID: string]: TrapiNodeBinding[];
  };
  analyses: TrapiAnalysis[];
  pfocr?: TrapiPfocrFigure[];
}

export interface TrapiAuxGraphCollection {
  [supportGraphID: string]: TrapiAuxiliaryGraph;
}

export interface TrapiResponse {
  description?: string;
  schema_version?: string;
  biolink_version?: string;
  workflow?: { id: string }[];
  message: {
    query_graph: TrapiQueryGraph;
    knowledge_graph: TrapiKnowledgeGraph;
    auxiliary_graphs?: TrapiAuxGraphCollection;
    results: TrapiResult[];
  };
  logs: TrapiLog[];
}

export interface TrapiLog {
  timestamp: string;
  level: string;
  message: string;
  code: string;
}

export interface TrapiRequest {
  message: {
    query_graph: any;
  };
  submitter?: string;
}

export interface JSONDoc {
  [key1: string]: any;
  [key2: number]: any;
}

export interface TemplatedInput {
  queryInputs: string | string[];
  [additionalProperties: string]: string | string[];
}

export interface SRIResolvedSet {
  [originalCurie: string]: SRIBioEntity;
}

export interface ExpandedCuries {
  [originalCurie: string]: string[];
}

export interface QNode {
  id: string;
  categories: string[];
  equivalentIDs?: SRIResolvedSet;
  expandedCategories: string[];
  equivalentIDsUpdated: boolean;
  curie: string[];
  is_set: boolean;
  expanded_curie: ExpandedCuries;
  entity_count: number;
  held_curie: string[];
  held_expanded: ExpandedCuries;
  constraints: any; // TODO type
  connected_to: Set<string>;
}

export interface QEdge {
  id: string;
  predicate: string[];
  subject: QNode;
  object: QNode;
  expanded_predicates: string[];
  qualifier_constraints: TrapiQualifierConstraint[];
  reverse: boolean;
  executed: boolean;
  logs: StampedLog[];
  records: Record[];
  filter?: any;
  getQualifierConstraints: () => TrapiQualifierConstraint[];
}

export interface APIEdge extends SmartAPIKGOperationObject {
  reasoner_edge: QEdge;
  input: string | string[] | TemplatedInput;
  input_resolved_identifiers: {
    [curie: string]: unknown;
  };
  original_input: {
    [equivalentCurie: string]: string;
  };
}

export interface NonBatchAPIEdge extends APIEdge {
  input: string;
}

export interface BatchAPIEdge extends APIEdge {
  input: string[];
}

export interface TemplateNonBatchAPIEdge extends APIEdge {
  input: TemplatedInput;
}

export interface TemplateBatchAPIEdge extends APIEdge {
  input: TemplatedInput;
}

export type APIDefinition = {
  // Must have one of id or infores
  id?: string; // SmartAPI ID, takes priority over infores
  name: string; // Must match name on SmartAPI registry
  infores?: string; // infores of API
  primarySource?: boolean;
  timeout?: number;
} & ({ id: string } | { infores: string });

export interface APIList {
  include: APIDefinition[];
  // takes priority over include, taking into account id/infores prioritization
  exclude: APIDefinition[];
}

export interface QueryHandlerOptions {
  provenanceUsesServiceProvider?: boolean;
  smartAPIID?: string;
  teamName?: string;
  enableIDResolution?: boolean;
  // TODO: type instances of `any`
  apiList?: APIList;
  schema?: any; // might be hard to type -- it's the entire TRAPI schema IIRC
  dryrun?: boolean;
  resolveOutputIDs?: boolean;
  submitter?: string;
  caching?: boolean; // from request url query values
  EDGE_ATTRIBUTES_USED_IN_RECORD_HASH?: string[];
}

export interface UnavailableAPITracker {
  [server: string]: { skip: boolean; skippedQueries: number };
}
