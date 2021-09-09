/**
 * Additional filter functions for use in constructing API calls
 * New functions may be defined and added to templateFuncs
 * Functions need only work on single-string inputs -- they are automatically
 * mapped if being applied to an array of inputs.
 */
const mappableStringTemplateFuncs = {}; // defined on str, can be mapped to array
const arrayOnlyTemplateFuncs = {}; // defined on array

mappableStringTemplateFuncs.substr = (input, begin, end) => {
  begin = begin || 0;
  end = end || input.length;
  return input.slice(begin, end);
};
mappableStringTemplateFuncs.addPrefix = (input, prefix, delim) => {
  prefix = prefix || "";
  delim = delim || ":";
  return prefix.length !== 0 ? prefix + delim + input : input;
};
mappableStringTemplateFuncs.rmPrefix = (input, delim) => {
  delim = delim || ":";
  split = input.split(delim);
  return split.length < 2 ? input : split[1];
};
mappableStringTemplateFuncs.replPrefix = (input, prefix, delim) => {
  return mappableStringTemplateFuncs.addPrefix(mappableStringTemplateFuncs.rmPrefix(input, delim), prefix, delim);
};

arrayOnlyTemplateFuncs.joinSafe = (input, delim) => {
  return Array.isArray(input) ? input.join(delim) : input;
};

const mapIfNeeded = func => {
  return (...args) => {
    const input = args.shift();
    if (typeof input === "undefined") {
      return undefined;
    } else if (Array.isArray(input)) {
      return input.map(item => func(item, ...args));
    } else {
      return func(input, ...args);
    }
  };
};

module.exports = env => {
  Object.keys(mappableStringTemplateFuncs).forEach(key => {
    env.addFilter(key, mapIfNeeded(mappableStringTemplateFuncs[key]));
  });
  Object.keys(arrayOnlyTemplateFuncs).forEach(key => {
    env.addFilter(key, arrayOnlyTemplateFuncs[key])
  })
};
