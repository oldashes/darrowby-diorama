import { OsmFootprint, OsmSceneData } from './osmFetcher';

export type RegionId = 'sydney' | 'darrowby' | 'wangshi' | 'otaru' | 'custom';
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeMode = 'morning' | 'day' | 'sunset' | 'night' | 'eclipse';
export type WeatherId = 'clear' | 'breeze' | 'rain' | 'snow';
export type RenderStyleId = 'pocket' | 'pixel' | 'hd';
export type WaterLayoutId = 'brook_pond' | 'canal_pond' | 'snow_canal' | 'harbour_bay' | 'osm_custom';
export type CameraPresetId = 'cinematic' | 'closeup' | 'street' | 'bird';

export interface PlacedItemData {
  id: string;
  catalogId: string;
  x: number;
  z: number;
  rotY: number;
  regionCustomTint?: string;
}

export interface SpecialSceneDef {
  id: string;
  icon: string;
  label: string;
  season: SeasonId;
  timeMode: TimeMode;
  weather: WeatherId;
  note: string;
  extraPlacements?: PlacedItemData[];
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
  fieldNotes: Record<SeasonId, string>;
  specialScenes: SpecialSceneDef[];
  osmData?: OsmSceneData;
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
  sydney: {
    id: 'sydney',
    name: '悉尼 · 蓝花楹海湾',
    badgeText: '33.85°S 151.22°E · Sydney Kirribilli Cove',
    subtitle: '南半球仲夏晴空、盛放蓝花楹大道、白色歌剧帆影与红白海角灯塔',
    lat: -33.847,
    lon: 151.2155,
    defaultSeason: 'summer',
    defaultWeather: 'breeze',
    defaultTime: 'day',
    waterLayout: 'harbour_bay',
    hasPaddies: false,
    palette: {
      ...SHARED_STORYBOOK_PALETTE,
      grassSpring: '#9ac474',
      grassSummer: '#8db867',
      grassAutumn: '#c2a55f',
      grassWinter: '#ebe7dc',
      dirtPath: '#e5d0a8',
      waterTop: '#4bbbd0',
      iceTop: '#b7dce8',
      cliffRock: '#b6976c',
      cliffSoil: '#8c6b49',
      roofTone: '#c26952',
      wallTone: '#efe6d5',
      carStyle: 'cream',
    },
    fieldNotes: {
      spring: '十月底南半球迎春暖意渐浓，基里比利港畔花苞初绽，木栈道海风清新。',
      summer: '11 月底北半球入冬时悉尼正值蓝花楹初夏巅峰：紫色花云缀满岸坡，海港白帆点点。',
      autumn: '四月澳大利亚深秋高爽湛蓝，海角灯塔与沙岸步道沐浴在柔金日照里。',
      winter: '七月悉尼港冬日仍温和明媚，常青绿坡伴着海湾潮汐安静栖泊帆船。',
    },
    specialScenes: [
      {
        id: 'jacaranda_bloom',
        icon: '💜',
        label: '蓝花楹盛放季',
        season: 'summer',
        timeMode: 'day',
        weather: 'breeze',
        note: '基里比利蓝花楹盛放季：紫色花雨漫过沿岸长椅与木栈道，白帆贴着碧湾顺风巡游。',
        extraPlacements: [
          { id: 'sp_sy_j1', catalogId: 'jacaranda_tree', x: -3.2, z: 3.4, rotY: 0.7 },
          { id: 'sp_sy_j2', catalogId: 'jacaranda_tree', x: 3.2, z: -5.4, rotY: 1.9 },
          { id: 'sp_sy_sb1', catalogId: 'sailboat', x: 0.8, z: 7.4, rotY: 0.35 },
          { id: 'sp_sy_bn', catalogId: 'bench', x: -3.6, z: 1.8, rotY: 0.9 },
        ],
      },
      {
        id: 'harbour_summer_night',
        icon: '🎆',
        label: '仲夏海港之夜',
        season: 'summer',
        timeMode: 'night',
        weather: 'clear',
        note: '仲夏海港之夜：夜色蓝图映亮白色歌剧帆壳与红白灯塔塔顶灯光，游船静泊码头。',
        extraPlacements: [
          { id: 'sp_sy_l1', catalogId: 'lantern', x: -1.6, z: 2.2, rotY: 0 },
          { id: 'sp_sy_l2', catalogId: 'lantern', x: 2.8, z: -0.6, rotY: 0 },
          { id: 'sp_sy_sb2', catalogId: 'sailboat', x: 1.4, z: 4.4, rotY: -0.5 },
        ],
      },
    ],
    placements: [
      { id: 'sy_sails', catalogId: 'harbour_sails', x: 4.8, z: -2.2, rotY: -0.42 },
      { id: 'sy_lh', catalogId: 'coastal_lighthouse', x: -7.6, z: 6.4, rotY: 0.3 },
      { id: 'sy_inn', catalogId: 'inn', x: -5.8, z: -5.8, rotY: 0.25 },
      { id: 'sy_h1', catalogId: 'house_1', x: -1.4, z: -6.2, rotY: 0.1 },
      { id: 'sy_h2', catalogId: 'house_2', x: 2.2, z: -6.6, rotY: -0.2 },
      { id: 'sy_cafe', catalogId: 'tea_stall', x: -2.8, z: -0.2, rotY: 0.05 },
      { id: 'sy_gh', catalogId: 'greenhouse', x: -7.6, z: -1.6, rotY: 1.57 },
      { id: 'sy_j1', catalogId: 'jacaranda_tree', x: -8.4, z: -5.8, rotY: 0.4 },
      { id: 'sy_j2', catalogId: 'jacaranda_tree', x: -3.8, z: -7.8, rotY: 1.2 },
      { id: 'sy_j3', catalogId: 'jacaranda_tree', x: 0.8, z: -4.4, rotY: 2.1 },
      { id: 'sy_j4', catalogId: 'jacaranda_tree', x: -5.2, z: 1.4, rotY: 0.9 },
      { id: 'sy_j5', catalogId: 'jacaranda_tree', x: 7.6, z: -5.6, rotY: 1.6 },
      { id: 'sy_j6', catalogId: 'jacaranda_tree', x: 8.4, z: -0.6, rotY: 2.8 },
      { id: 'sy_tc', catalogId: 'tree_common', x: 5.4, z: -8.2, rotY: 0.8 },
      { id: 'sy_tb', catalogId: 'tree_birch', x: -8.8, z: 2.2, rotY: 1.4 },
      { id: 'sy_sb1', catalogId: 'sailboat', x: 2.4, z: 6.2, rotY: 0.5 },
      { id: 'sy_sb2', catalogId: 'sailboat', x: 6.8, z: 5.6, rotY: -0.8 },
      { id: 'sy_sb3', catalogId: 'sailboat', x: 5.4, z: 8.6, rotY: 1.1 },
      { id: 'sy_dk1', catalogId: 'duck', x: 8.0, z: 3.2, rotY: 0.6 },
      { id: 'sy_dk2', catalogId: 'duck', x: 7.0, z: 3.8, rotY: -0.9 },
      { id: 'sy_car', catalogId: 'sedan', x: -4.2, z: -2.4, rotY: 0.12 },
      { id: 'sy_bn1', catalogId: 'bench', x: -0.2, z: 0.9, rotY: 0.15 },
      { id: 'sy_bn2', catalogId: 'bench', x: -5.2, z: 4.6, rotY: 1.4 },
      { id: 'sy_l1', catalogId: 'lantern', x: -3.8, z: 1.0, rotY: 0 },
      { id: 'sy_l2', catalogId: 'lantern', x: 1.2, z: 0.8, rotY: 0 },
      { id: 'sy_l3', catalogId: 'lantern', x: -5.8, z: 3.6, rotY: 0 },
      { id: 'sy_l4', catalogId: 'lantern', x: 5.8, z: 0.6, rotY: 0 },
      { id: 'sy_rk', catalogId: 'rock_moss', x: -8.8, z: 8.0, rotY: 0.5 },
      { id: 'sy_dog', catalogId: 'shiba', x: -3.4, z: -0.8, rotY: 0.6 },
      { id: 'sy_alp', catalogId: 'alpaca', x: -6.6, z: -3.4, rotY: -0.5 },
    ],
  },

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
    fieldNotes: {
      spring: '四月的约克郡山谷新绿返青，石灰岩干砌矮墙与牧场羊群沿着溪水苏醒。',
      summer: '仲夏高地白昼绵长，集市广场的干草堆与酒馆石桥边游人如织。',
      autumn: '九月底山毛榉与白桦率先转金，湿润谷风吹过石磨坊与蜂箱小院。',
      winter: '北约克荒原冬季寒风凛冽，玻璃温室透出暖灯，石崖悬冰成帘。',
    },
    specialScenes: [
      {
        id: 'market_day',
        icon: '🎪',
        label: '集市日',
        season: 'summer',
        timeMode: 'day',
        weather: 'breeze',
        note: '集市日（Market Day）：石桥广场摆出酒桶货箱与茶饮摊，牧民牵着骏马与羊驼进镇。',
        extraPlacements: [
          { id: 'sp_d_tea', catalogId: 'tea_stall', x: -3.2, z: -0.2, rotY: 0.2 },
          { id: 'sp_d_bar1', catalogId: 'barrel', x: 3.4, z: -2.4, rotY: 0.4 },
          { id: 'sp_d_cr1', catalogId: 'crate', x: 4.1, z: -2.1, rotY: -0.3 },
          { id: 'sp_d_hay1', catalogId: 'hay', x: 4.8, z: 0.5, rotY: 0.7 },
          { id: 'sp_d_bn1', catalogId: 'bench', x: -1.6, z: 2.2, rotY: 1.57 },
        ],
      },
      {
        id: 'moor_eclipse',
        icon: '🌗',
        label: '荒原日食',
        season: 'winter',
        timeMode: 'eclipse',
        weather: 'clear',
        note: '荒原日食：斜向月影缓慢扫过约克郡山村，本影区内温室与酒馆窗格自动点亮。',
        extraPlacements: [
          { id: 'sp_d_l1', catalogId: 'lantern', x: -0.6, z: -1.6, rotY: 0 },
          { id: 'sp_d_l2', catalogId: 'lantern', x: 1.8, z: 2.4, rotY: 0 },
        ],
      },
    ],
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
    fieldNotes: {
      spring: '江汉平原清明插秧季：河岸垂柳吐绿，早茶摊飘出油条豆浆与热干面香气。',
      summer: '七月荷塘连片铺开，石拱桥下鸭群戏水，东侧稻田绿浪绵延。',
      autumn: '晚稻成熟垂穗，马头墙屋檐下晒秋晾谷，水渠映着暖金晚霞。',
      winter: '冬月湖风清寒，早市灯笼最早亮起，白墙黑瓦落上一层薄霜。',
    },
    specialScenes: [
      {
        id: 'morning_tea',
        icon: '🏮',
        label: '网市早茶集',
        season: 'spring',
        timeMode: 'morning',
        weather: 'breeze',
        note: '网市早茶集：晨雾刚散，街口加支起红灯早点摊与长凳，街坊围坐过早。',
        extraPlacements: [
          { id: 'sp_w_tea2', catalogId: 'tea_stall', x: -5.4, z: -2.5, rotY: 1.57 },
          { id: 'sp_w_bn', catalogId: 'bench', x: -2.5, z: 2.7, rotY: 0 },
          { id: 'sp_w_l1', catalogId: 'lantern', x: -2.2, z: -0.8, rotY: 0 },
          { id: 'sp_w_dk', catalogId: 'duck', x: 1.2, z: 1.2, rotY: 0.5 },
        ],
      },
      {
        id: 'lotus_night',
        icon: '🪷',
        label: '荷塘夏夜',
        season: 'summer',
        timeMode: 'night',
        weather: 'clear',
        note: '荷塘夏夜：星夜灯火照亮双桥河岸与西南荷塘，红灯与农家窗光倒映水面。',
        extraPlacements: [
          { id: 'sp_w_nl1', catalogId: 'lantern', x: -3.2, z: 5.5, rotY: 0 },
          { id: 'sp_w_nl2', catalogId: 'lantern', x: -7.5, z: 4.5, rotY: 0 },
          { id: 'sp_w_lp4', catalogId: 'lilypad', x: -5.8, z: 5.6, rotY: 0.8 },
          { id: 'sp_w_lp5', catalogId: 'lilypad', x: -4.6, z: 8.2, rotY: 2.1 },
        ],
      },
    ],
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
    fieldNotes: {
      spring: '五月融雪后小樽石造仓库露出暖灰砖石立面，运河游步道重现樱影。',
      summer: '北海道盛夏清爽通透，石砌码头酒桶与长椅伴着海风惬意悠闲。',
      autumn: '深秋红叶攀上仓库石墙，夕阳斜照运河煤气灯，柴犬巡游码头。',
      winter: '二月雪灯之路（Snow Light Path）：厚雪覆瓦，细雪纷飞，63 盏煤气灯亮彻冰岸。',
    },
    specialScenes: [
      {
        id: 'snow_light',
        icon: '🕯️',
        label: '雪灯之路',
        season: 'winter',
        timeMode: 'night',
        weather: 'snow',
        note: '小樽雪灯之路（每年二月）：运河两岸增设雪灯盏盏，在冬夜蓝调中闪烁暖光。',
        extraPlacements: [
          { id: 'sp_o_l1', catalogId: 'lantern', x: -1.8, z: -4.0, rotY: 0 },
          { id: 'sp_o_l2', catalogId: 'lantern', x: -1.8, z: 1.2, rotY: 0 },
          { id: 'sp_o_l3', catalogId: 'lantern', x: 1.8, z: -1.5, rotY: 0 },
          { id: 'sp_o_l4', catalogId: 'lantern', x: 1.8, z: 3.2, rotY: 0 },
        ],
      },
      {
        id: 'canal_thaw',
        icon: '🌸',
        label: '运河初春',
        season: 'spring',
        timeMode: 'day',
        weather: 'breeze',
        note: '小樽融雪初春：石造码头解冻流水，咖啡屋前摆出木箱与长椅迎客。',
        extraPlacements: [
          { id: 'sp_o_dk1', catalogId: 'duck', x: -0.2, z: -2.2, rotY: 0.4 },
          { id: 'sp_o_dk2', catalogId: 'duck', x: 0.3, z: 4.5, rotY: -1.0 },
        ],
      },
    ],
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
    fieldNotes: { ...bp.fieldNotes },
    specialScenes: bp.specialScenes.map((s) => ({
      ...s,
      extraPlacements: s.extraPlacements?.map((ep) => ({ ...ep })),
    })),
    osmData: bp.osmData,
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

function hitsOsmBuilding(x: number, z: number, buildings: OsmFootprint[], pad = 1.05): boolean {
  for (const b of buildings) {
    if (Math.abs(x - b.cx) <= b.width * 0.5 + pad && Math.abs(z - b.cz) <= b.depth * 0.5 + pad) {
      return true;
    }
  }
  return false;
}

export function buildCustomBlueprint(
  lat: number,
  lon: number,
  live?: LiveWeatherReport,
  osm?: OsmSceneData,
  placeTitle?: string,
): RegionBlueprint {
  const absLat = Math.abs(lat);
  const isSubtropicalAsia = lat > 18 && lat < 36 && lon > 95 && lon < 130;
  const isCold = absLat > 48 || (live?.tempC !== undefined && live.tempC <= 4);

  const defaultSeason: SeasonId =
    live?.suggestedSeason ?? (isCold ? 'winter' : isSubtropicalAsia ? 'summer' : 'autumn');
  const defaultWeather: WeatherId =
    live?.weather ?? (isCold ? 'snow' : 'breeze');

  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const coordText = `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;

  const hasLiveOsm =
    osm !== undefined &&
    osm.stats.source === 'osm' &&
    (osm.buildings.length > 0 || osm.roads.length > 0 || osm.waters.length > 0);

  if (hasLiveOsm && osm) {
    const placements: PlacedItemData[] = [];
    const nearPos = (x: number, z: number, dist = 1.1) =>
      placements.some((p) => Math.hypot(p.x - x, p.z - z) < dist);

    // 1. Mapped OSM trees (up to 16) using regional seasonal GLBs
    let treeAdded = 0;
    for (let i = 0; i < osm.trees.length && treeAdded < 16; i++) {
      const tr = osm.trees[i];
      if (hitsOsmBuilding(tr.x, tr.z, osm.buildings, 0.7)) continue;
      if (nearPos(tr.x, tr.z, 0.9)) continue;
      const isNearWater = osm.waters.some((w) =>
        w.points.some(([wx, wz]) => Math.hypot(wx - tr.x, wz - tr.z) < 2.2),
      );
      const treeId = isCold
        ? 'tree_pine'
        : isNearWater && isSubtropicalAsia
          ? 'tree_willow'
          : i % 3 === 0
            ? 'tree_birch'
            : 'tree_common';
      placements.push({
        id: `osm_tr_${treeAdded}`,
        catalogId: treeId,
        x: Math.round(tr.x * 2) / 2,
        z: Math.round(tr.z * 2) / 2,
        rotY: (i * 1.1) % (Math.PI * 2),
      });
      treeAdded += 1;
    }

    // 2. Street lanterns & parked cars along actual OSM roads
    let lanternCount = 0;
    let carCount = 0;
    for (let r = 0; r < osm.roads.length && (lanternCount < 4 || carCount < 2); r++) {
      const rd = osm.roads[r];
      if (rd.points.length < 2) continue;
      const mid = rd.points[Math.floor(rd.points.length / 2)];
      const prev = rd.points[Math.max(0, Math.floor(rd.points.length / 2) - 1)];
      const next = rd.points[Math.min(rd.points.length - 1, Math.floor(rd.points.length / 2) + 1)];
      const angle = Math.atan2(next[1] - prev[1], next[0] - prev[0]);
      const nx = -Math.sin(angle) * (rd.width * 0.55 + 0.35);
      const nz = Math.cos(angle) * (rd.width * 0.55 + 0.35);
      const px = Math.max(-9.2, Math.min(9.2, Math.round((mid[0] + nx) * 2) / 2));
      const pz = Math.max(-9.2, Math.min(9.2, Math.round((mid[1] + nz) * 2) / 2));

      if (!hitsOsmBuilding(px, pz, osm.buildings, 0.65) && !nearPos(px, pz, 1.3)) {
        if (carCount < 2 && rd.kind !== 'footway') {
          placements.push({
            id: `osm_car_${carCount}`,
            catalogId: 'sedan',
            x: px,
            z: pz,
            rotY: -angle,
          });
          carCount += 1;
        } else if (lanternCount < 4) {
          placements.push({
            id: `osm_l_${lanternCount}`,
            catalogId: 'lantern',
            x: px,
            z: pz,
            rotY: 0,
          });
          lanternCount += 1;
        }
      }
    }

    // 3. Ducks on mapped water bodies
    if (osm.waters.length > 0) {
      const w0 = osm.waters[0];
      const pt = w0.points[Math.floor(w0.points.length / 2)];
      if (pt) {
        const dx = Math.max(-8.8, Math.min(8.8, pt[0]));
        const dz = Math.max(-8.8, Math.min(8.8, pt[1]));
        if (!hitsOsmBuilding(dx, dz, osm.buildings, 0.4)) {
          placements.push({ id: 'osm_dk1', catalogId: 'duck', x: dx, z: dz, rotY: 0.4 });
        }
      }
    }

    // 4. Rural / Sparse OSM Hybrid Fill: enrich villages & townships with regional hero models
    if (osm.buildings.length < 5) {
      const heroPool = isSubtropicalAsia
        ? ['wangshi_house', 'tea_stall', 'bridge_stone', 'wangshi_house', 'tree_willow', 'shiba', 'alpaca']
        : isCold
          ? ['house_2', 'inn', 'tree_pine', 'bench', 'fox', 'shiba', 'barrel']
          : ['house_1', 'greenhouse', 'mill', 'well', 'tree_common', 'alpaca', 'shiba'];
      const spots: Array<[number, number, number]> = [
        [-5.5, -5.0, 0.15],
        [-2.5, 4.5, 0.25],
        [4.5, -5.5, -0.35],
        [6.0, 2.5, 1.57],
        [-6.5, 2.5, 0.8],
        [1.5, -1.5, 0.4],
        [3.5, 6.5, -0.7],
      ];
      let added = 0;
      for (let i = 0; i < spots.length && added < 7; i++) {
        const [sx, sz, rotY] = spots[i];
        if (!hitsOsmBuilding(sx, sz, osm.buildings, 1.2) && !nearPos(sx, sz, 1.5)) {
          placements.push({
            id: `osm_hyb_${added}`,
            catalogId: heroPool[added % heroPool.length],
            x: sx,
            z: sz,
            rotY,
          });
          added += 1;
        }
      }
    }

    const displayName = placeTitle?.trim() || osm.placeLabel || `OSM 街区 · ${coordText}`;
    const hasFarm = isSubtropicalAsia && osm.greens.some((g) => g.kind === 'farmland');
    const summaryText = `已抓取 OSM 实测轮廓：${osm.stats.buildingCount} 栋建筑、${osm.stats.roadCount} 条路网、${osm.stats.waterCount} 处水系与 ${osm.stats.treeCount} 棵登记树木（© OpenStreetMap contributors）。`;

    return {
      id: 'custom',
      name: displayName,
      badgeText: `${coordText} · OSM ${osm.stats.buildingCount}建筑/${osm.stats.roadCount}路${live ? ' · ' + live.summary : ''}`,
      subtitle: '基于真实 OpenStreetMap 街道与建筑轮廓生成 · 支持自由增删建造',
      lat,
      lon,
      defaultSeason,
      defaultWeather,
      defaultTime: 'day',
      waterLayout: 'osm_custom',
      hasPaddies: hasFarm,
      palette: {
        ...SHARED_STORYBOOK_PALETTE,
        roofTone: isSubtropicalAsia ? '#596978' : isCold ? '#6b7d90' : '#b8765c',
        wallTone: isSubtropicalAsia ? '#f0eae0' : '#ece4d4',
        carStyle: isSubtropicalAsia ? 'blue' : 'cream',
      },
      placements,
      fieldNotes: {
        spring: `春景实景：${summaryText}`,
        summer: `夏景实景：${summaryText}`,
        autumn: `秋景实景：${summaryText}`,
        winter: `冬景实景：${summaryText}`,
      },
      specialScenes: [
        {
          id: 'street_fair',
          icon: '🎪',
          label: '街头市集',
          season: defaultSeason === 'winter' ? 'spring' : defaultSeason,
          timeMode: 'day',
          weather: 'breeze',
          note: '街头市集限定切片：街口临时添置露天茶摊、木箱货摊与休闲长椅。',
          extraPlacements: [
            { id: 'sp_c_tea', catalogId: 'tea_stall', x: -1.5, z: 2.5, rotY: 0.4 },
            { id: 'sp_c_bn', catalogId: 'bench', x: 1.5, z: 2.0, rotY: -0.5 },
            { id: 'sp_c_cr', catalogId: 'crate', x: -2.5, z: 3.0, rotY: 0.2 },
          ],
        },
        {
          id: 'evening_lights',
          icon: '🌙',
          label: '街区华灯',
          season: defaultSeason,
          timeMode: 'night',
          weather: 'clear',
          note: '街区华灯模式：OSM 真实建筑窗格与街灯在夜色中同步点亮暖光。',
          extraPlacements: [
            { id: 'sp_c_l1', catalogId: 'lantern', x: -2.0, z: -2.0, rotY: 0 },
            { id: 'sp_c_l2', catalogId: 'lantern', x: 2.5, z: 2.5, rotY: 0 },
          ],
        },
      ],
      osmData: osm,
    };
  }

  const waterLayout: WaterLayoutId = isSubtropicalAsia
    ? 'canal_pond'
    : isCold
      ? 'snow_canal'
      : 'brook_pond';

  const basePreset = isSubtropicalAsia
    ? PRESET_REGIONS.wangshi
    : isCold
      ? PRESET_REGIONS.otaru
      : PRESET_REGIONS.darrowby;

  const placements: PlacedItemData[] = basePreset.placements.map((p, i) => ({
    ...p,
    id: `c_${i}_${p.catalogId}`,
  }));

  const resolvedTitle = placeTitle?.trim() || `自定义坐标 · ${coordText}`;

  return {
    id: 'custom',
    name: resolvedTitle,
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
    fieldNotes: { ...basePreset.fieldNotes },
    specialScenes: basePreset.specialScenes.map((s) => ({
      ...s,
      extraPlacements: s.extraPlacements?.map((ep) => ({ ...ep })),
    })),
  };
}
