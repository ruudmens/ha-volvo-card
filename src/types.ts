export interface HomeAssistant {
  states: {
    [entityId: string]: {
      state: string;
      attributes: Record<string, any>;
    };
  };
  config?: {
    unit_system?: { length?: string };
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
  electric?: string;
  fuel?: string;
  fuel_level?: string;
}

export interface VolvoCardConfig {
  type: string;
  name?: string;
  entities: VolvoCardEntities;
  images?: VolvoCardImages;
  labels?: VolvoCardLabels;
  /** Show the lock/climate dialog when the card is tapped. Defaults to true. */
  show_actions?: boolean;
  /** Selects a built-in cable/pulse overlay preset tuned for this model, e.g. "v60". See overlays.ts. */
  model?: string;
  /** Overrides individual overlay values — takes precedence over the `model` preset. */
  overlay?: VolvoCardOverlay;
}

export type ChargeState = "idle" | "scheduled" | "charging";
export type VehicleKind = "hybrid" | "bev" | "ice" | "unknown";
export type StatusKey = "unlocked" | "locked" | "scheduled" | "charging" | "";
