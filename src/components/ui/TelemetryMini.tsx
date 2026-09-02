import React from 'react';

interface TelemetryMiniProps {
  label: string;
  value: string;
  unit: string;
  status?: 'critical' | 'warning';
}

export function TelemetryMini({ label, value, unit, status }: TelemetryMiniProps) {
  const valueColor = status === 'critical' ? '#ff2d55' : status === 'warning' ? '#ff8c00' : '#fff';
  const bg = status === 'critical' ? 'rgba(255,45,85,0.08)' : status === 'warning' ? 'rgba(255,140,0,0.08)' : 'rgba(0,0,0,0.25)';
  const border = status === 'critical' ? '1px solid rgba(255,45,85,0.3)' : status === 'warning' ? '1px solid rgba(255,140,0,0.25)' : '1px solid rgba(255,255,255,0.06)';

  return (
    <div style={{
      padding: '5px 7px',
      background: bg,
      border,
      borderRadius: 4,
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 7.5,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.1em',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          color: valueColor,
          letterSpacing: '-0.02em',
          transition: 'color 0.3s ease',
        }}>
          {value}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: 'rgba(255,255,255,0.3)',
        }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
