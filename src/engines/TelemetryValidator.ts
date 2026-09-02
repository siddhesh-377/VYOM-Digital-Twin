export class TelemetryValidator {
  static validate(data: any) {
    if (!data) return false;
    
    // Check for essential telemetry subsystems
    if (!data.power || !data.thermal || !data.comm || !data.attitude) {
      console.warn('Telemetry validation failed: Missing subsystems');
      return false;
    }
    
    // Check for NaN or invalid values
    if (typeof data.power.batteryPercent !== 'number' || isNaN(data.power.batteryPercent) || isNaN(data.thermal.cpuTempC)) {
      console.warn('Telemetry validation failed: NaN or invalid value detected');
      return false;
    }
    
    // Ensure battery SoC is strictly within [0, 100]
    data.power.batteryPercent = Math.max(0, Math.min(100, data.power.batteryPercent));

    return true;
  }
}
