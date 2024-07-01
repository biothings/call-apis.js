import { SmartAPIKGOperationObject } from "@biothings-explorer/smartapi-kg";
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