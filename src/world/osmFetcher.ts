export interface OsmFootprint {
  id: string;
  points: Array<[number, number]>;
  cx: number;
  cz: number;
  width: number;
  depth: number;
  rotY: number;
  height: number;
  levels: number;
  name?: string;
  buildingTag?: string;
}

export interface OsmRoad {
  points: Array<[number, number]>;
  width: number;
  kind: 'primary' | 'secondary' | 'residential' | 'footway';
  name?: string;
}

export interface OsmWater {
  points: Array<[number, number]>;
  isPolygon: boolean;
  width: number;
}

export interface OsmGreenArea {
  points: Array<[number, number]>;
  kind: 'park' | 'farmland' | 'wood';
}

export interface OsmTree {
  x: number;
  z: number;
}

export interface OsmSceneData {
  placeLabel: string;
  lat: number;
  lon: number;
  plotSizeMeters: number;
  roads: OsmRoad[];
  waters: OsmWater[];
  greens: OsmGreenArea[];
  buildings: OsmFootprint[];
  trees: OsmTree[];
  stats: {
    buildingCount: number;
    roadCount: number;
    waterCount: number;
    treeCount: number;
    greenCount: number;
    source: 'osm' | 'fallback';
  };
}

const clampRange = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

function dedupPoints(pts: Array<[number, number]>, clampLimit = 10.2): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [rx, rz] of pts) {
    const x = clampRange(rx, clampLimit);
    const z = clampRange(rz, clampLimit);
    if (out.length === 0) {
      out.push([x, z]);
      continue;
    }
    const prev = out[out.length - 1];
    if (Math.hypot(x - prev[0], z - prev[1]) >= 0.06) {
      out.push([x, z]);
    }
  }
  return out;
}

// Liang-Barsky 2D segment clipping against [-half, +half]^2
function clipSegmentToSquare(
  a: [number, number],
  b: [number, number],
  half = 10.35,
): [[number, number], [number, number]] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [a[0] + half, half - a[0], a[1] + half, half - a[1]];

  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-9) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

function clipPolylineToSquare(
  rawPts: Array<[number, number]>,
  half = 10.35,
): Array<Array<[number, number]>> {
  const chains: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];

  for (let i = 0; i < rawPts.length - 1; i++) {
    const clipped = clipSegmentToSquare(rawPts[i], rawPts[i + 1], half);
    if (!clipped) {
      if (current.length >= 2) chains.push(current);
      current = [];
      continue;
    }
    const [p0, p1] = clipped;
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 0.04) continue;

    if (current.length === 0) {
      current.push(p0, p1);
    } else {
      const tail = current[current.length - 1];
      if (Math.hypot(p0[0] - tail[0], p0[1] - tail[1]) < 0.05) {
        current.push(p1);
      } else {
        if (current.length >= 2) chains.push(current);
        current = [p0, p1];
      }
    }
  }
  if (current.length >= 2) chains.push(current);
  return chains;
}

function parseLevels(tags: Record<string, string>): number {
  const rawLevels = parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(rawLevels) && rawLevels > 0) return rawLevels;

  const rawHeight = parseFloat((tags.height ?? '').replace(/m$/i, '').trim());
  if (Number.isFinite(rawHeight) && rawHeight > 0) {
    return Math.max(1, rawHeight / 3.2);
  }

  const bt = (tags.building ?? '').toLowerCase();
  if (bt === 'apartments' || bt === 'commercial' || bt === 'office' || bt === 'hotel') return 5;
  if (bt === 'church' || bt === 'cathedral' || bt === 'temple') return 4;
  if (bt === 'retail' || bt === 'school' || bt === 'public' || bt === 'civic') return 3;
  return 2;
}

