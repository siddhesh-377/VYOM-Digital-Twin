import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import * as satellite from 'satellite.js';

class OrbitEngine {
  private satrec: satellite.SatRec | null = null;
  private orbitAngle = 0;
  
  constructor() {
    eventBus.subscribe('CLOCK_TICK', this.onTick);
  }

  // Simple TLE generator for a given altitude and inclination
  private generateTLE(altKm: number, incDeg: number) {
    // This is a placeholder for generating a real TLE or just using a default ISS-like TLE
    const tleLine1 = '1 25544U 98067A   20292.51888497 -.00010996  00000-0 -14838-4 0  9997';
    const tleLine2 = '2 25544  51.6443 325.2608 0003058 126.9745 285.4952 15.49479361251390';
    return { tleLine1, tleLine2 };
  }

  private initSatellite() {
    if (this.satrec) return;
    const store = useMissionStore.getState();
    const alt = store.telemetry?.orbit.altitudeKm || 650;
    const inc = store.telemetry?.orbit.inclinationDeg || 51.6;
    const { tleLine1, tleLine2 } = this.generateTLE(alt, inc);
    this.satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  }

  private onTick = (payload: { simDelta: number, tickCount: number }) => {
    this.initSatellite();
    if (!this.satrec) return;

    const dt = Math.max(0.001, payload.simDelta / 1000);
    const store = useMissionStore.getState();
    const EARTH_MU = 398600.4418;
    const EARTH_RADIUS_KM = 6371.0;
    
    // Fast path: use previous altitude to step angle
    const r_km = EARTH_RADIUS_KM + (store.telemetry?.orbit.altitudeKm || 650);
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r_km, 3) / EARTH_MU);
    const omega = (2 * Math.PI) / periodSeconds;
    
    this.orbitAngle += omega * dt;
    if (this.orbitAngle > Math.PI * 2 * 1000) {
      this.orbitAngle = this.orbitAngle % (Math.PI * 2);
    }

    if (payload.tickCount % 3 === 0) {
      const date = new Date(store.missionStartTime + store.elapsedRealMs * store.timeMultiplier);
      const positionAndVelocity = satellite.propagate(this.satrec, date);
      
      const gmst = satellite.gstime(date);
      let lat = store.telemetry?.orbit.latitudeDeg || 0;
      let lng = store.telemetry?.orbit.longitudeDeg || 0;
      let alt = store.telemetry?.orbit.altitudeKm || 650;
      let vel = store.telemetry?.orbit.velocityKms || 7.5;

      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
        const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;
        
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);
        
        lat = satellite.degreesLat(positionGd.latitude);
        lng = satellite.degreesLong(positionGd.longitude);
        alt = positionGd.height;
        vel = Math.sqrt(velocityEci.x * velocityEci.x + velocityEci.y * velocityEci.y + velocityEci.z * velocityEci.z);
      } else {
        // Fallback Keplerian math if satellite.js propagation fails
        const incRad = (store.telemetry?.orbit.inclinationDeg || 51.6) * Math.PI / 180;
        lat = Math.sin(this.orbitAngle) * (store.telemetry?.orbit.inclinationDeg || 51.6);
        const earthRotRate = (360 / (24 * 3600)) * dt;
        const orbitLngProgression = ((omega * 180) / Math.PI) * dt * Math.cos(incRad);
        lng = ((store.telemetry?.orbit.longitudeDeg || 0) + orbitLngProgression - earthRotRate);
        while (lng > 180) lng -= 360;
        while (lng < -180) lng += 360;
      }

      const a_ms2 = (EARTH_MU / (r_km * r_km)) * 1000;
      
      eventBus.publish('ORBIT_UPDATE', {
        latitudeDeg: lat,
        longitudeDeg: lng,
        altitudeKm: alt,
        velocityKms: vel,
        accelerationMs2: a_ms2,
        gForce: a_ms2 / 9.80665,
        periodMin: periodSeconds / 60,
        semiMajorAxisKm: r_km,
        trueAnomalyDeg: ((this.orbitAngle * 180) / Math.PI) % 360,
      });
    }
  };
}

export const orbitEngine = new OrbitEngine();
