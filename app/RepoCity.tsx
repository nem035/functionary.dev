"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, MapControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CityEdge, CityMap, CityNode, EvidenceKind } from "../lib/city-map";
import { validateCityMap } from "../lib/city-map";
import { sampleMap } from "../lib/sample-map";

type ViewMode = "all" | "code" | "infra";

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  declared: "Declared",
  observed: "Observed",
  inferred: "Inferred",
};

const EVIDENCE_COLORS: Record<EvidenceKind, string> = {
  declared: "#191a17",
  observed: "#3f725d",
  inferred: "#96704f",
};

function CameraRig({ viewKey }: { viewKey: string }) {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(10, 11, 11);
    camera.lookAt(0, 0.45, 0);
    if (camera instanceof THREE.OrthographicCamera) camera.zoom = viewKey === "campus" ? 52 : 62;
    camera.updateProjectionMatrix();
  }, [camera, viewKey]);
  return null;
}

function fallbackPosition(index: number, count: number): [number, number] {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return [((index % columns) - (columns - 1) / 2) * 3, (Math.floor(index / columns) - (rows - 1) / 2) * 2.8];
}

function DistrictPlots({ nodes, allNodes }: { nodes: CityNode[]; allNodes: CityNode[] }) {
  const scopeById = new Map(allNodes.filter((node) => node.kind === "scope").map((node) => [node.id, node]));
  const groups = new Map<string, CityNode[]>();
  nodes.forEach((node) => {
    const key = node.parentId ?? "unmapped";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  return [...groups.entries()].map(([scopeId, children]) => {
    const positions = children.map((node, index) => node.display?.position ?? fallbackPosition(index, children.length));
    const sizes = children.map((node) => node.display?.size ?? [1.6, 1.2, 1.4]);
    const minX = Math.min(...positions.map((p, i) => p[0] - sizes[i][0] / 2)) - 0.55;
    const maxX = Math.max(...positions.map((p, i) => p[0] + sizes[i][0] / 2)) + 0.55;
    const minZ = Math.min(...positions.map((p, i) => p[1] - sizes[i][2] / 2)) - 0.55;
    const maxZ = Math.max(...positions.map((p, i) => p[1] + sizes[i][2] / 2)) + 0.55;
    const points: [number, number, number][] = [
      [minX, 0.018, minZ], [maxX, 0.018, minZ], [maxX, 0.018, maxZ],
      [minX, 0.018, maxZ], [minX, 0.018, minZ],
    ];
    return (
      <group key={scopeId}>
        <mesh position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[maxX - minX, maxZ - minZ]} />
          <meshBasicMaterial color="#c9c098" transparent opacity={0.17} depthWrite={false} />
        </mesh>
        <Line points={points} color="#847d62" lineWidth={0.65} dashed dashSize={0.18} gapSize={0.12} />
        <Html position={[minX + 0.12, 0.03, maxZ - 0.08]} center={false} zIndexRange={[1, 0]}>
          <span className="district-label">{scopeById.get(scopeId)?.label ?? "Unmapped"}</span>
        </Html>
      </group>
    );
  });
}

function Connections({ edges, positions }: { edges: CityEdge[]; positions: Map<string, [number, number]> }) {
  return edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return null;
    const middleZ = from[1] + (to[1] - from[1]) * 0.5;
    const points: [number, number, number][] = [
      [from[0], 0.045, from[1]],
      [from[0], 0.045, middleZ],
      [to[0], 0.045, middleZ],
      [to[0], 0.045, to[1]],
    ];
    return (
      <Line
        key={edge.id}
        points={points}
        color={EVIDENCE_COLORS[edge.evidence]}
        lineWidth={edge.evidence === "observed" ? 1.8 : 1.15}
        dashed={edge.evidence === "inferred"}
        dashSize={0.17}
        gapSize={0.1}
        transparent
        opacity={0.82}
      />
    );
  });
}

