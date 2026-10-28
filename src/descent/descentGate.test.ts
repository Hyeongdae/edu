import { describe, expect, it } from "vitest";
import { isDescentTestEnabled } from "./descentGate";

describe("local descent availability", () => {
  it.each([undefined, "", "false", "TRUE", "1", " truex "])("rejects flag %s", flag => {
    expect(isDescentTestEnabled({ DEV: true, VITE_LOCAL_DEMO_MODE: flag })).toBe(false);
  });
  it.each(["true", " true ", "\ttrue\n"])("accepts explicit dev flag %j", flag => {
    expect(isDescentTestEnabled({ DEV: true, VITE_LOCAL_DEMO_MODE: flag })).toBe(true);
  });
  it.each([undefined, "true", "false"])("rejects production even with flag%s", flag => {
    expect(isDescentTestEnabled({ DEV: false, VITE_LOCAL_DEMO_MODE: flag })).toBe(false);
  });
});
