import _ from "lodash";
import * as Sentry from "@sentry/node";
import { TrapiLog } from "./types";

export interface StampedLog extends TrapiLog {
  data: any;
  toJSON(): TrapiLog;
}

export enum SentryLogSeverity {
  ERROR = "error",
  WARNING = "warning",
  INFO = "info",
  DEBUG = "debug",
}

export default class LogEntry {
  level: string;
  message: string;
  code: string;
  data: any;
  constructor(level = "DEBUG", code: string | null = null, message: string = null, data: any = null) {
    this.level = level;
    this.message = message;
    this.code = code;
    this.data = data;
  }

  getLog(): StampedLog {
    const log = {
      timestamp: new Date().toISOString(),
      level: this.level,
      message: this.message,
      code: this.code,
    };
    if (global.job) {
      global.job.log(JSON.stringify(log, undefined, 2));
    }
    Sentry.addBreadcrumb({
      category: "log",
      message: this.message,
      level: SentryLogSeverity[this.level.toLowerCase()],
    });
    return {
      ...log,
      data: this.data,
      toJSON() {
        return _.omit(this, ["data", "toJSON"]) as StampedLog;
      },
    };
  }
}