function geometryFor(node: CityNode, size: [number, number, number]) {
  const [width, height, depth] = size;
  if (node.archetype === "database") return new THREE.CylinderGeometry(width / 2, width / 2, height, 24);
  if (node.archetype === "cloud") return new THREE.DodecahedronGeometry(width * 0.57, 0);
  if (node.archetype === "gateway") return new THREE.BoxGeometry(width, height, depth * 0.72);
  return new THREE.BoxGeometry(width, height, depth);
}

function Structure({ node, position, selected, onSelect }: { node: CityNode; position: [number, number]; selected: boolean; onSelect: () => void }) {
  const size = node.display?.size ?? [1.6, 1.2, 1.4];
  const [width, height, depth] = size;
  const geometry = useMemo(() => geometryFor(node, size), [depth, height, node, width]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const color = node.display?.color ?? (node.kind === "infra" ? "#b17f9f" : node.kind === "external" ? "#cf7e78" : "#8cb7a7");
  const floorCount = Math.max(0, Math.min(4, Math.round(height * 1.2) - 1));

  return (
    <group position={[position[0], height / 2, position[1]]}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { document.body.style.cursor = "default"; }}
        scale={selected ? 1.055 : 1}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.84}
          transparent={node.kind === "external"}
          opacity={node.kind === "external" ? 0.82 : 1}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.22 : 0}
        />
      </mesh>
      <lineSegments geometry={edges} scale={selected ? 1.06 : 1.006}>
        <lineBasicMaterial color="#191a17" />
      </lineSegments>
      {node.archetype !== "database" && node.archetype !== "cloud" && Array.from({ length: floorCount }, (_, index) => (
        <mesh key={index} position={[0, -height / 2 + ((index + 1) * height) / (floorCount + 1), depth / 2 + 0.008]}>
          <planeGeometry args={[width * 0.86, 0.018]} />
          <meshBasicMaterial color="#191a17" transparent opacity={0.58} />
        </mesh>
      ))}
      <Html position={[0, height / 2 + 0.32, 0]} center zIndexRange={[10, 2]}>
        <button className={selected ? "structure-label selected" : "structure-label"} type="button" onClick={onSelect}>{node.label}</button>
      </Html>
    </group>
  );
}

function CityScene({ nodes, allNodes, edges, selectedId, onSelect, viewKey, showDistricts }: {
  nodes: CityNode[];
  allNodes: CityNode[];
  edges: CityEdge[];
  selectedId: string;
  onSelect: (id: string) => void;
  viewKey: string;
  showDistricts: boolean;
}) {
  const positions = useMemo(() => {
    const map = new Map<string, [number, number]>();
    nodes.forEach((node, index) => map.set(node.id, node.display?.position ?? fallbackPosition(index, nodes.length)));
    return map;
  }, [nodes]);

  return (
    <Canvas
      orthographic
      camera={{ position: [10, 11, 11], zoom: 52, near: 0.1, far: 100 }}
      shadows
      dpr={[1, 1.7]}
      onPointerMissed={() => nodes[0] && onSelect(nodes[0].id)}
    >
      <CameraRig viewKey={viewKey} />
      <color attach="background" args={["#d8d0aa"]} />
      <ambientLight intensity={1.55} />
      <directionalLight position={[-6, 12, 7]} intensity={2.35} castShadow shadow-mapSize={[1024, 1024]} />
      <gridHelper args={[24, 24, "#aaa27d", "#c8bf99"]} position={[0, -0.025, 0]} />
      {showDistricts && <DistrictPlots nodes={nodes} allNodes={allNodes} />}
      <Connections edges={edges} positions={positions} />
      {nodes.map((node) => (
        <Structure key={node.id} node={node} position={positions.get(node.id)!} selected={node.id === selectedId} onSelect={() => onSelect(node.id)} />
      ))}
      <MapControls makeDefault enableRotate={false} enableDamping dampingFactor={0.08} minZoom={30} maxZoom={110} screenSpacePanning />
    </Canvas>
  );
}

