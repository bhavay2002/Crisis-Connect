import { db } from "../../db/db";
import { cityNodes, cityEdges } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../../utils/logger";

interface CrisisImpact {
  crisisNodeId: string;
  crisisType: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface PropagationResult {
  affectedNodes: Array<{
    id: string; name: string; type: string; lat: string; lng: string;
    distanceHops: number; travelTimeMinutes: number; riskIncrease: number; newRiskScore: number;
  }>;
  nearestResponders: Array<{
    id: string; name: string; type: string; distanceKm: number; travelTimeMinutes: number; availability: string;
  }>;
  predictedResponseTime: string;
  riskSpread: "contained" | "moderate" | "severe" | "catastrophic";
  bottlenecks: string[];
  estimatedAffectedPopulation: number;
  confidenceScore: number;
}

const SEVERITY_PROPAGATION: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const RESPONDER_TYPES = ["hospital", "fire_station", "police", "shelter"];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function simulateCrisisPropagation(impact: CrisisImpact, cityId = "default"): Promise<PropagationResult> {
  const allNodes = await db.select().from(cityNodes).where(and(eq(cityNodes.cityId, cityId), eq(cityNodes.isActive, true)));
  const allEdges = await db.select().from(cityEdges).where(eq(cityEdges.cityId, cityId));

  if (allNodes.length === 0) {
    return { affectedNodes: [], nearestResponders: [], predictedResponseTime: "Unknown", riskSpread: "contained", bottlenecks: [], estimatedAffectedPopulation: 0, confidenceScore: 0.3 };
  }

  // Build adjacency map
  const adjacency: Map<string, Array<{ toId: string; travelTime: number; distance: number; congestion: number }>> = new Map();
  for (const edge of allEdges) {
    if (!adjacency.has(edge.fromNodeId)) adjacency.set(edge.fromNodeId, []);
    adjacency.get(edge.fromNodeId)!.push({
      toId: edge.toNodeId,
      travelTime: edge.travelTimeMinutes,
      distance: parseFloat(edge.distanceKm),
      congestion: parseFloat(edge.congestionFactor || "1"),
    });
    // bidirectional
    if (!adjacency.has(edge.toNodeId)) adjacency.set(edge.toNodeId, []);
    adjacency.get(edge.toNodeId)!.push({
      toId: edge.fromNodeId,
      travelTime: edge.travelTimeMinutes,
      distance: parseFloat(edge.distanceKm),
      congestion: parseFloat(edge.congestionFactor || "1"),
    });
  }

  // BFS/Dijkstra-style propagation from crisis node
  const severity = SEVERITY_PROPAGATION[impact.severity] || 2;
  const maxHops = severity + 1;
  const crisisNode = allNodes.find(n => n.id === impact.crisisNodeId);

  const visited = new Map<string, { hops: number; time: number }>();
  const queue: Array<{ nodeId: string; hops: number; time: number }> = [{ nodeId: impact.crisisNodeId, hops: 0, time: 0 }];
  visited.set(impact.crisisNodeId, { hops: 0, time: 0 });

  while (queue.length > 0) {
    const { nodeId, hops, time } = queue.shift()!;
    if (hops >= maxHops) continue;
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.toId)) {
        const newTime = time + Math.round(neighbor.travelTime * neighbor.congestion);
        visited.set(neighbor.toId, { hops: hops + 1, time: newTime });
        queue.push({ nodeId: neighbor.toId, hops: hops + 1, time: newTime });
      }
    }
  }

  // Compute affected nodes
  const affectedNodes = [];
  for (const [nodeId, { hops, time }] of visited) {
    if (nodeId === impact.crisisNodeId) continue;
    const node = allNodes.find(n => n.id === nodeId);
    if (!node) continue;
    const riskIncrease = Math.round((severity / hops) * 15);
    affectedNodes.push({
      id: node.id, name: node.name, type: node.type,
      lat: node.latitude, lng: node.longitude,
      distanceHops: hops, travelTimeMinutes: time,
      riskIncrease, newRiskScore: Math.min(100, node.riskScore + riskIncrease),
    });
  }
  affectedNodes.sort((a, b) => a.distanceHops - b.distanceHops);

  // Find nearest responders
  const responderNodes = allNodes.filter(n => RESPONDER_TYPES.includes(n.type) && n.id !== impact.crisisNodeId);
  const crisisLat = parseFloat(crisisNode?.latitude || "0");
  const crisisLng = parseFloat(crisisNode?.longitude || "0");
  const nearestResponders = responderNodes
    .map(r => {
      const dist = haversineKm(crisisLat, crisisLng, parseFloat(r.latitude), parseFloat(r.longitude));
      const travelMin = visited.get(r.id)?.time ?? Math.round((dist / 30) * 60);
      return {
        id: r.id, name: r.name, type: r.type,
        distanceKm: parseFloat(dist.toFixed(2)),
        travelTimeMinutes: travelMin,
        availability: r.riskScore < 30 ? "available" : r.riskScore < 60 ? "limited" : "overwhelmed",
      };
    })
    .sort((a, b) => a.travelTimeMinutes - b.travelTimeMinutes)
    .slice(0, 5);

  const fastestResponder = nearestResponders[0];
  const predictedResponseTime = fastestResponder
    ? `${fastestResponder.travelTimeMinutes} min (${fastestResponder.name})`
    : "Unknown";

  // Risk spread classification
  const affectedCount = affectedNodes.length;
  const riskSpread = affectedCount >= 8 ? "catastrophic" : affectedCount >= 5 ? "severe" : affectedCount >= 3 ? "moderate" : "contained";

  // Bottleneck detection: nodes with high risk already
  const bottlenecks = allNodes
    .filter(n => n.riskScore >= 60 && visited.has(n.id))
    .map(n => n.name).slice(0, 3);

  const estimatedAffectedPopulation = Math.round(affectedNodes.reduce((sum, n) => sum + (SEVERITY_PROPAGATION[impact.severity] * 800), 0));

  logger.info(`[DigitalTwin] Crisis propagation: ${affectedCount} nodes affected, riskSpread=${riskSpread}`);

  return {
    affectedNodes,
    nearestResponders,
    predictedResponseTime,
    riskSpread,
    bottlenecks,
    estimatedAffectedPopulation,
    confidenceScore: allEdges.length > 0 ? 0.85 : 0.5,
  };
}

