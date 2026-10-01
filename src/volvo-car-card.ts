import { LitElement, html, css, unsafeCSS, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { HomeAssistant, VolvoCardConfig, VolvoCardEntities, VehicleKind, ChargeState } from "./types";
import {
  getState,
  numState,
  resolveImage,
  round,
  deriveVehicleKind,
  deriveChargeState,
  isConnected,
  isCharging,
  statusKey,
} from "./state";
import {
  HEDVIG_FONT_WOFF2,
  LIGHTNING_ICON_PATH,
  LOCK_ICON_INNER,
  LOCK_OPEN_ICON_INNER,
  FAN_ICON_INNER,
  CABLE_IMAGE_PNG,
} from "./assets";
import { label } from "./labels";
import { resolveOverlay } from "./overlays";

interface HeaderMain {
  value: number;
  unit: string;
}

type SubIcon = "lightning" | "mdi:gas-station";

interface HeaderSub {
  icon: SubIcon;
  value: string;
  label: string;
}

@customElement("volvo-car-card")
export class VolvoCarCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: VolvoCardConfig;
  @state() private actionsOpen = false;
  @state() private climateOn = false;

  public setConfig(config: VolvoCardConfig): void {
    if (!config || !config.entities) {
      throw new Error("volvo-car-card: `entities` is required in card config");
    }
    this.config = config;
  }

  public getCardSize(): number {
    return 3;
  }

  public static getStubConfig(): VolvoCardConfig {
    return {
      type: "custom:volvo-car-card",
      entities: {
        battery: "sensor.volvo_xxx_battery",
        distance_to_empty_battery: "sensor.volvo_xxx_distance_to_empty_battery",
        distance_to_empty_tank: "sensor.volvo_xxx_distance_to_empty_tank",
        fuel_amount: "sensor.volvo_xxx_fuel_amount",
        fuel_tank_capacity_l: 50,
        charging_connection_status: "sensor.volvo_xxx_charging_connection_status",
        charging_status: "sensor.volvo_xxx_charging_status",
        lock: "lock.volvo_xxx_lock",
        location: "device_tracker.volvo_xxx_location",
        start_climatisation: "button.volvo_xxx_start_climatisation",
        stop_climatisation: "button.volvo_xxx_stop_climatisation",
      },
      images: {
        exterior_back: "sensor.volvo_xxx_images",
        exterior_side_left: "sensor.volvo_xxx_images",
      },
    };
  }

  private headerMain(kind: VehicleKind, chargeState: ChargeState): HeaderMain {
    const { entities: e } = this.config;
    const dteBattery = numState(this.hass, e.distance_to_empty_battery) ?? 0;
    const dteTank = numState(this.hass, e.distance_to_empty_tank) ?? 0;
    const battery = numState(this.hass, e.battery) ?? 0;

    if (kind === "ice") {
      return { value: round(dteTank), unit: "km" };
    }
    if (chargeState === "scheduled" || this.appHeader) {
      return { value: round(battery), unit: "%" };
    }
    // idle or charging: total range (battery-only vehicles simply have dteTank = 0)
    return { value: round(dteBattery + dteTank), unit: "km" };
  }

  private headerSub1(kind: VehicleKind, chargeState: ChargeState): HeaderSub | null {
    const { entities: e } = this.config;
    const dteBattery = numState(this.hass, e.distance_to_empty_battery) ?? 0;
    const fuelAmount = numState(this.hass, e.fuel_amount);
    const tankCapacity = e.fuel_tank_capacity_l;

    const fuelSub = (): HeaderSub | null => {
      if (fuelAmount === undefined || !tankCapacity) return null;
      const pct = round((fuelAmount / tankCapacity) * 100);
      return { icon: "mdi:gas-station", value: `${pct}%`, label: label(this.config.labels, "fuel_level") };
    };

    if (kind === "ice") return fuelSub();

    if (kind === "hybrid") {
      if (chargeState === "charging" && !this.appHeader) return fuelSub();
      return { icon: "lightning", value: `${round(dteBattery)} km`, label: label(this.config.labels, "electric") };
    }

    // bev
    if (chargeState === "scheduled" || this.appHeader) {
      return { icon: "lightning", value: `${round(dteBattery)} km`, label: label(this.config.labels, "electric") };
    }
    return null;
  }

  private headerSub2(kind: VehicleKind, chargeState: ChargeState): string | null {
    if (kind !== "hybrid" || (chargeState === "charging" && !this.appHeader)) return null;
    const dteTank = numState(this.hass, this.config.entities.distance_to_empty_tank) ?? 0;
    return `${round(dteTank)} km ${label(this.config.labels, "fuel")}`;
  }

  private get appHeader(): boolean {
    return this.config.header === "app";
  }

  /** "1 h 17 min left" from a minutes sensor; a non-numeric state is shown as-is. */
  private chargingTimeLeft(): string | null {
    const id = this.config.entities.charging_time_left;
    if (!id) return null;
    const raw = getState(this.hass, id);
    if (raw === undefined || raw === "" || raw === "unknown" || raw === "unavailable") return null;
    const n = Number(raw);
    let text: string;
    if (Number.isFinite(n)) {
      const unit = this.hass.states[id]?.attributes?.unit_of_measurement;
      const minutes = Math.round(unit === "h" ? n * 60 : unit === "s" ? n / 60 : n);
      if (minutes <= 0) return null;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      text = h > 0 ? `${h} h ${m} min` : `${m} min`;
    } else {
      text = raw;
    }
    return `${text} ${label(this.config.labels, "time_left")}`.trim();
  }

  private carImageStyle(connected: boolean): { style: Record<string, string>; hasImage: boolean } {
    const { images } = this.config;
    const src =
      (connected
        ? images && resolveImage(this.hass, images.exterior_back, "exterior_back")
        : images && resolveImage(this.hass, images.exterior_side_left, "exterior_side_left")) ||
      images?.fallback ||
      "";

    const bg = src ? `url('${src}')` : "none";
    const size = connected ? "185% 100%" : "182% 100%";
    const marginLeft = connected ? "-60px" : "-48px";
    const marginTop = connected ? "-34px" : "-10px";
    const marginBottom = connected ? "-30px" : "-30px";

    return {
      style: {
        background: `${bg} left center / ${size} no-repeat transparent`,
        marginLeft,
        marginTop,
        marginBottom,
      },
      hasImage: !!src,
    };
  }

  protected render(): TemplateResult {
    if (!this.hass || !this.config) return html``;

    const { entities: e, name } = this.config;
    const kind = deriveVehicleKind(e);

    if (kind === "unknown") {
      return html`
        <ha-card>
          <div class="warning">
            volvo-car-card: no battery or fuel entities configured — nothing to show.
          </div>
        </ha-card>
      `;
    }

    const chargeState = deriveChargeState(this.hass, e, kind);
    const connected = kind !== "ice" && isConnected(this.hass, e);
    const charging = kind !== "ice" && isCharging(this.hass, e);
    const main = this.headerMain(kind, chargeState);
    const sub1 = this.headerSub1(kind, chargeState);
    const sub2 = this.headerSub2(kind, chargeState);
    const sKey = statusKey(this.hass, e, chargeState, kind);
    const status = sKey ? label(this.config.labels, sKey) : "";
    const timeLeft = chargeState === "charging" ? this.chargingTimeLeft() : null;
    const { style: imgStyle, hasImage } = this.carImageStyle(connected);
    const isDark = this.hass.themes?.darkMode ?? true;
    // Text over the car photo stays white regardless of theme (the photo's own
    // dark background makes that legible). Without a photo, or in light mode,
    // fall back to plain black/dark-grey text instead of white-on-nothing.
    const overlayClass = !hasImage || !isDark ? "theme-text" : "";

    return html`
      <ha-card>
        <div class="volvo-card" @click=${this.openActions}>
          ${charging ? this.renderPulse() : nothing}
          <div
            class="car-image"
            style=${`background:${imgStyle.background};margin-left:${imgStyle.marginLeft};margin-top:${imgStyle.marginTop};margin-bottom:${imgStyle.marginBottom};`}
          ></div>
          ${connected ? this.renderCable() : nothing}
          <div class="header ${overlayClass}">
            ${name ? html`<div class="vehicle-name">${name}</div>` : nothing}
            <div class="row main-row">
              <span class="main-value"
                >${main.value}<span class="main-unit"> ${main.unit}</span></span
              >
            </div>
            ${sub1
              ? html`
                  <div class="row sub-row">
                    ${sub1.icon === "lightning"
                      ? this.renderLightningIcon()
                      : html`<ha-icon icon=${sub1.icon}></ha-icon>`}
                    <span class="sub-value">${sub1.value}</span>
                    <span class="sub-label">${sub1.label}</span>
                  </div>
                `
              : nothing}
            ${sub2 ? html`<div class="row sub-row-2">${sub2}</div>` : nothing}
          </div>
          ${status ? html`<div class="status ${overlayClass}">${status}</div>` : nothing}
          ${timeLeft ? html`<div class="status-right ${overlayClass}">${timeLeft}</div>` : nothing}
        </div>
      </ha-card>
      ${this.actionsOpen ? this.renderActionsDialog(e, isDark) : nothing}
    `;
  }

  private openActions(ev: Event): void {
    ev.stopPropagation();
    this.actionsOpen = true;
  }

  private closeActions(): void {
    this.actionsOpen = false;
  }

  private callLock(lock: boolean): void {
    const entityId = this.config.entities.lock;
    if (!entityId) return;
    this.hass.callService("lock", lock ? "lock" : "unlock", { entity_id: entityId });
    this.closeActions();
  }

  private pressButton(entityId?: string): void {
    if (!entityId) return;
    this.hass.callService("button", "press", { entity_id: entityId });
  }

  private toggleClimate(): void {
    const { start_climatisation, stop_climatisation } = this.config.entities;
    this.pressButton(this.climateOn ? stop_climatisation : start_climatisation);
    this.climateOn = !this.climateOn;
  }

  private renderActionsDialog(e: VolvoCardEntities, isDark: boolean): TemplateResult {
    const isLocked = getState(this.hass, e.lock) === "locked";
    const hasFan = !!(e.start_climatisation || e.stop_climatisation);
    const themeClass = isDark ? "dark" : "light";

    return html`
      <div class="actions-backdrop" @click=${this.closeActions}>
        <div class="actions-panel" @click=${(ev: Event) => ev.stopPropagation()}>
          ${e.lock
            ? html`
                <button
                  class="icon-button ${themeClass}"
                  aria-label=${isLocked ? label(this.config.labels, "unlock") : label(this.config.labels, "lock")}
                  @click=${() => this.callLock(!isLocked)}
                >
                  ${this.renderStrokeIcon(isLocked ? LOCK_ICON_INNER : LOCK_OPEN_ICON_INNER)}
                  <span>${isLocked ? label(this.config.labels, "unlock") : label(this.config.labels, "lock")}</span>
                </button>
              `
            : nothing}
          ${hasFan
            ? html`
                <button
                  class="icon-button ${themeClass} ${this.climateOn ? "active" : ""}"
                  aria-label=${label(this.config.labels, "climate")}
                  @click=${() => this.toggleClimate()}
                >
                  ${this.renderStrokeIcon(FAN_ICON_INNER)}
                  <span>${label(this.config.labels, "climate")}</span>
                </button>
              `
            : nothing}
        </div>
      </div>
    `;
  }

  private renderLightningIcon(): TemplateResult {
    return html`<svg class="icon-svg" viewBox="0 0 24 24">
      <path fill="currentColor" d=${LIGHTNING_ICON_PATH}></path>
    </svg>`;
  }

  private renderStrokeIcon(inner: string): TemplateResult {
    return html`<svg
      class="icon-svg-stroke"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      ${unsafeSVG(inner)}
    </svg>`;
  }

  private renderCable(): TemplateResult {
    const overlay = resolveOverlay(this.config.model, this.config.overlay);
    return html`<img
      class="cable"
      src=${CABLE_IMAGE_PNG}
      style="bottom: ${overlay.cable_bottom}; width: ${overlay.cable_width};"
    />`;
  }

  private renderPulse(): TemplateResult {
    const overlay = resolveOverlay(this.config.model, this.config.overlay);
    return html`
      <div class="pulse-container" style="left: ${overlay.pulse_left}; top: ${overlay.pulse_top};">
        <span class="pulse" style="animation-delay: 0s"></span>
        <span class="pulse" style="animation-delay: 2s"></span>
        <span class="pulse" style="animation-delay: 4s"></span>
      </div>
    `;
  }

  static styles = css`
    @font-face {
      font-family: "Hedvig Letters Sans";
      src: url(${unsafeCSS(HEDVIG_FONT_WOFF2)}) format("woff2");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    :host {
      --volvo-accent-color: #38f2e9;
    }

    ha-card {
      overflow: hidden;
      border-radius: 16px;
      position: relative;
    }
    .volvo-card {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      font-family: "Hedvig Letters Sans", sans-serif;
    }
    .warning {
      padding: 16px;
      font-family: "Hedvig Letters Sans", sans-serif;
      color: var(--primary-text-color);
    }

    /* z-index stacking: car image(0) -> pulse(1) -> cable(2) -> text(3)
       The car image has an opaque background (photo + fallback color), so a
       pulse placed behind it (a lower z-index) is fully hidden, not just
       occluded by the car silhouette. It has to sit above the image to be
       visible at all. */
    .pulse-container {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      /* left/top are set inline per-model — see resolveOverlay() in overlays.ts */
      width: 0;
      height: 0;
    }
    .pulse {
      position: absolute;
      left: -35px;
      top: -35px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(40, 220, 90, 1) 0%,
        rgba(40, 220, 90, 1) 58%,
        rgba(40, 220, 90, 1) 72%
      );
      animation: volvoChargingPulse 6s ease-out infinite;
    }
    @keyframes volvoChargingPulse {
      0% {
        transform: scale(0.1);
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
      100% {
        transform: scale(1.5);
        opacity: 0;
      }
    }

    .car-image {
      position: absolute;
      inset: 0;
      z-index: 1;
    }

    .cable {
      position: absolute;
      left: 0;
      /* bottom/width are set inline per-model — see resolveOverlay() in overlays.ts */
      height: auto;
      object-fit: contain;
      pointer-events: none;
      z-index: 2;
    }

    .header {
      position: absolute;
      left: 13px;
      top: 13px;
      z-index: 3;
      display: block;
      width: auto;
    }
    .vehicle-name {
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 4px;
    }
    .row {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-start;
      width: max-content;
      white-space: nowrap;
    }
    .main-row {
      align-items: flex-start;
      gap: 9px;
    }
    .main-value {
      font-size: 51px;
      font-weight: 300;
      letter-spacing: -0.07em;
      color: white;
      line-height: 1;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    }
    .main-unit {
      font-weight: 300;
      margin-left: -4px;
    }
    .sub-row {
      align-items: center;
      gap: 4px;
      margin-top: 0px;
    }
    .sub-row ha-icon {
      --mdc-icon-size: 20px;
      color: white;
      flex-shrink: 0;
    }
    .icon-svg {
      width: 18px;
      height: 26px;
      color: white;
      flex-shrink: 0;
    }
    .sub-value {
      font-size: 18px;
      font-weight: 400;
      color: white;
    }
    .sub-label {
      font-size: 18px;
      font-weight: 300;
      color: rgba(255, 255, 255, 0.5);
    }
    .sub-row-2 {
      font-size: 16px;
      font-weight: 300;
      color: rgba(255, 255, 255, 0.5);
      margin-top: -7px;
      margin-left: 3px;
    }

    .status-right {
      position: absolute;
      right: 16px;
      bottom: 19px;
      z-index: 3;
      font-size: 15px;
      font-weight: 300;
      color: #aaa;
    }

    .status {
      position: absolute;
      left: 13px;
      bottom: 13px;
      z-index: 3;
      font-size: 24px;
      font-weight: 300;
      color: #aaa;
    }

    /* No photo, or light theme: fall back to plain black/dark-grey text
       instead of white (white-on-photo only reads well against the dark
       image background; white-on-nothing or white-on-light doesn't). */
    .header.theme-text .vehicle-name {
      color: #5c5c5c;
    }
    .header.theme-text .main-value {
      color: #141414;
      text-shadow: none;
    }
    .header.theme-text .sub-row ha-icon,
    .header.theme-text .icon-svg,
    .header.theme-text .sub-value {
      color: #141414;
    }
    .header.theme-text .sub-label,
    .header.theme-text .sub-row-2 {
      color: #5c5c5c;
    }
    .status.theme-text,
    .status-right.theme-text {
      color: #5c5c5c;
    }

    .volvo-card {
      cursor: pointer;
    }

    .actions-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .actions-panel {
      display: flex;
      flex-direction: row;
      gap: 16px;
    }
    .icon-button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 84px;
      height: 84px;
      border: none;
      border-radius: 20px;
      background: var(--card-background-color, var(--ha-card-background, white));
      color: var(--primary-text-color);
      font-family: "Hedvig Letters Sans", sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .icon-button .icon-svg-stroke {
      width: 28px;
      height: 28px;
    }
    .icon-button.light {
      color: #141414;
    }
    .icon-button.light .icon-svg-stroke {
      color: #141414;
    }
    .icon-button.dark {
      color: white;
    }
    .icon-button.dark .icon-svg-stroke {
      color: white;
    }
    .icon-button.light.active {
      background: #141414;
      color: white;
    }
    .icon-button.light.active .icon-svg-stroke {
      color: white;
    }
    .icon-button.dark.active {
      background: white;
      color: #0d0f10;
    }
    .icon-button.dark.active .icon-svg-stroke {
      color: #0d0f10;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "volvo-car-card": VolvoCarCard;
  }
  interface Window {
    customCards?: { type: string; name: string; description: string; preview?: boolean }[];
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "volvo-car-card",
  name: "Volvo Car Card",
  description: "A card for Volvo integration vehicles (ICE, PHEV, BEV) with charging status.",
  preview: true,
});