function downloadMap(map: CityMap) {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${map.id}.repo-city.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function RepoCity() {
  const [map, setMap] = useState<CityMap>(sampleMap);
  const [selectedId, setSelectedId] = useState("checkout");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("all");
  const [enabledEvidence, setEnabledEvidence] = useState<Set<EvidenceKind>>(new Set(["declared", "observed", "inferred"]));
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const nodeById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);
  const focusNode = focusId ? nodeById.get(focusId) : undefined;
  const baseNodes = useMemo(() => {
    if (focusId) return map.nodes.filter((node) => node.parentId === focusId);
    return map.nodes.filter((node) => node.parentId && nodeById.get(node.parentId)?.kind === "scope");
  }, [focusId, map.nodes, nodeById]);
  const visibleNodes = useMemo(() => baseNodes.filter((node) => {
    if (mode === "code") return node.kind === "deployable" || node.kind === "module";
    if (mode === "infra") return node.kind === "infra" || node.kind === "external";
    return true;
  }), [baseNodes, mode]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => map.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to) && enabledEvidence.has(edge.evidence)), [enabledEvidence, map.edges, visibleIds]);
  const selected = nodeById.get(selectedId) ?? visibleNodes[0] ?? map.nodes[0];
  const selectedChildren = selected ? map.nodes.filter((node) => node.parentId === selected.id) : [];
  const relatedEdges = selected ? map.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];
  const scopes = map.nodes.filter((node) => node.kind === "scope");
  const filteredRailNodes = baseNodes.filter((node) => `${node.label} ${node.kind} ${node.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (visibleNodes.length && !visibleIds.has(selectedId)) setSelectedId(visibleNodes[0].id);
  }, [selectedId, visibleIds, visibleNodes]);

  function toggleEvidence(kind: EvidenceKind) {
    setEnabledEvidence((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }

  function enterSelected() {
    if (!selectedChildren.length) return;
    setFocusId(selected.id);
    setMode("all");
    setSelectedId(selectedChildren[0].id);
  }

  function leaveFocus() {
    const previousFocus = focusId;
    setFocusId(null);
    setMode("all");
    if (previousFocus) setSelectedId(previousFocus);
  }

  async function importMap(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const errors = validateCityMap(parsed);
      if (errors.length) throw new Error(errors.slice(0, 3).join(" "));
      const nextMap = parsed as CityMap;
      const firstStructure = nextMap.nodes.find((node) => node.parentId && nextMap.nodes.find((candidate) => candidate.id === node.parentId)?.kind === "scope");
      setMap(nextMap);
      setFocusId(null);
      setMode("all");
      if (firstStructure) setSelectedId(firstStructure.id);
      setNotice(`Loaded ${nextMap.name}: ${nextMap.nodes.length} nodes, ${nextMap.edges.length} relationships.`);
    } catch (error) {
      setNotice(error instanceof Error ? `Map rejected: ${error.message}` : "Map rejected: invalid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">RC</span><span>Repo City</span></div>
        <div className="stat"><span>Repository</span><strong>{map.repository ?? map.id}</strong></div>
        <div className="stat"><span>Structures</span><strong>{baseNodes.length}</strong></div>
        <div className="stat"><span>Connections</span><strong>{visibleEdges.length}</strong></div>
        <div className="header-actions">
          <button className="secondary-action" type="button" onClick={() => downloadMap(map)}>Export JSON</button>
          <button className="map-action" type="button" onClick={() => fileInput.current?.click()}>Import agent map</button>
          <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={importMap} />
        </div>
      </header>

      <aside className="rail">
        <div className="rail-heading">
          {focusId && <button className="back-link" type="button" onClick={leaveFocus}>← Campus</button>}
          <p className="eyebrow">{focusId ? "Inside building" : "System map"}</p>
          <h1>{focusNode?.label ?? map.name}</h1>
          <p className="rail-copy">{focusNode?.description ?? map.summary ?? "A semantic repository map."}</p>
        </div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a structure" /></label>
        <div className="component-list" aria-label="Mapped components">
          {focusId ? filteredRailNodes.map((node, index) => (
            <ComponentRow key={node.id} node={node} index={index} active={node.id === selectedId} onSelect={() => setSelectedId(node.id)} />
          )) : scopes.map((scope) => {
            const children = filteredRailNodes.filter((node) => node.parentId === scope.id);
            if (!children.length) return null;
            return (
              <section className="rail-group" key={scope.id}>
                <p>{scope.label}</p>
                {children.map((node, index) => <ComponentRow key={node.id} node={node} index={index} active={node.id === selectedId} onSelect={() => setSelectedId(node.id)} />)}
              </section>
            );
          })}
        </div>
      </aside>

      <section className="viewport" aria-label="Interactive repository city">
        {visibleNodes.length ? (
          <CityScene nodes={visibleNodes} allNodes={map.nodes} edges={visibleEdges} selectedId={selectedId} onSelect={setSelectedId} viewKey={focusId ?? "campus"} showDistricts={!focusId} />
        ) : (
          <div className="empty-view"><strong>No structures in this layer.</strong><button type="button" onClick={() => setMode("all")}>Show all components</button></div>
        )}
        <div className="viewport-label"><span className="pulse" /> {focusId ? `${focusNode?.label} interior` : "Semantic campus"}</div>
        <p className="viewport-help">Drag to pan · scroll to zoom · select to inspect</p>
        <div className="control-deck">
          <div className="mode-switch" aria-label="Component layer">
            {(["all", "code", "infra"] as ViewMode[]).map((item) => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}
          </div>
          <span className="deck-rule" />
          <div className="evidence-switch" aria-label="Relationship evidence">
            {(["declared", "observed", "inferred"] as EvidenceKind[]).map((kind) => (
              <button key={kind} type="button" className={enabledEvidence.has(kind) ? "active" : ""} onClick={() => toggleEvidence(kind)}>
                <i style={{ background: EVIDENCE_COLORS[kind] }} />{EVIDENCE_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
        {notice && <button className="notice" type="button" onClick={() => setNotice(null)}>{notice}<span>×</span></button>}
      </section>

      <aside className="inspector">
        {selected && <>
          <p className="eyebrow">Selected structure</p>
          <div className="kind-tag">{selected.kind} · {selected.archetype}</div>
          <h2>{selected.label}</h2>
          <p className="description">{selected.description ?? "No description was provided by the mapping agent."}</p>
          <dl>
            <div><dt>Contains</dt><dd>{selectedChildren.length ? `${selectedChildren.length} rooms` : "No child map"}</dd></div>
            <div><dt>Relationships</dt><dd>{relatedEdges.length}</dd></div>
            <div><dt>Evidence</dt><dd>{new Set(relatedEdges.map((edge) => edge.evidence)).size || "—"} types</dd></div>
            <div><dt>Source refs</dt><dd>{selected.sourceRefs?.length ?? 0}</dd></div>
          </dl>
          <button className="primary" type="button" disabled={!selectedChildren.length} onClick={enterSelected}>
            {selectedChildren.length ? "Enter building" : "No interior map"}<span>→</span>
          </button>

          {!!Object.keys(selected.metrics ?? {}).length && <section className="metric-grid">
            <p className="eyebrow">Mapped metrics</p>
            <div>{Object.entries(selected.metrics ?? {}).slice(0, 4).map(([key, value]) => <span key={key}><strong>{Number.isInteger(value) ? value.toLocaleString() : value}</strong><small>{key}</small></span>)}</div>
          </section>}

          <section className="source-list">
            <p className="eyebrow">Evidence trail</p>
            {selected.sourceRefs?.length ? selected.sourceRefs.map((ref, index) => (
              <div key={`${ref.path ?? ref.url}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{ref.path ?? ref.url}{ref.line ? `:${ref.line}` : ""}</code></div>
            )) : <p className="muted">No evidence references supplied.</p>}
          </section>

          {map.warnings?.length ? <section className="warning"><span>Mapping note</span><p>{map.warnings[0]}</p></section> : null}
        </>}
      </aside>
    </main>
  );
}

function ComponentRow({ node, index, active, onSelect }: { node: CityNode; index: number; active: boolean; onSelect: () => void }) {
  return (
    <button className={active ? "component-row active" : "component-row"} onClick={onSelect} type="button">
      <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
      <span><strong>{node.label}</strong><small>{node.kind} · {node.archetype}</small></span>
    </button>
  );
}
