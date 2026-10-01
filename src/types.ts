export interface HomeAssistant {
  states: {
    [entityId: string]: {
      state: string;
      attributes: Record<string, any>;
    };
  };
  themes?: {
    darkMode: boolean;
  };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): Promise<unknown>;
}

export interface VolvoCardEntities {
  battery?: string;
  distance_to_empty_battery?: string;
  distance_to_empty_tank?: string;
  fuel_amount?: string;
  fuel_tank_capacity_l?: number;
  charging_connection_status?: string;
  charging_status?: string;
  lock?: string;
  location?: string;
  start_climatisation?: string;
  stop_climatisation?: string;
  /** Remaining charging time, e.g. the Volvo integration's `estimated_charging_time` sensor (minutes).
   *  Shown on the right of the status line while charging, like the Volvo app ("1 h 17 min left"). */
  charging_time_left?: string;
}

export interface VolvoCardImages {
  exterior_back?: string;
  exterior_side_left?: string;
  fallback?: string;
}

export interface VolvoCardOverlay {
  cable_bottom?: string;
  cable_width?: string;
  pulse_left?: string;
  pulse_top?: string;
}

export interface VolvoCardLabels {
  unlocked?: string;
  locked?: string;
  scheduled?: string;
  charging?: string;
  lock?: string;
  unlock?: string;
  climate?: string;
  /** Header sub-labels and the charging-time suffix. */
  electric?: string;
  fuel?: string;
  fuel_level?: string;
  time_left?: string;
}

export interface VolvoCardConfig {
  type: string;
  name?: string;
  entities: VolvoCardEntities;
  images?: VolvoCardImages;
  labels?: VolvoCardLabels;
  /** Selects a built-in cable/pulse overlay preset tuned for this model, e.g. "v60". See overlays.ts. */
  model?: string;
  /** Overrides individual overlay values — takes precedence over the `model` preset. */
  overlay?: VolvoCardOverlay;
  /** "classic" (default): range-first header. "app": battery-first header like the Volvo Cars app —
   *  a hybrid always shows battery %, electric range and fuel range, also while charging. */
  header?: "classic" | "app";
}

export type ChargeState = "idle" | "scheduled" | "charging";
export type VehicleKind = "hybrid" | "bev" | "ice" | "unknown";
export type StatusKey = "unlocked" | "locked" | "scheduled" | "charging" | "";
