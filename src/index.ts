import { LogEntry, StampedLog, RedisClient } from "@biothings-explorer/utils";
import { APIEdge, QueryHandlerOptions, UnavailableAPITracker } from "./types";
import Debug from "debug";
const debug = Debug("bte:call-apis:query");
import queryBuilder from "./builder/builder_factory";
import TRAPIQueryBuilder from "./builder/trapi_query_builder";
import SubQueryDispatcher from "./dispatcher";
import {
  NodeNormalizerResultObj,
  Record,
} from "@biothings-explorer/api-response-transform";
import {
  ResolverOutput,
  SRIResolverOutput,
  generateInvalidBioentities,
  getAttributes,
  resolveSRI,
  ResolvableBioEntity,
} from "biomedical_id_resolver";

export * from "./types";

export interface CuriesBySemanticType {
  [semanticType: string]: string[];
}

export default class APIQueryDispatcher {
  APIEdges: APIEdge[];
  logs: StampedLog[];
  options: QueryHandlerOptions;
  redisClient: RedisClient;
  constructor(
    APIEdges: APIEdge[],
    options: QueryHandlerOptions = {},
    redisClient?: RedisClient,
  ) {
    this.APIEdges = APIEdges;
    this.logs = [];
    this.options = options;
    this.redisClient = redisClient;
  }

  _constructQueries(APIEdges: APIEdge[]) {
    return APIEdges.map(edge => {
      const built = queryBuilder(edge);
      if (built instanceof TRAPIQueryBuilder) {
        built.addSubmitter?.(this.options.submitter);
      }
      return built;
    });
  }

  _groupCuriesBySemanticType(records: Record[]): CuriesBySemanticType {
    const curies: { [semanticType: string]: Set<string> | string[] } = {};
    records.map(record => {
      if (record && record.association) {
        // INPUTS
        const inputType = record.association.input_type;
        if (!(inputType in curies)) {
          curies[inputType] = new Set();
        }
        (curies[inputType] as Set<string>).add(record.subject.original);
        // OUTPUTS
        const outputType = record.association.output_type;
        if (!(outputType in curies)) {
          curies[outputType] = new Set();
        }
        (curies[outputType] as Set<string>).add(record.object.original);
      }
    });
    Object.entries(curies).forEach(([semanticType, curiesOfType]) => {
      // remove undefined curies
      const goodCuries = [...curiesOfType].filter(id => id !== undefined);
      curies[semanticType] = goodCuries;
    });
    return curies as CuriesBySemanticType;
  }
  /**
   * Add equivalent ids to all entities using biomedical-id-resolver service
   */
  async _annotate(
    records: Record[],
    resolveOutputIDs = true,
  ): Promise<Record[]> {
    const groupedCuries = this._groupCuriesBySemanticType(records);
    let res: SRIResolverOutput | ResolverOutput;
    let attributes: unknown;
    if (resolveOutputIDs === false) {
      res = generateInvalidBioentities(groupedCuries);
    } else {
      res = await resolveSRI(groupedCuries);
      attributes = await getAttributes(groupedCuries);
    }
    records.map(record => {
      if (record && record !== undefined) {
        record.object.normalizedInfo = res[
          record.object.original
        ] as NodeNormalizerResultObj;
        record.subject.normalizedInfo = res[
          record.subject.original
        ] as NodeNormalizerResultObj;
      }
      // add attributes
      if (
        attributes &&
        record &&
        Object.hasOwnProperty.call(attributes, record.subject.original)
      ) {
        if (record instanceof ResolvableBioEntity) {
          record.subject.normalizedInfo.attributes =
            attributes[record.subject.original];
        }
      }
      if (
        attributes &&
        record &&
        Object.hasOwnProperty.call(attributes, record.object.original)
      ) {
        if (record instanceof ResolvableBioEntity) {
          record.object.normalizedInfo.attributes =
            attributes[record.object.original];
        }
      }
    });
    return records;
  }

  async query(
    resolveOutputIDs = true,
    unavailableAPIs: UnavailableAPITracker = {},
  ): Promise<Record[]> {
    // Used for temporarily storing a message to log via both debug and TRAPI logs
    let message: string;
    message = `Resolving ID feature is turned ${resolveOutputIDs ? "on" : "off"
      }`;
    debug(message);
    this.logs.push(new LogEntry("DEBUG", null, message).getLog());
    message = [
      `call-apis: ${this.APIEdges.length}`,
      `planned queries for edge`,
      `${this.APIEdges[0].reasoner_edge?.id}`,
    ].join(" ");
    debug(message);
    this.logs.push(new LogEntry("DEBUG", null, message).getLog());
    const queries = this._constructQueries(this.APIEdges);
    const startTime = performance.now();
    const subQueryDispatcher = new SubQueryDispatcher(
      queries,
      this.redisClient,
      unavailableAPIs,
      this.options,
    );
    const { records, logs } = await subQueryDispatcher.execute();
    this.logs.push(...logs);
    // Occurs when globalMaxRecords hit, requiring query termination
    if (!records) return undefined;

    const finishTime = performance.now();
    const timeElapsed = Math.round(
      finishTime - startTime > 1000
        ? (finishTime - startTime) / 1000
        : finishTime - startTime,
    );
    const timeUnits = finishTime - startTime > 1000 ? "s" : "ms";

    debug("query completes.");
    message = `Total number of records returned for this qEdge is ${records.length}`;
    debug(message);
    this.logs.push(new LogEntry("DEBUG", null, message).getLog());

    debug("Start to use id resolver module to annotate output ids.");
    const annotatedRecords = await this._annotate(records, resolveOutputIDs);
    debug("id annotation completes");
    debug(`qEdge queries complete in ${timeElapsed}${timeUnits}`);
    this.logs.push(
      new LogEntry(
        "DEBUG",
        null,
        `call-apis: qEdge queries complete in ${timeElapsed}${timeUnits}`,
      ).getLog(),
    );

    return annotatedRecords; // TODO: additional stuff like annotation
  }
}
