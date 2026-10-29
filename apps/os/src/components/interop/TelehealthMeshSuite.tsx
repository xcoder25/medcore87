'use client';

/**
 * TelehealthMeshSuite — Smart Infrastructure & Low-Bandwidth Satellite/Mesh Syncing.
 * Decentralized peer-to-peer network topology for remote Akwa Ibom LGAs (Essien Udim, Eastern Obolo, Ini, Ibeno).
 * Features Delay-Tolerant Networking (DTN) packet bundles, Merkle vector clock reconciliation,
 * and opportunistic satellite/mesh backhaul syncing.
 */

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Wifi,
  Satellite,
  Shield,
  RefreshCw,
  Zap,
  Server,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Send,
  Cpu,
  Layers,
  Battery,
  Sun,
  Activity,
  HardDrive,
  Globe,
  Sliders
} from 'lucide-react';
import {
  loadMeshState,
  saveMeshState,
  triggerPeerDiscovery,
  broadcastDtnPacket,
  syncViaSatelliteUplink,
  toggleBlackoutSimulation,
  type TelehealthMeshState,
  type MeshNode,
  type DtnBundlePacket
} from '../../lib/telehealthMeshSync';
import type { UserSession } from '../auth/AuthScreen';

interface Props {
  session?: UserSession;
  onNavigate?: (module: string) => void;
  onClose?: () => void;
}

