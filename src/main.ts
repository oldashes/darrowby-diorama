import './style.css';
import { CATALOG, CatalogItem } from './assets/modelLibrary';
import { playChimeSound, playUiTick } from './audio/sfx';
import { GroundLookPreset, ViewMode } from './world/cylinderWorld';
import { DioramaEngine } from './world/dioramaEngine';
import { InteriorKind } from './world/interiorWorld';
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
import { SpaceSectorPin } from './world/spaceWorld';

declare global {
  interface Window {
    setViewMode?: (m: ViewMode) => void;
    setGroundLookPreset?: (p: GroundLookPreset) => void;
    setInteriorKind?: (k: InteriorKind) => void;
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
    undoLastPlacement?: () => boolean;
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

const VALID_VIEWS: ViewMode[] = ['space', 'ground', 'interior', 'plot'];

function isValidViewMode(val: string | undefined | null): val is ViewMode {
  return Boolean(val && VALID_VIEWS.includes(val as ViewMode));
}

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

  const spacePinsEl = document.getElementById('space-pins');
  const spaceBar = document.getElementById('space-bar');
  const groundBar = document.getElementById('ground-bar');
  const interiorBar = document.getElementById('interior-bar');
  const camPresetsBar = document.getElementById('cam-presets');

  const btnDiveGround = document.getElementById('btn-dive-ground');
  const btnEnterInterior = document.getElementById('btn-enter-interior');
  const btnEnterPlotMode = document.getElementById('btn-enter-plot-mode');
  const btnExitInterior = document.getElementById('btn-exit-interior');
  const btnBackGround = document.getElementById('btn-back-ground');
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
  const spaceDestBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.space-dest-btn'));
  const groundCamBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.ground-cam-btn'));
  const interiorBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.interior-btn'));
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
  let lastSpaceDest = 'sydney';

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
    const view = st.viewMode;
    const isLightPaper =
      st.renderStyle === 'pocket' &&
      view !== 'space' &&
      st.timeMode !== 'night' &&
      st.timeMode !== 'eclipse';
    document.documentElement.classList.toggle('theme-pocket', isLightPaper);

    // Per-mode sub-bars and dock controls
    spaceBar?.classList.toggle('hidden', view !== 'space');
    spacePinsEl?.classList.toggle('hidden', view !== 'space');
    groundBar?.classList.toggle('hidden', view !== 'ground');
    interiorBar?.classList.toggle('hidden', view !== 'interior');
    camPresetsBar?.classList.toggle('hidden', view !== 'plot');

    btnDiveGround?.classList.toggle('hidden', view !== 'space');
    btnEnterInterior?.classList.toggle('hidden', view !== 'ground');
    btnEnterPlotMode?.classList.toggle('hidden', view !== 'ground');
    btnExitInterior?.classList.toggle('hidden', view !== 'interior');
    btnBackGround?.classList.toggle('hidden', view !== 'plot');
    btnToggleBuild?.classList.toggle('hidden', view !== 'plot');

    if (view !== 'plot') {
      buildDrawer?.classList.add('hidden');
    }

    const activeSpecial = st.region.specialScenes.find(
      (s) => s.id === st.activeSpecialSceneId,
    );
    const timeTag = activeSpecial
      ? ` · ${activeSpecial.label}`
      : st.timeMode === 'eclipse'
        ? ' · 日食'
        : st.timeMode === 'night'
          ? ' · 夜'
          : st.timeMode === 'sunset'
            ? ' · 暮色'
            : st.timeMode === 'morning'
              ? ' · 晨曦'
              : '';
    const seasonTag =
      st.season === 'winter' && st.region.mildWinter && !st.isSnowyGround
        ? '暖冬'
        : SEASON_LABELS[st.season];

    if (view === 'space') {
      if (locName) locName.textContent = '库珀空间站 · 岛三号奥尼尔圆筒';
      if (locSub) {
        locSub.textContent = 'L5 地月轨道 · 三面 42° 采光反射镜 · 零重力农业环与地月遥望';
      }
      if (fieldNote) {
        fieldNote.textContent =
          '拖拽围绕圆筒外舱 360° 巡航，滚轮拉近可透过透明视窗瞥见旋转大陆，点击标签或下方目的地直接降落平地！';
      }
      if (legendRow) {
        legendRow.innerHTML = [
          `<span class="legend-pill">🛰️ 外太空总览</span>`,
          `<span class="legend-pill">🪞 3 采光反射镜</span>`,
          `<span class="legend-pill">🌍 地月系统遥望</span>`,
        ].join('');
      }
      if (weatherPill) weatherPill.textContent = `轨道俯瞰 · ${st.timeMode === 'night' ? '暗面微光' : '日照星海'}`;
      if (placedCountPill) placedCountPill.textContent = `选定着陆区：${st.region.name}`;
    } else if (view === 'interior') {
      const isTavern = st.interiorKind === 'tavern';
      if (locName) locName.textContent = isTavern ? '☕ 观海驿站酒馆 · 室内' : '🌿 玻璃温室花房 · 室内';
      if (locSub) {
        locSub.textContent = isTavern
          ? `${st.region.name} 临海木石旅舍 · 墙挂库珀空间站蓝图 · 窗外即圆筒长街`
          : `${st.region.name} 维多利亚铁艺花房 · 蓝花楹与盆栽群 · 玻璃穹顶透见旋转大陆`;
      }
      if (fieldNote) {
        fieldNote.textContent =
          '拖拽环顾室内细节，WASD/滚轮自由走动；点击正南侧木门或「出门回街道」即可返回平地街景。';
      }
      if (legendRow) {
        legendRow.innerHTML = isTavern
          ? [
              `<span class="legend-pill">🔥 砖砌壁炉</span>`,
              `<span class="legend-pill">🐕 柴犬守店</span>`,
              `<span class="legend-pill">🗺️ 空间站蓝图</span>`,
            ].join('')
          : [
              `<span class="legend-pill">🌸 温室蓝花楹</span>`,
              `<span class="legend-pill">🪴 多肉长桌</span>`,
              `<span class="legend-pill">🪟 圆筒天窗</span>`,
            ].join('');
      }
      if (weatherPill) weatherPill.textContent = `MMORPG 室内 · ${seasonTag}${timeTag}`;
      if (placedCountPill) placedCountPill.textContent = isTavern ? '当前房间：观海驿站' : '当前房间：玻璃温室';
    } else if (view === 'ground') {
      if (locName) locName.textContent = `${st.region.name}（平地视角）`;
      if (locSub) {
        locSub.textContent = `${st.region.badgeText} · 脚下正常地球街区无缝衔接 R=320m 倒悬天空穹顶`;
      }
      if (fieldNote) {
        fieldNote.textContent =
          activeSpecial?.note ||
          '拖拽自由环视眼前街区与头顶 120° 倒悬大陆天际线，WASD/滚轮漫步街头，也可推门进入室内或切至沙盘造景。';
      }
      if (legendRow) {
        const parts = [
          `<span class="legend-pill">🏠 ${st.legendCounts.buildings}</span>`,
          `<span class="legend-pill">🌳 ${st.legendCounts.nature}</span>`,
          `<span class="legend-pill">🐑 ${st.legendCounts.living}</span>`,
        ];
        if (st.osmBuildingCount > 0 || st.osmRoadCount > 0) {
          parts.push(
            `<span class="legend-pill">🗺️ OSM ${st.osmBuildingCount}栋/${st.osmRoadCount}路</span>`,
          );
        }
        legendRow.innerHTML = parts.join('');
      }
      if (weatherPill) {
        weatherPill.textContent = `${seasonTag} · ${WEATHER_LABELS[st.weather]}${timeTag}`;
      }
      if (placedCountPill) placedCountPill.textContent = `街区含 ${st.placedCount} 处建筑/物件`;
    } else {
      // 'plot' isometric sandbox builder
      if (locName) locName.textContent = st.region.name;
      if (locSub) locSub.textContent = st.region.badgeText;
      if (fieldNote) {
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
          parts.push(
            `<span class="legend-pill">🗺️ OSM ${st.osmBuildingCount}栋/${st.osmRoadCount}路</span>`,
          );
        }
        legendRow.innerHTML = parts.join('');
      }
      if (weatherPill) {
        weatherPill.textContent = `${seasonTag} · ${WEATHER_LABELS[st.weather]}${timeTag}`;
      }
      if (placedCountPill) placedCountPill.textContent = `共 ${st.placedCount} 处可改建`;
    }

    for (const b of modeBtns) b.classList.toggle('active', b.dataset.view === view);
    for (const b of spaceDestBtns) {
      const dest = b.dataset.dest;
      const isActive =
        dest === st.region.id || (st.region.id === 'custom' && dest === lastSpaceDest);
      b.classList.toggle('active', isActive);
    }
    for (const b of groundCamBtns) {
      b.classList.toggle('active', b.dataset.ground === st.groundPreset);
    }
    for (const b of interiorBtns) {
      b.classList.toggle('active', b.dataset.room === st.interiorKind);
    }
    for (const b of styleBtns) b.classList.toggle('active', b.dataset.style === st.renderStyle);
    for (const b of timeBtns) b.classList.toggle('active', b.dataset.time === st.timeMode);
    for (const b of seasonBtns) b.classList.toggle('active', b.dataset.season === st.season);
    for (const b of weatherBtns) b.classList.toggle('active', b.dataset.weather === st.weather);
    for (const b of catTabs) b.classList.toggle('active', b.dataset.cat === activeCat);
    for (const b of regionCards) b.classList.toggle('active', b.dataset.region === st.region.id);

    canvas.classList.toggle('place-cursor', view === 'plot' && st.toolMode === 'place');
    canvas.classList.toggle('delete-cursor', view === 'plot' && st.toolMode === 'delete');

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
      groundPreset: st.groundPreset,
      interiorKind: st.interiorKind,
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

  async function applyCustomLocation(
    lat: number,
    lon: number,
    label?: string,
    targetView?: ViewMode,
  ): Promise<void> {
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
      const curView = engine.getState().viewMode;
      const nextView: ViewMode = targetView ?? (curView === 'plot' ? 'plot' : 'ground');
      if (curView !== nextView) {
        engine.setViewMode(nextView);
      }
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

  function switchView(view: ViewMode): void {
    if (view !== 'plot') {
      buildDrawer?.classList.add('hidden');
      engine.setToolMode('view');
    }
    engine.setViewMode(view);
  }

  // URL overrides for deterministic testing or deep linking
  const params = new URLSearchParams(window.location.search);
  const qView = params.get('view');
  const qRegion = params.get('region') as Exclude<RegionId, 'custom'> | null;
  if (qRegion && PRESET_REGIONS[qRegion]) {
    engine.setRegion(PRESET_REGIONS[qRegion]);
    lastSpaceDest = qRegion;
  }
  if (isValidViewMode(qView)) {
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
  window.setViewMode = (m) => switchView(m);
  window.setGroundLookPreset = (p) => engine.setGroundLookPreset(p);
  window.setInteriorKind = (k) => engine.setInteriorKind(k);
  window.setRegion = (id) => {
    if (PRESET_REGIONS[id]) {
      lastSpaceDest = id;
      engine.setRegion(PRESET_REGIONS[id]);
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
  window.undoLastPlacement = () => engine.undoLastPlacement();

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
      const view = b.dataset.view;
      if (!isValidViewMode(view)) return;
      playUiTick();
      switchView(view);
    });
  }
  for (const b of spaceDestBtns) {
    b.addEventListener('click', () => {
      const dest = b.dataset.dest;
      if (!dest) return;
      playChimeSound();
      lastSpaceDest = dest;
      if (dest === 'guangzhou') {
        void applyCustomLocation(23.1216, 113.265, '广州 · 北京路', 'ground');
        return;
      }
      const rid = dest as Exclude<RegionId, 'custom'>;
      if (PRESET_REGIONS[rid]) {
        engine.setRegion(PRESET_REGIONS[rid]);
        switchView('ground');
      }
    });
  }
  for (const b of groundCamBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      engine.setGroundLookPreset((b.dataset.ground as GroundLookPreset) || 'street');
    });
  }
  for (const b of interiorBtns) {
    b.addEventListener('click', () => {
      playUiTick();
      engine.setInteriorKind((b.dataset.room as InteriorKind) || 'tavern');
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
        lastSpaceDest = rid;
        engine.setRegion(PRESET_REGIONS[rid]);
        if (engine.getState().viewMode !== 'plot') {
          switchView('ground');
        }
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
      lastSpaceDest = label.includes('广州') ? 'guangzhou' : lastSpaceDest;
      void applyCustomLocation(lat, lon, label);
    });
  }

  btnDiveGround?.addEventListener('click', () => {
    playChimeSound();
    switchView('ground');
  });
  btnEnterInterior?.addEventListener('click', () => {
    playChimeSound();
    switchView('interior');
  });
  btnEnterPlotMode?.addEventListener('click', () => {
    playUiTick();
    switchView('plot');
  });
  btnExitInterior?.addEventListener('click', () => {
    playUiTick();
    switchView('ground');
  });
  btnBackGround?.addEventListener('click', () => {
    playUiTick();
    switchView('ground');
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

  // Canvas tap vs drag-to-look / drag-to-orbit disambiguation (6px threshold)
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
    if (mode === 'ground' || mode === 'interior') {
      if (isDown) {
        const dx = e.clientX - lastPt.x;
        const dy = e.clientY - lastPt.y;
        lastPt = { x: e.clientX, y: e.clientY };
        engine.handleFirstPersonDrag(dx, dy);
      }
      return;
    }
    if (mode === 'plot') {
      engine.updateHover(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!isDown) return;
    isDown = false;
    const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
    if (dist <= 6) {
      const st = engine.getState();
      if (st.viewMode === 'interior') {
        if (engine.handleInteriorTap(e.clientX, e.clientY)) {
          playUiTick();
          switchView('ground');
        }
      } else if (st.viewMode === 'plot') {
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
      const mode = engine.getState().viewMode;
      if (mode === 'ground' || mode === 'interior') {
        e.preventDefault();
        engine.handleFirstPersonWheel(e.deltaY);
      }
    },
    { passive: false },
  );

  window.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    const mode = engine.getState().viewMode;

    if (mode === 'ground' || mode === 'interior') {
      if (k === 'w' || k === 'arrowup') engine.moveFirstPerson(0.75, 0);
      else if (k === 's' || k === 'arrowdown') engine.moveFirstPerson(-0.75, 0);
      else if (k === 'a' || k === 'arrowleft') engine.moveFirstPerson(0, -0.65);
      else if (k === 'd' || k === 'arrowright') engine.moveFirstPerson(0, 0.65);
      else if (k === 'escape') {
        scenePopover?.classList.add('hidden');
        regionModal?.classList.add('hidden');
      }
      return;
    }

    if (k === 'r' && mode === 'plot') {
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

  // Pooled floating HTML dive-in pins for Space View (never recreated per frame)
  const pinPool = new Map<string, HTMLButtonElement>();
  const pinDataMap = new Map<string, SpaceSectorPin>();

  function syncSpacePins(): void {
    if (!spacePinsEl) return;
    if (engine.getState().viewMode !== 'space') {
      for (const btn of pinPool.values()) btn.classList.add('hidden');
      return;
    }

    const pins = engine.getProjectedSpacePins();
    const activeIds = new Set<string>();
    for (const pin of pins) {
      if (!pin.visible) continue;
      activeIds.add(pin.id);
      pinDataMap.set(pin.id, pin);

      let btn = pinPool.get(pin.id);
      if (!btn) {
        btn = document.createElement('button');
        btn.className = 'cyl-pin';
        btn.dataset.pinId = pin.id;
        btn.innerHTML = `<span class="pin-name">${pin.label}</span><span class="cyl-pin-tag">${pin.subLabel}</span>`;
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const pid = (ev.currentTarget as HTMLButtonElement).dataset.pinId;
          const pDef = pid ? pinDataMap.get(pid) : undefined;
          if (!pDef) return;
          playChimeSound();
          lastSpaceDest = pDef.regionId;
          engine.setRegion(PRESET_REGIONS[pDef.regionId]);
          switchView('ground');
        });
        spacePinsEl.appendChild(btn);
        pinPool.set(pin.id, btn);
      } else {
        const nameSpan = btn.querySelector('.pin-name');
        const tagSpan = btn.querySelector('.cyl-pin-tag');
        if (nameSpan && nameSpan.textContent !== pin.label) {
          nameSpan.textContent = pin.label;
        }
        if (tagSpan && tagSpan.textContent !== pin.subLabel) {
          tagSpan.textContent = pin.subLabel;
        }
      }

      btn.classList.remove('hidden');
      btn.classList.toggle('focused', engine.getState().region.id === pin.regionId);
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
    syncSpacePins();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

bootstrap();
