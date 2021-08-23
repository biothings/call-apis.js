/**
 * Basic function to use with templating
 * Each function is wrapped around whatever's being edited, e.g. {{#func}}stuff{{/func}}
 * Functions can be wrapped around tags which are expecting input from a list
 * e.g. {{#list}}{{#func}}{{.}}{{/func}}{{/list}}
 * Functions which take arguments take them in the following format, using ; to delimit
 * {{#func}}someString;arg1;arg2{{/func}}
 */
module.exports = {
  /** Slice a string.
   * Args:
   *    str: the string to be sliced
   *    begin: the start of the slice, if ommited defaults to 0
   *    end: the end of the slice, if ommited defaults to end of the str
   */
  slice: () => {
    return (val, render) => {
      const split = val.split(";");
      if (split.length < 2) {
        return val;
      }
      const str = split[0];
      const begin = split[1] === "" ? 0 : split[1];
      const end = split[2] === "" ? str.length : split[2];
      return render(str).slice(begin, end);
    };
  },
  /** Remove a prefix.
   *  Args:
   *    str: string to remove the prefix from
   *  Assumes the delimiter between prefix:string is ':'.
   */
  rmPrefix: () => {
    return (val, render) => {
      const split = render(val).split(":");
      if (split.length < 2) {
        return val;
      }
      return split[1];
    };
  },
  /** Replace a prefix
   *  Args:
   *    str: string to remove the prefix from
   *    newPrefix: the new prefix
   *  Assumes the delimiter between prefix:string is ':'.
   */
  replPrefix: () => {
    return (val, render) => {
      const split = val.split(";");
      if (split.length < 2) {
        return render(val);
      }
      const strSplit = render(split[0]).split(":");
      const newPrefix = render(split[1]);
      return strSplit.length > 1 ? newPrefix + ":" + strSplit[1] : newPrefix + ":" + strSplit[0];
    };
  },
};
