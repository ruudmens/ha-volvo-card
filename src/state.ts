import { ChargeState, HomeAssistant, StatusKey, VehicleKind, VolvoCardEntities } from "./types";

export function getState(hass: HomeAssistant, entityId?: string): string | undefined {
  if (!entityId) return undefined;
  return hass.states[entityId]?.state;
}

export function getAttr(hass: HomeAssistant, entityId: string | undefined, attr: string): any {
  if (!entityId) return undefined;
  return hass.states[entityId]?.attributes?.[attr];
}

/**
 * `value` can be either an entity ID (whose `attr` attribute holds the image URL) or a literal
 * URL/local path (e.g. `/local/assets/car.png`) — whichever it is, this returns the URL to use.
 */
export function resolveImage(hass: HomeAssistant, value: string | undefined, attr: string): string | undefined {
  if (!value) return undefined;
  if (hass.states[value] !== undefined) {
    return getAttr(hass, value, attr) || undefined;
  }
  return value;
}

export function numState(hass: HomeAssistant, entityId?: string): number | undefined {
  const s = getState(hass, entityId);
  if (s === undefined) return undefined;
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Distance unit for a range sensor: the entity's own unit (HA converts it to the user's
 * unit system), else the HA unit system, else km.
 */
export function distanceUnit(hass: HomeAssistant, entityId?: string): string {
  const fromEntity = getAttr(hass, entityId, "unit_of_measurement");
  if (fromEntity) return fromEntity;
  return hass.config?.unit_system?.length === "mi" ? "mi" : "km";
}

export function round(n: number | undefined): number {
  return Math.round(n ?? 0);
}

/**
 * Vehicle kind is derived from which entities the user configured, not a
 * config flag — an unconfigured entity means "this vehicle doesn't have
 * that system" (e.g. no fuel entities on a full EV).
 */
export function deriveVehicleKind(entities: VolvoCardEntities): VehicleKind {
  const hasBattery = !!(entities.battery && entities.distance_to_empty_battery);
  const hasFuel = !!(entities.fuel_amount && entities.distance_to_empty_tank);
  if (hasBattery && hasFuel) return "hybrid";
  if (hasBattery) return "bev";
  if (hasFuel) return "ice";
  return "unknown";
}

function isHome(hass: HomeAssistant, entities: VolvoCardEntities): boolean {
  if (!entities.location) return true;
  return getState(hass, entities.location) === "home";
}

export function isConnected(hass: HomeAssistant, entities: VolvoCardEntities): boolean {
  const connStatus = (getState(hass, entities.charging_connection_status) || "").toLowerCase();
  return connStatus.includes("connect") && !connStatus.includes("disconnect");
}

export function isCharging(hass: HomeAssistant, entities: VolvoCardEntities): boolean {
  const chargeStateStr = (getState(hass, entities.charging_status) || "").toLowerCase();
  return chargeStateStr.includes("charg") && !chargeStateStr.includes("not");
}

/**
 * Charging state only applies to vehicles with a battery. ICE vehicles are
 * always treated as idle (no plug, no charging UI, no pulse/cable overlay) —
 * this falls out naturally since an ICE config has no charging entities set,
 * so isConnected()/isCharging() are already false, but it's made explicit
 * here rather than relying on that as an implicit side effect.
 */
export function deriveChargeState(
  hass: HomeAssistant,
  entities: VolvoCardEntities,
  kind: VehicleKind
): ChargeState {
  if (kind === "ice") return "idle";
  if (!isConnected(hass, entities)) return "idle";
  return isCharging(hass, entities) ? "charging" : "scheduled";
}

export function statusKey(
  hass: HomeAssistant,
  entities: VolvoCardEntities,
  chargeState: ChargeState,
  kind: VehicleKind
): StatusKey {
  if (kind === "ice") {
    const isLocked = getState(hass, entities.lock) === "locked";
    if (entities.lock && isHome(hass, entities) && !isLocked) return "unlocked";
    return isLocked ? "locked" : "";
  }

  const isLocked = getState(hass, entities.lock) === "locked";
  const battery = numState(hass, entities.battery) ?? 0;
  const isFullyCharged = battery >= 100;

  if (entities.lock && isHome(hass, entities) && !isLocked) return "unlocked";
  if (chargeState === "scheduled") {
    return isFullyCharged && isLocked ? "locked" : "scheduled";
  }
  if (chargeState === "charging") return "charging";
  if (isLocked) return "locked";
  return "";
}
