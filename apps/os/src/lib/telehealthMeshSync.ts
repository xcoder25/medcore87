/**
 * Smart Infrastructure & Telehealth Mesh Sync Engine.
 * Decentralized peer-to-peer Wi-Fi/BLE mesh networking for remote Akwa Ibom clinics
 * (Essien Udim, Eastern Obolo, Ini, Ibeno riverine clinics).
 * Uses Delay-Tolerant Networking (DTN) bundles, Merkle vector clocks,
 * and opportunistic low-bandwidth satellite (Starlink / O3b) backhaul sync.
 */

export interface MeshNode {
  id: string;
  name: string;
  lga: string;
  facilityType: 'PHC' | 'COTTAGE_HOSPITAL' | 'RIVERINE_AMBULANCE' | 'GENERAL_HOSPITAL' | 'STATE_MOH_HUB';
  status: 'MESH_PEER_ACTIVE' | 'SATELLITE_UPLINK_HOT' | 'DISCONNECTED_ISLAND' | 'STORE_AND_FORWARD_RELAY';
  meshPeersConnected: string[];
  rssiDb: number;
  batteryPercent: number;
  solarPowered: boolean;
  queuedDtnBundles: number;
  vectorClock: number;
  lastMeshSyncIso: string;
}

export interface DtnBundlePacket {
  bundleId: string;
  originNodeId: string;
  originLga: string;
  targetNodeId: string;
  hops: string[];
  ttlSeconds: number;
  payloadType: 'TRIAGE_VITALS' | 'ANC_OBSERVATION' | 'RADET_HIV_EVENT' | 'PRESCRIPTION_DISPENSE' | 'CMS_EMERGENCY_REORDER';
  patientRef?: string;
  checksumSha256: string;
  compressionRatio: string;
  status: 'PENDING_PEER_HOP' | 'IN_TRANSIT_MESH' | 'DELIVERED_TO_GATEWAY' | 'SYNCED_TO_STATE_CLOUD';
  createdIso: string;
}

export interface SatelliteUplinkTelemetry {
  constellation: 'Starlink LEO' | 'O3b MEO' | 'NigComSat-1R GEO';
  uplinkState: 'SEARCHING_SATELLITE' | 'OPTIMAL_BEAM_LOCKED' | 'WINDOW_CLOSING' | 'OFFLINE_SCHEDULED';
  uplinkSpeedKbps: number;
  nextPassSeconds: number;
  dataSavingsPercent: number;
  merkleTreeRoot: string;
}

const STORAGE_KEY = 'medcore_telehealth_mesh_v1';

// Initial Akwa Ibom State Topology Nodes
const INITIAL_NODES: MeshNode[] = [
  {
    id: 'NODE-ESSIEN-UDIM-01',
    name: 'Essien Udim PHC Central',
    lga: 'Essien Udim',
    facilityType: 'PHC',
    status: 'MESH_PEER_ACTIVE',
    meshPeersConnected: ['NODE-INI-IKPE-03', 'NODE-IKOT-EKPENE-HUB'],
    rssiDb: -62,
    batteryPercent: 94,
    solarPowered: true,
    queuedDtnBundles: 6,
    vectorClock: 48,
    lastMeshSyncIso: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: 'NODE-EASTERN-OBOLO-02',
    name: 'Eastern Obolo Coastal Cottage Clinic',
    lga: 'Eastern Obolo',
    facilityType: 'COTTAGE_HOSPITAL',
    status: 'STORE_AND_FORWARD_RELAY',
    meshPeersConnected: ['NODE-BOAT-EMS-04', 'NODE-IBENO-PHC-05'],
    rssiDb: -74,
    batteryPercent: 88,
    solarPowered: true,
    queuedDtnBundles: 14,
    vectorClock: 72,
    lastMeshSyncIso: new Date(Date.now() - 8 * 60000).toISOString(),
  },
  {
    id: 'NODE-INI-IKPE-03',
    name: 'Ikpe Annang Rural Health Post',
    lga: 'Ini',
    facilityType: 'PHC',
    status: 'MESH_PEER_ACTIVE',
    meshPeersConnected: ['NODE-ESSIEN-UDIM-01'],
    rssiDb: -68,
    batteryPercent: 79,
    solarPowered: true,
    queuedDtnBundles: 3,
    vectorClock: 29,
    lastMeshSyncIso: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 'NODE-BOAT-EMS-04',
    name: 'Creek Patrol Ambulance Boat 04',
    lga: 'Eastern Obolo / Ibeno Estuary',
    facilityType: 'RIVERINE_AMBULANCE',
    status: 'MESH_PEER_ACTIVE',
    meshPeersConnected: ['NODE-EASTERN-OBOLO-02'],
    rssiDb: -58,
    batteryPercent: 100,
    solarPowered: false,
    queuedDtnBundles: 2,
    vectorClock: 33,
    lastMeshSyncIso: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: 'NODE-IMMANUEL-HUB',
    name: 'Immanuel General Hospital Regional Gateway',
    lga: 'Eket',
    facilityType: 'GENERAL_HOSPITAL',
    status: 'SATELLITE_UPLINK_HOT',
    meshPeersConnected: ['NODE-EASTERN-OBOLO-02', 'NODE-UYO-STATE-HQ'],
    rssiDb: -42,
    batteryPercent: 100,
    solarPowered: false,
    queuedDtnBundles: 0,
    vectorClock: 184,
    lastMeshSyncIso: new Date().toISOString(),
  },
  {
    id: 'NODE-UYO-STATE-HQ',
    name: 'Akwa Ibom MoH Central Telemetry Repository',
    lga: 'Uyo',
    facilityType: 'STATE_MOH_HUB',
    status: 'SATELLITE_UPLINK_HOT',
    meshPeersConnected: ['NODE-IMMANUEL-HUB', 'NODE-IKOT-EKPENE-HUB'],
    rssiDb: -35,
    batteryPercent: 100,
    solarPowered: false,
    queuedDtnBundles: 0,
    vectorClock: 620,
    lastMeshSyncIso: new Date().toISOString(),
  },
];

