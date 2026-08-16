import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

// Procedural Earth using GLSL shaders — strict WebGL 1.0 / 2.0 compliant
export function Earth({ radius = 2 }: { radius?: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  const earthMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      lightDir: { value: new THREE.Vector3(5, 3, 5).normalize() },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float time;
      uniform vec3 lightDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (vec2(3.0) - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }

      void main() {
        float light = max(0.05, dot(vNormal, lightDir));
        
        // Continent generation
        float lat = vUv.y;
        float lon = vUv.x;
        float continents = fbm(vec2(lon * 3.0, lat * 5.0) + vec2(1.3, 0.7));
        float isLand = smoothstep(0.45, 0.55, continents);
        
        // Ocean color
        vec3 deepOcean = vec3(0.02, 0.05, 0.18);
        vec3 shallowOcean = vec3(0.04, 0.12, 0.35);
        vec3 ocean = mix(deepOcean, shallowOcean, noise(vec2(lon * 8.0, lat * 8.0)));
        
        // Land color
        vec3 land = vec3(0.12, 0.22, 0.08);
        vec3 desert = vec3(0.35, 0.28, 0.12);
        vec3 snow = vec3(0.8, 0.85, 0.9);
        float isDesert = smoothstep(0.3, 0.35, abs(lat - 0.5));
        float isSnow = smoothstep(0.85, 0.9, lat) + smoothstep(0.15, 0.1, lat);
        vec3 landColor = mix(land, desert, isDesert);
        landColor = mix(landColor, snow, clamp(isSnow, 0.0, 1.0));
        
        // City lights (dark side)
        float nightSide = 1.0 - smoothstep(0.0, 0.3, dot(vNormal, lightDir));
        float cityNoise = step(0.78, fbm(vec2(lon * 12.0, lat * 12.0)));
        vec3 cityLights = vec3(1.0, 0.9, 0.6) * cityNoise * nightSide * isLand * 0.8;
        
        // Specular on ocean
        vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(vNormal, halfDir)), 60.0) * (1.0 - isLand) * 0.5;
        
        vec3 color = mix(ocean, landColor, isLand);
        color *= light;
        color += spec;
        color += cityLights;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }), []);

  const cloudMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      lightDir: { value: new THREE.Vector3(5, 3, 5).normalize() }
    },
    transparent: true,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      uniform float time;
      uniform vec3 lightDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (vec2(3.0) - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main() {
        float light = max(0.1, dot(vNormal, lightDir));
        float cloud = fbm(vUv * vec2(4.0, 6.0) + vec2(time * 0.005, 0.0));
        float alpha = smoothstep(0.48, 0.58, cloud) * 0.7;
        vec3 color = vec3(0.95, 0.97, 1.0) * light;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);

  const atmosphereMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { lightDir: { value: new THREE.Vector3(5, 3, 5).normalize() } },
    transparent: true,
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform vec3 lightDir;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
        rim = pow(rim, 2.5);
        float light = max(0.0, dot(vNormal, lightDir));
        vec3 atmoColor = mix(vec3(0.0, 0.3, 0.8), vec3(0.1, 0.5, 1.0), light);
        gl_FragColor = vec4(atmoColor, rim * 0.6);
      }
    `,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    (earthMaterial.uniforms.time as any).value = t;
    (cloudMaterial.uniforms.time as any).value = t;
    if (earthRef.current) earthRef.current.rotation.y = t * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y = t * 0.055;
  });

  return (
    <group>
      {/* Atmosphere glow */}
      <Sphere ref={atmosphereRef} args={[radius * 1.08, 64, 64]}>
        <primitive object={atmosphereMaterial} attach="material" />
      </Sphere>
      {/* Earth surface */}
      <Sphere ref={earthRef} args={[radius, 128, 128]}>
        <primitive object={earthMaterial} attach="material" />
      </Sphere>
      {/* Clouds */}
      <Sphere ref={cloudsRef} args={[radius * 1.012, 64, 64]}>
        <primitive object={cloudMaterial} attach="material" />
      </Sphere>
    </group>
  );
}

export function StarField() {
  const count = 3000;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 150 + Math.random() * 100;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * 1.5 + 0.3;
    return arr;
  }, []);

  const starMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    vertexShader: `
      attribute float size;
      varying float vSize;
      void main() {
        vSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * 2.5;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying float vSize;
      void main() {
        vec2 xy = gl_PointCoord.xy - vec2(0.5);
        float r = dot(xy, xy);
        if (r > 0.25) discard;
        float alpha = (1.0 - r * 4.0) * 0.8;
        vec3 color = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.95, 0.8), vSize * 0.5);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, [positions, sizes]);

  useFrame(({ clock }) => {
    (starMat.uniforms.time as any).value = clock.getElapsedTime();
  });

  return <points geometry={geom} material={starMat} />;
}

export function OrbitingSatellite({ earthRadius = 2, altitudeKm = 650 }: { earthRadius?: number; altitudeKm?: number }) {
  const satRef = useRef<THREE.Mesh>(null);
  const angle = useRef(0);

  const SCALE = earthRadius / 6371;
  const orbitRadius = earthRadius + altitudeKm * SCALE * 0.8;

  useFrame((_, delta) => {
    angle.current += delta * 0.4;
    if (satRef.current) {
      satRef.current.position.set(
        Math.cos(angle.current) * orbitRadius,
        Math.sin(angle.current * 0.3) * orbitRadius * 0.2,
        Math.sin(angle.current) * orbitRadius
      );
    }
  });

  return (
    <group>
      <mesh ref={satRef}>
        <boxGeometry args={[0.04, 0.02, 0.02]} />
        <meshStandardMaterial color="#aaccff" metalness={0.9} roughness={0.1} emissive="#001133" />
      </mesh>
    </group>
  );
}

export function Nebula() {
  const nebulaRef = useRef<THREE.Points>(null);
  const count = 800;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 200;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 2] = -80 + (Math.random() - 0.5) * 40;
    }
    return arr;
  }, []);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 12.0;
      }
    `,
    fragmentShader: `
      uniform float time;
      void main() {
        vec2 xy = gl_PointCoord - vec2(0.5);
        float r = dot(xy, xy) * 4.0;
        if (r > 1.0) discard;
        float alpha = (1.0 - r) * 0.06;
        vec3 col = mix(vec3(0.1, 0.0, 0.3), vec3(0.0, 0.2, 0.5), xy.x + 0.5);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  }), []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(({ clock }) => {
    (mat.uniforms.time as any).value = clock.getElapsedTime();
    if (nebulaRef.current) nebulaRef.current.rotation.y = clock.getElapsedTime() * 0.002;
  });

  return <points ref={nebulaRef} geometry={geom} material={mat} />;
}
