import './style.css';
import { CATALOG, CatalogItem } from './assets/modelLibrary';
import { playChimeSound, playUiTick } from './audio/sfx';
import { DioramaEngine } from './world/dioramaEngine';
import { fetchOsmArea, geocodePlace } from './world/osmFetcher';
import {
  CameraPresetId,
  PRESET_REGIONS,
  RegionId,
  RenderStyleId,
  SeasonId,
  TimeMode,
  WeatherId,
  buildCustomBlueprint,
  fetchLiveWeather,
} from './world/regions';

declare global {
  interface Window {
    setRegion?: (id: Exclude<RegionId, 'custom'>) => void;
    setCustomCoords?: (lat: number, lon: number) => Promise<void>;
    loadOsmCoords?: (lat: number, lon: number, label?: string) => Promise<void>;
    setSeason?: (s: SeasonId) => void;
    setTimeMode?: (t: TimeMode) => void;
    setSpecialScene?: (id: string | null) => void;
    setEclipseOffset?: (offset: number) => void;
    setWeather?: (w: WeatherId) => void;
    setRenderStyle?: (st: RenderStyleId) => void;
    setCameraOrbit?: (az: number, pol: number, zoom?: number) => void;
    setCameraPreset?: (preset: CameraPresetId) => void;
    placeCatalogItem?: (id: string, x: number, z: number, rotY?: number) => unknown;
    getDioramaStats?: () => ReturnType<DioramaEngine['getState']>;
    __renderReady?: boolean;
    __modelsLoaded?: boolean;
    __stats?: Record<string, unknown>;
  }
}

const SEASON_LABELS: Record<SeasonId, string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

const WEATHER_LABELS: Record<WeatherId, string> = {
  clear: '晴朗',
  breeze: '微风',
  rain: '细雨',
  snow: '飘雪',
};

