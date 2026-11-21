import './style.css';
import { CATALOG, CatalogItem } from './assets/modelLibrary';
import { playChimeSound, playUiTick } from './audio/sfx';
import {
  CONTINENT_STRIPS,
  ContinentStripId,
  CylinderCameraPreset,
  CylinderPlotDef,
  ViewMode,
} from './world/cylinderWorld';
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
    setViewMode?: (m: ViewMode) => void;
    setCylinderStrip?: (s: ContinentStripId) => void;
    setCylinderCameraPreset?: (p: CylinderCameraPreset) => void;
    focusCylinderPlot?: (id: string) => void;
    enterCylinderPlot?: (id?: string) => Promise<void>;
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

  const cylinderPinsEl = document.getElementById('cylinder-pins');
  const cylinderBar = document.getElementById('cylinder-bar');
  const camPresetsBar = document.getElementById('cam-presets');
  const btnEnterPlot = document.getElementById('btn-enter-plot');
  const btnBackCylinder = document.getElementById('btn-back-cylinder');
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

  const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-btn'));
  const stripBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.strip-btn'));
  const cylCamBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.cyl-cam-btn'));
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
    const inCyl = st.viewMode === 'cylinder';
    const isLightPaper =
      st.renderStyle === 'pocket' && st.timeMode !== 'night' && st.timeMode !== 'eclipse';
    document.documentElement.classList.toggle('theme-pocket', isLightPaper);

    cylinderBar?.classList.toggle('hidden', !inCyl);
    camPresetsBar?.classList.toggle('hidden', inCyl);
    btnEnterPlot?.classList.toggle('hidden', !inCyl);
    btnBackCylinder?.classList.toggle('hidden', inCyl);
    btnToggleBuild?.classList.toggle('hidden', inCyl);
    cylinderPinsEl?.classList.toggle('hidden', !inCyl);
    if (inCyl) {
      buildDrawer?.classList.add('hidden');
    }

    const stripDef = CONTINENT_STRIPS[st.cylinderStrip];
    const focused = st.focusedPlot;
    const cylTimeLabel =
      st.timeMode === 'night'
        ? '星夜'
        : st.timeMode === 'sunset'
          ? '暮色'
          : st.timeMode === 'eclipse'
            ? '日食'
            : st.timeMode === 'morning'
              ? '晨曦'
              : '白昼';

    if (inCyl) {
      if (locName) locName.textContent = '库珀空间站 · 奥尼尔圆筒';
      if (locSub) {
        locSub.textContent = focused
          ? `${stripDef.icon} ${stripDef.name} · 聚焦「${focused.name}」（${focused.climateTag}）`
          : `${stripDef.icon} ${stripDef.name} · ${stripDef.subtitle}`;
      }
      if (fieldNote) {
        fieldNote.textContent = focused
          ? `${focused.subtitle}（滚轮前后漫游，点击地标或进入地块精建）`
          : '3 条大陆风貌带 × 极地观星灯塔；滚轮沿气候轴漫游，拖拽抬头见对岸小镇。';
      }
      if (legendRow) {
        legendRow.innerHTML = [
          `<span class="legend-pill">🌏 3 大陆带</span>`,
          `<span class="legend-pill">📍 ${st.cylinderPlotCount} 地块</span>`,
          `<span class="legend-pill">🚋 3 环线电车</span>`,
          `<span class="legend-pill">🪐 极地观测塔</span>`,
        ].join('');
      }
      if (weatherPill) {
        weatherPill.textContent = `${stripDef.name} · ${cylTimeLabel}`;
      }
      if (placedCountPill) {
        placedCountPill.textContent = `共 ${st.cylinderPlotCount} 处空间站地块`;
      }
      if (btnEnterPlot) {
        btnEnterPlot.textContent = focused
          ? `🛠️ 进入「${focused.shortLabel}」精建`
          : '🛠️ 进入地块精建';
      }
    } else {
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
        const seasonTag =
          st.season === 'winter' && st.region.mildWinter && !st.isSnowyGround
            ? '暖冬'
            : SEASON_LABELS[st.season];
        weatherPill.textContent = `${seasonTag} · ${WEATHER_LABELS[st.weather]}${timeTag}`;
      }
      if (placedCountPill) placedCountPill.textContent = `共 ${st.placedCount} 处可改建`;
    }

    for (const b of modeBtns) b.classList.toggle('active', b.dataset.view === st.viewMode);
    for (const b of stripBtns) b.classList.toggle('active', Number(b.dataset.strip) === st.cylinderStrip);
    for (const b of cylCamBtns) b.classList.toggle('active', b.dataset.cylCam === st.cylinderPreset);
    for (const b of styleBtns) b.classList.toggle('active', b.dataset.style === st.renderStyle);
    for (const b of timeBtns) b.classList.toggle('active', b.dataset.time === st.timeMode);
    for (const b of seasonBtns) b.classList.toggle('active', b.dataset.season === st.season);
    for (const b of weatherBtns) b.classList.toggle('active', b.dataset.weather === st.weather);
    for (const b of catTabs) b.classList.toggle('active', b.dataset.cat === activeCat);
    for (const b of regionCards) b.classList.toggle('active', b.dataset.region === st.region.id);

    canvas.classList.toggle('place-cursor', !inCyl && st.toolMode === 'place');
    canvas.classList.toggle('delete-cursor', !inCyl && st.toolMode === 'delete');

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
      viewMode: st.viewMode,
      cylinderStrip: st.cylinderStrip,
      cylinderPreset: st.cylinderPreset,
      focusedPlotId: st.focusedPlotId,
      cylinderPlotCount: st.cylinderPlotCount,
      regionId: st.region.id,
      season: st.season,
      timeMode: st.timeMode,
      weather: st.weather,
      renderStyle: st.renderStyle,
      mildWinter: st.mildWinter,
      isSnowyGround: st.isSnowyGround,
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
      engine.registerCustomPlotInCylinder(bp.name, lat, lon);
      engine.setViewMode('plot');
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

  async function enterPlotFromCylinder(plot?: CylinderPlotDef): Promise<void> {
    if (!plot) {
      engine.setViewMode('plot');
      return;
    }
    engine.focusCylinderPlot(plot.id);
    if (plot.presetRegionId) {
      engine.setRegion(PRESET_REGIONS[plot.presetRegionId]);
      engine.setViewMode('plot');
      playChimeSound();
      return;
    }
    if (plot.osmCoords) {
      await applyCustomLocation(plot.osmCoords.lat, plot.osmCoords.lon, plot.osmCoords.label);
      return;
    }
    engine.setViewMode('plot');
  }

  // URL overrides for deterministic testing or deep linking
  const params = new URLSearchParams(window.location.search);
  const qView = params.get('view') as ViewMode | null;
  const qRegion = params.get('region') as Exclude<RegionId, 'custom'> | null;
  if (qRegion && PRESET_REGIONS[qRegion]) {
    engine.setRegion(PRESET_REGIONS[qRegion]);
    engine.focusCylinderPlot(qRegion);
    if (qView !== 'cylinder') engine.setViewMode('plot');
  }
  if (qView === 'plot' || qView === 'cylinder') {
    engine.setViewMode(qView);
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
  window.setViewMode = (m) => engine.setViewMode(m);
  window.setCylinderStrip = (s) => engine.setCylinderStrip(s);
  window.setCylinderCameraPreset = (p) => engine.setCylinderCameraPreset(p);
  window.focusCylinderPlot = (id) => {
    engine.focusCylinderPlot(id);
  };
  window.enterCylinderPlot = async (id) => {
    const st = engine.getState();
    const targetId = id || st.focusedPlotId;
    const plot =
      st.focusedPlot && st.focusedPlot.id === targetId
        ? st.focusedPlot
        : engine.focusCylinderPlot(targetId) ?? undefined;
    await enterPlotFromCylinder(plot);
  };
  window.setRegion = (id) => {
    if (PRESET_REGIONS[id]) {
      engine.setRegion(PRESET_REGIONS[id]);
      engine.focusCylinderPlot(id);
    }
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
  for (const b of modeBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      const view = b.dataset.view === 'plot' ? 'plot' : 'cylinder';
      engine.setViewMode(view);
    });
  }
  for (const b of stripBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      const s = Number(b.dataset.strip) as ContinentStripId;
      engine.setCylinderStrip(s);
    });
  }
  for (const b of cylCamBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      const preset = (b.dataset.cylCam as CylinderCameraPreset) || 'vista';
      engine.setCylinderCameraPreset(preset);
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
        engine.focusCylinderPlot(rid);
        engine.setViewMode('plot');
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

  btnEnterPlot?.addEventListener('click', () => {
    const st = engine.getState();
    void enterPlotFromCylinder(st.focusedPlot);
  });

  btnBackCylinder?.addEventListener('click', () => {
    playUiTick();
    buildDrawer?.classList.add('hidden');
    engine.setToolMode('view');
    engine.setViewMode('cylinder');
  });

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
      engine.applyLiveWeather(live);
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

  // Canvas tap vs drag-to-orbit / drag-to-look disambiguation (6px threshold)
  let downPt = { x: 0, y: 0 };
  let lastPt = { x: 0, y: 0 };
  let isDown = false;
  canvas.addEventListener('pointerdown', (e) => {
    isDown = true;
    downPt = { x: e.clientX, y: e.clientY };
    lastPt = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointermove', (e) => {
    const mode = engine.getState().viewMode;
    if (mode === 'cylinder') {
      if (isDown) {
        const dx = e.clientX - lastPt.x;
        const dy = e.clientY - lastPt.y;
        lastPt = { x: e.clientX, y: e.clientY };
        engine.handleCylinderDrag(dx, dy);
      }
      return;
    }
    engine.updateHover(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!isDown) return;
    isDown = false;
    const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
    if (dist <= 6) {
      const st = engine.getState();
      if (st.viewMode === 'cylinder') {
        const hit = engine.handleCylinderTap(e.clientX, e.clientY);
        if (hit) {
          if (st.focusedPlotId === hit.id) {
            void enterPlotFromCylinder(hit);
          } else {
            playUiTick();
            engine.focusCylinderPlot(hit.id);
          }
        }
      } else {
        engine.handleTap(e.clientX, e.clientY);
      }
    }
  });
  canvas.addEventListener('pointercancel', () => {
    isDown = false;
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (engine.getState().viewMode === 'cylinder') {
        e.preventDefault();
        engine.handleCylinderWheel(e.deltaY);
      }
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (engine.getState().viewMode === 'cylinder') {
      if (k === 'w' || k === 'arrowup') engine.nudgeCylinder(-4.5, 0);
      else if (k === 's' || k === 'arrowdown') engine.nudgeCylinder(4.5, 0);
      else if (k === 'a' || k === 'arrowleft') engine.nudgeCylinder(0, 0.14);
      else if (k === 'd' || k === 'arrowright') engine.nudgeCylinder(0, -0.14);
      else if (k === 'escape') {
        scenePopover?.classList.add('hidden');
        regionModal?.classList.add('hidden');
      }
      return;
    }

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

  // Pooled floating HTML pins for Cooper Station plots (never recreated per frame!)
  const pinPool = new Map<string, HTMLButtonElement>();
  const pinDataMap = new Map<string, CylinderPlotDef>();

  function syncFloatingPins(): void {
    if (!cylinderPinsEl) return;
    if (engine.getState().viewMode !== 'cylinder') {
      for (const btn of pinPool.values()) btn.classList.add('hidden');
      return;
    }

    let pins = engine.getProjectedCylinderPins();
    if (window.innerWidth <= 780 && pins.length > 5) {
      pins = [...pins]
        .sort((a, b) => (a.isFocused ? -1 : b.isFocused ? 1 : a.dist - b.dist))
        .slice(0, 5);
    }

    const activeIds = new Set<string>();
    for (const pin of pins) {
      activeIds.add(pin.plot.id);
      pinDataMap.set(pin.plot.id, pin.plot);

      let btn = pinPool.get(pin.plot.id);
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'cyl-pin';
        btn.dataset.plotId = pin.plot.id;
        btn.innerHTML = `<span>${pin.plot.icon}</span><span class="pin-name">${pin.plot.shortLabel}</span><span class="cyl-pin-tag">${pin.plot.climateTag}</span>`;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const pid = (ev.currentTarget as HTMLButtonElement).dataset.plotId;
          const pDef = pid ? pinDataMap.get(pid) : undefined;
          if (!pDef) return;
          if (engine.getState().focusedPlotId === pDef.id) {
            void enterPlotFromCylinder(pDef);
          } else {
            playUiTick();
            engine.focusCylinderPlot(pDef.id);
          }
        });
        cylinderPinsEl.appendChild(btn);
        pinPool.set(pin.plot.id, btn);
      } else {
        const nameSpan = btn.querySelector('.pin-name');
        const tagSpan = btn.querySelector('.cyl-pin-tag');
        if (nameSpan && nameSpan.textContent !== pin.plot.shortLabel) {
          nameSpan.textContent = pin.plot.shortLabel;
        }
        if (tagSpan && tagSpan.textContent !== pin.plot.climateTag) {
          tagSpan.textContent = pin.plot.climateTag;
        }
      }

      btn.classList.remove('hidden');
      btn.classList.toggle('focused', pin.isFocused);
      btn.classList.toggle('overhead', pin.isOverhead && !pin.isFocused);
      btn.style.transform = `translate3d(${Math.round(pin.x)}px, ${Math.round(pin.y)}px, 0) translate(-50%, -100%)`;
    }

    for (const [id, btn] of pinPool.entries()) {
      if (!activeIds.has(id)) {
        btn.classList.add('hidden');
      }
    }
  }

  syncHud();

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    engine.step(dt);
    syncFloatingPins();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap();
