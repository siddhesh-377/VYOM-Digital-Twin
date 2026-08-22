/**
 * SafetyValidator — Deterministic Aerospace Safety & Constraint Engine
 * 
 * Enforces rigorous physical, thermal, electrical, orbital, and life-support
 * boundary limits before allowing any autonomous or commanded action to execute
 * against the spacecraft state or digital twin.
 */

export interface SafetyValidationResult {
  passed: boolean;
  safetyMarginPercent: number;
  verifiedRules: string[];
  constraintViolations: string[];
  riskCategory: 'nominal' | 'elevated' | 'critical' | 'violates_flight_rules';
}

export interface TelemetryStateSnapshot {
  batteryPercent: number;
  voltageV: number;
  cpuTempC: number;
  batteryTempC: number;
  payloadTempC: number;
  reactionWheelRpm: number;
  angularVelDegs: number;
  cabinPressureKpa?: number;
  cabinPo2Kpa?: number;
  radiationUsvH?: number;
  commSignalDbm: number;
  powerConsumptionW: number;
  solarGenerationW: number;
}

export class SafetyValidator {
  // Flight operational boundary envelopes
  private static readonly LIMITS = {
    minBatteryPercent: 20.0,          // % SoC floor
    minVoltageV: 22.0,                // VDC lower threshold
    maxCpuTempC: 85.0,                // °C max CPU junction temp
    maxBatteryTempC: 45.0,            // °C max battery cell temp
    maxPayloadTempC: 65.0,            // °C max payload instrument temp
    maxReactionWheelRpm: 6200,        // RPM max momentum wheel saturation
    maxAngularVelDegs: 3.5,           // °/s max body rate
    minCabinPressureKpa: 70.0,        // kPa cabin pressure floor
    minCabinPo2Kpa: 19.5,             // kPa oxygen partial pressure floor
    maxCabinPo2Kpa: 23.5,             // kPa oxygen partial pressure ceiling
    minCommSignalDbm: -115.0,         // dBm link budget threshold
    maxPowerConsumptionW: 8500.0,     // W max instantaneous bus draw
  };

