"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, MapControls } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CityEdge, CityMap, CityNode, EvidenceKind } from "../lib/city-map";
import { validateCityMap } from "../lib/city-map";
import { computeFlowLayout, flowStageLabel, type FlowLayout } from "../lib/flow-layout";
import { defaultShowcase, showcases, type Showcase } from "../lib/showcase-maps";

type ViewMode = "all" | "code" | "infra";
type Surface = "home" | "viewer";

const INSTALL_COMMAND = "npm install -g functionary-cli";

const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  declared: "Declared",
  observed: "Observed",
  inferred: "Inferred",
};

const EVIDENCE_COLORS: Record<EvidenceKind, string> = {
  declared: "#171915",
  observed: "#3f725d",
  inferred: "#a56f46",
};

function CameraRig({ viewKey, bounds }: { viewKey: string; bounds: FlowLayout["bounds"] }) {
  const camera = useThree((state) => state.camera);
  const viewportSize = useThree((state) => state.size);

  useLayoutEffect(() => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = Math.max(4, bounds.maxX - bounds.minX);
    const spanZ = Math.max(4, bounds.maxZ - bounds.minZ);
    camera.position.set(centerX + 11, 14, centerZ + 15);
    camera.lookAt(centerX, 0.35, centerZ);
    if (camera instanceof THREE.OrthographicCamera) {
      // Three cameras are intentionally controlled imperatively by React Three Fiber.
      // eslint-disable-next-line react-hooks/immutability
      camera.zoom = Math.max(12, Math.min(78, Math.min(viewportSize.width / (spanX + 6), viewportSize.height / (spanZ + 7)) * 0.92));
    }
    camera.updateProjectionMatrix();
  }, [bounds, camera, viewKey, viewportSize.height, viewportSize.width]);

  return null;
}

function FlowBands({ layout }: { layout: FlowLayout }) {
  const layerNumbers = [...new Set(layout.layers.values())].sort((a, b) => a - b);
  const maxLayer = Math.max(...layerNumbers, 0);
  const width = layout.bounds.maxX - layout.bounds.minX + 3;
  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2;

  return layerNumbers.map((layer) => {
    const ids = [...layout.layers].filter(([, value]) => value === layer).map(([id]) => id);
    const zValues = ids.map((id) => layout.positions.get(id)?.[1] ?? 0);
    const z = zValues.reduce((total, value) => total + value, 0) / Math.max(1, zValues.length);
    return (
      <group key={layer}>
        <mesh position={[centerX, -0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, 2.55]} />
          <meshBasicMaterial color={layer % 2 ? "#c6bea0" : "#ddd5b5"} transparent opacity={0.2} depthWrite={false} />
        </mesh>
        <Line
          points={[[layout.bounds.minX - 1.1, 0.01, z + 1.28], [layout.bounds.maxX + 1.1, 0.01, z + 1.28]]}
          color="#8d866d"
          lineWidth={0.55}
          dashed
          dashSize={0.16}
          gapSize={0.12}
          transparent
          opacity={0.6}
        />
        <Html position={[layout.bounds.minX - 1.25, 0.02, z]} center={false} zIndexRange={[1, 0]}>
          <span className="flow-stage-label"><b>{String(layer + 1).padStart(2, "0")}</b>{flowStageLabel(layer, maxLayer)}</span>
        </Html>
      </group>
    );
  });
}

function Connections({ edges, positions, selectedId }: { edges: CityEdge[]; positions: Map<string, [number, number]>; selectedId: string }) {
  return edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return null;
    const emphasized = edge.from === selectedId || edge.to === selectedId;
    const middleZ = from[1] + (to[1] - from[1]) * 0.52;
    const points: [number, number, number][] = [
      [from[0], 0.045, from[1]],
      [from[0], 0.045, middleZ],
      [to[0], 0.045, middleZ],
      [to[0], 0.045, to[1]],
    ];
    const arrowStart = new THREE.Vector3(to[0], 0.07, middleZ);
    const arrowEnd = new THREE.Vector3(to[0], 0.07, to[1]);
    if (arrowStart.distanceTo(arrowEnd) < 0.12) arrowStart.set(from[0], 0.07, middleZ);
    const direction = arrowEnd.clone().sub(arrowStart).normalize();
    const arrowPosition = arrowStart.clone().lerp(arrowEnd, 0.74);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    return (
      <group key={edge.id}>
        <Line
          points={points}
          color={EVIDENCE_COLORS[edge.evidence]}
          lineWidth={emphasized ? 2 : 0.8}
          dashed={edge.evidence === "inferred"}
          dashSize={0.17}
          gapSize={0.1}
          transparent
          opacity={emphasized ? 0.92 : 0.2}
        />
        <mesh position={arrowPosition} quaternion={quaternion}>
          <coneGeometry args={[emphasized ? 0.105 : 0.07, emphasized ? 0.26 : 0.18, 4]} />
          <meshBasicMaterial color={EVIDENCE_COLORS[edge.evidence]} transparent opacity={emphasized ? 0.95 : 0.34} />
        </mesh>
      </group>
    );
  });
}

