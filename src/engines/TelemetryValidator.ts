export class TelemetryValidator {
  static validate(data: any) {
    if (!data) return false;
    
    // Check for essential telemetry subsystems
    if (!data.power || !data.thermal || !data.comm || !data.attitude) {
      console.warn('Telemetry validation failed: Missing subsystems');
      return false;
    }
    
    // Check for NaN or invalid values
    if (isNaN(data.power.batteryPercent) || isNaN(data.thermal.cpuTempC)) {
      console.warn('Telemetry validation failed: NaN detected');
      return false;
    }
    
    return true;
  }
}
