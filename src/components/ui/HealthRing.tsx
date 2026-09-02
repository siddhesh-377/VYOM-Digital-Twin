import React from 'react';

interface HealthRingProps {
  value: number; // 0–100
  size?: number;
}

export function HealthRing({ value, size = 80 }: HealthRingProps) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - value / 100);

  const color = value >= 70 ? '#00ff88' : value >= 40 ? '#ff8c00' : '#ff2d55';

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background ring */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={5}
      />
      {/* Value arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
      />
      {/* Center text */}
      <text
        x={size / 2} y={size / 2 + 4}
        textAnchor="middle"
        fill={color}
        fontFamily="'JetBrains Mono', monospace"
        fontSize={14}
        fontWeight="700"
      >
        {Math.round(value)}%
      </text>
    </svg>
  );
}
