import { VolvoCardLabels } from "./types";

export const DEFAULT_LABELS: Required<VolvoCardLabels> = {
  unlocked: "Unlocked",
  locked: "Locked",
  scheduled: "Scheduled",
  charging: "Charging",
  lock: "Lock",
  unlock: "Unlock",
  climate: "Climate",
  electric: "electric",
  fuel: "fuel",
  fuel_level: "Fuel",
  time_left: "left",
};

export function label(labels: VolvoCardLabels | undefined, key: keyof VolvoCardLabels): string {
  return labels?.[key] ?? DEFAULT_LABELS[key];
}
