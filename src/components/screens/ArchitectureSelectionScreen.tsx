import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';

// Mock data fallback
const MOCK_ARCHITECTURES = [
  {
    id: 'arch-alpha',
    name: 'Alpha Sentinel',
    description: 'High-agility reconnaissance satellite with advanced optical sensors.',
    mass: 1200,
    power: 2500,
    cost: 45,
    features: ['Optical Array', 'High Agility', 'Low Orbit']
  },
  {
    id: 'arch-beta',
    name: 'Beta Communications',
    description: 'Geostationary relay node for high-bandwidth data transmission.',
    mass: 3500,
    power: 8000,
    cost: 120,
    features: ['High Bandwidth', 'Geostationary', 'Solar Array']
  },
  {
    id: 'arch-gamma',
    name: 'Gamma Deep Space',
    description: 'Interplanetary exploration probe equipped with ion thrusters.',
    mass: 800,
    power: 1200,
    cost: 85,
    features: ['Ion Thruster', 'Radiation Hardened', 'Deep Space']
  }
];

export const ArchitectureSelectionScreen: React.FC = () => {
  const [architectures, setArchitectures] = useState(MOCK_ARCHITECTURES);
  const [loading, setLoading] = useState(true);
  
  const satelliteConfig = useMissionStore((state: any) => state.satelliteConfig);
  const setSatelliteConfig = useMissionStore((state: any) => state.setSatelliteConfig);

  useEffect(() => {
    const fetchArchitectures = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/architectures');
        if (response.ok) {
          const data = await response.json();
          setArchitectures(data);
        }
      } catch (error) {
        console.warn('Failed to fetch architectures, using mock data.', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArchitectures();
  }, []);

  const handleSelect = (arch: any) => {
    setSatelliteConfig({
      ...satelliteConfig,
      architectureId: arch.id,
      architectureName: arch.name,
      mass: arch.mass,
      power: arch.power,
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div style={styles.container}>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={styles.header}
      >
        <h1 style={styles.title}>ORBITAL ARCHITECTURE SELECTION</h1>
        <p style={styles.subtitle}>Select base satellite configuration for deployment</p>
      </motion.div>

      {loading ? (
        <div style={styles.loader}>INITIALIZING UPLINK...</div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={styles.grid}
        >
          {architectures.map((arch) => {
            const isSelected = satelliteConfig?.architectureId === arch.id;
            return (
              <motion.div
                key={arch.id}
                variants={itemVariants}
                whileHover={{ scale: 1.02, borderColor: '#00d4ff' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  ...styles.card,
                  borderColor: isSelected ? '#00ff88' : '#334155',
                  backgroundColor: isSelected ? 'rgba(0, 255, 136, 0.05)' : 'rgba(15, 23, 42, 0.6)'
                }}
                onClick={() => handleSelect(arch)}
              >
                <div style={styles.cardHeader}>
                  <h2 style={styles.cardTitle}>{arch.name}</h2>
                  {isSelected && <span style={styles.selectedBadge}>ACTIVE</span>}
                </div>
                
                <p style={styles.description}>{arch.description}</p>
                
                <div style={styles.statsContainer}>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>MASS</div>
                    <div style={styles.statValue}>{arch.mass} <span style={styles.unit}>kg</span></div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>POWER</div>
                    <div style={styles.statValue}>{arch.power} <span style={styles.unit}>W</span></div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statLabel}>COST</div>
                    <div style={styles.statValue}>{arch.cost} <span style={styles.unit}>M</span></div>
                  </div>
                </div>

                <div style={styles.featuresList}>
                  {arch.features?.map((feature: string, idx: number) => (
                    <span key={idx} style={styles.featureTag}>
                      {feature}
                    </span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    minHeight: '100%',
    backgroundColor: '#020409',
    color: '#e2e8f0',
    fontFamily: 'var(--font-mono, monospace)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    marginBottom: '3rem',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '1rem',
  },
  title: {
    fontFamily: 'var(--font-display, sans-serif)',
    fontSize: '2rem',
    color: '#00d4ff',
    margin: '0 0 0.5rem 0',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  subtitle: {
    color: '#94a3b8',
    margin: 0,
    fontSize: '0.9rem',
  },
  loader: {
    color: '#00d4ff',
    textAlign: 'center' as const,
    marginTop: '4rem',
    fontSize: '1.2rem',
    letterSpacing: '0.2em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '2rem',
  },
  card: {
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '1.5rem',
    cursor: 'pointer',
    position: 'relative' as const,
    overflow: 'hidden',
    transition: 'border-color 0.3s ease, background-color 0.3s ease',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontFamily: 'var(--font-display, sans-serif)',
    fontSize: '1.25rem',
    color: '#f8fafc',
    margin: 0,
  },
  selectedBadge: {
    backgroundColor: '#00ff88',
    color: '#020409',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.05em',
  },
  description: {
    color: '#cbd5e1',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    marginBottom: '1.5rem',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '1rem',
    borderRadius: '6px',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#64748b',
    marginBottom: '0.25rem',
    letterSpacing: '0.05em',
  },
  statValue: {
    fontSize: '1.1rem',
    color: '#00d4ff',
    fontWeight: 'bold',
  },
  unit: {
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: 'normal',
  },
  featuresList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  featureTag: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    color: '#00d4ff',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
  }
};

export default ArchitectureSelectionScreen;
