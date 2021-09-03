/**
 * Additional filter functions for use in constructing API calls
 * New functions may be defined and added to templateFuncs
 * Functions need only work on single-string inputs -- they are automatically
 * mapped if being applied to an array of inputs.
 */
const templateFuncs = {}; // storage for all funcs, when defining new add here

templateFuncs.substr = (input, begin, end) => {
  begin = begin || 0;
  end = end || input.length;
  return input.slice(begin, end);
};
templateFuncs.addPrefix = (input, prefix, delim) => {
  prefix = prefix || "";
  delim = delim || ":";
  return prefix.length !== 0 ? prefix + delim + input : input;
};
templateFuncs.rmPrefix = (input, delim) => {
  delim = delim || ":";
  split = input.split(delim);
  return split.length < 2 ? input : split[1];
};
templateFuncs.replPrefix = (input, prefix, delim) => {
  return templateFuncs.addPrefix(templateFuncs.rmPrefix(input, delim), prefix, delim);
};

const mapIfNeeded = (func) => {
  return (...args) => {
    const input = args.shift()
    if (typeof input === "undefined") {
      return undefined;
    } else if (Array.isArray(input)) {
      return input.map((item) => func(item, ...args));
    } else {
      return func(input, ...args);
    }
  };
};

module.exports = env => {
  Object.keys(templateFuncs).forEach(key => {
    env.addFilter(key, mapIfNeeded(templateFuncs[key]));
  });
};
