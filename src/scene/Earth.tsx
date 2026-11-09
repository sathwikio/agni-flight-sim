import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EARTH_RADIUS_UNITS } from '../simulation/flightModel';
import { QualityMode } from '../simulation/store';

interface EarthProps {
  sunDirection: THREE.Vector3;
  qualityMode: QualityMode;
}

const EARTH_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecCloudsMap;
  uniform vec3 uSunDir;
  uniform float uCloudDrift;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunDir);

    float ndotl = dot(N, L);
    float dayFactor = smoothstep(-0.16, 0.22, ndotl);
    float twilightFactor = smoothstep(-0.24, 0.06, ndotl) * (1.0 - smoothstep(0.0, 0.34, ndotl));

    vec3 daySample = texture2D(uDayMap, vUv).rgb;
    vec3 nightSample = texture2D(uNightMap, vUv).rgb;
    // R = elevation/bump, G = land mask/roughness, B = clouds
    vec3 brc = texture2D(uSpecCloudsMap, vUv).rgb;
    float landMask = brc.g;
    float oceanMask = 1.0 - smoothstep(0.15, 0.45, landMask);

    // Subtle cloud shadow on surface
    vec2 cloudUv = vec2(fract(vUv.x + uCloudDrift * 0.6), vUv.y);
    float cloudShadow = texture2D(uSpecCloudsMap, cloudUv).b;

    // Diffuse illumination with soft wrap around terminator
    float diffuse = max(ndotl, 0.0);
    float shadowedDiffuse = diffuse * (1.0 - cloudShadow * 0.28);
    vec3 dayLit = daySample * (0.09 + 0.98 * pow(shadowedDiffuse, 0.92));

    // Ocean specular reflection (Blinn-Phong sun glint over water)
    vec3 H = normalize(L + V);
    float specBase = pow(max(dot(N, H), 0.0), 42.0);
    vec3 oceanGlint = vec3(1.0, 0.93, 0.82) * specBase * oceanMask * dayFactor * 0.42;

    // Warm atmospheric sunset band along the day-night terminator
    vec3 twilightTint = vec3(0.95, 0.38, 0.12) * twilightFactor * (0.35 + 0.35 * oceanMask);

    // Night-side city lights (masked out over open oceans and bright daylight)
    float nightMask = 1.0 - smoothstep(-0.12, 0.14, ndotl);
    vec3 cityLights = pow(nightSample, vec3(1.35)) * vec3(1.35, 1.05, 0.72) * nightMask * 1.65;
    vec3 nightAmbient = daySample * vec3(0.035, 0.055, 0.095) * nightMask;

    // Subtle Rayleigh limb scatter on the planetary surface edge
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    vec3 limbScatter = mix(vec3(0.08, 0.24, 0.55), vec3(0.32, 0.64, 1.0), dayFactor) * fresnel * (0.18 + 0.52 * dayFactor);

    vec3 color = dayLit + oceanGlint + twilightTint + cityLights + nightAmbient + limbScatter;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const CLOUDS_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const CLOUDS_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uSpecCloudsMap;
  uniform vec3 uSunDir;
  uniform float uCloudDrift;

  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    #include <logdepthbuf_fragment>

    vec2 uvShifted = vec2(fract(vUv.x + uCloudDrift), vUv.y);
    float cloudDensity = texture2D(uSpecCloudsMap, uvShifted).b;
    float alpha = smoothstep(0.12, 0.85, cloudDensity) * 0.72;
    if (alpha < 0.01) discard;

    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(uSunDir);
    float ndotl = dot(N, L);

    float dayLight = smoothstep(-0.18, 0.28, ndotl);
    float twilight = smoothstep(-0.22, 0.04, ndotl) * (1.0 - smoothstep(0.02, 0.28, ndotl));

    vec3 litCloud = mix(vec3(0.03, 0.05, 0.09), vec3(0.96, 0.98, 1.0), dayLight);
    litCloud += vec3(0.95, 0.45, 0.18) * twilight * 0.55;

    gl_FragColor = vec4(litCloud, alpha);
  }