function geometryFor(archetype: CityNode["archetype"], width: number, height: number, depth: number) {
  if (archetype === "database") return new THREE.CylinderGeometry(width / 2, width / 2, height, 24);
  if (archetype === "cloud") return new THREE.DodecahedronGeometry(width * 0.57, 0);
  if (archetype === "gateway") return new THREE.BoxGeometry(width, height, depth * 0.72);
  return new THREE.BoxGeometry(width, height, depth);
}

function Structure({ node, index, position, selected, onSelect }: {
  node: CityNode;
  index: number;
  position: [number, number];
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const size = node.display?.size ?? [1.65, 1.2, 1.4];
  const [width, height, depth] = size;
  const geometry = useMemo(() => geometryFor(node.archetype, width, height, depth), [depth, height, node.archetype, width]);
  const outline = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const color = node.display?.color ?? (node.kind === "infra" ? "#b17f9f" : node.kind === "external" ? "#cf8278" : "#81afa6");
  const floorCount = Math.max(0, Math.min(4, Math.round(height * 1.2) - 1));

  return (
    <group position={[position[0], height / 2, position[1]]}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
        scale={selected ? 1.055 : 1}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.86}
          transparent={node.kind === "external"}
          opacity={node.kind === "external" ? 0.82 : 1}
          emissive={selected ? color : "#000000"}
          emissiveIntensity={selected ? 0.2 : 0}
        />
      </mesh>
      <lineSegments geometry={outline} scale={selected ? 1.06 : 1.006}>
        <lineBasicMaterial color="#171915" />
      </lineSegments>
      {node.archetype !== "database" && node.archetype !== "cloud" && Array.from({ length: floorCount }, (_, floor) => (
        <mesh key={floor} position={[0, -height / 2 + ((floor + 1) * height) / (floorCount + 1), depth / 2 + 0.008]}>
          <planeGeometry args={[width * 0.86, 0.018]} />
          <meshBasicMaterial color="#171915" transparent opacity={0.56} />
        </mesh>
      ))}
      <Html position={[0, height / 2 + 0.24, 0]} center zIndexRange={selected || hovered ? [10, 3] : [4, 1]}>
        <button
          className={selected || hovered ? `structure-label${selected ? " selected" : ""}` : "structure-pin"}
          type="button"
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onClick={onSelect}
          aria-label={node.label}
        >
          {selected || hovered ? node.label : String(index + 1).padStart(2, "0")}
        </button>
      </Html>
    </group>
  );
}

function CityScene({ nodes, allNodes, edges, selectedId, onSelect, viewKey }: {
  nodes: CityNode[];
  allNodes: CityNode[];
  edges: CityEdge[];
  selectedId: string;
  onSelect: (id: string) => void;
  viewKey: string;
}) {
  const layout = useMemo(() => computeFlowLayout(nodes, edges, allNodes), [allNodes, edges, nodes]);
  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2;
  const centerZ = (layout.bounds.minZ + layout.bounds.maxZ) / 2;

  return (
    <Canvas
      orthographic
      camera={{ position: [10, 13, 15], zoom: 48, near: 0.1, far: 160 }}
      shadows
      dpr={[1, 1.7]}
      onPointerMissed={() => nodes[0] && onSelect(nodes[0].id)}
    >
      <CameraRig viewKey={viewKey} bounds={layout.bounds} />
      <color attach="background" args={["#d8d0aa"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-6, 12, 7]} intensity={2.25} castShadow shadow-mapSize={[1024, 1024]} />
      <gridHelper args={[80, 80, "#aaa27d", "#c8bf99"]} position={[0, -0.035, 0]} />
      <FlowBands layout={layout} />
      <Connections edges={edges} positions={layout.positions} selectedId={selectedId} />
      {nodes.map((node, index) => (
        <Structure key={node.id} node={node} index={index} position={layout.positions.get(node.id)!} selected={node.id === selectedId} onSelect={() => onSelect(node.id)} />
      ))}
      <MapControls makeDefault target={[centerX, 0.35, centerZ]} enableRotate={false} enableDamping dampingFactor={0.08} minZoom={12} maxZoom={110} screenSpacePanning />
    </Canvas>
  );
}

