module.exports = {
  slice: () => {
    return (val, render) => {
      const split = val.split(";");
      if (split.length < 2) {
        return val;
      }
      const str = split[0];
      const begin = split[1] === '' ? 0 : split[1];
      const end = split[2] === '' ? str.length : split[2];
      return render(str).slice(begin, end);
    };
  },
  rmPrefix: () => {
    return (val, render) => {
      const split = render(val).split(":");
      if (split.length < 2) {
        return val;
      }
      return split[1];
    };
  },
  replPrefix: () => {
    return (val, render) => {
      const split = val.split(";");
      if (split.length < 2) {
        return render(val);
      }
      const strSplit = render(split[0]).split(":");
      const newPrefix = render(split[1]);
      return strSplit.length > 1 ? newPrefix + ":" + strSplit[1] : newPrefix + ":" + strSplit[0]
    };
  },

}
