import { CrewMember } from '../types/mission';

export class CrewHealthVisualizer {
  static getCrewStatusColor(member: CrewMember): string {
    if (member.status === 'critical') return '#ff0000';
    if (member.status === 'elevated' || member.stressIndex > 80) return '#ff9900';
    return '#00cc00';
  }

  static getFatigueWarning(member: CrewMember): string | null {
    if (member.stressIndex > 80) return 'High stress levels detected.';
    if (member.heartRateBpm > 100 || member.heartRateBpm < 50) return 'Abnormal heart rate.';
    if (member.spo2Percent < 95) return 'Low SpO2 levels.';
    return null;
  }
}
