import LogEntry from "../../src/log_entry";

describe("test log entry module", () => {
  test("if no optional param passed, should return default value", () => {
    const log = new LogEntry().getLog();
    expect(log.code).toEqual(null);
    expect(log.level).toEqual("DEBUG");
    expect(log.message).toEqual(null);
    expect(log).toHaveProperty("timestamp");
  });

  test("if code is correctly set", () => {
    // @ts-expect-error testing functionality of code set for coverage
    const log = new LogEntry("DEBUG", 404).getLog();
    expect(log.code).toEqual(404);
    expect(log.level).toEqual("DEBUG");
    expect(log.message).toEqual(null);
    expect(log).toHaveProperty("timestamp");
  });

  test("if message is correctly set", () => {
    const log = new LogEntry("DEBUG", null, "yes").getLog();
    expect(log.code).toEqual(null);
    expect(log.level).toEqual("DEBUG");
    expect(log.message).toEqual("yes");
    expect(log).toHaveProperty("timestamp");
  });
});