// Seed a default city model (Mumbai-inspired)
export async function seedDefaultCityModel(cityId = "default") {
  const existing = await db.select().from(cityNodes).where(eq(cityNodes.cityId, cityId)).limit(1);
  if (existing.length > 0) return { message: "City model already exists", nodeCount: existing.length };

  const nodesData: Array<typeof cityNodes.$inferInsert> = [
    { cityId, name: "City Hospital Central",    type: "hospital",     latitude: "19.0760", longitude: "72.8777", riskScore: 20, capacity: 500 },
    { cityId, name: "North District Hospital",  type: "hospital",     latitude: "19.1000", longitude: "72.8500", riskScore: 15, capacity: 300 },
    { cityId, name: "East Fire Station",        type: "fire_station", latitude: "19.0820", longitude: "72.8900", riskScore: 10 },
    { cityId, name: "Central Fire Station",     type: "fire_station", latitude: "19.0700", longitude: "72.8650", riskScore: 8  },
    { cityId, name: "Police HQ",                type: "police",       latitude: "19.0730", longitude: "72.8800", riskScore: 12 },
    { cityId, name: "North Police Station",     type: "police",       latitude: "19.0950", longitude: "72.8600", riskScore: 10 },
    { cityId, name: "Evacuation Shelter A",     type: "shelter",      latitude: "19.0680", longitude: "72.8700", riskScore: 5,  capacity: 2000 },
    { cityId, name: "Evacuation Shelter B",     type: "shelter",      latitude: "19.1020", longitude: "72.8900", riskScore: 5,  capacity: 1500 },
    { cityId, name: "Main Road Junction",       type: "road_junction",latitude: "19.0790", longitude: "72.8830", riskScore: 35 },
    { cityId, name: "Highway Interchange",      type: "road_junction",latitude: "19.0850", longitude: "72.8750", riskScore: 40 },
    { cityId, name: "Old City Bridge",          type: "bridge",       latitude: "19.0720", longitude: "72.8600", riskScore: 65 },
    { cityId, name: "Port Bridge",              type: "bridge",       latitude: "19.0670", longitude: "72.8950", riskScore: 55 },
    { cityId, name: "Commercial Zone A",        type: "zone",         latitude: "19.0800", longitude: "72.8800", riskScore: 45 },
    { cityId, name: "Residential Zone B",       type: "zone",         latitude: "19.0920", longitude: "72.8700", riskScore: 30 },
    { cityId, name: "Industrial Zone C",        type: "zone",         latitude: "19.0600", longitude: "72.8900", riskScore: 70 },
  ];

  const insertedNodes = await db.insert(cityNodes).values(nodesData).returning();
  const nodeMap: Record<string, string> = {};
  insertedNodes.forEach((n, i) => { nodeMap[nodesData[i].name!] = n.id; });

  const edgesData: Array<typeof cityEdges.$inferInsert> = [
    { cityId, fromNodeId: nodeMap["City Hospital Central"],  toNodeId: nodeMap["Main Road Junction"],      distanceKm: "0.8",  travelTimeMinutes: 3  },
    { cityId, fromNodeId: nodeMap["City Hospital Central"],  toNodeId: nodeMap["Police HQ"],               distanceKm: "0.5",  travelTimeMinutes: 2  },
    { cityId, fromNodeId: nodeMap["Police HQ"],              toNodeId: nodeMap["Main Road Junction"],      distanceKm: "0.4",  travelTimeMinutes: 2  },
    { cityId, fromNodeId: nodeMap["Main Road Junction"],     toNodeId: nodeMap["East Fire Station"],       distanceKm: "0.6",  travelTimeMinutes: 3  },
    { cityId, fromNodeId: nodeMap["Main Road Junction"],     toNodeId: nodeMap["Commercial Zone A"],       distanceKm: "0.3",  travelTimeMinutes: 2  },
    { cityId, fromNodeId: nodeMap["Main Road Junction"],     toNodeId: nodeMap["Highway Interchange"],     distanceKm: "0.9",  travelTimeMinutes: 4  },
    { cityId, fromNodeId: nodeMap["Highway Interchange"],    toNodeId: nodeMap["North District Hospital"], distanceKm: "1.5",  travelTimeMinutes: 6  },
    { cityId, fromNodeId: nodeMap["Highway Interchange"],    toNodeId: nodeMap["North Police Station"],    distanceKm: "1.2",  travelTimeMinutes: 5  },
    { cityId, fromNodeId: nodeMap["Highway Interchange"],    toNodeId: nodeMap["Residential Zone B"],      distanceKm: "0.8",  travelTimeMinutes: 4  },
    { cityId, fromNodeId: nodeMap["Old City Bridge"],        toNodeId: nodeMap["Main Road Junction"],      distanceKm: "1.1",  travelTimeMinutes: 5, congestionFactor: "1.8" },
    { cityId, fromNodeId: nodeMap["Old City Bridge"],        toNodeId: nodeMap["Central Fire Station"],    distanceKm: "0.7",  travelTimeMinutes: 3  },
    { cityId, fromNodeId: nodeMap["Port Bridge"],            toNodeId: nodeMap["Industrial Zone C"],       distanceKm: "0.5",  travelTimeMinutes: 3  },
    { cityId, fromNodeId: nodeMap["Industrial Zone C"],      toNodeId: nodeMap["Central Fire Station"],    distanceKm: "1.3",  travelTimeMinutes: 6  },
    { cityId, fromNodeId: nodeMap["Evacuation Shelter A"],   toNodeId: nodeMap["Central Fire Station"],    distanceKm: "0.4",  travelTimeMinutes: 2  },
    { cityId, fromNodeId: nodeMap["Evacuation Shelter B"],   toNodeId: nodeMap["North Police Station"],    distanceKm: "0.6",  travelTimeMinutes: 3  },
  ];
  await db.insert(cityEdges).values(edgesData);

  logger.info(`[DigitalTwin] Seeded city model: ${insertedNodes.length} nodes, ${edgesData.length} edges`);
  return { message: "City model seeded", nodeCount: insertedNodes.length, edgeCount: edgesData.length };
}
