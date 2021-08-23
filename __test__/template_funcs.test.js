const tf = require("../src/builder/template_funcs");
const mustache = require('mustache');

runner_factory = func => s => func()(s, r => r);

describe("test templateFuncs", () => {
  test("slice behavior", () => {
    const str = "abcdefghi";
    const runSlice = runner_factory(tf.slice);
    let res;
    res = runSlice(str);
    expect(res).toEqual(str);
    res = runSlice(str + ";");
    expect(res).toEqual(str);
    res = runSlice(str + ";;");
    expect(res).toEqual(str);
    res = runSlice(str + ";1");
    expect(res).toEqual(str.slice(1));
    res = runSlice(str + ";1;");
    expect(res).toEqual(str.slice(1));
    res = runSlice(str + ";;3");
    expect(res).toEqual(str.slice(0, 3));
    res = runSlice(str + ";3;6");
    expect(res).toEqual(str.slice(3, 6));
    res = runSlice(str + ";;-3");
    expect(res).toEqual(str.slice(0, -3));
  });

  test("rmPrefix behavior", () => {
    const has = "PREFIX:usefulid";
    const hasnot = "usefulid";
    const run = runner_factory(tf.rmPrefix);
    let res;
    res = run(has);
    expect(res).toEqual(hasnot);
    res = run(hasnot);
    expect(res).toEqual(hasnot);
  });

  test("replPrefix behavior", () => {
    const has = "PREFIX:usefulid";
    const hasnot = "usefulid";
    const run = runner_factory(tf.replPrefix);
    let res;
    res = run(has + ";NEWFIX");
    expect(res).toEqual("NEWFIX:" + hasnot);
    res = run(hasnot + ";NEWFIX");
    expect(res).toEqual("NEWFIX:" + hasnot)
    res = run(has);
    expect(res).toEqual(has);
  })

  test("basic applied usage", () => {
    const view = {
      ids: [123, 456, 789],
      ...tf
    }
    let template = "{{#ids}}{{#slice}}{{.}};0;2{{/slice}},{{/ids}}";
    let res = mustache.render(template, view);
    expect(res).toEqual("12,45,78,");

    view.ids = ["MONDO:test1", "MONDO:test2", "MONDO:test3"];
    template = "{{#ids}}{{#rmPrefix}}{{.}}{{/rmPrefix}},{{/ids}}"
    res = mustache.render(template, view);
    expect(res).toEqual("test1,test2,test3,")

    template = "{{#ids}}{{#replPrefix}}{{.}};UMLS{{/replPrefix}},{{/ids}}";
    res = mustache.render(template, view);
    expect(res).toEqual("UMLS:test1,UMLS:test2,UMLS:test3,");

  })
});
