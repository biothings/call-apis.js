import { Record } from "@biothings-explorer/types";
import Subquery from "./queries/subquery";
import APIQueryPool from "./query_pool";
import APIQueryQueue from "./query_queue";
import { SerializableLog, cacheContent } from "@biothings-explorer/utils";
import Debug from "debug";
import { ResolvableBioEntity, ResolverOutput, SRIBioEntity, SRIResolverOutput, generateInvalidBioentities, getAttributes, resolveSRI } from "biomedical_id_resolver";
import { QueryHandlerOptions } from "@biothings-explorer/types";
const debug = Debug("bte:call-apis:query");

export interface CuriesBySemanticType {
  [semanticType: string]: string[];
}

interface ExecutionData {
  hash: string;
  records: Record[];
  logs: SerializableLog[];
  apiUnavailable: boolean;
}

export default class SubQueryDispatcher {
  queue: APIQueryQueue;
  pool: APIQueryPool;
  currentlyDispatched: number;
  complete: (value: unknown) => void;
  subscribers: {
    [subqueryHash: string]: (
      hash: string,
      records: Record[],
      logs: SerializableLog[],
      apiUnavailable: boolean,
    ) => void;
  };
  awaitingFollowUp: {
    [subqueryHash: string]: {
      originalHash: string;
      records: Record[];
      logs: SerializableLog[];
      apiUnavailable: boolean;
    };
  };
  constructor() {
    this.queue = new APIQueryQueue();
    this.pool = new APIQueryPool();
    this.currentlyDispatched = 0;
    this.subscribers = {};
    this.awaitingFollowUp = {};
  }

  async execute(query: Subquery, options: QueryHandlerOptions): Promise<ExecutionData> {
    this.queue.add(query, options);
    const promise = new Promise<ExecutionData>(resolve => {
      this.subscribers[query.hash] = (hash, records, logs, apiUnavailable) =>
        // Need original hash given by executor, as query hash changes when page-scrolling
        resolve({ hash, records, logs, apiUnavailable });
    });

    if (this.currentlyDispatched < this.pool.size) {
      await this.queryPool();
    }

    return promise;
  }

  async queryPool(): Promise<void> {
    const next = await this.queue.getNext();
    if (!next) return;
    const { query, options } = next;

    this.currentlyDispatched += 1;
    void this.pool.query(
      query,
      options,
      async ({ logs, records, fromCache, followUp, apiUnavailable }) => {
        await this.onQueryComplete(
          query.hash,
          logs,
          options,
          records,
          fromCache,
          apiUnavailable,
          followUp,
        );
      },
    );
  }

  async onQueryComplete(
    hash: string,
    logs: SerializableLog[],
    options: QueryHandlerOptions,
    records?: Record[],
    fromCache?: boolean,
    apiUnavailable?: boolean,
    followUp?: Subquery,
  ): Promise<void> {
    if (!records) {
      records = [];
    }
    this.currentlyDispatched -= 1;
    let originalHash = hash;

    // Check if this query is a follow-up to a previous query
    // If so, collect the previous for response or new storage
    const previous = this.awaitingFollowUp[hash];
    if (previous) {
      records.push(...previous.records);
      logs.push(...previous.logs);
      originalHash = previous.originalHash;
      delete this.awaitingFollowUp[hash];
    }
    // If there's a follow-up query, store results for when it's done
    if (followUp) {
      this.awaitingFollowUp[followUp.hash] = {
        originalHash: originalHash,
        records,
        logs,
        apiUnavailable,
      };
      this.queue.add(followUp, options);
    }

    if (!followUp) {
      // Update subscriber and remove it
      const callback = this.subscribers[originalHash];
      delete this.subscribers[originalHash];

      if (!fromCache) {
        debug("Start to use id resolver module to annotate output ids.");
        records = await this.annotate(records, options.resolveOutputIDs);
        debug("id annotation completes");
      }

      callback(originalHash, records, logs, apiUnavailable);

      // Cache for future use
      if (!fromCache && (options.caching ?? true) && records.length > 0) {
        await this.cacheQuery(originalHash, records);
      }
    }
    if (this.currentlyDispatched < this.pool.size) {
      await this.queryPool();
    }
  }

  groupCuriesBySemanticType(records: Record[]): CuriesBySemanticType {
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
  async annotate(
    records: Record[],
    resolveOutputIDs = true,
  ): Promise<Record[]> {
    const groupedCuries = this.groupCuriesBySemanticType(records);
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
        ] as SRIBioEntity;
        record.subject.normalizedInfo = res[
          record.subject.original
        ] as SRIBioEntity;
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
  
  async cacheQuery(hash: string, records: Record[]): Promise<void> {
    debug(`Caching ${records.length} records for subquery ${hash}`);
    const recordPack = Record.packRecords(records);
    await cacheContent(hash, recordPack);
  }
}
