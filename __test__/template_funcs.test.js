const tf = require("../src/builder/template_funcs");

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
});