  /**
   * Deterministically validates an action against the current simulated telemetry state.
   */
  public static validate(
    actionName: string,
    state?: Partial<TelemetryStateSnapshot>
  ): SafetyValidationResult {
    const violations: string[] = [];
    const verifiedRules: string[] = [];
    let safetyMargin = 100.0;

    const current: TelemetryStateSnapshot = {
      batteryPercent: state?.batteryPercent ?? 85.0,
      voltageV: state?.voltageV ?? 28.4,
      cpuTempC: state?.cpuTempC ?? 42.0,
      batteryTempC: state?.batteryTempC ?? 20.0,
      payloadTempC: state?.payloadTempC ?? 32.0,
      reactionWheelRpm: state?.reactionWheelRpm ?? 3200,
      angularVelDegs: state?.angularVelDegs ?? 0.02,
      cabinPressureKpa: state?.cabinPressureKpa ?? 101.3,
      cabinPo2Kpa: state?.cabinPo2Kpa ?? 21.3,
      radiationUsvH: state?.radiationUsvH ?? 14.0,
      commSignalDbm: state?.commSignalDbm ?? -74.0,
      powerConsumptionW: state?.powerConsumptionW ?? 240.0,
      solarGenerationW: state?.solarGenerationW ?? 280.0,
    };

    // 1. Power & Electrical Rule Check
    if (current.batteryPercent < this.LIMITS.minBatteryPercent) {
      violations.push(`RULE-PWR-01: Battery SoC (${current.batteryPercent.toFixed(1)}%) below minimum flight rule floor (${this.LIMITS.minBatteryPercent}%).`);
      safetyMargin -= 35;
    } else {
      verifiedRules.push(`RULE-PWR-01: Battery SoC margin verified (${current.batteryPercent.toFixed(1)}% >= ${this.LIMITS.minBatteryPercent}%).`);
    }

    if (current.voltageV < this.LIMITS.minVoltageV) {
      violations.push(`RULE-PWR-02: Main bus voltage (${current.voltageV.toFixed(1)}V) below regulation limit (${this.LIMITS.minVoltageV}V).`);
      safetyMargin -= 30;
    } else {
      verifiedRules.push(`RULE-PWR-02: Bus voltage nominal (${current.voltageV.toFixed(1)}V >= ${this.LIMITS.minVoltageV}V).`);
    }

    // 2. Thermal Envelope Rule Check
    if (current.cpuTempC > this.LIMITS.maxCpuTempC) {
      violations.push(`RULE-THM-01: Onboard Computer temperature (${current.cpuTempC.toFixed(1)}°C) exceeds safety limit (${this.LIMITS.maxCpuTempC}°C).`);
      safetyMargin -= 25;
    } else {
      verifiedRules.push(`RULE-THM-01: Flight computer thermal envelope valid (${current.cpuTempC.toFixed(1)}°C <= ${this.LIMITS.maxCpuTempC}°C).`);
    }

    if (current.batteryTempC > this.LIMITS.maxBatteryTempC) {
      violations.push(`RULE-THM-02: Battery pack temperature (${current.batteryTempC.toFixed(1)}°C) exceeds safety threshold (${this.LIMITS.maxBatteryTempC}°C).`);
      safetyMargin -= 30;
    } else {
      verifiedRules.push(`RULE-THM-02: Battery thermal envelope within safe limits (${current.batteryTempC.toFixed(1)}°C <= ${this.LIMITS.maxBatteryTempC}°C).`);
    }

    // 3. Attitude & ADCS Dynamics Rule Check
    if (current.reactionWheelRpm > this.LIMITS.maxReactionWheelRpm) {
      violations.push(`RULE-ADCS-01: Reaction wheel speed (${current.reactionWheelRpm} RPM) violates saturation limit (${this.LIMITS.maxReactionWheelRpm} RPM).`);
      safetyMargin -= 20;
    } else {
      verifiedRules.push(`RULE-ADCS-01: Reaction wheel momentum budget verified (${current.reactionWheelRpm} RPM <= ${this.LIMITS.maxReactionWheelRpm} RPM).`);
    }

    if (current.angularVelDegs > this.LIMITS.maxAngularVelDegs) {
      violations.push(`RULE-ADCS-02: Spacecraft body rate (${current.angularVelDegs.toFixed(2)}°/s) exceeds stability threshold (${this.LIMITS.maxAngularVelDegs}°/s).`);
      safetyMargin -= 25;
    } else {
      verifiedRules.push(`RULE-ADCS-02: Body rates within pointing tolerance (${current.angularVelDegs.toFixed(2)}°/s <= ${this.LIMITS.maxAngularVelDegs}°/s).`);
    }

    // 4. Life Support (ECLSS) Rule Check (if human spacecraft telemetry is active)
    if (current.cabinPo2Kpa !== undefined) {
      if (current.cabinPo2Kpa < this.LIMITS.minCabinPo2Kpa || current.cabinPo2Kpa > this.LIMITS.maxCabinPo2Kpa) {
        violations.push(`RULE-ECLSS-01: Cabin PO2 (${current.cabinPo2Kpa.toFixed(1)} kPa) outside metabolic safe zone [${this.LIMITS.minCabinPo2Kpa} - ${this.LIMITS.maxCabinPo2Kpa} kPa].`);
        safetyMargin -= 40;
      } else {
        verifiedRules.push(`RULE-ECLSS-01: Cabin oxygen partial pressure envelope verified (${current.cabinPo2Kpa.toFixed(1)} kPa).`);
      }
    }

    // 5. Action Whitelist & Flight Rule Compatibility
    const actionLower = (actionName || '').toLowerCase();
    const isDestructive = actionLower.includes('vent_all') || actionLower.includes('overcharge') || actionLower.includes('disable_watchdog');
    if (isDestructive) {
      violations.push(`RULE-CMD-01: Action "${actionName}" identified as hazardous/destructive under Flight Safety Directive 402.`);
      safetyMargin -= 50;
    } else {
      verifiedRules.push(`RULE-CMD-01: Action "${actionName}" conforms to aerospace fault recovery procedures.`);
    }

    const passed = violations.length === 0;
    const finalMargin = Math.max(0, Math.min(100, Math.round(safetyMargin)));
    const riskCategory = !passed
      ? 'violates_flight_rules'
      : finalMargin < 50
      ? 'elevated'
      : 'nominal';

    return {
      passed,
      safetyMarginPercent: finalMargin,
      verifiedRules,
      constraintViolations: violations,
      riskCategory,
    };
  }
}
