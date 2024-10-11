import { SmartAPIKGOperationObject } from "@biothings-explorer/smartapi-kg";
import { Record } from "@biothings-explorer/api-response-transform";
import { StampedLog } from "@biothings-explorer/utils";
import { SRIBioEntity } from "biomedical_id_resolver";
import { TrapiQualifierConstraint } from "@biothings-explorer/types";

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

export interface UnavailableAPITracker {
  [server: string]: { skip: boolean; skippedQueries: number };
}