function bootstrap(): void {
  const maybeCanvas = document.getElementById('gl-canvas') as HTMLCanvasElement | null;
  if (!maybeCanvas) throw new Error('Missing #gl-canvas');
  const canvas: HTMLCanvasElement = maybeCanvas;

  const loadingBadge = document.getElementById('loading-badge');
  const locName = document.getElementById('loc-name');
  const locSub = document.getElementById('loc-sub');
  const fieldNote = document.getElementById('field-note');
  const legendRow = document.getElementById('legend-row');
  const weatherPill = document.getElementById('weather-pill');
  const placedCountPill = document.getElementById('placed-count-pill');
  const buildHint = document.getElementById('build-hint');

  const scenePopover = document.getElementById('scene-popover');
  const specialSceneRow = document.getElementById('special-scene-row');
  const buildDrawer = document.getElementById('build-drawer');
  const regionModal = document.getElementById('region-modal');
  const catalogStrip = document.getElementById('catalog-strip');

  const btnToggleBuild = document.getElementById('btn-toggle-build');
  const btnToggleScene = document.getElementById('btn-toggle-scene');
  const btnOpenRegions = document.getElementById('btn-open-regions');
  const btnCloseScene = document.getElementById('btn-close-scene');
  const btnCloseBuild = document.getElementById('btn-close-build');
  const btnCloseRegions = document.getElementById('btn-close-regions');
  const btnRotatePiece = document.getElementById('btn-rotate-piece');
  const btnDeleteMode = document.getElementById('btn-delete-mode');
  const btnUndoPiece = document.getElementById('btn-undo-piece');
  const btnResetRegion = document.getElementById('btn-reset-region');
  const btnOrbitLeft = document.getElementById('btn-orbit-left');
  const btnOrbitRight = document.getElementById('btn-orbit-right');
  const btnCamReset = document.getElementById('btn-cam-reset');
  const btnSyncLive = document.getElementById('btn-sync-live');
  const btnApplyCoord = document.getElementById('btn-apply-coord');
  const inputPlace = document.getElementById('input-place') as HTMLInputElement | null;
  const inputLat = document.getElementById('input-lat') as HTMLInputElement | null;
  const inputLon = document.getElementById('input-lon') as HTMLInputElement | null;
  const coordStatus = document.getElementById('coord-status');

  const styleBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.style-btn'));
  const timeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-time]'));
  const seasonBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-season]'));
  const weatherBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-weather]'));
  const catTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.cat-btn'));
  const regionCards = Array.from(document.querySelectorAll<HTMLButtonElement>('.region-card'));
  const camBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-cam]'));
  const quickChips = Array.from(document.querySelectorAll<HTMLButtonElement>('.osm-quick-chip'));

  let activeCat: CatalogItem['category'] = 'building';
  let isFetchingCustom = false;

  function renderCatalogStrip(): void {
    if (!catalogStrip) return;
    const st = engine.getState();
    const items = CATALOG.filter((c) => c.category === activeCat);
    catalogStrip.innerHTML = '';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'catalog-card';
      btn.dataset.catalog = item.id;
      if (st.toolMode === 'place' && st.selectedCatalogId === item.id) {
        btn.classList.add('active');
      }
      btn.innerHTML = `<span class="cc-ico">${item.icon}</span><span class="cc-lbl">${item.label}</span>`;
      btn.addEventListener('click', () => {
        playUiTick();
        engine.setToolMode('place', item.id);
      });
      catalogStrip.appendChild(btn);
    }
  }

  function renderSpecialScenes(): void {
    if (!specialSceneRow) return;
    const st = engine.getState();
    specialSceneRow.innerHTML = '';
    for (const sp of st.region.specialScenes) {
      const btn = document.createElement('button');
      btn.className = 'special-chip';
      btn.dataset.special = sp.id;
      if (st.activeSpecialSceneId === sp.id) btn.classList.add('active');
      btn.textContent = `${sp.icon} ${sp.label}`;
      btn.addEventListener('click', () => {
        playChimeSound();
        engine.setSpecialScene(sp.id);
      });
      specialSceneRow.appendChild(btn);
    }
  }

  function syncHud(): void {
    const st = engine.getState();
    const isLightPaper =
      st.renderStyle === 'pocket' && st.timeMode !== 'night' && st.timeMode !== 'eclipse';
    document.documentElement.classList.toggle('theme-pocket', isLightPaper);

    if (locName) locName.textContent = st.region.name;
    if (locSub) locSub.textContent = st.region.badgeText;

    if (fieldNote) {
      const activeSpecial = st.region.specialScenes.find(
        (s) => s.id === st.activeSpecialSceneId,
      );
      fieldNote.textContent = activeSpecial
        ? activeSpecial.note
        : st.region.fieldNotes[st.season] || st.region.subtitle;
    }

    if (legendRow) {
      const parts = [
        `<span class="legend-pill">🏠 ${st.legendCounts.buildings}</span>`,
        `<span class="legend-pill">🌳 ${st.legendCounts.nature}</span>`,
        `<span class="legend-pill">🐑 ${st.legendCounts.living}</span>`,
      ];
      if (st.osmBuildingCount > 0 || st.osmRoadCount > 0) {
        parts.push(`<span class="legend-pill">🗺️ OSM ${st.osmBuildingCount}栋/${st.osmRoadCount}路</span>`);
      }
      legendRow.innerHTML = parts.join('');
    }

    if (weatherPill) {
      const activeSpecial = st.region.specialScenes.find(
        (s) => s.id === st.activeSpecialSceneId,
      );
      const timeTag = activeSpecial
        ? ` · ${activeSpecial.label}`
        : st.timeMode === 'eclipse'
          ? ' · 日食'
          : st.timeMode === 'night'
            ? ' · 夜'
            : '';
      weatherPill.textContent = `${SEASON_LABELS[st.season]} · ${WEATHER_LABELS[st.weather]}${timeTag}`;
    }
    if (placedCountPill) placedCountPill.textContent = `共 ${st.placedCount} 处可改建`;

    for (const b of styleBtns) b.classList.toggle('active', b.dataset.style === st.renderStyle);
    for (const b of timeBtns) b.classList.toggle('active', b.dataset.time === st.timeMode);
    for (const b of seasonBtns) b.classList.toggle('active', b.dataset.season === st.season);
    for (const b of weatherBtns) b.classList.toggle('active', b.dataset.weather === st.weather);
    for (const b of catTabs) b.classList.toggle('active', b.dataset.cat === activeCat);
    for (const b of regionCards) b.classList.toggle('active', b.dataset.region === st.region.id);

    canvas.classList.toggle('place-cursor', st.toolMode === 'place');
    canvas.classList.toggle('delete-cursor', st.toolMode === 'delete');

    btnDeleteMode?.classList.toggle('danger-active', st.toolMode === 'delete');
    btnToggleBuild?.classList.toggle('active', !buildDrawer?.classList.contains('hidden'));
    btnToggleScene?.classList.toggle('active', !scenePopover?.classList.contains('hidden'));

    if (buildHint) {
      if (st.toolMode === 'delete') {
        buildHint.textContent = '拆除模式：点击岛上任意建筑、树木或小动物即可移除（按住拖拽仍可旋转岛屿）';
      } else if (st.toolMode === 'place') {
        const cur = CATALOG.find((c) => c.id === st.selectedCatalogId);
        buildHint.textContent = `摆放「${cur?.label ?? st.selectedCatalogId}」：点击岛屿网格落子 · R / 🔄 旋转 · 拖拽旋转视角`;
      } else {
        buildHint.textContent = '选择下方任意积木点击地面即可摆放到岛屿上';
      }
    }

    renderSpecialScenes();
    renderCatalogStrip();
    window.__modelsLoaded = st.modelsLoaded;
    window.__stats = {
      regionId: st.region.id,
      season: st.season,
      timeMode: st.timeMode,
      weather: st.weather,
      renderStyle: st.renderStyle,
      activeSpecialSceneId: st.activeSpecialSceneId,
      toolMode: st.toolMode,
      placedCount: st.placedCount,
      osmBuildingCount: st.osmBuildingCount,
      osmRoadCount: st.osmRoadCount,
      modelsLoaded: st.modelsLoaded,
      cameraAzimuth: st.cameraAzimuth,
      cameraPolar: st.cameraPolar,
      cameraZoom: st.cameraZoom,
    };
  }

  const engine = new DioramaEngine(
    canvas,
    syncHud,
    () => {
      if (loadingBadge) loadingBadge.classList.add('hidden');
      syncHud();
    },
  );

  async function applyCustomLocation(lat: number, lon: number, label?: string): Promise<void> {
    if (isFetchingCustom) return;
    isFetchingCustom = true;
    if (btnApplyCoord) btnApplyCoord.textContent = '⏳ 正在拉取 OSM 街区与气象...';
    if (coordStatus) coordStatus.textContent = '正在请求 OpenStreetMap 建筑/道路/水系及 Open-Meteo 实况...';

    try {
      const [osmRes, liveRes] = await Promise.allSettled([
        fetchOsmArea(lat, lon, label, 200),
        fetchLiveWeather(lat, lon),
      ]);
      const osm = osmRes.status === 'fulfilled' ? osmRes.value : undefined;
      const live = liveRes.status === 'fulfilled' ? liveRes.value : undefined;

      const bp = buildCustomBlueprint(lat, lon, live, osm, label);
      engine.setRegion(bp);
      playChimeSound();

      if (coordStatus) {
        if (osm && osm.stats.source === 'osm' && (osm.buildings.length > 0 || osm.roads.length > 0)) {
          coordStatus.textContent = `已加载 OSM 街区（${osm.stats.buildingCount}栋建筑 / ${osm.stats.roadCount}条路网）${live ? ' · ' + live.summary : ''}`;
        } else {
          coordStatus.textContent = `该位置 OSM 公开轮廓较少，已按气候地貌混合生成${live ? ' · ' + live.summary : ''}`;
        }
      }
      regionModal?.classList.add('hidden');
    } finally {
      isFetchingCustom = false;
      if (btnApplyCoord) btnApplyCoord.textContent = '✨ 拉取真实 OSM 街区 + 实时天气';
    }
  }

  // URL overrides for deterministic testing or deep linking
  const params = new URLSearchParams(window.location.search);
  const qRegion = params.get('region') as Exclude<RegionId, 'custom'> | null;
  if (qRegion && PRESET_REGIONS[qRegion]) {
    engine.setRegion(PRESET_REGIONS[qRegion]);
  }
  const qSeason = params.get('season') as SeasonId | null;
  if (qSeason && ['spring', 'summer', 'autumn', 'winter'].includes(qSeason)) {
    engine.setSeason(qSeason);
  }
  const qTime = params.get('time') as TimeMode | null;
  if (qTime && ['morning', 'day', 'sunset', 'night', 'eclipse'].includes(qTime)) {
    engine.setTimeMode(qTime);
  }
  const qWeather = params.get('weather') as WeatherId | null;
  if (qWeather && ['clear', 'breeze', 'rain', 'snow'].includes(qWeather)) {
    engine.setWeather(qWeather);
  }
  const qStyle = params.get('style') as RenderStyleId | null;
  if (qStyle && ['pocket', 'pixel', 'hd'].includes(qStyle)) {
    engine.setRenderStyle(qStyle);
  }

  // Expose QA / Automation API
  window.getDioramaStats = () => engine.getState();
  window.setRegion = (id) => {
    if (PRESET_REGIONS[id]) engine.setRegion(PRESET_REGIONS[id]);
  };
  window.setCustomCoords = async (lat, lon) => applyCustomLocation(lat, lon);
  window.loadOsmCoords = async (lat, lon, label) => applyCustomLocation(lat, lon, label);
  window.setSeason = (s) => engine.setSeason(s);
  window.setTimeMode = (t) => engine.setTimeMode(t);
  window.setSpecialScene = (id) => engine.setSpecialScene(id);
  window.setEclipseOffset = (off) => engine.setEclipseOffset(off);
  window.setWeather = (w) => engine.setWeather(w);
  window.setRenderStyle = (st) => engine.setRenderStyle(st);
  window.setCameraOrbit = (az, pol, zoom) => engine.setCameraOrbit(az, pol, zoom);
  window.setCameraPreset = (preset) => engine.setCameraPreset(preset);
  window.placeCatalogItem = (id, x, z, rotY) => engine.placeCatalogItem(id, x, z, rotY);

  // Wire UI Events
  for (const b of styleBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      const s = b.dataset.style;
      const styleId: RenderStyleId = s === 'pixel' ? 'pixel' : s === 'hd' ? 'hd' : 'pocket';
      engine.setRenderStyle(styleId);
    });
  }
  for (const b of timeBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      engine.setTimeMode(b.dataset.time as TimeMode);
    });
  }
  for (const b of seasonBtns) {
    b.addEventListener('click', () => {
      playChimeSound();
      engine.setSeason(b.dataset.season as SeasonId);
    });
  }
  for (const b of weatherBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      engine.setWeather(b.dataset.weather as WeatherId);
    });
  }
  for (const b of catTabs) {
    b.addEventListener('click', () => {
      playUiTick();
      activeCat = b.dataset.cat as CatalogItem['category'];
      const first = CATALOG.find((c) => c.category === activeCat);
      if (first) engine.setToolMode('place', first.id);
      syncHud();
    });
  }
  for (const b of camBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      for (const other of camBtns) other.classList.toggle('active', other === b);
      engine.setCameraPreset((b.dataset.cam as CameraPresetId) || 'cinematic');
    });
  }
  for (const card of regionCards) {
    card.addEventListener('click', () => {
      const rid = card.dataset.region as Exclude<RegionId, 'custom'>;
      if (PRESET_REGIONS[rid]) {
        playChimeSound();
        engine.setRegion(PRESET_REGIONS[rid]);
        regionModal?.classList.add('hidden');
      }
    });
  }
  for (const chip of quickChips) {
    chip.addEventListener('click', () => {
      const lat = Number(chip.dataset.lat);
      const lon = Number(chip.dataset.lon);
      const label = chip.dataset.label || '';
      if (inputLat) inputLat.value = String(lat);
      if (inputLon) inputLon.value = String(lon);
      if (inputPlace) inputPlace.value = '';
      void applyCustomLocation(lat, lon, label);
    });
  }

  btnToggleBuild?.addEventListener('click', () => {
    playUiTick();
    scenePopover?.classList.add('hidden');
    const opening = buildDrawer?.classList.contains('hidden');
    buildDrawer?.classList.toggle('hidden');
    engine.setToolMode(opening ? 'place' : 'view');
    syncHud();
  });

  btnToggleScene?.addEventListener('click', () => {
    playUiTick();
    buildDrawer?.classList.add('hidden');
    engine.setToolMode('view');
    scenePopover?.classList.toggle('hidden');
    syncHud();
  });

  btnCloseBuild?.addEventListener('click', () => {
    buildDrawer?.classList.add('hidden');
    engine.setToolMode('view');
    syncHud();
  });

  btnCloseScene?.addEventListener('click', () => {
    scenePopover?.classList.add('hidden');
    syncHud();
  });

  btnOpenRegions?.addEventListener('click', () => {
    playUiTick();
    regionModal?.classList.remove('hidden');
  });

  btnCloseRegions?.addEventListener('click', () => {
    regionModal?.classList.add('hidden');
  });

  btnRotatePiece?.addEventListener('click', () => {
    playUiTick();
    engine.rotatePreview90();
  });

  btnDeleteMode?.addEventListener('click', () => {
    playUiTick();
    const cur = engine.getState().toolMode;
    engine.setToolMode(cur === 'delete' ? 'place' : 'delete');
  });

  btnUndoPiece?.addEventListener('click', () => {
    engine.undoLastPlacement();
  });

  btnResetRegion?.addEventListener('click', () => {
    playChimeSound();
    engine.resetRegionToDefault();
  });

  btnOrbitLeft?.addEventListener('click', () => engine.orbitRotateBy(Math.PI * 0.25));
  btnOrbitRight?.addEventListener('click', () => engine.orbitRotateBy(-Math.PI * 0.25));
  btnCamReset?.addEventListener('click', () => {
    for (const b of camBtns) b.classList.toggle('active', b.dataset.cam === 'cinematic');
    engine.resetCamera();
  });

  btnSyncLive?.addEventListener('click', async () => {
    const st = engine.getState();
    btnSyncLive.textContent = '⏳ 同步中...';
    try {
      const live = await fetchLiveWeather(st.region.lat, st.region.lon);
      engine.setWeather(live.weather);
      engine.setSeason(live.suggestedSeason);
      if (locSub) locSub.textContent = `${st.region.lat.toFixed(2)}, ${st.region.lon.toFixed(2)} · 实况 ${live.summary}`;
      playChimeSound();
    } catch {
      // ignore fallback cleanly
    } finally {
      btnSyncLive.textContent = '📡 同步当地实况';
    }
  });

  async function handleCustomSubmit(): Promise<void> {
    const placeText = inputPlace?.value.trim() ?? '';
    if (placeText.length > 0) {
      if (coordStatus) coordStatus.textContent = `正在解析地名「${placeText}」的全球坐标...`;
      if (btnApplyCoord) btnApplyCoord.textContent = '⏳ 检索地名...';
      try {
        const geo = await geocodePlace(placeText);
        if (inputLat) inputLat.value = geo.lat.toFixed(4);
        if (inputLon) inputLon.value = geo.lon.toFixed(4);
        await applyCustomLocation(geo.lat, geo.lon, geo.displayName);
      } catch (err) {
        if (btnApplyCoord) btnApplyCoord.textContent = '✨ 拉取真实 OSM 街区 + 实时天气';
        if (coordStatus) {
          coordStatus.textContent = err instanceof Error ? err.message : '地名解析失败，请直接输入经纬度';
        }
      }
      return;
    }

    const lat = Number(inputLat?.value ?? 31.2162);
    const lon = Number(inputLon?.value ?? 121.4404);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      if (coordStatus) coordStatus.textContent = '请输入有效经纬度（纬度 -90~90，经度 -180~180）';
      return;
    }
    await applyCustomLocation(lat, lon);
  }

  btnApplyCoord?.addEventListener('click', () => {
    void handleCustomSubmit();
  });
  inputPlace?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCustomSubmit();
    }
  });

  // Canvas tap vs drag-to-orbit disambiguation (6px threshold)
  let downPt = { x: 0, y: 0 };
  let isDown = false;
  canvas.addEventListener('pointerdown', (e) => {
    isDown = true;
    downPt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    engine.updateHover(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!isDown) return;
    isDown = false;
    const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
    if (dist <= 6) {
      engine.handleTap(e.clientX, e.clientY);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'r') {
      engine.rotatePreview90();
    } else if (k === 'escape') {
      buildDrawer?.classList.add('hidden');
      scenePopover?.classList.add('hidden');
      regionModal?.classList.add('hidden');
      engine.setToolMode('view');
    }
  });

  window.addEventListener('resize', () => {
    engine.resize(window.innerWidth, window.innerHeight);
  });

  syncHud();

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    engine.step(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap();
