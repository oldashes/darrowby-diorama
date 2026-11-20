import * as THREE from 'three';
import { RenderStyleId } from '../world/regions';

const COMPOSITE_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FS = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D uColorTex;
uniform sampler2D uDepthTex;
uniform sampler2D uNormalTex;
uniform vec2 uTexelSize;
uniform vec2 uPixelGrid;
uniform float uPixelMode;
uniform float uPocketMode;
uniform vec2 uViewportCss;
uniform float uDarkTheme;
uniform float uInkStrength;
uniform vec3 uInkColor;
uniform float uNightWarmth;

float bayer4(vec2 p) {
  vec2 c = floor(mod(p, 4.0));
  int x = int(c.x);
  int y = int(c.y);
  int idx = x + y * 4;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 pocketPaperSrgb(vec2 uv) {
  vec2 cssPos = uv * uViewportCss;
  vec3 base = mix(vec3(0.949, 0.929, 0.878), vec3(0.118, 0.145, 0.204), uDarkTheme);
  vec3 dotCol = mix(vec3(0.773, 0.737, 0.671), vec3(0.235, 0.282, 0.388), uDarkTheme);

  vec2 cell = mod(cssPos, 24.0) - 12.0;
  float dotMask = 1.0 - smoothstep(0.85, 1.45, length(cell));
  vec3 col = mix(base, dotCol, dotMask * 0.55);

  float grain = (fract(sin(dot(floor(cssPos), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.016;
  return clamp(col + grain, 0.0, 1.0);
}

void main() {
  vec3 col = texture2D(uColorTex, vUv).rgb;
  vec2 wobble = uPocketMode > 0.5
    ? vec2(sin(vUv.y * 210.0), cos(vUv.x * 210.0)) * uTexelSize * 0.35
    : vec2(0.0);
  vec2 sampleUv = vUv + wobble;
  vec2 eOff = uPocketMode > 0.5
    ? uTexelSize * 1.22
    : uTexelSize * mix(1.75, 1.0, uPixelMode);

  float dC = texture2D(uDepthTex, vUv).r;
  float dL = texture2D(uDepthTex, sampleUv - vec2(eOff.x, 0.0)).r;
  float dR = texture2D(uDepthTex, sampleUv + vec2(eOff.x, 0.0)).r;
  float dU = texture2D(uDepthTex, sampleUv + vec2(0.0, eOff.y)).r;
  float dD = texture2D(uDepthTex, sampleUv - vec2(0.0, eOff.y)).r;

  vec3 nC = texture2D(uNormalTex, sampleUv).rgb * 2.0 - 1.0;
  vec3 nL = texture2D(uNormalTex, sampleUv - vec2(eOff.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nR = texture2D(uNormalTex, sampleUv + vec2(eOff.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nU = texture2D(uNormalTex, sampleUv + vec2(0.0, eOff.y)).rgb * 2.0 - 1.0;
  vec3 nD = texture2D(uNormalTex, sampleUv - vec2(0.0, eOff.y)).rgb * 2.0 - 1.0;

  // Orthographic linear depth discontinuity for crisp silhouette ink
  float minD = min(min(dL, dR), min(dU, dD));
  float maxD = max(max(dL, dR), max(dU, dD));
  float depthDiff = maxD - minD;
  float isBg = step(0.9992, min(dC, minD));
  float depthEdge = smoothstep(0.0055, 0.016, depthDiff) * (1.0 - isBg);

  if (uPocketMode > 0.5 && isBg > 0.5) {
    vec3 paperSrgb = pocketPaperSrgb(vUv);
    float paperVig = smoothstep(0.65, 1.32, length(vUv - 0.5) * 1.42) * 0.05;
    gl_FragColor = vec4(paperSrgb * (1.0 - paperVig), 1.0);
    return;
  }

  // Clean interior normal crease detection (suppressed on sky/void and flat grass)
  float nDelta = max(length(nR - nL), length(nU - nD));
  float nearGeom = 1.0 - step(0.9985, dC);
  float normalEdge = smoothstep(0.56, 1.05, nDelta) * nearGeom;

  float edge = clamp(max(depthEdge, normalEdge * (uPocketMode > 0.5 ? 0.58 : 0.65)), 0.0, 1.0) * uInkStrength;

  // Subtle sunlit storybook top-edge warm highlight on roof ridges and eaves
  float topCrease = clamp(nC.y - nD.y, 0.0, 1.0) * nearGeom;
  col += vec3(0.075, 0.068, 0.052) * smoothstep(0.28, 0.72, topCrease) * (1.0 - uNightWarmth * 0.65);

  // Soft warm bloom around bright glowing cottage windows and street lanterns
  vec3 c1 = texture2D(uColorTex, vUv + vec2(uTexelSize.x * 2.2, 0.0)).rgb;
  vec3 c2 = texture2D(uColorTex, vUv - vec2(uTexelSize.x * 2.2, 0.0)).rgb;
  vec3 c3 = texture2D(uColorTex, vUv + vec2(0.0, uTexelSize.y * 2.2)).rgb;
  vec3 c4 = texture2D(uColorTex, vUv - vec2(0.0, uTexelSize.y * 2.2)).rgb;
  vec3 avgBloom = (c1 + c2 + c3 + c4) * 0.25;
  float bright = max(dot(avgBloom, vec3(0.299, 0.587, 0.114)) - 0.85, 0.0);
  col += avgBloom * clamp(bright * 0.48, 0.0, 0.42);

  if (uPocketMode > 0.5) {
    // Replace exterior clear sky pixel adjacent to island boundary with paper tone to eliminate dark halo
    if (dC >= 0.9992) {
      vec3 extPaper = pocketPaperSrgb(vUv);
      col = pow(extPaper, vec3(2.2));
    }
    vec3 geomCol = dC >= 0.9992 ? vec3(0.16, 0.13, 0.10) : col;
    vec3 pocketInk = mix(geomCol * 0.24, vec3(0.032, 0.024, 0.020), 0.32);
    col = mix(col, pocketInk, edge * 0.82);

    vec3 srgb = pow(aces(col * 1.04), vec3(1.0 / 2.2));
    srgb = mix(
      srgb,
      srgb * vec3(1.015, 1.00, 0.965) + vec3(0.022, 0.020, 0.014) * (1.0 - uDarkTheme),
      0.55
    );
    float paperVig = smoothstep(0.65, 1.32, length(vUv - 0.5) * 1.42) * 0.05;
    gl_FragColor = vec4(srgb * (1.0 - paperVig), 1.0);
    return;
  }

  // Apply crisp sepia-charcoal ink line
  col = mix(col, pow(uInkColor, vec3(2.2)), edge);

  // Optional Quack crisp 2px pixel-dither pass
  if (uPixelMode > 0.5) {
    float b = (bayer4(vUv * uPixelGrid) - 0.5) * 0.022;
    col = max(col + b, vec3(0.0));
  }

  vec3 srgb = pow(aces(col * 1.06), vec3(1.0 / 2.2));

  // Soft studio framing vignette
  float vig = 1.0 - smoothstep(0.58, 1.25, length(vUv - 0.5) * 1.42) * 0.16;
  gl_FragColor = vec4(srgb * vig, 1.0);
}
`;

export class InkPipeline {
  private colorRt: THREE.WebGLRenderTarget;
  private normalRt: THREE.WebGLRenderTarget;
  private depthTex: THREE.DepthTexture;
  private normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private compositeMat: THREE.ShaderMaterial;
  private rtW = 0;
  private rtH = 0;
  private curStyle: RenderStyleId = 'pocket';

  constructor() {
    this.depthTex = new THREE.DepthTexture(2, 2);
    this.depthTex.format = THREE.DepthFormat;
    this.depthTex.type = THREE.UnsignedIntType;
    this.depthTex.minFilter = THREE.NearestFilter;
    this.depthTex.magFilter = THREE.NearestFilter;

    this.colorRt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthTexture: this.depthTex,
      depthBuffer: true,
    });

    this.normalRt = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: COMPOSITE_VS,
      fragmentShader: COMPOSITE_FS,
      uniforms: {
        uColorTex: { value: this.colorRt.texture },
        uDepthTex: { value: this.depthTex },
        uNormalTex: { value: this.normalRt.texture },
        uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
        uPixelGrid: { value: new THREE.Vector2(640, 360) },
        uPixelMode: { value: 0 },
        uPocketMode: { value: 1 },
        uViewportCss: { value: new THREE.Vector2(1280, 720) },
        uDarkTheme: { value: 0 },
        uInkStrength: { value: 0.78 },
        uInkColor: { value: new THREE.Color('#27201b') },
        uNightWarmth: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMat);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number, style: RenderStyleId): void {
    this.compositeMat.uniforms.uViewportCss.value.set(Math.max(2, cssWidth), Math.max(2, cssHeight));

    const w =
      style === 'pixel'
        ? Math.max(240, Math.round(cssWidth * 0.54))
        : Math.max(320, Math.round(cssWidth * Math.min(2, dpr)));
    const h =
      style === 'pixel'
        ? Math.max(240, Math.round(cssHeight * 0.54))
        : Math.max(320, Math.round(cssHeight * Math.min(2, dpr)));

    if (w !== this.rtW || h !== this.rtH || style !== this.curStyle) {
      this.rtW = w;
      this.rtH = h;
      this.curStyle = style;

      const filter = style === 'pixel' ? THREE.NearestFilter : THREE.LinearFilter;
      this.colorRt.texture.minFilter = filter;
      this.colorRt.texture.magFilter = filter;
      this.colorRt.texture.needsUpdate = true;

      this.normalRt.texture.minFilter = filter;
      this.normalRt.texture.magFilter = filter;
      this.normalRt.texture.needsUpdate = true;

      this.depthTex.minFilter = THREE.NearestFilter;
      this.depthTex.magFilter = THREE.NearestFilter;
      this.depthTex.needsUpdate = true;

      this.colorRt.setSize(w, h);
      this.normalRt.setSize(w, h);

      this.compositeMat.uniforms.uTexelSize.value.set(1 / w, 1 / h);
      this.compositeMat.uniforms.uPixelGrid.value.set(w, h);
      this.compositeMat.uniforms.uPixelMode.value = style === 'pixel' ? 1.0 : 0.0;
      this.compositeMat.uniforms.uPocketMode.value = style === 'pocket' ? 1.0 : 0.0;
      this.compositeMat.uniforms.uInkStrength.value =
        style === 'pixel' ? 0.85 : style === 'pocket' ? 0.82 : 0.68;
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    nightWarmth: number,
    isDarkSky: boolean,
    toggleFxForNormals: (hidden: boolean) => void,
  ): void {
    this.compositeMat.uniforms.uNightWarmth.value = nightWarmth;
    this.compositeMat.uniforms.uDarkTheme.value = isDarkSky ? 1.0 : 0.0;

    // Pass 1: Lit Storybook Color + DepthTexture
    renderer.setRenderTarget(this.colorRt);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    // Pass 2: Crisp Opaque Normals (excluding snow, wind ribbons, glass/fx)
    const prevBg = scene.background;
    scene.background = new THREE.Color('#8080ff');
    toggleFxForNormals(true);
    scene.overrideMaterial = this.normalMat;
    renderer.setRenderTarget(this.normalRt);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    toggleFxForNormals(false);
    scene.background = prevBg;

    // Pass 3: Ink Outlines + Pixel Dither / HD Tone / Pocket Paper Composite to Screen
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCam);
  }

  dispose(): void {
    this.colorRt.dispose();
    this.normalRt.dispose();
    this.depthTex.dispose();
    this.normalMat.dispose();
    this.compositeMat.dispose();
  }
}
