import { describe, it, expect } from "vitest";
import { mergeConfig } from "../src/config/mergeConfig.js";
import { config_default, styles_default, messages_default } from "../src/config/defaults.js";

describe("mergeConfig", () => {
  it("uses all defaults when no config is supplied", async () => {
    const out = await mergeConfig({});
    expect(out.isfrcam).toBe(config_default.isfrcam);
    expect(out.cam_res).toBe(config_default.cam_res);
    expect(out.VIS).toBe(styles_default.VIS);
    expect(out.FACE_COLOR_SUCCESS).toBe(styles_default.FACE_COLOR_SUCCESS);
    expect(out.messages).toMatchObject(messages_default);
  });

  it("overrides a config key from user input", async () => {
    const out = await mergeConfig({ config: { is_front_camera: false } });
    expect(out.isfrcam).toBe(false);
    // Other keys stay default
    expect(out.cam_res).toBe(config_default.cam_res);
  });

  it("overrides a style key from user input", async () => {
    const out = await mergeConfig({ style: { face_color_success: "#00FF00" } });
    expect(out.FACE_COLOR_SUCCESS).toBe("#00FF00");
    expect(out.FACE_COLOR_FAIL).toBe(styles_default.FACE_COLOR_FAIL);
  });

  it("merges messages — user keys override, others fall back to defaults", async () => {
    const out = await mergeConfig({ messages: { BLINK_NOW: "Blink!" } });
    expect(out.messages.BLINK_NOW).toBe("Blink!");
    expect(out.messages.NO_FACE).toBe(messages_default.NO_FACE);
  });

  it("attaches callbacks correctly", async () => {
    const onCaptureComplete = () => {};
    const onError = () => {};
    const out = await mergeConfig({ onCaptureComplete, onError });
    expect(out.onCaptureComplete).toBe(onCaptureComplete);
    expect(out.onError).toBe(onError);
    expect(out.onClose).toBeUndefined();
  });

  it("respects containerId", async () => {
    const out = await mergeConfig({ config: { containerId: "my-container" } });
    expect(out.containerId).toBe("my-container");
  });

  it("defaults containerId to null", async () => {
    const out = await mergeConfig({});
    expect(out.containerId).toBeNull();
  });

  it("uses dark semi-transparent overlay defaults", async () => {
    const out = await mergeConfig({});
    expect(out.DOC_COLOR).toBe("#000000");
    expect(out.DOC_OPACITY).toBe(0.6);
  });

  it("applies jpeg_quality and session_timeout_ms", async () => {
    const out = await mergeConfig({
      config: { jpeg_quality: 0.75, session_timeout_ms: 30000 },
    });
    expect(out.jpeg_quality).toBe(0.75);
    expect(out.session_timeout_ms).toBe(30000);
  });

  it("uses encrypt and enc_key from config", async () => {
    const out = await mergeConfig({ config: { encrypt: true, enc_key: "PEM_KEY" } });
    expect(out.encrypt).toBe(true);
    expect(out.enc_key).toBe("PEM_KEY");
  });
});
