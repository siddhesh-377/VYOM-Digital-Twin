export class SafetyValidator {
  static validate(action: string) {
    const safeActions = [
      'Strategy Alpha-4',
      'Strategy Beta-2',
      'Power reroute',
      'Safe mode',
      'Attitude adjustment',
      'Thermal shunt',
    ];
    
    // Check if the recommended action is in the predefined safe boundaries
    const isSafe = safeActions.some(safe => action.includes(safe));
    
    if (!isSafe) {
      console.warn(`SafetyValidator Blocked Action: ${action} is outside operational safety bounds.`);
    }
    
    return isSafe;
  }
}
