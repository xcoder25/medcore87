/** Patient knowledge graph — edges between clinical entities */
import { publishFacilityData } from './roleSyncBus';
import { buildPatient360 } from './patient360';

export type NodeType = 'patient' | 'condition' | 'medication' | 'lab' | 'imaging' | 'procedure' | 'doctor' | 'visit' | 'outcome';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  rel: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildPatientKnowledgeGraph(facilityId: string, patientKey: string): KnowledgeGraph {
  const bundle = buildPatient360(facilityId, patientKey);
  if (!bundle) return { nodes: [], edges: [] };
  const p = bundle.patient;
  const nodes: GraphNode[] = [{ id: `patient:${p.id}`, type: 'patient', label: `${p.firstName} ${p.lastName}` }];
  const edges: GraphEdge[] = [];

  for (const c of p.chronicConditions || p.problems || []) {
    const id = `cond:${c}`;
    nodes.push({ id, type: 'condition', label: c });
    edges.push({ id: `e-${id}`, from: `patient:${p.id}`, to: id, rel: 'has_condition' });
  }
  for (const m of p.currentMedications || []) {
    const id = `med:${m}`;
    nodes.push({ id, type: 'medication', label: m });
    edges.push({ id: `e-${id}`, from: `patient:${p.id}`, to: id, rel: 'on_medication' });
  }
  for (const ev of bundle.events.slice(0, 40)) {
    const type: NodeType =
      ev.kind === 'lab' ? 'lab' : ev.kind === 'rx' ? 'medication' : ev.kind === 'visit' ? 'visit' : ev.kind === 'imaging' ? 'imaging' : 'visit';
    const id = `ev:${ev.id}`;
    nodes.push({ id, type, label: ev.title });
    edges.push({ id: `e-${id}`, from: `patient:${p.id}`, to: id, rel: ev.kind });
  }
  return { nodes, edges };
}

export function graphSummary(g: KnowledgeGraph) {
  const byType: Record<string, number> = {};
  for (const n of g.nodes) byType[n.type] = (byType[n.type] || 0) + 1;
  return { nodeCount: g.nodes.length, edgeCount: g.edges.length, byType };
}
