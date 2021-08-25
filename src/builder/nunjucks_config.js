const templateFuncs = {};
templateFuncs.substr = (str, begin, end) => {
    begin = begin || 0;
    end = end || str.length;
    return str.slice(begin, end);
  },
templateFuncs.addPrefix = (str, prefix, delim) => {
  prefix = prefix || "";
  delim = delim || ":";
  return prefix.length !== 0 ? prefix + delim + str : str;
},
templateFuncs.rmPrefix = (str, delim) => {
  delim = delim || ":";
  split = str.split(delim);
  return split.length < 2 ? str : split[1];
},

templateFuncs.replPrefix = (str, prefix, delim) => {
  return templateFuncs.addPrefix(templateFuncs.rmPrefix(str, delim), prefix, delim);
},

module.exports = env => {
  Object.keys(templateFuncs).forEach((key) => {env.addFilter(key, templateFuncs[key])});
  // env.addFilter("substr", templateFuncs.substr);
  // env.addFilter("addPrefix", templateFuncs.addPrefix);
  // env.addFilter("rmPrefix", templateFuncs.rmPrefix);
  // env.addFilter("replPrefix", templateFuncs.replPrefix);
};
