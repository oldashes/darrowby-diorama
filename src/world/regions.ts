export type RegionId = 'darrowby' | 'wangshi' | 'otaru' | 'custom';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeMode = 'morning' | 'day' | 'sunset' | 'night' | 'eclipse';
export type WeatherId = 'clear' | 'breeze' | 'rain' | 'snow';
export type RenderStyleId = 'hd' | 'pixel';
export type WaterLayoutId = 'brook_pond' | 'canal_pond' | 'snow_canal';

export interface PlacedItemData {
  id: string;
  catalogId: string;
  x: number;
  z: number;
  rotY: number;
  regionCustomTint?: string;
}

export interface PaletteOverrides {
  grassSpring: string;
  grassSummer: string;
  grassAutumn: string;
  grassWinter: string;
  dirtPath: string;
  waterTop: string;
  iceTop: string;
  cliffRock: string;
  cliffSoil: string;
  shadowTint: string;
  roofTone: string;
  wallTone: string;
  carStyle: 'green' | 'blue' | 'cream';
}

export interface RegionBlueprint {
  id: RegionId;
  name: string;
  badgeText: string;
  subtitle: string;
  lat: number;
  lon: number;
  defaultSeason: SeasonId;
  defaultWeather: WeatherId;
  defaultTime: TimeMode;
  waterLayout: WaterLayoutId;
  hasPaddies: boolean;
  palette: PaletteOverrides;
  placements: PlacedItemData[];
}

export interface LiveWeatherReport {
  weather: WeatherId;
  suggestedSeason: SeasonId;
  tempC: number;
  windKmh: number;
  summary: string;
}