export const TelehealthMeshSuite: React.FC<Props> = ({
  session,
  onNavigate,
  onClose,
}) => {
  const [meshState, setMeshState] = useState<TelehealthMeshState>(loadMeshState);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('NODE-ESSIEN-UDIM-01');
  const [isSimulatingSync, setIsSimulatingSync] = useState<boolean>(false);
  const [liveLog, setLiveLog] = useState<string[]>([
    'Telehealth Mesh Engine initialized on Akwa Ibom State UHF/Wi-Fi mesh spectrum.',
    'Discovered 6 peer nodes across Essien Udim, Eastern Obolo, Ini, and coastal creeks.',
    'Merkle Vector Clock verified: Root digest 0x8f3c4e2a1b9d07e6 (Consistent).',
  ]);

  const addLog = (msg: string) => {
    setLiveLog(prev => [`[${new Date().toLocaleTimeString('en-GB')}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const handlePeerPing = () => {
    const next = triggerPeerDiscovery(meshState);
    setMeshState(next);
    addLog('Scanned 2.4GHz & 5GHz ad-hoc mesh channels: All 6 nodes responding within 42ms.');
  };

  const handleBroadcastPacket = (type: DtnBundlePacket['payloadType'], ref: string) => {
    const next = broadcastDtnPacket(meshState, selectedNodeId, type, ref);
    setMeshState(next);
    addLog(`Created cryptographically signed DTN bundle from ${selectedNodeId}: [${type}] "${ref}". In transit across local mesh.`);
  };

  const handleSatelliteUplinkSync = () => {
    setIsSimulatingSync(true);
    addLog('Starlink LEO Satellite Uplink Beam acquired. Flushing DTN bundle queues to Akwa Ibom State Cloud...');
    window.setTimeout(() => {
      const next = syncViaSatelliteUplink(meshState);
      setMeshState(next);
      setIsSimulatingSync(false);
      addLog('✅ All pending packets synced to State Cloud. Merkle tree updated.');
    }, 1200);
  };

  const handleToggleBlackout = () => {
    const next = toggleBlackoutSimulation(meshState);
    setMeshState(next);
    if (next.blackoutSimulated) {
      addLog('⚠️ SIMULATION ACTIVATED: Complete fiber & GSM cellular blackout. Remote nodes switched to Store-and-Forward local mesh only.');
    } else {
      addLog('Normal connectivity restored. Satellite uplink and district hubs online.');
    }
  };

  const selectedNode = meshState.nodes.find(n => n.id === selectedNodeId) || meshState.nodes[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* ── TOP TELEMETRY BANNER ────────────────────────────────────────── */}
      <div
        style={{
          background: meshState.blackoutSimulated
            ? 'linear-gradient(135deg, #1E1B4B 0%, #311042 50%, #7F1D1D 100%)'
            : 'linear-gradient(135deg, #091E3A 0%, #0F3763 50%, #0D9488 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          color: '#FFFFFF',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
          transition: 'all 0.3s ease',
        }}
      >
        <div style={{ maxWidth: 680 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255, 255, 255, 0.25)', borderRadius: 9999, padding: '4px 14px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', marginBottom: 12 }}>
            <Radio size={14} className="animate-pulse" />
            <span>AKWA IBOM RURAL TELEHEALTH MESH · DTN & SATELLITE ENGINE</span>
          </div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Smart Infrastructure & Low-Bandwidth Satellite Sync
          </h1>
          <p style={{ margin: 0, fontSize: '0.92rem', color: '#CBD5E1', lineHeight: 1.6 }}>
            Enabling remote clinics in Essien Udim, Eastern Obolo, and Ini to communicate peer-to-peer over ad-hoc Wi-Fi/mesh, automatically store-and-forwarding records until satellite or cloud backhaul is detected.
          </p>
        </div>

        {/* Satellite Constellation Status Card */}
        <div style={{ background: 'rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: 16, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 800, color: '#5EEAD4' }}>
              <Satellite size={18} />
              <span>{meshState.satellite.constellation}</span>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 9999,
                background: meshState.satellite.uplinkState === 'OPTIMAL_BEAM_LOCKED' ? '#059669' : '#DC2626',
                color: '#FFFFFF',
              }}
            >
              {meshState.satellite.uplinkState.replace('_', ' ')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.78rem' }}>
            <div>
              <div style={{ color: '#94A3B8' }}>Uplink Speed</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFFFFF' }}>
                {meshState.satellite.uplinkSpeedKbps} Kbps
              </div>
            </div>
            <div>
              <div style={{ color: '#94A3B8' }}>Data Reduction</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#34D399' }}>
                {meshState.satellite.dataSavingsPercent}% Saved
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.72rem', color: '#CBD5E1', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 8 }}>
            Merkle Vector Root: <strong style={{ color: '#5EEAD4' }}>{meshState.satellite.merkleTreeRoot}</strong>
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE MESH CONTROLS ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleToggleBlackout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderRadius: 12,
            border: 'none',
            background: meshState.blackoutSimulated ? '#DC2626' : '#334155',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <AlertTriangle size={16} />
          <span>{meshState.blackoutSimulated ? 'Exit Blackout Simulation' : 'Simulate Complete Blackout'}</span>
        </button>

        <button
          type="button"
          onClick={handlePeerPing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            color: '#0F172A',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <Wifi size={16} color="#0D9488" />
          <span>Ping Local Wi-Fi Mesh Peers</span>
        </button>

        <button
          type="button"
          onClick={handleSatelliteUplinkSync}
          disabled={isSimulatingSync || meshState.blackoutSimulated}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 22px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: isSimulatingSync || meshState.blackoutSimulated ? 'not-allowed' : 'pointer',
            opacity: isSimulatingSync || meshState.blackoutSimulated ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
          }}
        >
          <Satellite size={16} />
          <span>{isSimulatingSync ? 'Flushing Bundles to Satellite...' : 'Opportunistic Satellite Sync'}</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
          <span>6/6 Akwa Ibom Decentralized Mesh Nodes Synchronized</span>
        </div>
      </div>

      {/* ── MESH TOPOLOGY & NODES GRID ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {meshState.nodes.map(node => {
          const isSelected = selectedNodeId === node.id;
          return (
            <div
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '20px',
                border: `2px solid ${isSelected ? '#0D9488' : '#E2E8F0'}`,
                boxShadow: isSelected ? '0 8px 24px rgba(13, 148, 136, 0.12)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0D9488', textTransform: 'uppercase' }}>
                    {node.lga} LGA · {node.facilityType.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A' }}>{node.name}</div>
                </div>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 9999,
                    background: node.status === 'SATELLITE_UPLINK_HOT' ? '#ECFDF5' : node.status === 'MESH_PEER_ACTIVE' ? '#EFF6FF' : '#FEF2F2',
                    color: node.status === 'SATELLITE_UPLINK_HOT' ? '#059669' : node.status === 'MESH_PEER_ACTIVE' ? '#1D4ED8' : '#DC2626',
                  }}
                >
                  {node.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Hardware Telemetry Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#F8FAFC', padding: '10px 12px', borderRadius: 10, fontSize: '0.72rem' }}>
                <div>
                  <div style={{ color: '#64748B' }}>Signal</div>
                  <div style={{ fontWeight: 800, color: '#0F172A' }}>{node.rssiDb} dBm</div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>Battery</div>
                  <div style={{ fontWeight: 800, color: node.batteryPercent < 80 ? '#D97706' : '#10B981' }}>
                    {node.batteryPercent}% {node.solarPowered ? '☀️' : '⚡'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>DTN Queue</div>
                  <div style={{ fontWeight: 800, color: node.queuedDtnBundles > 0 ? '#DC2626' : '#059669' }}>
                    {node.queuedDtnBundles} pkts
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748B' }}>Clock</div>
                  <div style={{ fontWeight: 800, color: '#0F172A' }}>v{node.vectorClock}</div>
                </div>
              </div>

              {/* Peer Hops */}
              <div style={{ fontSize: '0.72rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={13} />
                <span>Connected Mesh Peers: <strong>{node.meshPeersConnected.join(', ')}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SELECTED NODE DISPATCH & LIVE DTN PACKETS ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 2fr)', gap: 20 }}>
        {/* Node Dispatch Console */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            padding: '22px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '0.98rem', color: '#0F172A' }}>
            <Cpu size={18} color="#0D9488" />
            <span>Generate DTN Bundle from {selectedNode.lga}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B', lineHeight: 1.5 }}>
            Transmit patient records across the local peer-to-peer Wi-Fi mesh without relying on cellular data or internet access.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => handleBroadcastPacket('TRIAGE_VITALS', 'PAT-AKS-4401 (Severe Malaria STAT)')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              <span>Transmit Triage Vitals Bundle</span>
              <Send size={15} color="#0D9488" />
            </button>

            <button
              type="button"
              onClick={() => handleBroadcastPacket('ANC_OBSERVATION', 'PAT-AKS-8812 (Pre-Eclampsia Alert)')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              <span>Transmit Antenatal CTG Bundle</span>
              <Send size={15} color="#0D9488" />
            </button>

            <button
              type="button"
              onClick={() => handleBroadcastPacket('CMS_EMERGENCY_REORDER', 'IV Artesunate + Oxytocin STAT')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                background: '#F8FAFC',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              <span>Transmit CMS Emergency Stock Request</span>
              <Send size={15} color="#0D9488" />
            </button>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 8 }}>
              Telemetry Activity Log:
            </div>
            <div
              style={{
                background: '#0F172A',
                borderRadius: 10,
                padding: '12px 14px',
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                color: '#34D399',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {liveLog.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Live DTN Bundle Stream */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            padding: '22px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '0.98rem', color: '#0F172A' }}>
              <HardDrive size={18} color="#0D9488" />
              <span>Delay-Tolerant Network (DTN) Packet Bundles</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
              SHA-256 Envelope Authenticated
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {meshState.packets.map(pkt => {
              const isDelivered = pkt.status === 'SYNCED_TO_STATE_CLOUD' || pkt.status === 'DELIVERED_TO_GATEWAY';
              return (
                <div
                  key={pkt.bundleId}
                  style={{
                    background: '#F8FAFC',
                    borderRadius: 14,
                    padding: '16px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>{pkt.bundleId}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#E0F2FE',
                          color: '#0369A1',
                        }}
                      >
                        {pkt.payloadType.replace('_', ' ')}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 10px',
                        borderRadius: 9999,
                        background: isDelivered ? '#ECFDF5' : '#FEF3C7',
                        color: isDelivered ? '#059669' : '#D97706',
                      }}
                    >
                      {pkt.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Payload Ref: {pkt.patientRef}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', flexWrap: 'wrap', gap: 6 }}>
                    <div>
                      Origin: <strong>{pkt.originLga} LGA</strong> ➔ Target: <strong>Akwa Ibom MoH Cloud</strong>
                    </div>
                    <div>
                      Hops: <strong>{pkt.hops.length}</strong> · Delta: <strong style={{ color: '#059669' }}>{pkt.compressionRatio}</strong>
                    </div>
                    <div style={{ fontFamily: 'monospace' }}>
                      Hash: {pkt.checksumSha256.slice(0, 16)}...
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
