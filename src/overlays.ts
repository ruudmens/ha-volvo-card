import { VolvoCardOverlay } from "./types";

/**
 * The charge cable render and the charging-pulse anchor point aren't in the same spot relative to
 * the car photo for every model — each car's charge port sits in a different place on the crop.
 * These are the values baked into the CSS today (tuned for the maintainer's own car), used when no
 * `model` preset matches and no manual `overlay` override is set.
 */
export const DEFAULT_OVERLAY: Required<VolvoCardOverlay> = {
  cable_bottom: "64px",
  cable_width: "54%",
  pulse_left: "56%",
  pulse_top: "48%",
};

/**
 * Built-in per-model presets, keyed by lowercase model name (matched case-insensitively against
 * the card's `model` config option). Add to this table as more vehicles get measured — see the
 * README's "Cable & pulse overlay" section for how to derive new values.
 */
export const MODEL_OVERLAYS: Record<string, VolvoCardOverlay> = {
  v60: {
    cable_bottom: "22px",
    cable_width: "58%",
    pulse_left: "60%",
    pulse_top: "59%",
  },
  xc90: {
    cable_bottom: "44px",
    cable_width: "58%",
    pulse_left: "58%",
    pulse_top: "55%",
  },
};

export function resolveOverlay(
  model: string | undefined,
  override: VolvoCardOverlay | undefined
): Required<VolvoCardOverlay> {
  const preset = (model && MODEL_OVERLAYS[model.toLowerCase()]) || {};
  return { ...DEFAULT_OVERLAY, ...preset, ...override };
}