`;

const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uSunDir;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    #include <logdepthbuf_fragment>

    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(uSunDir);

    // Back-face limb intensity
    float viewDot = dot(N, V);
    float rim = pow(clamp(1.0 + viewDot, 0.0, 1.0), 2.35);

    float sunFacing = dot(N, L);
    float daySide = smoothstep(-0.35, 0.35, sunFacing);
    float twilightBand = smoothstep(-0.35, 0.0, sunFacing) * (1.0 - smoothstep(0.0, 0.38, sunFacing));

    vec3 rayleighBlue = vec3(0.22, 0.58, 1.0);
    vec3 sunsetAmber = vec3(0.98, 0.44, 0.16);
    vec3 nightLimb = vec3(0.04, 0.11, 0.25);

    vec3 scatterColor = mix(nightLimb, rayleighBlue, daySide);
    scatterColor = mix(scatterColor, sunsetAmber, twilightBand * 0.65);

    float alpha = rim * (0.16 + 0.72 * daySide);
    gl_FragColor = vec4(scatterColor * (0.85 + 0.5 * daySide), alpha);
  }
`;

export const Earth: React.FC<EarthProps> = ({ sunDirection, qualityMode }) => {
  const { gl } = useThree();
  const cloudDriftRef = useRef(0);

  // Load texture set matching quality mode and properly dispose old textures when toggled
  const textures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const res = qualityMode === 'high' ? '4096' : '2048';
    const maxAniso = Math.min(gl.capabilities.getMaxAnisotropy(), qualityMode === 'high' ? 8 : 2);

    const configure = (tex: THREE.Texture, isColor: boolean) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.anisotropy = maxAniso;
      tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    const day = configure(loader.load(`/textures/earth_day_${res}.jpg`), true);
    const night = configure(loader.load(`/textures/earth_night_${res}.jpg`), true);
    const specClouds = configure(
      loader.load(`/textures/earth_bump_roughness_clouds_${res}.jpg`),
      false
    );

    return { day, night, specClouds };
  }, [qualityMode, gl]);

  useEffect(() => {
    return () => {
      textures.day.dispose();
      textures.night.dispose();
      textures.specClouds.dispose();
    };
  }, [textures]);

  const geometries = useMemo(() => {
    const segs = qualityMode === 'high' ? 128 : 64;
    const cloudSegs = qualityMode === 'high' ? 96 : 48;
    const atmoSegs = qualityMode === 'high' ? 96 : 48;

    return {
      surface: new THREE.SphereGeometry(EARTH_RADIUS_UNITS, segs, segs),
      clouds: new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.0035, cloudSegs, cloudSegs),
      atmosphere: new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.028, atmoSegs, atmoSegs),
    };
  }, [qualityMode]);

  useEffect(() => {
    return () => {
      geometries.surface.dispose();
      geometries.clouds.dispose();
      geometries.atmosphere.dispose();
    };
  }, [geometries]);

  const materials = useMemo(() => {
    const surface = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERTEX_SHADER,
      fragmentShader: EARTH_FRAGMENT_SHADER,
      uniforms: {
        uDayMap: { value: textures.day },
        uNightMap: { value: textures.night },
        uSpecCloudsMap: { value: textures.specClouds },
        uSunDir: { value: sunDirection.clone().normalize() },
        uCloudDrift: { value: 0 },
      },
    });

    const clouds = new THREE.ShaderMaterial({
      vertexShader: CLOUDS_VERTEX_SHADER,
      fragmentShader: CLOUDS_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSpecCloudsMap: { value: textures.specClouds },
        uSunDir: { value: sunDirection.clone().normalize() },
        uCloudDrift: { value: 0 },
      },
    });

    const atmosphere = new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX_SHADER,
      fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSunDir: { value: sunDirection.clone().normalize() },
      },
    });

    return { surface, clouds, atmosphere };
  }, [textures, sunDirection]);

  useEffect(() => {
    return () => {
      materials.surface.dispose();
      materials.clouds.dispose();
      materials.atmosphere.dispose();
    };
  }, [materials]);

  useFrame((_, delta) => {
    cloudDriftRef.current = (cloudDriftRef.current + delta * 0.0012) % 1;
    materials.surface.uniforms.uCloudDrift.value = cloudDriftRef.current;
    materials.clouds.uniforms.uCloudDrift.value = cloudDriftRef.current;
    materials.surface.uniforms.uSunDir.value.copy(sunDirection).normalize();
    materials.clouds.uniforms.uSunDir.value.copy(sunDirection).normalize();
    materials.atmosphere.uniforms.uSunDir.value.copy(sunDirection).normalize();
  });

  return (
    <group name="earth-system">
      <mesh geometry={geometries.surface} material={materials.surface} receiveShadow />
      <mesh geometry={geometries.clouds} material={materials.clouds} />
      <mesh geometry={geometries.atmosphere} material={materials.atmosphere} />
    </group>
  );
};
