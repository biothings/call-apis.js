import nunjucks from "nunjucks";
import nunjucksConfig from "../../src/builder/nunjucks_config";
const env = nunjucks.configure({ autoescape: false });
nunjucksConfig(env);

describe("test templateFuncs", () => {
  test("substr behavior", () => {
    const str = "abcdefghi";
    function run(str: string, begin?: number, end?: number): string {
      return nunjucks.renderString(`{{ test | substr(${begin}, ${end}) }}`, { test: str });
    }
    let res: string;
    res = run(str);
    expect(res).toEqual(str);
    res = run(str, 1);
    expect(res).toEqual(str.slice(1));
    res = run(str, 3, 6);
    expect(res).toEqual(str.slice(3, 6));
    res = run(str, 0, -3);
    expect(res).toEqual(str.slice(0, -3));
  });

  test("addPrefix behavior", () => {
    const has = "PREFIX:usefulid";
    const hasnot = "usefulid";
    function run(str: string, prefix?: string, delim?: string): string {
      prefix = typeof prefix === "undefined" ? undefined : `"${prefix}"`;
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | addPrefix(${prefix}, ${delim}) }}`, { test: str });
    }
    let res: string;
    res = run(hasnot, "PREFIX");
    expect(res).toEqual(has);
    res = run(hasnot, "PREFIX", "-");
    expect(res).toEqual("PREFIX-" + hasnot);
  });

  test("rmPrefix behavior", () => {
    const has = "PREFIX:usefulid";
    const hasnot = "usefulid";
    function run(str: string, delim?: string) {
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | rmPrefix(${delim}) }}`, { test: str });
    }
    let res: string;
    res = run(has);
    expect(res).toEqual(hasnot);
    res = run(has, "-");
    expect(res).toEqual(has);
    res = run(hasnot);
    expect(res).toEqual(hasnot);
  });

  test("replPrefix behavior", () => {
    const has = "PREFIX:usefulid";
    const hasnot = "usefulid";
    function run(str: string, prefix?: string, delim?: string) {
      prefix = typeof prefix === "undefined" ? undefined : `"${prefix}"`;
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | replPrefix(${prefix}, ${delim}) }}`, { test: str });
    }
    let res: string;
    res = run(has, "NEWFIX");
    expect(res).toEqual("NEWFIX:" + hasnot);
    res = run(hasnot, "NEWFIX");
    expect(res).toEqual("NEWFIX:" + hasnot);
    res = run(has);
    expect(res).toEqual(hasnot);
    res = run(has, "NEWFIX", "-");
    expect(res).toEqual("NEWFIX-PREFIX:" + hasnot);
  });

  test("array usage", () => {
    const has = ["PREFIX:id0", "PREFIX:id1", "PREFIX:id2"];
    let res: string;
    function run1(str: string[], delim?: string, prefix?: string) {
      prefix = typeof prefix === "undefined" ? undefined : `"${prefix}"`;
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | rmPrefix(${prefix}, ${delim}) | join(",") }}`, { test: str });
    }
    res = run1(has);
    expect(res).toEqual("id0,id1,id2");
    function run2(str: string[], prefix?: string, delim?: string): string {
      prefix = typeof prefix === "undefined" ? undefined : `"${prefix}"`;
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | addPrefix(${prefix}, ${delim}) | join(",") }}`, { test: str });
    }
    res = run2(has, "test", ":");
    expect(res).toEqual("test:PREFIX:id0,test:PREFIX:id1,test:PREFIX:id2");
    function run3(str: string[], prefix?: string, delim?: string) {
      prefix = typeof prefix === "undefined" ? undefined : `"${prefix}"`;
      delim = typeof delim === "undefined" ? undefined : `"${delim}"`;
      return nunjucks.renderString(`{{ test | replPrefix(${prefix}, ${delim}) | join(",") }}`, { test: str });
    }
    res = run3(has, "test");
    expect(res).toEqual("test:id0,test:id1,test:id2");
    function run4(str: string[], begin: number, end?: number) {
      return nunjucks.renderString(`{{ test | substr(${begin}, ${end}) }}`, { test: str });
    }
    res = run4(has, -3);
    expect(res).toEqual("id0,id1,id2");
  });
});