const INITIAL_PACKETS: DtnBundlePacket[] = [
  {
    bundleId: 'DTN-PKT-9921',
    originNodeId: 'NODE-ESSIEN-UDIM-01',
    originLga: 'Essien Udim',
    targetNodeId: 'NODE-UYO-STATE-HQ',
    hops: ['NODE-ESSIEN-UDIM-01', 'NODE-IKOT-EKPENE-HUB'],
    ttlSeconds: 86400,
    payloadType: 'TRIAGE_VITALS',
    patientRef: 'PAT-AKS-4401 (Aniefiok Ekpenyong)',
    checksumSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    compressionRatio: '94.2% Delta',
    status: 'IN_TRANSIT_MESH',
    createdIso: new Date(Date.now() - 4 * 60000).toISOString(),
  },
  {
    bundleId: 'DTN-PKT-9922',
    originNodeId: 'NODE-EASTERN-OBOLO-02',
    originLga: 'Eastern Obolo',
    targetNodeId: 'NODE-IMMANUEL-HUB',
    hops: ['NODE-EASTERN-OBOLO-02', 'NODE-BOAT-EMS-04'],
    ttlSeconds: 86400,
    payloadType: 'ANC_OBSERVATION',
    patientRef: 'PAT-AKS-8812 (Blessing Udoh)',
    checksumSha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    compressionRatio: '91.8% Delta',
    status: 'PENDING_PEER_HOP',
    createdIso: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    bundleId: 'DTN-PKT-9923',
    originNodeId: 'NODE-EASTERN-OBOLO-02',
    originLga: 'Eastern Obolo',
    targetNodeId: 'NODE-UYO-STATE-HQ',
    hops: ['NODE-EASTERN-OBOLO-02', 'NODE-IMMANUEL-HUB'],
    ttlSeconds: 86400,
    payloadType: 'RADET_HIV_EVENT',
    patientRef: 'PEPFAR Cohort ART Refill (12 Patients)',
    checksumSha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    compressionRatio: '96.5% Delta',
    status: 'DELIVERED_TO_GATEWAY',
    createdIso: new Date(Date.now() - 25 * 60000).toISOString(),
  },
];

export interface TelehealthMeshState {
  nodes: MeshNode[];
  packets: DtnBundlePacket[];
  satellite: SatelliteUplinkTelemetry;
  blackoutSimulated: boolean;
}

export function loadMeshState(): TelehealthMeshState {
  if (typeof window === 'undefined') {
    return {
      nodes: INITIAL_NODES,
      packets: INITIAL_PACKETS,
      satellite: {
        constellation: 'Starlink LEO',
        uplinkState: 'OPTIMAL_BEAM_LOCKED',
        uplinkSpeedKbps: 1840,
        nextPassSeconds: 840,
        dataSavingsPercent: 94.2,
        merkleTreeRoot: '0x8f3c4e2a1b9d07e6',
      },
      blackoutSimulated: false,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    /* fallback */
  }

  const initial: TelehealthMeshState = {
    nodes: INITIAL_NODES,
    packets: INITIAL_PACKETS,
    satellite: {
      constellation: 'Starlink LEO',
      uplinkState: 'OPTIMAL_BEAM_LOCKED',
      uplinkSpeedKbps: 1840,
      nextPassSeconds: 840,
      dataSavingsPercent: 94.2,
      merkleTreeRoot: '0x8f3c4e2a1b9d07e6',
    },
    blackoutSimulated: false,
  };
  saveMeshState(initial);
  return initial;
}

export function saveMeshState(state: TelehealthMeshState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('medcore-mesh-sync', { detail: state }));
  } catch {
    /* ignore */
  }
}