function Landing({ onOpen, onImport }: { onOpen: (showcase: Showcase) => void; onImport: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyInstall() {
    await navigator.clipboard.writeText(`${INSTALL_COMMAND}\nfunctionary map .`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="home-shell">
      <nav className="home-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top"><span>F</span>functionary.dev</a>
        <div><a href="#atlas">Atlas</a><a href="#install">CLI</a><button type="button" onClick={onImport}>Open a map</button></div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">A system atlas generated from source</p>
          <h1>See how the whole repository <em>actually flows.</em></h1>
          <p className="hero-lede">Functionary turns any codebase into a navigable city: entry points at the front, execution through the middle, infrastructure and external systems behind it.</p>
          <div className="hero-actions">
            <button className="button-dark" type="button" onClick={() => onOpen(showcases[0])}>Explore React <span>↗</span></button>
            <a className="button-light" href="#install">Map your repository <span>↓</span></a>
          </div>
        </div>
        <div className="hero-diagram" aria-label="Front-to-back repository flow illustration">
          <p>Request / event / import</p>
          <div className="flow-row flow-row-one"><span>01</span><b>Entry points</b><i /><i /></div>
          <div className="flow-arrow">↓ &nbsp; calls · routes · emits</div>
          <div className="flow-row flow-row-two"><span>02</span><b>Core compute</b><i /><i /><i /></div>
          <div className="flow-arrow">↓ &nbsp; reads · writes · deploys</div>
          <div className="flow-row flow-row-three"><span>03</span><b>State & runtime</b><i /><i /><i /><i /></div>
          <small>Buildings are deployables. Rooms are modules. Roads are evidence-backed relationships.</small>
        </div>
      </section>

      <section className="principles" aria-label="Product principles">
        <div><span>01</span><strong>Repository agnostic</strong><p>Applications, libraries, CLIs, infrastructure, compilers, data systems, and monorepos.</p></div>
        <div><span>02</span><strong>Semantic, not mechanical</strong><p>The agent finds boundaries and flow instead of mirroring every directory.</p></div>
        <div><span>03</span><strong>Evidence on every claim</strong><p>Trace a structure back to manifests, code, config, infrastructure, or runtime facts.</p></div>
      </section>

      <section className="atlas" id="atlas">
        <div className="section-heading"><p className="kicker">The open-source atlas</p><h2>Famous systems,<br />made legible.</h2><p>Start with a familiar repository. Follow its public boundary through the machinery behind it.</p></div>
        <div className="repo-grid">
          {showcases.map((showcase, index) => {
            const structures = showcase.map.nodes.filter((node) => node.kind !== "scope");
            const stages = new Set(structures.map((node) => node.display?.flowLayer ?? 0)).size;
            return (
              <button className="repo-card" key={showcase.slug} type="button" onClick={() => onOpen(showcase)} style={{ "--repo-accent": showcase.accent } as React.CSSProperties}>
                <div className="repo-card-top"><span>{String(index + 1).padStart(2, "0")}</span><span>View map ↗</span></div>
                <h3>{showcase.map.name}</h3>
                <p>{showcase.map.summary}</p>
                <div className="mini-flow">{Array.from({ length: stages }, (_, stage) => <i key={stage} style={{ width: `${Math.min(88, 34 + stage * 17)}%` }} />)}</div>
                <div className="repo-meta"><span>{showcase.language}</span><span>{showcase.shape}</span><span>{structures.length} structures</span></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="install" id="install">
        <div><p className="kicker">Map your own</p><h2>One command.<br />A whole-system view.</h2><p>The Functionary CLI bundles the mapping skill. Codex reads the repository in a read-only sandbox, emits a validated map, and leaves the code untouched.</p></div>
        <div className="terminal-card">
          <div><span>CLI launch package</span><span>● ● ●</span></div>
          <code><b>$</b> {INSTALL_COMMAND}</code>
          <code><b>$</b> functionary map .</code>
          <p>✓ .functionary/map.json</p>
          <button type="button" onClick={copyInstall}>{copied ? "Copied" : "Copy commands"}</button>
        </div>
        <div className="install-actions"><button className="button-dark" type="button" onClick={onImport}>Open generated map <span>↑</span></button><a href="#atlas">Explore example maps ↑</a></div>
      </section>

      <footer><a className="wordmark" href="#top"><span>F</span>functionary.dev</a><p>Understand the system before changing it.</p><span>Built for unfamiliar code.</span></footer>
    </main>
  );
}

function MapViewer({ map, initialNotice, onHome, onImport }: { map: CityMap; initialNotice?: string | null; onHome: () => void; onImport: () => void }) {
  const nodeById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);
  const firstStructure = map.nodes.find((node) => node.parentId && nodeById.get(node.parentId)?.kind === "scope") ?? map.nodes[0];
  const [selectedId, setSelectedId] = useState(firstStructure?.id ?? "");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("all");
  const [enabledEvidence, setEnabledEvidence] = useState<Set<EvidenceKind>>(new Set(["declared", "observed", "inferred"]));
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);

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
  const layout = useMemo(() => computeFlowLayout(visibleNodes, visibleEdges, map.nodes), [map.nodes, visibleEdges, visibleNodes]);
  const maxLayer = Math.max(...layout.layers.values(), 0);
  const effectiveSelectedId = visibleIds.has(selectedId) ? selectedId : visibleNodes[0]?.id ?? selectedId;
  const selected = nodeById.get(effectiveSelectedId) ?? visibleNodes[0] ?? map.nodes[0];
  const selectedChildren = selected ? map.nodes.filter((node) => node.parentId === selected.id) : [];
  const relatedEdges = selected ? map.edges.filter((edge) => edge.from === selected.id || edge.to === selected.id) : [];
  const filteredRailNodes = visibleNodes.filter((node) => `${node.label} ${node.kind} ${node.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const layerNumbers = [...new Set(layout.layers.values())].sort((a, b) => a - b);

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

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={onHome}><span className="brand-mark">F</span><span>functionary.dev</span></button>
        <div className="stat"><span>Repository</span><strong>{map.repository ?? map.id}</strong></div>
        <div className="stat"><span>Flow stages</span><strong>{layerNumbers.length}</strong></div>
        <div className="stat"><span>Relationships</span><strong>{visibleEdges.length}</strong></div>
        <div className="header-actions"><button className="secondary-action" type="button" onClick={onHome}>Atlas</button><button className="map-action" type="button" onClick={onImport}>Open map</button></div>
      </header>

      <aside className="rail">
        <div className="rail-heading">
          {focusId && <button className="back-link" type="button" onClick={leaveFocus}>← System map</button>}
          <p className="eyebrow">{focusId ? "Inside building" : "Flow map"}</p>
          <h1>{focusNode?.label ?? map.name}</h1>
          <p className="rail-copy">{focusNode?.description ?? map.summary ?? "A semantic repository map."}</p>
        </div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a structure" /></label>
        <div className="component-list" aria-label="Mapped components">
          {layerNumbers.map((layer) => {
            const nodes = filteredRailNodes.filter((node) => layout.layers.get(node.id) === layer);
            if (!nodes.length) return null;
            return (
              <section className="rail-group" key={layer}>
                <p><span>{String(layer + 1).padStart(2, "0")}</span>{flowStageLabel(layer, maxLayer)}</p>
                {nodes.map((node) => <ComponentRow key={node.id} node={node} active={node.id === effectiveSelectedId} onSelect={() => setSelectedId(node.id)} />)}
              </section>
            );
          })}
        </div>
      </aside>

      <section className="viewport" aria-label="Interactive repository city">
        {visibleNodes.length ? <CityScene nodes={visibleNodes} allNodes={map.nodes} edges={visibleEdges} selectedId={effectiveSelectedId} onSelect={setSelectedId} viewKey={`${map.id}:${focusId ?? "campus"}:${mode}`} /> : <div className="empty-view"><strong>No structures in this layer.</strong><button type="button" onClick={() => setMode("all")}>Show all components</button></div>}
        <div className="viewport-label"><span className="pulse" /> {focusId ? `${focusNode?.label} interior` : "Front → back system flow"}</div>
        <p className="viewport-help">Hover to label · select to trace · drag to pan · scroll to zoom</p>
        <div className="control-deck">
          <div className="mode-switch" aria-label="Component layer">{(["all", "code", "infra"] as ViewMode[]).map((item) => <button key={item} type="button" className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
          <span className="deck-rule" />
          <div className="evidence-switch" aria-label="Relationship evidence">{(["declared", "observed", "inferred"] as EvidenceKind[]).map((kind) => <button key={kind} type="button" className={enabledEvidence.has(kind) ? "active" : ""} onClick={() => toggleEvidence(kind)}><i style={{ background: EVIDENCE_COLORS[kind] }} />{EVIDENCE_LABELS[kind]}</button>)}</div>
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
            <div><dt>Flow stage</dt><dd>{String((layout.layers.get(selected.id) ?? 0) + 1).padStart(2, "0")} · {flowStageLabel(layout.layers.get(selected.id) ?? 0, maxLayer)}</dd></div>
            <div><dt>Contains</dt><dd>{selectedChildren.length ? `${selectedChildren.length} rooms` : "No child map"}</dd></div>
            <div><dt>Relationships</dt><dd>{relatedEdges.length}</dd></div>
            <div><dt>Source refs</dt><dd>{selected.sourceRefs?.length ?? 0}</dd></div>
          </dl>
          <button className="primary" type="button" disabled={!selectedChildren.length} onClick={enterSelected}>{selectedChildren.length ? "Enter building" : "No interior map"}<span>→</span></button>
          {!!Object.keys(selected.metrics ?? {}).length && <section className="metric-grid"><p className="eyebrow">Mapped metrics</p><div>{Object.entries(selected.metrics ?? {}).slice(0, 4).map(([key, value]) => <span key={key}><strong>{Number.isInteger(value) ? value.toLocaleString() : value}</strong><small>{key}</small></span>)}</div></section>}
          <section className="source-list"><p className="eyebrow">Evidence trail</p>{selected.sourceRefs?.length ? selected.sourceRefs.map((ref, index) => <div key={`${ref.path ?? ref.url}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><code>{ref.path ?? ref.url}{ref.line ? `:${ref.line}` : ""}</code></div>) : <p className="muted">No evidence references supplied.</p>}</section>
          {map.warnings?.length ? <section className="warning"><span>Mapping note</span><p>{map.warnings[0]}</p></section> : null}
        </>}
      </aside>
    </main>
  );
}

export default function Functionary() {
  const [surface, setSurface] = useState<Surface>("home");
  const [map, setMap] = useState<CityMap>(defaultShowcase.map);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function openShowcase(showcase: Showcase) {
    setMap(showcase.map);
    setNotice(`Opened curated ${showcase.map.name} map · ${showcase.map.nodes.length} nodes · ${showcase.map.edges.length} relationships.`);
    setSurface("viewer");
  }

  async function importMap(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const errors = validateCityMap(parsed);
      if (errors.length) throw new Error(errors.slice(0, 3).join(" "));
      const nextMap = parsed as CityMap;
      setMap(nextMap);
      setNotice(`Loaded ${nextMap.name} · ${nextMap.nodes.length} nodes · ${nextMap.edges.length} relationships.`);
      setSurface("viewer");
    } catch (error) {
      setNotice(error instanceof Error ? `Map rejected: ${error.message}` : "Map rejected: invalid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <>
      <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" onChange={importMap} />
      {surface === "home" ? <Landing onOpen={openShowcase} onImport={() => fileInput.current?.click()} /> : <MapViewer key={map.id} map={map} initialNotice={notice} onHome={() => setSurface("home")} onImport={() => fileInput.current?.click()} />}
    </>
  );
}

function ComponentRow({ node, active, onSelect }: { node: CityNode; active: boolean; onSelect: () => void }) {
  return <button className={active ? "component-row active" : "component-row"} onClick={onSelect} type="button"><span className="row-index">{node.archetype.slice(0, 2).toUpperCase()}</span><span><strong>{node.label}</strong><small>{node.kind} · {node.archetype}</small></span></button>;
}
