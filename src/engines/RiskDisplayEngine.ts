export class RiskDisplayEngine {
  static getRiskColor(riskScore: number): string {
    if (riskScore >= 80) return 'red';
    if (riskScore >= 60) return 'orange';
    if (riskScore >= 40) return 'yellow';
    return 'green';
  }

  static formatContributingFactors(factors: string[]): string {
    if (!factors || factors.length === 0) return 'No contributing factors identified.';
    return factors.join(', ');
  }
}