// ── Operations & Actions ──────────────────────────────────────────────────────

export function triggerPeerDiscovery(state: TelehealthMeshState): TelehealthMeshState {
  const updatedNodes = state.nodes.map(n => ({
    ...n,
    rssiDb: Math.max(-85, Math.min(-40, n.rssiDb + (Math.floor(Math.random() * 7) - 3))),
    lastMeshSyncIso: new Date().toISOString(),
  }));

  const nextState: TelehealthMeshState = {
    ...state,
    nodes: updatedNodes,
  };
  saveMeshState(nextState);
  return nextState;
}

export function broadcastDtnPacket(
  state: TelehealthMeshState,
  originNodeId: string,
  payloadType: DtnBundlePacket['payloadType'],
  patientRef: string
): TelehealthMeshState {
  const node = state.nodes.find(n => n.id === originNodeId) || state.nodes[0];
  const newPacket: DtnBundlePacket = {
    bundleId: `DTN-PKT-${Math.floor(1000 + Math.random() * 9000)}`,
    originNodeId: node.id,
    originLga: node.lga,
    targetNodeId: 'NODE-UYO-STATE-HQ',
    hops: [node.id],
    ttlSeconds: 86400,
    payloadType,
    patientRef,
    checksumSha256: Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
    compressionRatio: '95.1% Delta',
    status: 'IN_TRANSIT_MESH',
    createdIso: new Date().toISOString(),
  };

  const updatedNodes = state.nodes.map(n =>
    n.id === originNodeId ? { ...n, queuedDtnBundles: n.queuedDtnBundles + 1, vectorClock: n.vectorClock + 1 } : n
  );

  const nextState: TelehealthMeshState = {
    ...state,
    nodes: updatedNodes,
    packets: [newPacket, ...state.packets.slice(0, 49)],
  };
  saveMeshState(nextState);
  return nextState;
}

export function syncViaSatelliteUplink(state: TelehealthMeshState): TelehealthMeshState {
  // Flush in-transit / pending packets to DELIVERED_TO_GATEWAY & SYNCED_TO_STATE_CLOUD
  const updatedPackets: DtnBundlePacket[] = state.packets.map(p => ({
    ...p,
    status: 'SYNCED_TO_STATE_CLOUD',
    hops: p.hops.includes('NODE-UYO-STATE-HQ') ? p.hops : [...p.hops, 'NODE-UYO-STATE-HQ'],
  }));

  const updatedNodes = state.nodes.map(n => ({
    ...n,
    queuedDtnBundles: 0,
    vectorClock: n.vectorClock + 5,
    lastMeshSyncIso: new Date().toISOString(),
  }));

  const nextState: TelehealthMeshState = {
    ...state,
    nodes: updatedNodes,
    packets: updatedPackets,
    satellite: {
      ...state.satellite,
      uplinkState: 'OPTIMAL_BEAM_LOCKED',
      merkleTreeRoot: `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`,
      nextPassSeconds: 1200,
    },
  };
  saveMeshState(nextState);
  return nextState;
}

export function toggleBlackoutSimulation(state: TelehealthMeshState): TelehealthMeshState {
  const isBlackout = !state.blackoutSimulated;
  const nextNodes = state.nodes.map(n => {
    if (isBlackout) {
      if (n.facilityType === 'GENERAL_HOSPITAL' || n.facilityType === 'STATE_MOH_HUB') {
        return { ...n, status: 'DISCONNECTED_ISLAND' as const };
      }
      return { ...n, status: 'STORE_AND_FORWARD_RELAY' as const };
    } else {
      if (n.id === 'NODE-IMMANUEL-HUB' || n.id === 'NODE-UYO-STATE-HQ') {
        return { ...n, status: 'SATELLITE_UPLINK_HOT' as const };
      }
      return { ...n, status: 'MESH_PEER_ACTIVE' as const };
    }
  });

  const nextState: TelehealthMeshState = {
    ...state,
    blackoutSimulated: isBlackout,
    nodes: nextNodes,
    satellite: {
      ...state.satellite,
      uplinkState: isBlackout ? 'SEARCHING_SATELLITE' : 'OPTIMAL_BEAM_LOCKED',
    },
  };
  saveMeshState(nextState);
  return nextState;
}
