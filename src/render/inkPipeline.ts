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
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform float uNightWarmth;
uniform float uPerspectiveMode;
uniform vec2 uCamNearFar;

float linearizeDepth(float d) {
  if (uPerspectiveMode < 0.5) return d;
  float zNdc = d * 2.0 - 1.0;
  float n = uCamNearFar.x;
  float f = uCamNearFar.y;
  float lin = (2.0 * n * f) / max(0.0001, (f + n - zNdc * (f - n)));
  return clamp((lin - n) / max(0.0001, (f - n)), 0.0, 1.0);
}

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

vec3 hdSkyLinear(vec2 uv) {
  vec3 grad = mix(uSkyBot, uSkyTop, smoothstep(0.0, 1.0, uv.y));
  float sunGlow = smoothstep(0.85, 0.0, length(uv - vec2(0.78, 0.82))) * 0.12 * (1.0 - uDarkTheme);
  return grad + vec3(1.0, 0.88, 0.68) * sunGlow;
}

void main() {
  vec3 col = texture2D(uColorTex, vUv).rgb;
  bool isPocket = uPocketMode > 0.5;
  bool isPixel = uPixelMode > 0.5;
  bool isHd = !isPocket && !isPixel;

  vec2 wobble = isPocket
    ? vec2(sin(vUv.y * 240.0), cos(vUv.x * 240.0)) * uTexelSize * 0.85
    : vec2(0.0);
  vec2 sampleUv = vUv + wobble;
  vec2 eOff = isPocket
    ? uTexelSize * 1.15
    : isPixel
      ? uTexelSize * 1.0
      : uTexelSize * 2.15;

  float dC = texture2D(uDepthTex, vUv).r;
  float dL = texture2D(uDepthTex, sampleUv - vec2(eOff.x, 0.0)).r;
  float dR = texture2D(uDepthTex, sampleUv + vec2(eOff.x, 0.0)).r;
  float dU = texture2D(uDepthTex, sampleUv + vec2(0.0, eOff.y)).r;
  float dD = texture2D(uDepthTex, sampleUv - vec2(0.0, eOff.y)).r;

  float ldL = linearizeDepth(dL);
  float ldR = linearizeDepth(dR);
  float ldU = linearizeDepth(dU);
  float ldD = linearizeDepth(dD);

  vec3 nC = texture2D(uNormalTex, sampleUv).rgb * 2.0 - 1.0;
  vec3 nL = texture2D(uNormalTex, sampleUv - vec2(eOff.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nR = texture2D(uNormalTex, sampleUv + vec2(eOff.x, 0.0)).rgb * 2.0 - 1.0;
  vec3 nU = texture2D(uNormalTex, sampleUv + vec2(0.0, eOff.y)).rgb * 2.0 - 1.0;
  vec3 nD = texture2D(uNormalTex, sampleUv - vec2(0.0, eOff.y)).rgb * 2.0 - 1.0;

  // Depth discontinuity for crisp silhouette ink (orthographic raw or linearized perspective)
  float minD = min(min(dL, dR), min(dU, dD));
  float minLD = min(min(ldL, ldR), min(ldU, ldD));
  float maxLD = max(max(ldL, ldR), max(ldU, ldD));
  float depthDiff = maxLD - minLD;
  float bgCutoff = uPerspectiveMode > 0.5 ? 0.99992 : 0.9992;
  float isBg = step(bgCutoff, min(dC, minD));
  float depthEdge = uPerspectiveMode > 0.5
    ? smoothstep(0.0038, 0.015, depthDiff) * (1.0 - isBg)
    : smoothstep(0.0055, 0.016, depthDiff) * (1.0 - isBg);

  if (isPocket && isBg > 0.5) {
    vec3 paperSrgb = pocketPaperSrgb(vUv);
    float paperVig = smoothstep(0.65, 1.32, length(vUv - 0.5) * 1.42) * 0.05;
    gl_FragColor = vec4(paperSrgb * (1.0 - paperVig), 1.0);
    return;
  }

  if (isHd && isBg > 0.5) {
    vec3 skySrgb = pow(aces(hdSkyLinear(vUv) * 1.06), vec3(1.0 / 2.2));
    float vigBg = 1.0 - smoothstep(0.62, 1.30, length(vUv - 0.5) * 1.42) * 0.14;
    gl_FragColor = vec4(skySrgb * vigBg, 1.0);
    return;
  }

  // Interior normal crease detection
  float nDelta = max(length(nR - nL), length(nU - nD));
  float nearGeom = 1.0 - step(bgCutoff, dC);
  float normalWeight = isPocket ? 0.62 : isHd ? 0.78 : 0.68;
  float normalEdge = smoothstep(0.54, 1.02, nDelta) * nearGeom;
  float edge = clamp(max(depthEdge, normalEdge * normalWeight), 0.0, 1.0) * uInkStrength;

  // Sunlit top-edge rim highlight (strong warm bounce in HD storybook, subtle in pocket/pixel)
  float topCrease = clamp(nC.y - nD.y, 0.0, 1.0) * nearGeom;
  float rimGain = isHd ? 0.11 : isPocket ? 0.03 : 0.065;
  col += vec3(rimGain, rimGain * 0.90, rimGain * 0.70) * smoothstep(0.24, 0.72, topCrease) * (1.0 - uNightWarmth * 0.65);

  // Soft warm bloom (lush in HD storybook; night-only in pocket watercolor; gentle in pixel)
  vec3 c1 = texture2D(uColorTex, vUv + vec2(uTexelSize.x * 2.2, 0.0)).rgb;
  vec3 c2 = texture2D(uColorTex, vUv - vec2(uTexelSize.x * 2.2, 0.0)).rgb;
  vec3 c3 = texture2D(uColorTex, vUv + vec2(0.0, uTexelSize.y * 2.2)).rgb;
  vec3 c4 = texture2D(uColorTex, vUv - vec2(0.0, uTexelSize.y * 2.2)).rgb;
  vec3 avgBloom = (c1 + c2 + c3 + c4) * 0.25;
  float bright = max(dot(avgBloom, vec3(0.299, 0.587, 0.114)) - 0.82, 0.0);
  float bloomAmt = isHd
    ? clamp(bright * 0.68, 0.0, 0.56)
    : isPocket
      ? clamp(bright * 0.45, 0.0, 0.36) * smoothstep(0.35, 0.95, uNightWarmth)
      : clamp(bright * 0.44, 0.0, 0.38);
  col += avgBloom * bloomAmt;

  if (isPocket) {
    if (dC >= bgCutoff) {
      vec3 extPaper = pocketPaperSrgb(vUv);
      col = pow(extPaper, vec3(2.2));
    }

    vec3 srgb = pow(aces(col * 1.02), vec3(1.0 / 2.2));
    vec2 cssPos = vUv * uViewportCss;

    if (dC < bgCutoff) {
      // 1. Flat architectural watercolor wash (5-stop soft luminance quantization + matte desaturation)
      float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
      float qLuma = floor(luma * 5.0 + 0.5) / 5.0;
      float flatLuma = mix(luma, qLuma, 0.54);
      vec3 celCol = mix(srgb, clamp(srgb * (flatLuma / max(luma, 0.001)), 0.0, 1.0), 0.72);
      srgb = mix(vec3(flatLuma), celCol, 0.84);

      // 2. Cool architectural slate-blue shadow wash in daytime
      float shadowTintMask = smoothstep(0.58, 0.24, luma) * (1.0 - uDarkTheme);
      srgb = mix(srgb, mix(srgb, vec3(0.38, 0.46, 0.59), 0.28), shadowTintMask);

      // 3. 45-degree technical pen cross-hatching on shaded planes
      float shadeMask = smoothstep(0.56, 0.24, luma) * (1.0 - uDarkTheme);
      float diag1 = smoothstep(0.76, 0.96, sin((cssPos.x + cssPos.y) * 1.25));
      float diag2 = smoothstep(0.82, 0.98, sin((cssPos.x - cssPos.y) * 1.25)) * smoothstep(0.36, 0.16, luma);
      float hatch = max(diag1 * 0.55, diag2 * 0.45) * shadeMask;
      srgb = mix(srgb, vec3(0.24, 0.23, 0.26), hatch * 0.30);

      // 4. Cotton paper tooth texture across painted surfaces
      float tooth = (fract(sin(dot(floor(cssPos * 0.9), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.042;
      srgb = clamp(srgb + tooth * (1.0 - uDarkTheme * 0.55), 0.0, 1.0);
    }

    // 5. Hue-tinted fine technical fountain pen ink (lineOf equivalent)
    vec3 pocketInk = dC >= bgCutoff
      ? vec3(0.18, 0.15, 0.13)
      : mix(srgb * 0.22, vec3(0.14, 0.12, 0.10), 0.42);
    srgb = mix(srgb, pocketInk, edge * 0.88);

    float paperVig = smoothstep(0.65, 1.32, length(vUv - 0.5) * 1.42) * 0.05;
    gl_FragColor = vec4(srgb * (1.0 - paperVig), 1.0);
    return;
  }

  if (isHd) {
    if (dC >= bgCutoff) {
      col = hdSkyLinear(vUv);
    }
    vec3 brushInk = pow(vec3(0.176, 0.114, 0.078), vec3(2.2)); // warm walnut-sepia storybook brush #2d1d14
    col = mix(col, brushInk, edge * 0.92);

    vec3 srgb = pow(aces(col * 1.08), vec3(1.0 / 2.2));
    if (dC < bgCutoff) {
      float luma = dot(srgb, vec3(0.299, 0.587, 0.114));
      srgb = clamp(mix(vec3(luma), srgb, 1.24), 0.0, 1.0);
      srgb *= mix(vec3(1.04, 1.01, 0.96), vec3(1.0), uDarkTheme);
    }
    float vig = 1.0 - smoothstep(0.62, 1.30, length(vUv - 0.5) * 1.42) * 0.14;
    gl_FragColor = vec4(clamp(srgb * vig, 0.0, 1.0), 1.0);
    return;
  }

  // Crisp Retro 2px Pixel Diorama (uPixelMode > 0.5)
  col = mix(col, pow(uInkColor, vec3(2.2)), edge);
  float b = (bayer4(vUv * uPixelGrid) - 0.5) * 0.024;
  col = max(col + b, vec3(0.0));
  vec3 srgb = pow(aces(col * 1.05), vec3(1.0 / 2.2));
  if (dC < bgCutoff) {
    vec3 quant = floor(srgb * 26.0 + 0.5) / 26.0;
    srgb = mix(srgb, quant, 0.45);
  }
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
        uInkColor: { value: new THREE.Color('#1c1816') },
        uSkyTop: { value: new THREE.Color('#47688a') },
        uSkyBot: { value: new THREE.Color('#a8c2d4') },
        uNightWarmth: { value: 0 },
        uPerspectiveMode: { value: 0.0 },
        uCamNearFar: { value: new THREE.Vector2(0.5, 120.0) },
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
        style === 'pixel' ? 0.88 : style === 'pocket' ? 0.80 : 0.78;
    }
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    nightWarmth: number,
    isDarkSky: boolean,
    skyTopHex: string,
    skyBotHex: string,
    toggleFxForNormals: (hidden: boolean) => void,
  ): void {
    this.compositeMat.uniforms.uNightWarmth.value = nightWarmth;
    this.compositeMat.uniforms.uDarkTheme.value = isDarkSky ? 1.0 : 0.0;
    this.compositeMat.uniforms.uSkyTop.value.set(skyTopHex);
    this.compositeMat.uniforms.uSkyBot.value.set(skyBotHex);

    const isPersp = camera instanceof THREE.PerspectiveCamera;
    this.compositeMat.uniforms.uPerspectiveMode.value = isPersp ? 1.0 : 0.0;
    if (isPersp) {
      this.compositeMat.uniforms.uCamNearFar.value.set(camera.near, camera.far);
    } else if (camera instanceof THREE.OrthographicCamera) {
      this.compositeMat.uniforms.uCamNearFar.value.set(camera.near, camera.far);
    }

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

    // Pass 3: Ink Outlines + Pixel Dither / HD Storybook / Pocket Watercolor Composite to Screen
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
