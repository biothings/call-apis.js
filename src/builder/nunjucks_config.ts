/**
 * Additional filter functions for use in constructing API calls
 * New functions may be defined and added to templateFuncs
 * Functions need only work on single-string inputs -- they are automatically
 * mapped if being applied to an array of inputs.
 */
import { Environment } from "nunjucks";

// defined on str, can be mapped to array
const mappableStringTemplateFuncs = {
  substr: function (input: string, begin?: number, end?: number): string {
    begin = begin ?? 0;
    end = end ?? input.length;
    return input.slice(begin, end);
  },
  addPrefix: function (input: string, prefix?: string, delim?: string) {
    prefix = prefix ?? "";
    delim = delim ?? ":";
    return prefix.length !== 0 ? prefix + delim + input : input;
  },
  rmPrefix: function (input: string, delim?: string) {
    delim = delim ?? ":";
    const split = input.split(delim);
    return split.length < 2 ? input : split[1];
  },
  replPrefix: function (input: string, prefix?: string, delim?: string) {
    return mappableStringTemplateFuncs.addPrefix(
      mappableStringTemplateFuncs.rmPrefix(input, delim),
      prefix,
      delim,
    );
  },
  wrap: function (input: unknown, start: unknown, end?: unknown) {
    if (typeof start === "undefined") {
      return input;
    }
    end = end ?? start;
    return String(start) + String(input) + String(end);
  },
};

// defined on array
const arrayOnlyTemplateFuncs = {
  joinSafe: function (input: string | string[], delim?: string) {
    return Array.isArray(input) ? input.join(delim) : input;
  },
};

function mapIfNeeded<
  F extends (...args: (string | string[] | undefined)[]) => string | string[],
>(func: F) {
  return (...args: Parameters<F>) => {
    const input = args.shift();
    if (typeof input === "undefined") {
      return undefined;
    } else if (Array.isArray(input)) {
      return input.map(item => func(item, ...args)) as string[];
    } else {
      return func(input, ...args) as string;
    }
  };
}

export default function nunJucksConfig(env: Environment): void {
  Object.keys(mappableStringTemplateFuncs).forEach(key => {
    env.addFilter(key, mapIfNeeded(mappableStringTemplateFuncs[key]));
  });
  Object.keys(arrayOnlyTemplateFuncs).forEach(key => {
    env.addFilter(key, arrayOnlyTemplateFuncs[key]);
  });
}
