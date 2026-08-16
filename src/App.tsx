import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './styles/global.css';
import { useMissionStore } from './store/missionStore';
import { initializeEngines } from './engines';
import { Navigation } from './components/ui/Navigation';
import { eventBus } from './engines/MissionEventBus';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { BudgetScreen } from './components/screens/BudgetScreen';
import { LaunchLocationScreen } from './components/screens/LaunchLocationScreen';
import { SatelliteGenerationScreen } from './components/screens/SatelliteGenerationScreen';
import { LaunchSequenceScreen } from './components/screens/LaunchSequenceScreen';
import { MissionControlScreen } from './components/screens/MissionControlScreen';
import { TelemetryScreen } from './components/screens/TelemetryScreen';
import { CrewScreen } from './components/screens/CrewScreen';
import { OrbitScreen } from './components/screens/OrbitScreen';
import { UniverseScreen } from './components/screens/UniverseScreen';
import { ScenariosScreen } from './components/screens/ScenariosScreen';
import { AIScreen } from './components/screens/AIScreen';
import { BlackBoxScreen } from './components/screens/BlackBoxScreen';
import { MissionTimeScreen } from './components/screens/MissionTimeScreen';
import { ReportsScreen } from './components/screens/ReportsScreen';
import { ArchiveScreen } from './components/screens/ArchiveScreen';
import { ReplayScreen, CompletionScreen } from './components/screens/ReplayCompletionScreens';
import { DispositionScreen, FarewellScreen } from './components/screens/DispositionFarewellScreens';
import { DigitalTwinScreen, EnvironmentScreen } from './components/screens/DigitalTwinEnvironmentScreens';

const PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

function ScreenRouter() {
  const screen = useMissionStore((s) => s.screen);
  const status = useMissionStore((s) => s.status);
  const config = useMissionStore((s) => s.config);

  // If user is on crew screen but mission is not human exploration, redirect to mission-control
  useEffect(() => {
    if (screen === 'crew' && config?.type !== 'human') {
      useMissionStore.getState().setScreen('mission-control');
    }
  }, [screen, config]);

  // Auto-navigate to completion when mission hits 100% (Listen to eventbus instead of reactive loop)
  useEffect(() => {
    const handleComplete = () => {
      useMissionStore.getState().setScreen('completion');
    };
    const unsubscribe = eventBus.subscribe('MISSION_COMPLETE', handleComplete);
    return unsubscribe;
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        variants={PAGE_VARIANTS}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      >
        {screen === 'welcome' && <WelcomeScreen />}
        {screen === 'onboarding' && <OnboardingScreen />}
        {screen === 'budget' && <BudgetScreen />}
        {screen === 'launch' && <LaunchLocationScreen />}
        {screen === 'satellite' && <SatelliteGenerationScreen />}
        {screen === 'launch-sequence' && <LaunchSequenceScreen />}
        {screen === 'mission-control' && <MissionControlScreen />}
        {screen === 'crew' && config?.type === 'human' && <CrewScreen />}
        {screen === 'digital-twin' && <DigitalTwinScreen />}
        {screen === 'orbit' && <OrbitScreen />}
        {screen === 'universe' && <UniverseScreen />}
        {screen === 'telemetry' && <TelemetryScreen />}
        {screen === 'environment' && <EnvironmentScreen />}
        {screen === 'scenarios' && <ScenariosScreen />}
        {screen === 'ai' && <AIScreen />}
        {screen === 'mission-time' && <MissionTimeScreen />}
        {screen === 'blackbox' && <BlackBoxScreen />}
        {screen === 'replay' && <ReplayScreen />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'archive' && <ArchiveScreen />}
        {screen === 'completion' && <CompletionScreen />}
        {screen === 'disposition' && <DispositionScreen />}
        {screen === 'farewell' && <FarewellScreen />}
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useEffect(() => {
    initializeEngines();
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#020409' }}>
      <ScreenRouter />
      <Navigation />
    </div>
  );
}