let uidCounter = 1;
export function makePlacementId(prefix = 'it'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter}`;
}

export const SHARED_STORYBOOK_PALETTE: PaletteOverrides = {
  grassSpring: '#9cbc73',
  grassSummer: '#a8c074',
  grassAutumn: '#bfa062',
  grassWinter: '#ebe7dc',
  dirtPath: '#cfc2a7',
  waterTop: '#8fc3d2',
  iceTop: '#c9e0ea',
  cliffRock: '#7a756c',
  cliffSoil: '#625243',
  shadowTint: '#6d7c94',
  roofTone: '#b8765c',
  wallTone: '#e5dec8',
  carStyle: 'green',
};

export const PRESET_REGIONS: Record<Exclude<RegionId, 'custom'>, RegionBlueprint> = {
  darrowby: {
    id: 'darrowby',
    name: '约克郡 · 达罗比',
    badgeText: '54.30°N 2.00°W · Yorkshire Dales',
    subtitle: '《万物生灵》冬日玻璃温室、老风磨与牧场石桥',
    lat: 54.3,
    lon: -2.0,
    defaultSeason: 'winter',
    defaultWeather: 'breeze',
    defaultTime: 'day',
    waterLayout: 'brook_pond',
    hasPaddies: false,
    palette: {
      ...SHARED_STORYBOOK_PALETTE,
      roofTone: '#6f7e8c',
      wallTone: '#e5dec8',
      carStyle: 'green',
    },
    placements: [
      { id: 'd_h1', catalogId: 'house_1', x: -5.2, z: -4.4, rotY: 0.25 },
      { id: 'd_gh1', catalogId: 'greenhouse', x: -1.8, z: -6.1, rotY: 0 },
      { id: 'd_gh2', catalogId: 'greenhouse', x: -1.8, z: -3.5, rotY: 0 },
      { id: 'd_inn', catalogId: 'inn', x: 6.2, z: -5.4, rotY: -0.35 },
      { id: 'd_mill', catalogId: 'mill', x: 6.8, z: 1.5, rotY: 2.55 },
      { id: 'd_st', catalogId: 'stable', x: -7.0, z: 3.4, rotY: 1.35 },
      { id: 'd_br', catalogId: 'bridge_stone', x: 0.7, z: 0.6, rotY: -0.38 },
      { id: 'd_wl', catalogId: 'well', x: -7.4, z: -3.2, rotY: 0.3 },
      { id: 'd_bh1', catalogId: 'beehive', x: -3.6, z: 2.6, rotY: 0.2 },
      { id: 'd_bh2', catalogId: 'beehive', x: 2.8, z: 6.8, rotY: -0.5 },
      { id: 'd_car', catalogId: 'sedan', x: -4.2, z: -0.9, rotY: 0.15 },
      { id: 'd_bn', catalogId: 'bench', x: 3.8, z: -1.5, rotY: 0.4 },
      { id: 'd_l1', catalogId: 'lantern', x: -2.4, z: -1.0, rotY: 0 },
      { id: 'd_l2', catalogId: 'lantern', x: 3.2, z: 1.6, rotY: 0 },
      { id: 'd_l3', catalogId: 'lantern', x: -5.6, z: 2.0, rotY: 0 },
      { id: 'd_t1', catalogId: 'tree_common', x: -8.2, z: -7.2, rotY: 0.4 },
      { id: 'd_t2', catalogId: 'tree_common', x: 2.8, z: -7.6, rotY: 1.1 },
      { id: 'd_t3', catalogId: 'tree_birch', x: 8.4, z: -1.6, rotY: 0.8 },
      { id: 'd_t4', catalogId: 'tree_pine', x: -8.6, z: 7.4, rotY: 0.2 },
      { id: 'd_t5', catalogId: 'tree_common', x: 8.2, z: 6.6, rotY: 2.1 },
      { id: 'd_rk1', catalogId: 'rock_moss', x: -4.8, z: 6.8, rotY: 0.5 },
      { id: 'd_hay', catalogId: 'hay', x: -5.2, z: 4.8, rotY: 0.4 },
      { id: 'd_a1', catalogId: 'alpaca', x: -7.6, z: -0.6, rotY: 0.8 },
      { id: 'd_a2', catalogId: 'alpaca', x: 4.8, z: 6.2, rotY: -0.9 },
      { id: 'd_c1', catalogId: 'cow', x: 6.2, z: 5.2, rotY: 2.3 },
      { id: 'd_hr', catalogId: 'horse', x: -4.4, z: 4.0, rotY: -0.6 },
      { id: 'd_dog', catalogId: 'shiba', x: -3.2, z: -2.0, rotY: 0.5 },
      { id: 'd_dk1', catalogId: 'duck', x: -1.4, z: 6.2, rotY: 0.4 },
      { id: 'd_dk2', catalogId: 'duck', x: -2.2, z: 7.1, rotY: -1.1 },
    ],
  },

  wangshi: {
    id: 'wangshi',
    name: '湖北监利 · 网市镇',
    badgeText: '30°08′N 113°05′E · 江汉稻塘水乡',
    subtitle: '白墙黛瓦马头墙、红灯笼早餐摊、双石拱桥与荷塘稻田',
    lat: 30.1448,
    lon: 113.0881,
    defaultSeason: 'summer',
    defaultWeather: 'clear',
    defaultTime: 'day',
    waterLayout: 'canal_pond',
    hasPaddies: true,
    palette: {
      ...SHARED_STORYBOOK_PALETTE,
      grassSummer: '#a6c46e',
      grassSpring: '#9ec47c',
      dirtPath: '#e0d2b0',
      waterTop: '#87c5cf',
      roofTone: '#596978',
      wallTone: '#f2ece0',
      carStyle: 'blue',
    },
    placements: [
      { id: 'w_h1', catalogId: 'wangshi_house', x: -6.4, z: -5.6, rotY: 0.08 },
      { id: 'w_h2', catalogId: 'wangshi_house', x: -3.2, z: -7.2, rotY: -0.04 },
      { id: 'w_h3', catalogId: 'wangshi_house', x: -7.2, z: -1.2, rotY: 1.48 },
      { id: 'w_tea', catalogId: 'tea_stall', x: -3.2, z: 1.4, rotY: 0.15 },
      { id: 'w_br1', catalogId: 'bridge_stone', x: 1.1, z: -2.4, rotY: Math.PI * 0.5 },
      { id: 'w_br2', catalogId: 'bridge_stone', x: 1.1, z: 5.2, rotY: Math.PI * 0.5 },
      { id: 'w_car', catalogId: 'sedan', x: -3.6, z: -3.1, rotY: 0.12 },
      { id: 'w_wl', catalogId: 'well', x: -6.4, z: 2.2, rotY: 0.4 },
      { id: 'w_l1', catalogId: 'lantern', x: -1.0, z: -3.4, rotY: 0 },
      { id: 'w_l2', catalogId: 'lantern', x: -1.0, z: 3.8, rotY: 0 },
      { id: 'w_l3', catalogId: 'lantern', x: 3.0, z: -1.0, rotY: 0 },
      { id: 'w_w1', catalogId: 'tree_willow', x: -0.4, z: -6.6, rotY: 0.2 },
      { id: 'w_w2', catalogId: 'tree_willow', x: 2.6, z: -5.4, rotY: 1.8 },
      { id: 'w_w3', catalogId: 'tree_willow', x: -0.4, z: 1.2, rotY: 0.9 },
      { id: 'w_w4', catalogId: 'tree_willow', x: 2.6, z: 2.2, rotY: 2.6 },
      { id: 'w_w5', catalogId: 'tree_willow', x: -0.3, z: 8.2, rotY: 1.1 },
      { id: 'w_t1', catalogId: 'tree_common', x: -8.6, z: -7.8, rotY: 0.4 },
      { id: 'w_t2', catalogId: 'tree_common', x: 8.4, z: -8.4, rotY: 1.5 },
      { id: 'w_lp1', catalogId: 'lilypad', x: -5.2, z: 6.2, rotY: 0.3 },
      { id: 'w_lp2', catalogId: 'lilypad', x: -6.6, z: 7.4, rotY: 1.7 },
      { id: 'w_lp3', catalogId: 'lilypad', x: -4.2, z: 7.6, rotY: 2.4 },
      { id: 'w_dk1', catalogId: 'duck', x: -5.6, z: 6.8, rotY: 0.6 },
      { id: 'w_dk2', catalogId: 'duck', x: -4.8, z: 7.1, rotY: -0.9 },
      { id: 'w_rk', catalogId: 'rock_moss', x: -8.4, z: 5.8, rotY: 0.8 },
      { id: 'w_a1', catalogId: 'alpaca', x: -2.4, z: 7.8, rotY: 0.7 },
      { id: 'w_dog', catalogId: 'shiba', x: -4.8, z: 1.9, rotY: 0.9 },
      { id: 'w_cr', catalogId: 'crate', x: -4.9, z: -0.2, rotY: 0.4 },
    ],
  },

  otaru: {
    id: 'otaru',
    name: '北海道 · 小樽运河',
    badgeText: '43.19°N 141.00°E · Otaru Canal',
    subtitle: '雪落古砖石仓库、运河煤气灯长廊与冰柱水岸',
    lat: 43.19,
    lon: 141.0,
    defaultSeason: 'winter',
    defaultWeather: 'snow',
    defaultTime: 'sunset',
    waterLayout: 'snow_canal',
    hasPaddies: false,
    palette: {
      ...SHARED_STORYBOOK_PALETTE,
      roofTone: '#637180',
      wallTone: '#c78a74',
      waterTop: '#7eb2c7',
      iceTop: '#cfe2ed',
      carStyle: 'cream',
    },
    placements: [
      { id: 'o_h1', catalogId: 'house_2', x: -5.8, z: -5.2, rotY: 1.57 },
      { id: 'o_inn', catalogId: 'inn', x: -5.8, z: 0.8, rotY: 1.57 },
      { id: 'o_gh', catalogId: 'greenhouse', x: -5.8, z: 6.2, rotY: 1.57 },
      { id: 'o_st', catalogId: 'stable', x: 6.2, z: -4.8, rotY: -1.57 },
      { id: 'o_h2', catalogId: 'house_1', x: 6.2, z: 2.2, rotY: -1.57 },
      { id: 'o_br', catalogId: 'bridge_stone', x: 0.0, z: 1.0, rotY: Math.PI * 0.5 },
      { id: 'o_l1', catalogId: 'lantern', x: -2.4, z: -6.5, rotY: 0 },
      { id: 'o_l2', catalogId: 'lantern', x: -2.4, z: -1.8, rotY: 0 },
      { id: 'o_l3', catalogId: 'lantern', x: -2.4, z: 3.8, rotY: 0 },
      { id: 'o_l4', catalogId: 'lantern', x: 2.4, z: -4.2, rotY: 0 },
      { id: 'o_l5', catalogId: 'lantern', x: 2.4, z: 5.5, rotY: 0 },
      { id: 'o_b1', catalogId: 'bench', x: -2.9, z: -4.2, rotY: 1.57 },
      { id: 'o_b2', catalogId: 'bench', x: 2.9, z: -1.5, rotY: -1.57 },
      { id: 'o_p1', catalogId: 'tree_pine', x: -8.6, z: -7.5, rotY: 0.2 },
      { id: 'o_p2', catalogId: 'tree_pine', x: -8.6, z: 8.2, rotY: 0.9 },
      { id: 'o_p3', catalogId: 'tree_pine', x: 8.6, z: -7.8, rotY: 1.3 },
      { id: 'o_p4', catalogId: 'tree_pine', x: 8.6, z: 7.4, rotY: 2.4 },
      { id: 'o_fx1', catalogId: 'fox', x: 5.4, z: 6.4, rotY: -0.7 },
      { id: 'o_sh1', catalogId: 'shiba', x: -3.2, z: -0.4, rotY: 0.4 },
      { id: 'o_bar', catalogId: 'barrel', x: -3.6, z: 2.6, rotY: 0.2 },
    ],
  },
};

export function cloneBlueprint(bp: RegionBlueprint): RegionBlueprint {
  return {
    ...bp,
    palette: { ...bp.palette },
    placements: bp.placements.map((p) => ({ ...p })),
  };
}

export async function fetchLiveWeather(lat: number, lon: number): Promise<LiveWeatherReport> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,weather_code,wind_speed_10m`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
    };
    const cur = data.current ?? {};
    const temp = cur.temperature_2m ?? 12;
    const code = cur.weather_code ?? 0;
    const wind = cur.wind_speed_10m ?? 10;

    let weather: WeatherId = 'clear';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86 || (temp <= 1 && code >= 51)) {
      weather = 'snow';
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) {
      weather = 'rain';
    } else if (wind >= 16) {
      weather = 'breeze';
    }

    const month = new Date().getMonth(); // 0..11
    let suggestedSeason: SeasonId = 'summer';
    if (temp <= 4 || weather === 'snow') suggestedSeason = 'winter';
    else if (temp <= 14) suggestedSeason = month >= 8 && month <= 10 ? 'autumn' : 'spring';
    else suggestedSeason = month >= 2 && month <= 4 ? 'spring' : 'summer';

    const labelMap: Record<WeatherId, string> = {
      clear: '晴朗',
      breeze: '微风',
      rain: '细雨',
      snow: '飘雪',
    };
    return {
      weather,
      suggestedSeason,
      tempC: Math.round(temp * 10) / 10,
      windKmh: Math.round(wind),
      summary: `${Math.round(temp * 10) / 10}°C · ${labelMap[weather]} · 风速 ${Math.round(wind)} km/h`,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildCustomBlueprint(
  lat: number,
  lon: number,
  live?: LiveWeatherReport,
): RegionBlueprint {
  const absLat = Math.abs(lat);
  const isSubtropicalAsia = lat > 18 && lat < 36 && lon > 95 && lon < 130;
  const isCold = absLat > 48 || (live?.tempC !== undefined && live.tempC <= 4);

  const defaultSeason: SeasonId =
    live?.suggestedSeason ?? (isCold ? 'winter' : isSubtropicalAsia ? 'summer' : 'autumn');
  const defaultWeather: WeatherId =
    live?.weather ?? (isCold ? 'snow' : 'breeze');

  const waterLayout: WaterLayoutId = isSubtropicalAsia
    ? 'canal_pond'
    : isCold
      ? 'snow_canal'
      : 'brook_pond';

  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const coordText = `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;

  const placements: PlacedItemData[] = isSubtropicalAsia
    ? PRESET_REGIONS.wangshi.placements.map((p, i) => ({ ...p, id: `c_${i}_${p.catalogId}` }))
    : isCold
      ? PRESET_REGIONS.otaru.placements.map((p, i) => ({ ...p, id: `c_${i}_${p.catalogId}` }))
      : PRESET_REGIONS.darrowby.placements.map((p, i) => ({ ...p, id: `c_${i}_${p.catalogId}` }));

  return {
    id: 'custom',
    name: `自定义坐标 · ${coordText}`,
    badgeText: live ? `${coordText} · ${live.summary}` : `${coordText} · 实时经纬生成`,
    subtitle: isSubtropicalAsia
      ? '按经纬度解析为东方水乡与稻塘聚落风貌'
      : isCold
        ? '按高纬气候解析为雪国运河木石聚落风貌'
        : '按温带丘陵解析为田园农舍与风车聚落风貌',
    lat,
    lon,
    defaultSeason,
    defaultWeather,
    defaultTime: 'day',
    waterLayout,
    hasPaddies: isSubtropicalAsia,
    palette: {
      ...SHARED_STORYBOOK_PALETTE,
      roofTone: isSubtropicalAsia ? '#596978' : isCold ? '#6b7d90' : '#b8765c',
      wallTone: isSubtropicalAsia ? '#f0eae0' : '#e5dec8',
      carStyle: isSubtropicalAsia ? 'blue' : 'cream',
    },
    placements,
  };
}