export async function geocodePlace(
  query: string,
): Promise<{ lat: number; lon: number; displayName: string }> {
  const clean = query.trim();
  if (!clean) throw new Error('请输入地名或街道名称');

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1&accept-language=zh-CN,en`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`地名检索失败 (HTTP ${res.status})`);
    const rows = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`未在 OpenStreetMap 找到「${clean}」，请尝试更具体的地名或直接输入经纬度`);
    }
    const first = rows[0];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error('地理编码返回坐标无效');
    }
    const shortName = (first.display_name ?? clean).split(',').slice(0, 2).join(' · ').trim();
    return { lat, lon, displayName: shortName || clean };
  } finally {
    window.clearTimeout(timer);
  }
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

export async function fetchOsmArea(
  lat: number,
  lon: number,
  placeLabel?: string,
  plotSizeMeters = 200,
): Promise<OsmSceneData> {
  const halfM = plotSizeMeters / 2;
  const kx = 111320 * Math.max(0.15, Math.cos((lat * Math.PI) / 180));
  const ky = 110574;
  const reach = halfM * 1.12;
  const dLat = reach / ky;
  const dLon = reach / kx;
  const bbox = `${(lon - dLon).toFixed(6)},${(lat - dLat).toFixed(6)},${(lon + dLon).toFixed(6)},${(lat + dLat).toFixed(6)}`;

  const toLocal = (pLat: number, pLon: number): [number, number] => [
    (((pLon - lon) * kx) / halfM) * 10.2,
    -(((pLat - lat) * ky) / halfM) * 10.2,
  ];

  const label = placeLabel?.trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  const fallbackResult = (): OsmSceneData => ({
    placeLabel: label,
    lat,
    lon,
    plotSizeMeters,
    roads: [],
    waters: [],
    greens: [],
    buildings: [],
    trees: [],
    stats: {
      buildingCount: 0,
      roadCount: 0,
      waterCount: 0,
      treeCount: 0,
      greenCount: 0,
      source: 'fallback',
    },
  });

  let elements: OsmElement[] = [];
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, {
      signal: controller.signal,
    });
    if (!res.ok) return fallbackResult();
    const json = (await res.json()) as { elements?: OsmElement[] };
    if (!Array.isArray(json.elements)) return fallbackResult();
    elements = json.elements;
  } catch {
    return fallbackResult();
  } finally {
    window.clearTimeout(timer);
  }

  // Pass 1: collect all nodes + standalone mapped trees
  const nodeMap = new Map<number, [number, number]>();
  const trees: OsmTree[] = [];

  for (const el of elements) {
    if (el.type !== 'node' || el.lat === undefined || el.lon === undefined) continue;
    nodeMap.set(el.id, [el.lat, el.lon]);
    if (el.tags?.natural === 'tree') {
      const [tx, tz] = toLocal(el.lat, el.lon);
      if (Math.abs(tx) <= 9.6 && Math.abs(tz) <= 9.6) {
        if (!trees.some((t) => Math.hypot(t.x - tx, t.z - tz) < 0.7)) {
          if (trees.length < 28) trees.push({ x: tx, z: tz });
        }
      }
    }
  }

  // Pass 2: resolve ways via nodeMap
  const buildingsRaw: Array<OsmFootprint & { bboxArea: number }> = [];
  const roads: OsmRoad[] = [];
  const waters: OsmWater[] = [];
  const greens: OsmGreenArea[] = [];

  for (const el of elements) {
    if (el.type !== 'way' || !Array.isArray(el.nodes) || el.nodes.length < 2) continue;
    const tags = el.tags ?? {};
    const rawPts: Array<[number, number]> = [];
    for (const nid of el.nodes) {
      const ll = nodeMap.get(nid);
      if (ll) rawPts.push(toLocal(ll[0], ll[1]));
    }
    if (rawPts.length < 2) continue;

    // 1. Buildings
    if (tags.building) {
      const ringUnclamped = [...rawPts];
      if (
        ringUnclamped.length >= 4 &&
        Math.hypot(
          ringUnclamped[0][0] - ringUnclamped[ringUnclamped.length - 1][0],
          ringUnclamped[0][1] - ringUnclamped[ringUnclamped.length - 1][1],
        ) < 0.12
      ) {
        ringUnclamped.pop();
      }
      if (ringUnclamped.length < 3) continue;

      // Centroid check before clamping overhangs
      let sx = 0,
        sz = 0;
      for (const [px, pz] of ringUnclamped) {
        sx += px;
        sz += pz;
      }
      const origCx = sx / ringUnclamped.length;
      const origCz = sz / ringUnclamped.length;
      if (Math.abs(origCx) > 9.5 || Math.abs(origCz) > 9.5) continue;

      const ring = dedupPoints(ringUnclamped, 10.15);
      if (ring.length < 3) continue;

      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity,
        csx = 0,
        csz = 0;
      for (const [px, pz] of ring) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz;
        if (pz > maxZ) maxZ = pz;
        csx += px;
        csz += pz;
      }
      const cx = csx / ring.length;
      const cz = csz / ring.length;
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const bboxArea = width * depth;
      if (bboxArea < 0.1) continue;

      let maxEdgeLen = 0;
      let rotY = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len > maxEdgeLen) {
          maxEdgeLen = len;
          rotY = Math.atan2(b[1] - a[1], b[0] - a[0]);
        }
      }

      const levels = parseLevels(tags);
      const height =
        levels <= 4
          ? Math.max(1.15, levels * 0.58)
          : Math.min(6.0, 2.35 + Math.log2(levels - 2) * 0.95);

      buildingsRaw.push({
        id: `osm_b_${el.id}`,
        points: ring,
        cx,
        cz,
        width,
        depth,
        rotY,
        height,
        levels,
        name: tags.name || tags['name:zh'] || undefined,
        buildingTag: tags.building,
        bboxArea,
      });
      continue;
    }

    // 2. Roads (clipped cleanly at island border!)
    if (tags.highway) {
      const hw = tags.highway.toLowerCase();
      let kind: OsmRoad['kind'] = 'residential';
      let width = 0.85;
      if (hw === 'motorway' || hw === 'trunk' || hw === 'primary' || hw === 'primary_link') {
        kind = 'primary';
        width = 1.5;
      } else if (hw === 'secondary' || hw === 'tertiary' || hw === 'secondary_link' || hw === 'tertiary_link') {
        kind = 'secondary';
        width = 1.15;
      } else if (
        hw === 'footway' ||
        hw === 'pedestrian' ||
        hw === 'path' ||
        hw === 'cycleway' ||
        hw === 'steps'
      ) {
        kind = 'footway';
        width = 0.48;
      }
      for (const chain of clipPolylineToSquare(rawPts, 10.35)) {
        roads.push({
          points: chain,
          width,
          kind,
          name: tags.name || tags['name:zh'] || undefined,
        });
      }
      continue;
    }

    // 3. Water bodies & canals
    if (tags.natural === 'water' || tags.water || tags.waterway) {
      const hasVertexInside = rawPts.some(([x, z]) => Math.abs(x) <= 10.2 && Math.abs(z) <= 10.2);
      if (tags.natural === 'water' || tags.water) {
        if (!hasVertexInside) continue;
        const poly = dedupPoints(rawPts, 10.2);
        if (
          poly.length >= 4 &&
          Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.18
        ) {
          poly.pop();
        }
        if (poly.length >= 3) {
          waters.push({ points: poly, isPolygon: true, width: 1.5 });
        }
      } else if (tags.waterway) {
        const ww = tags.waterway.toLowerCase();
        const width = ww === 'river' ? 1.9 : ww === 'canal' ? 1.35 : 0.65;
        for (const chain of clipPolylineToSquare(rawPts, 10.35)) {
          waters.push({ points: chain, isPolygon: false, width });
        }
      }
      continue;
    }

    // 4. Greens / Farmland / Parks
    const lu = (tags.landuse ?? '').toLowerCase();
    const le = (tags.leisure ?? '').toLowerCase();
    if (
      lu === 'farmland' ||
      lu === 'orchard' ||
      lu === 'forest' ||
      lu === 'grass' ||
      lu === 'meadow' ||
      lu === 'village_green' ||
      le === 'park' ||
      le === 'garden'
    ) {
      const hasVertexInside = rawPts.some(([x, z]) => Math.abs(x) <= 10.2 && Math.abs(z) <= 10.2);
      if (!hasVertexInside) continue;
      const poly = dedupPoints(rawPts, 10.2);
      if (
        poly.length >= 4 &&
        Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 0.18
      ) {
        poly.pop();
      }
      if (poly.length >= 3) {
        const kind: OsmGreenArea['kind'] =
          lu === 'farmland' || lu === 'orchard'
            ? 'farmland'
            : lu === 'forest'
              ? 'wood'
              : 'park';
        greens.push({ points: poly, kind });
      }
    }
  }

  buildingsRaw.sort((a, b) => b.bboxArea - a.bboxArea);
  const buildings: OsmFootprint[] = buildingsRaw.slice(0, 85).map(({ bboxArea: _area, ...rest }) => rest);

  return {
    placeLabel: label,
    lat,
    lon,
    plotSizeMeters,
    roads,
    waters,
    greens,
    buildings,
    trees,
    stats: {
      buildingCount: buildings.length,
      roadCount: roads.length,
      waterCount: waters.length,
      treeCount: trees.length,
      greenCount: greens.length,
      source: 'osm',
    },
  };
}
