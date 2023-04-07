const _ = require("lodash");

module.exports = class LogEntry {
  constructor(level = "DEBUG", code = null, message = null, data = null) {
    this.level = level;
    this.message = message;
    this.code = code;
    this.data = data;
  }

  getLog() {
    const log = {
      timestamp: new Date().toISOString(),
      level: this.level,
      message: this.message,
      code: this.code,
    }
    if (global.job) {
      global.job.log(JSON.stringify(log, undefined, 2));
    }
    return {
      ...log,
      data: this.data,
      toJSON() {
        return _.omit(this, ["data", "toJSON"]);
      },
    };
  }
};
