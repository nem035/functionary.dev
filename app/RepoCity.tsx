"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, MapControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CityEdge, CityMap, CityNode, EvidenceKind, SourceRef } from "../lib/city-map";
import { validateCityMap } from "../lib/city-map";
import { computeFlowLayout, type FlowLayout } from "../lib/flow-layout";
import { defaultShowcase, showcases, type Showcase } from "../lib/showcase-maps";

type Surface = "home" | "viewer";

const INSTALL_COMMAND = "npm install -g functionary-cli";
const SCENE_INK = "#14202b";
const SCENE_PAPER = "#dbe5e7";
const SCENE_PANEL = "#edf3f2";
const NEIGHBORHOOD_ACCENTS = ["#6d9da5", "#75967b", "#8f7da8", "#b77f8b", "#718eaf"];

const EVIDENCE_COLORS: Record<EvidenceKind, string> = {
  declared: SCENE_INK,
  observed: "#3f725d",
  inferred: "#a56f46",
};

function CameraRig({ viewKey, bounds }: { viewKey: string; bounds: FlowLayout["bounds"] }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as {
    target?: THREE.Vector3;
    update?: () => void;
    addEventListener?: (type: "start", listener: () => void) => void;
    removeEventListener?: (type: "start", listener: () => void) => void;
  } | null;
  const viewportSize = useThree((state) => state.size);
  const targetPosition = useRef(camera.position.clone());
  const currentTarget = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const targetZoom = useRef(camera instanceof THREE.OrthographicCamera ? camera.zoom : 48);
  const reduceMotion = useRef(false);
  const fitting = useRef(true);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const releaseCamera = () => { fitting.current = false; };
    controls?.addEventListener?.("start", releaseCamera);
    return () => controls?.removeEventListener?.("start", releaseCamera);
  }, [controls]);

  useEffect(() => {
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const spanX = Math.max(4, bounds.maxX - bounds.minX);
    const spanZ = Math.max(4, bounds.maxZ - bounds.minZ);
    targetPosition.current.set(centerX + 11, 14, centerZ + 15);
    targetLookAt.current.set(centerX, 0.35, centerZ);
    if (camera instanceof THREE.OrthographicCamera) {
      targetZoom.current = Math.max(12, Math.min(78, Math.min(viewportSize.width / (spanX + 6), viewportSize.height / (spanZ + 7)) * 0.92));
    }
    fitting.current = true;
  }, [bounds, camera, viewKey, viewportSize.height, viewportSize.width]);

  // React Three Fiber scene objects are intentionally updated inside the render loop.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    if (!fitting.current) return;
    const blend = reduceMotion.current ? 1 : 1 - Math.exp(-delta * 4.8);
    camera.position.lerp(targetPosition.current, blend);
    currentTarget.current.lerp(targetLookAt.current, blend);
    camera.lookAt(currentTarget.current);
    if (controls?.target) controls.target.copy(currentTarget.current);
    controls?.update?.();
    if (camera instanceof THREE.OrthographicCamera) {
      // eslint-disable-next-line react-hooks/immutability
      camera.zoom = THREE.MathUtils.damp(camera.zoom, targetZoom.current, reduceMotion.current ? 1000 : 5.4, delta);
      camera.updateProjectionMatrix();
    }
    const positionSettled = camera.position.distanceToSquared(targetPosition.current) < 0.0001;
    const targetSettled = currentTarget.current.distanceToSquared(targetLookAt.current) < 0.0001;
    const zoomSettled = !(camera instanceof THREE.OrthographicCamera) || Math.abs(camera.zoom - targetZoom.current) < 0.01;
    if (positionSettled && targetSettled && zoomSettled) fitting.current = false;
  });

  return null;
}

function FlowBands({ layout }: { layout: FlowLayout }) {
  const layerNumbers = [...new Set(layout.layers.values())].sort((a, b) => a - b);
  const width = layout.bounds.maxX - layout.bounds.minX + 3;
  const centerX = (layout.bounds.minX + layout.bounds.maxX) / 2;

  return layerNumbers.map((layer) => {
    const ids = [...layout.layers].filter(([, value]) => value === layer).map(([id]) => id);
    const zValues = ids.map((id) => layout.positions.get(id)?.[1] ?? 0);
    const z = zValues.reduce((total, value) => total + value, 0) / Math.max(1, zValues.length);
    return (
      <group key={layer}>
        <mesh position={[centerX, -0.018, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width, 3.5]} />
          <meshBasicMaterial color={layer % 2 ? "#c5d5d8" : "#e1eaeb"} transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <Line
          points={[[layout.bounds.minX - 1.1, 0.01, z + 1.28], [layout.bounds.maxX + 1.1, 0.01, z + 1.28]]}
          color="#83989d"
          lineWidth={0.55}
          dashed
          dashSize={0.16}
          gapSize={0.12}
          transparent
          opacity={0.36}
        />
      </group>
    );
  });
}

function NeighborhoodPlots({ layout, selectedId, activeNeighborhoodId }: { layout: FlowLayout; selectedId: string; activeNeighborhoodId: string | null }) {
  const colors = ["#c8dfe2", "#cddbcf", "#d7d2e5", "#e2cfd7", "#c9d7e6"];

  return layout.neighborhoods.map((neighborhood, index) => {
    const { minX, maxX, minZ, maxZ } = neighborhood.bounds;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const active = neighborhood.id === activeNeighborhoodId || (!activeNeighborhoodId && neighborhood.nodeIds.includes(selectedId));
    const dimmed = !!activeNeighborhoodId && neighborhood.id !== activeNeighborhoodId;
    const signWidth = Math.min(width - 0.4, 5.4);
    const signHeight = 0.78;
    const signZ = maxZ - signHeight / 2 - 0.28;
    const codeColumnWidth = 0.7;
    const dividerX = -signWidth / 2 + codeColumnWidth;
    const outline: [number, number, number][] = [
      [minX, 0.004, minZ],
      [maxX, 0.004, minZ],
      [maxX, 0.004, maxZ],
      [minX, 0.004, maxZ],
      [minX, 0.004, minZ],
    ];

    return <group key={neighborhood.id}>
      <mesh position={[centerX, -0.027, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={colors[index % colors.length]} transparent opacity={dimmed ? 0.1 : active ? 0.5 : 0.34} depthWrite={false} />
      </mesh>
      <Line points={outline} color={active ? SCENE_INK : "#70878c"} lineWidth={active ? 1.55 : 0.9} transparent opacity={dimmed ? 0.16 : active ? 0.9 : 0.62} />
      <group position={[centerX, 0.048, signZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[signWidth, signHeight]} />
          <meshBasicMaterial color={active ? SCENE_INK : SCENE_PANEL} transparent opacity={dimmed ? 0.24 : 0.98} />
        </mesh>
        <Line
          points={[
            [-signWidth / 2, -signHeight / 2, 0.008],
            [signWidth / 2, -signHeight / 2, 0.008],
            [signWidth / 2, signHeight / 2, 0.008],
            [-signWidth / 2, signHeight / 2, 0.008],
            [-signWidth / 2, -signHeight / 2, 0.008],
          ]}
          color={SCENE_INK}
          lineWidth={active ? 1.35 : 0.8}
          transparent
          opacity={dimmed ? 0.18 : 1}
        />
        <Line
          points={[[dividerX, -signHeight / 2 + 0.08, 0.01], [dividerX, signHeight / 2 - 0.08, 0.01]]}
          color={active ? SCENE_PANEL : SCENE_INK}
          lineWidth={0.75}
          transparent
          opacity={dimmed ? 0.14 : 0.62}
        />
        <Text
          position={[-signWidth / 2 + codeColumnWidth / 2, 0, 0.014]}
          color={active ? SCENE_PANEL : SCENE_INK}
          fontSize={0.24}
          anchorX="center"
          anchorY="middle"
          fillOpacity={dimmed ? 0.2 : 1}
        >
          {`N${index + 1}`}
        </Text>
        <Text
          position={[dividerX + 0.18, 0, 0.014]}
          color={active ? SCENE_PANEL : SCENE_INK}
          fontSize={0.27}
          maxWidth={signWidth - codeColumnWidth - 0.32}
          lineHeight={1.02}
          textAlign="center"
          anchorX="left"
          anchorY="middle"
          fillOpacity={dimmed ? 0.2 : 1}
        >
          {neighborhood.label}
        </Text>
      </group>
    </group>;
  });
}

function Connections({ edges, positions, activeEdgeId, focusedEdgeIds }: { edges: CityEdge[]; positions: Map<string, [number, number]>; activeEdgeId: string | null; focusedEdgeIds?: Set<string> }) {
  return edges.map((edge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return null;
    const emphasized = edge.id === activeEdgeId;
    const focused = focusedEdgeIds?.has(edge.id) ?? false;
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
          lineWidth={emphasized ? 2.6 : focused ? 1.1 : 0.55}
          dashed={edge.evidence === "inferred"}
          dashSize={0.17}
          gapSize={0.1}
          transparent
          opacity={emphasized ? 0.98 : focused ? 0.48 : focusedEdgeIds ? 0.025 : 0.1}
        />
        <mesh position={arrowPosition} quaternion={quaternion}>
          <coneGeometry args={[emphasized ? 0.105 : 0.07, emphasized ? 0.26 : 0.18, 4]} />
          <meshBasicMaterial color={EVIDENCE_COLORS[edge.evidence]} transparent opacity={emphasized ? 0.98 : focused ? 0.62 : focusedEdgeIds ? 0.03 : 0.13} />
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

function plainType(node: CityNode, roomCount: number) {
  if (roomCount > 0) return `System with ${roomCount} room${roomCount === 1 ? "" : "s"}`;
  if (node.archetype === "room") return "Room";
  if (node.archetype === "gateway") return "Entry point";
  if (node.archetype === "worker") return "Background process";
  if (node.archetype === "database") return "Data store";
  if (node.archetype === "queue") return "Event channel";
  if (node.archetype === "storage") return "Storage";
  if (node.kind === "external" || node.archetype === "cloud") return "External service";
  if (node.kind === "infra") return "Infrastructure";
  return "Internal component";
}

function sourceHref(map: CityMap, source: SourceRef) {
  if (source.url) return source.url;
  if (!source.path || !map.repository) return null;
  const repository = map.repository
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  if (!repository.startsWith("github.com/")) return null;
  if (/[*?]/.test(source.path)) {
    return `https://${repository}/search?q=${encodeURIComponent(`path:${source.path}`)}&type=code`;
  }
  const path = source.path.replace(/^\.\//, "").split("/").map(encodeURIComponent).join("/");
  return `https://${repository}/blob/HEAD/${path}${source.line ? `#L${source.line}` : ""}`;
}

function closestVisibleAncestor(nodeId: string, nodeById: Map<string, CityNode>, visibleIds: Set<string>) {
  let current = nodeById.get(nodeId);
  while (current) {
    if (visibleIds.has(current.id)) return current.id;
    current = current.parentId ? nodeById.get(current.parentId) : undefined;
  }
  return null;
}

function Structure({ node, position, selected, hasInterior, expanded = false, interior = false, dimmed = false, onSelect, onEnter }: {
  node: CityNode;
  position: [number, number];
  selected: boolean;
  hasInterior: boolean;
  expanded?: boolean;
  interior?: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  onEnter: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const requestedSize = node.display?.size ?? [1.65, 1.2, 1.4];
  const size: [number, number, number] = node.archetype === "building" && !hasInterior
    ? [requestedSize[0], Math.min(requestedSize[1], 1.25), requestedSize[2]]
    : requestedSize;
  const [width, height, depth] = size;
  const visualArchetype = node.archetype === "building" && !hasInterior ? "room" : node.archetype;
  const geometry = useMemo(() => geometryFor(visualArchetype, width, height, depth), [depth, height, visualArchetype, width]);
  const outline = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);
  const color = node.display?.color ?? (node.kind === "infra" ? "#b17f9f" : node.kind === "external" ? "#cf8278" : "#81afa6");
  const floorCount = hasInterior ? Math.max(0, Math.min(4, Math.round(height * 1.2) - 1)) : 0;
  const worldScale = interior ? 0.48 : 1;
  const initialScale = interior ? 0.08 : 1;

  useFrame((_, delta) => {
    if (group.current) {
      const targetXz = expanded ? 1.08 : worldScale;
      const targetY = expanded ? 0.12 : worldScale;
      group.current.scale.x = THREE.MathUtils.damp(group.current.scale.x, targetXz, 7.5, delta);
      group.current.scale.y = THREE.MathUtils.damp(group.current.scale.y, targetY, 7.5, delta);
      group.current.scale.z = THREE.MathUtils.damp(group.current.scale.z, targetXz, 7.5, delta);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, (height * targetY) / 2, 7.5, delta);
    }
    if (material.current) {
      const targetOpacity = dimmed ? 0.22 : expanded ? 0.28 : node.kind === "external" ? 0.82 : 1;
      material.current.opacity = THREE.MathUtils.damp(material.current.opacity, targetOpacity, 7.5, delta);
    }
  });

  return (
    <group ref={group} position={[position[0], (height * initialScale) / 2, position[1]]} scale={[initialScale, initialScale, initialScale]}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        onDoubleClick={(event) => { event.stopPropagation(); if (!interior || hasInterior) onEnter(); }}
        onPointerEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
        scale={selected ? 1.075 : 1}
      >
        <meshStandardMaterial
          ref={material}
          color={color}
          roughness={0.86}
          transparent
          opacity={interior ? 0 : node.kind === "external" ? 0.82 : 1}
          emissive={selected || hovered ? color : "#000000"}
          emissiveIntensity={selected ? 0.32 : hovered ? 0.1 : 0}
        />
      </mesh>
      <lineSegments geometry={outline} scale={selected ? 1.06 : 1.006}>
        <lineBasicMaterial color={SCENE_INK} transparent opacity={dimmed ? 0.2 : expanded ? 0.38 : 1} />
      </lineSegments>
      {node.archetype !== "database" && node.archetype !== "cloud" && Array.from({ length: floorCount }, (_, floor) => (
        <mesh key={floor} position={[0, -height / 2 + ((floor + 1) * height) / (floorCount + 1), depth / 2 + 0.008]}>
          <planeGeometry args={[width * 0.86, 0.018]} />
          <meshBasicMaterial color={SCENE_INK} transparent opacity={dimmed ? 0.12 : expanded ? 0.2 : 0.56} />
        </mesh>
      ))}
    </group>
  );
}

function MapMarker({ node, index, position, selected, hasInterior, expanded = false, exploring = false, interior = false, dimmed = false, onSelect, onEnter }: {
  node: CityNode;
  index: number;
  position: [number, number];
  selected: boolean;
  hasInterior: boolean;
  expanded?: boolean;
  exploring?: boolean;
  interior?: boolean;
  dimmed?: boolean;
  onSelect: () => void;
  onEnter: () => void;
}) {
  const requestedSize = node.display?.size ?? [1.65, 1.2, 1.4];
  const scale = interior ? 0.48 : expanded ? 1.08 : 1;
  const footprintWidth = requestedSize[0] * scale + (interior ? 0.14 : 0.24);
  const footprintDepth = requestedSize[2] * scale + (interior ? 0.14 : 0.24);
  const labelLength = node.label.length + (hasInterior ? 3 : 0);
  const landmark = hasInterior && !interior;
  const quieter = node.kind === "external" && !interior;
  const plaqueWidth = interior
    ? Math.max(1.5, Math.min(2.4, 1.08 + labelLength * 0.045))
    : landmark
      ? Math.max(3.15, Math.min(4.7, 2.1 + labelLength * 0.065))
      : quieter
        ? Math.max(2.35, Math.min(3.65, 1.75 + labelLength * 0.05))
        : Math.max(2.6, Math.min(4.1, 1.9 + labelLength * 0.058));
  const plaqueHeight = interior ? 0.58 : landmark ? 1.02 : quieter ? 0.76 : 0.88;
  const codeFontSize = interior ? 0.13 : landmark ? 0.2 : quieter ? 0.145 : 0.17;
  const labelFontSize = interior ? 0.17 : landmark ? 0.29 : quieter ? 0.205 : 0.24;
  const plaqueColor = node.kind === "external" ? "#f0e5e5" : node.kind === "infra" ? "#ebe5ee" : "#e5efee";
  const markerY = 0.055;
  const plaqueZ = position[1] + footprintDepth / 2 + plaqueHeight / 2 + (interior ? 0.12 : 0.18);
  const plaqueNearEdgeZ = plaqueZ - plaqueHeight / 2;
  const footprint: [number, number, number][] = [
    [position[0] - footprintWidth / 2, markerY, position[1] - footprintDepth / 2],
    [position[0] + footprintWidth / 2, markerY, position[1] - footprintDepth / 2],
    [position[0] + footprintWidth / 2, markerY, position[1] + footprintDepth / 2],
    [position[0] - footprintWidth / 2, markerY, position[1] + footprintDepth / 2],
    [position[0] - footprintWidth / 2, markerY, position[1] - footprintDepth / 2],
  ];
  const plaqueOutline: [number, number, number][] = [
    [-plaqueWidth / 2, -plaqueHeight / 2, 0.008],
    [plaqueWidth / 2, -plaqueHeight / 2, 0.008],
    [plaqueWidth / 2, plaqueHeight / 2, 0.008],
    [-plaqueWidth / 2, plaqueHeight / 2, 0.008],
    [-plaqueWidth / 2, -plaqueHeight / 2, 0.008],
  ];
  const canEnter = !interior || hasInterior;
  const active = selected || expanded || exploring;
  const markerCode = interior ? `R${index + 1}` : String(index + 1).padStart(2, "0");
  const labelText = `${node.label}${canEnter ? `  ${expanded || exploring ? "×" : "↘"}` : ""}`;
  const codeColumnWidth = interior ? 0.28 : 0.34;
  const dividerX = -plaqueWidth / 2 + codeColumnWidth;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        if (canEnter) onEnter(); else onSelect();
      }}
      onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { document.body.style.cursor = "default"; }}
    >
      <mesh position={[position[0], markerY + 0.004, position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[footprintWidth, footprintDepth]} />
        <meshBasicMaterial color={SCENE_INK} transparent opacity={active && !dimmed ? 0.12 : 0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={footprint} color={active ? SCENE_INK : interior ? "#376f71" : "#70878c"} lineWidth={active ? 1.5 : 0.8} dashed={interior} dashSize={0.09} gapSize={0.06} transparent opacity={dimmed ? 0.18 : 0.78} />
      <Line points={[[position[0], markerY, position[1] + footprintDepth / 2], [position[0], markerY, plaqueNearEdgeZ]]} color={SCENE_INK} lineWidth={0.8} transparent opacity={dimmed ? 0.14 : 0.56} />
      <group position={[position[0], markerY + 0.012, plaqueZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[plaqueWidth, plaqueHeight]} />
          <meshBasicMaterial color={active ? SCENE_INK : plaqueColor} transparent opacity={dimmed ? 0.3 : quieter ? 0.9 : 0.98} />
        </mesh>
        <Line points={plaqueOutline} color={SCENE_INK} lineWidth={active ? 1.4 : 0.85} transparent opacity={dimmed ? 0.18 : 0.9} />
        <Line
          points={[[dividerX, -plaqueHeight / 2 + 0.07, 0.01], [dividerX, plaqueHeight / 2 - 0.07, 0.01]]}
          color={active ? SCENE_PANEL : SCENE_INK}
          lineWidth={0.65}
          transparent
          opacity={dimmed ? 0.18 : 0.48}
        />
        <Text
          position={[-plaqueWidth / 2 + codeColumnWidth / 2, 0, 0.014]}
          color={active ? SCENE_PANEL : SCENE_INK}
          fontSize={codeFontSize}
          anchorX="center"
          anchorY="middle"
          fillOpacity={dimmed ? 0.34 : 0.72}
        >
          {markerCode}
        </Text>
        <Text
          position={[dividerX + 0.1, 0, 0.014]}
          color={active ? SCENE_PANEL : SCENE_INK}
          fontSize={labelFontSize}
          maxWidth={plaqueWidth - codeColumnWidth - 0.2}
          lineHeight={1.04}
          textAlign="left"
          anchorX="left"
          anchorY="middle"
          fillOpacity={dimmed ? 0.34 : 1}
        >
          {labelText}
        </Text>
      </group>
    </group>
  );
}

function InteriorPlot({ bounds }: { bounds: FlowLayout["bounds"] }) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const outline: [number, number, number][] = [
    [bounds.minX, 0.025, bounds.minZ],
    [bounds.maxX, 0.025, bounds.minZ],
    [bounds.maxX, 0.025, bounds.maxZ],
    [bounds.minX, 0.025, bounds.maxZ],
    [bounds.minX, 0.025, bounds.minZ],
  ];

  return <group>
    <mesh position={[centerX, 0.012, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={SCENE_PANEL} transparent opacity={0.88} depthWrite={false} />
    </mesh>
    <Line points={outline} color={SCENE_INK} lineWidth={1.1} dashed dashSize={0.14} gapSize={0.09} />
  </group>;
}

function CityScene({ nodes, allNodes, edges, allEdges, selectedId, activeEdgeId, interiorActiveEdgeId, expandedId, focusId, neighborhoodId, onSelect, onEnter, viewKey }: {
  nodes: CityNode[];
  allNodes: CityNode[];
  edges: CityEdge[];
  allEdges: CityEdge[];
  selectedId: string;
  activeEdgeId: string | null;
  interiorActiveEdgeId: string | null;
  expandedId: string | null;
  focusId: string | null;
  neighborhoodId: string | null;
  onSelect: (id: string) => void;
  onEnter: (id: string) => void;
  viewKey: string;
}) {
  const layout = useMemo(() => computeFlowLayout(nodes, edges, allNodes), [allNodes, edges, nodes]);
  const interiorModel = useMemo(() => {
    if (!expandedId) return null;
    const parentPosition = layout.positions.get(expandedId);
    const parent = allNodes.find((node) => node.id === expandedId);
    const children = allNodes.filter((node) => node.parentId === expandedId);
    if (!parentPosition || !parent || !children.length) return null;

    const childIds = new Set(children.map((node) => node.id));
    const childEdges = allEdges.filter((edge) => childIds.has(edge.from) && childIds.has(edge.to));
    const childLayout = computeFlowLayout(children, childEdges, allNodes);
    const localCenterX = (childLayout.bounds.minX + childLayout.bounds.maxX) / 2;
    const localCenterZ = (childLayout.bounds.minZ + childLayout.bounds.maxZ) / 2;
    const positions = new Map<string, [number, number]>();
    const spread = 0.72;
    children.forEach((child) => {
      const local = childLayout.positions.get(child.id)!;
      positions.set(child.id, [
        parentPosition[0] + (local[0] - localCenterX) * spread,
        parentPosition[1] + (local[1] - localCenterZ) * spread,
      ]);
    });

    const extents = children.map((child) => {
      const [x, z] = positions.get(child.id)!;
      const [childWidth, , childDepth] = child.display?.size ?? [1.65, 1.2, 1.4];
      return { minX: x - childWidth * 0.28, maxX: x + childWidth * 0.28, minZ: z - childDepth * 0.28, maxZ: z + childDepth * 0.28 };
    });
    const plotBounds = {
      minX: Math.min(...extents.map((extent) => extent.minX)) - 0.65,
      maxX: Math.max(...extents.map((extent) => extent.maxX)) + 0.65,
      minZ: Math.min(...extents.map((extent) => extent.minZ)) - 0.65,
      maxZ: Math.max(...extents.map((extent) => extent.maxZ)) + 0.65,
    };
    const cameraBounds = {
      minX: Math.min(parentPosition[0] - 4.2, plotBounds.minX - 0.8),
      maxX: Math.max(parentPosition[0] + 4.2, plotBounds.maxX + 0.8),
      minZ: Math.min(parentPosition[1] - 3.6, plotBounds.minZ - 0.8),
      maxZ: Math.max(parentPosition[1] + 3.6, plotBounds.maxZ + 0.8),
    };
    return { parent, children, childEdges, positions, plotBounds, cameraBounds };
  }, [allEdges, allNodes, expandedId, layout]);
  const focusModel = useMemo(() => {
    if (!focusId || interiorModel) return null;
    const focusedEdges = edges.filter((edge) => edge.from === focusId || edge.to === focusId);
    const nodeIds = new Set([focusId]);
    focusedEdges.forEach((edge) => {
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
    });
    const extents = nodes.filter((node) => nodeIds.has(node.id)).map((node) => {
      const [x, z] = layout.positions.get(node.id)!;
      const [width, , depth] = node.display?.size ?? [1.65, 1.2, 1.4];
      return { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 };
    });
    if (!extents.length) return null;
    const bounds = {
      minX: Math.min(...extents.map((extent) => extent.minX)) - 1.5,
      maxX: Math.max(...extents.map((extent) => extent.maxX)) + 1.5,
      minZ: Math.min(...extents.map((extent) => extent.minZ)) - 1.5,
      maxZ: Math.max(...extents.map((extent) => extent.maxZ)) + 1.5,
    };
    return { nodeIds, edgeIds: new Set(focusedEdges.map((edge) => edge.id)), bounds };
  }, [edges, focusId, interiorModel, layout, nodes]);
  const neighborhoodModel = useMemo(() => {
    if (!neighborhoodId || interiorModel || focusModel) return null;
    const neighborhood = layout.neighborhoods.find((candidate) => candidate.id === neighborhoodId);
    if (!neighborhood) return null;
    return {
      nodeIds: new Set(neighborhood.nodeIds),
      bounds: { ...neighborhood.bounds, maxZ: neighborhood.bounds.maxZ + 0.9 },
    };
  }, [focusModel, interiorModel, layout, neighborhoodId]);

  return (
    <Canvas
      orthographic
      camera={{ position: [10, 13, 15], zoom: 48, near: 0.1, far: 160 }}
      shadows
      dpr={[1, 1.7]}
    >
      <CameraRig viewKey={viewKey} bounds={interiorModel?.cameraBounds ?? focusModel?.bounds ?? neighborhoodModel?.bounds ?? layout.bounds} />
      <color attach="background" args={[SCENE_PAPER]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[-6, 12, 7]} intensity={2.25} castShadow shadow-mapSize={[1024, 1024]} />
      <gridHelper args={[80, 80, "#91a7ab", "#c1d0d2"]} position={[0, -0.035, 0]} />
      <NeighborhoodPlots layout={layout} selectedId={selectedId} activeNeighborhoodId={neighborhoodId} />
      <FlowBands layout={layout} />
      <Connections edges={edges} positions={layout.positions} activeEdgeId={activeEdgeId} focusedEdgeIds={focusModel?.edgeIds} />
      {interiorModel && <>
        <InteriorPlot bounds={interiorModel.plotBounds} />
        <Connections edges={interiorModel.childEdges} positions={interiorModel.positions} activeEdgeId={interiorActiveEdgeId} />
      </>}
      {nodes.map((node, index) => (
        <group key={node.id}>
          <Structure node={node} position={layout.positions.get(node.id)!} selected={node.id === selectedId} hasInterior={allNodes.some((candidate) => candidate.parentId === node.id)} expanded={node.id === expandedId} dimmed={interiorModel ? node.id !== expandedId : neighborhoodModel ? !neighborhoodModel.nodeIds.has(node.id) : !!focusModel && !focusModel.nodeIds.has(node.id)} onSelect={() => onSelect(node.id)} onEnter={() => onEnter(node.id)} />
          <MapMarker node={node} index={index} position={layout.positions.get(node.id)!} selected={node.id === selectedId} hasInterior={allNodes.some((candidate) => candidate.parentId === node.id)} expanded={node.id === expandedId} exploring={node.id === focusId} dimmed={interiorModel ? node.id !== expandedId : neighborhoodModel ? !neighborhoodModel.nodeIds.has(node.id) : !!focusModel && !focusModel.nodeIds.has(node.id)} onSelect={() => onSelect(node.id)} onEnter={() => onEnter(node.id)} />
        </group>
      ))}
      {interiorModel?.children.map((node, index) => (
        <group key={node.id}>
          <Structure node={node} position={interiorModel.positions.get(node.id)!} selected={node.id === selectedId} hasInterior={allNodes.some((candidate) => candidate.parentId === node.id)} interior onSelect={() => onSelect(node.id)} onEnter={() => onEnter(node.id)} />
          <MapMarker node={node} index={index} position={interiorModel.positions.get(node.id)!} selected={node.id === selectedId} hasInterior={allNodes.some((candidate) => candidate.parentId === node.id)} interior onSelect={() => onSelect(node.id)} onEnter={() => onEnter(node.id)} />
        </group>
      ))}
      <MapControls makeDefault enableRotate={false} enableDamping dampingFactor={0.08} minZoom={12} maxZoom={110} screenSpacePanning />
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
          <small>Large systems open into rooms. Smaller components stay single-purpose. Arrows show how work moves.</small>
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
            const scopeIds = new Set(showcase.map.nodes.filter((node) => node.kind === "scope").map((node) => node.id));
            const structures = showcase.map.nodes.filter((node) => node.parentId && scopeIds.has(node.parentId));
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

function MapViewer({ map, notice, onDismissNotice, onHome, onImport }: { map: CityMap; notice?: string | null; onDismissNotice: () => void; onHome: () => void; onImport: () => void }) {
  const nodeById = useMemo(() => new Map(map.nodes.map((node) => [node.id, node])), [map.nodes]);
  const firstStructure = map.nodes.find((node) => node.parentId && nodeById.get(node.parentId)?.kind === "scope") ?? map.nodes[0];
  const [selectedId, setSelectedId] = useState(firstStructure?.id ?? "");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(() =>
    map.edges.find((edge) => edge.from === firstStructure?.id || edge.to === firstStructure?.id)?.id ?? null,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(onDismissNotice, 6000);
    return () => window.clearTimeout(timeout);
  }, [notice, onDismissNotice]);

  const campusNodes = useMemo(() => map.nodes.filter((node) => node.parentId && nodeById.get(node.parentId)?.kind === "scope"), [map.nodes, nodeById]);
  const visibleNodes = campusNodes;
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => {
    const projected = new Map<string, CityEdge>();
    const evidencePriority: Record<EvidenceKind, number> = { observed: 3, declared: 2, inferred: 1 };
    map.edges.forEach((edge) => {
      const from = closestVisibleAncestor(edge.from, nodeById, visibleIds);
      const to = closestVisibleAncestor(edge.to, nodeById, visibleIds);
      if (!from || !to || from === to) return;
      const key = `${from}->${to}`;
      const existing = projected.get(key);
      if (!existing || evidencePriority[edge.evidence] > evidencePriority[existing.evidence]) {
        projected.set(key, { ...edge, id: `campus:${key}`, from, to });
      }
    });
    return [...projected.values()];
  }, [map.edges, nodeById, visibleIds]);
  const activeExpandedId = expandedId && visibleIds.has(expandedId) ? expandedId : null;
  const activeFocusId = focusId && visibleIds.has(focusId) && !activeExpandedId ? focusId : null;
  const expandedNode = activeExpandedId ? nodeById.get(activeExpandedId) : undefined;
  const focusedNode = activeFocusId ? nodeById.get(activeFocusId) : undefined;
  const expandedChildren = useMemo(() => activeExpandedId ? map.nodes.filter((node) => node.parentId === activeExpandedId) : [], [activeExpandedId, map.nodes]);
  const sceneIds = useMemo(() => new Set([...visibleNodes.map((node) => node.id), ...expandedChildren.map((node) => node.id)]), [expandedChildren, visibleNodes]);
  const layout = useMemo(() => computeFlowLayout(visibleNodes, visibleEdges, map.nodes), [map.nodes, visibleEdges, visibleNodes]);
  const activeNeighborhoodId = neighborhoodId && layout.neighborhoods.some((neighborhood) => neighborhood.id === neighborhoodId) && !activeExpandedId && !activeFocusId ? neighborhoodId : null;
  const effectiveSelectedId = sceneIds.has(selectedId) ? selectedId : visibleNodes[0]?.id ?? selectedId;
  const selected = nodeById.get(effectiveSelectedId) ?? visibleNodes[0] ?? map.nodes[0];
  const selectedChildren = selected ? map.nodes.filter((node) => node.parentId === selected.id) : [];
  const focusConnections = activeFocusId ? visibleEdges.filter((edge) => edge.from === activeFocusId || edge.to === activeFocusId) : [];
  const selectedConnection = map.edges.find((edge) => edge.id === selectedConnectionId);
  const selectedConnectionFrom = selectedConnection ? closestVisibleAncestor(selectedConnection.from, nodeById, visibleIds) : null;
  const selectedConnectionTo = selectedConnection ? closestVisibleAncestor(selectedConnection.to, nodeById, visibleIds) : null;
  const campusActiveEdgeId = selectedConnectionFrom && selectedConnectionTo && selectedConnectionFrom !== selectedConnectionTo
    ? `campus:${selectedConnectionFrom}->${selectedConnectionTo}`
    : null;
  const filteredRailNodes = visibleNodes.filter((node) => `${node.label} ${node.kind} ${node.description ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const firstCampusConnection = useCallback((nodeId: string) => {
    return map.edges.find((edge) => {
      const from = closestVisibleAncestor(edge.from, nodeById, visibleIds);
      const to = closestVisibleAncestor(edge.to, nodeById, visibleIds);
      return from && to && from !== to && (from === nodeId || to === nodeId);
    });
  }, [map.edges, nodeById, visibleIds]);

  function connectionBetween(leftId: string, rightId: string) {
    return map.edges.find((edge) => {
      const from = closestVisibleAncestor(edge.from, nodeById, visibleIds);
      const to = closestVisibleAncestor(edge.to, nodeById, visibleIds);
      return (from === leftId && to === rightId) || (from === rightId && to === leftId);
    });
  }

  function selectNode(nodeId: string) {
    const campusNodeId = closestVisibleAncestor(nodeId, nodeById, visibleIds);
    const focusedConnection = activeFocusId && campusNodeId && campusNodeId !== activeFocusId
      ? connectionBetween(activeFocusId, campusNodeId)
      : null;
    if (activeFocusId && campusNodeId && campusNodeId !== activeFocusId && !focusedConnection) setFocusId(null);
    setSelectedId(nodeId);
    setSelectedConnectionId(
      focusedConnection?.id
      ?? (campusNodeId ? firstCampusConnection(campusNodeId)?.id : null)
      ?? map.edges.find((edge) => edge.from === nodeId || edge.to === nodeId)?.id
      ?? null,
    );
  }

  function exploreNode(nodeId: string) {
    setNeighborhoodId(null);
    const children = map.nodes.filter((node) => node.parentId === nodeId);
    if (children.length) {
      setFocusId(null);
      setExpandedId((current) => current === nodeId ? null : nodeId);
      selectNode(nodeId);
      return;
    }
    if (activeExpandedId && nodeById.get(nodeId)?.parentId === activeExpandedId) {
      selectNode(nodeId);
      return;
    }
    const campusNodeId = closestVisibleAncestor(nodeId, nodeById, visibleIds);
    if (!campusNodeId) return;
    setExpandedId(null);
    if (campusNodeId === activeFocusId) {
      setFocusId(null);
      selectNode(campusNodeId);
      return;
    }
    setFocusId(campusNodeId);
    setSelectedId(nodeId);
    setSelectedConnectionId(firstCampusConnection(campusNodeId)?.id ?? null);
  }

  function exploreNeighborhood(nextNeighborhoodId: string) {
    if (activeNeighborhoodId === nextNeighborhoodId) {
      setNeighborhoodId(null);
      return;
    }
    const neighborhood = layout.neighborhoods.find((candidate) => candidate.id === nextNeighborhoodId);
    const firstNodeId = neighborhood?.nodeIds[0];
    if (!neighborhood || !firstNodeId) return;
    setExpandedId(null);
    setFocusId(null);
    setNeighborhoodId(nextNeighborhoodId);
    setSelectedId(firstNodeId);
    setSelectedConnectionId(firstCampusConnection(firstNodeId)?.id ?? null);
  }

  function closeBuilding() {
    if (activeExpandedId) selectNode(activeExpandedId);
    setExpandedId(null);
  }

  function closeFocus() {
    if (activeFocusId) selectNode(activeFocusId);
    setFocusId(null);
  }

  function closeNeighborhood() {
    setNeighborhoodId(null);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (expandedId) {
        setSelectedId(expandedId);
        setSelectedConnectionId(firstCampusConnection(expandedId)?.id ?? null);
        setExpandedId(null);
      } else if (focusId) {
        setSelectedId(focusId);
        setSelectedConnectionId(firstCampusConnection(focusId)?.id ?? null);
        setFocusId(null);
      } else if (neighborhoodId) {
        setNeighborhoodId(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedId, firstCampusConnection, focusId, neighborhoodId]);

  return (
    <main className="shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={onHome}><span className="brand-mark">F</span><span>functionary.dev</span></button>
        <div className="stat"><span>Repository</span><strong>{map.repository ?? map.id}</strong></div>
        <div className="stat"><span>Neighborhoods</span><strong>{layout.neighborhoods.length}</strong></div>
        <div className="stat"><span>Relationships</span><strong>{visibleEdges.length}</strong></div>
        <div className="header-actions"><button className="secondary-action" type="button" onClick={onHome}>Atlas</button><button className="map-action" type="button" onClick={onImport}>Open map</button></div>
      </header>

      <aside className="rail">
        <div className="rail-heading">
          <p className="eyebrow">Flow map</p>
          <h1>{map.name}</h1>
          <p className="rail-copy">{map.summary ?? "A semantic repository map."}</p>
        </div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a component" /></label>
        <div className="component-list" aria-label="Mapped components">
          {layout.neighborhoods.map((neighborhood, neighborhoodIndex) => {
            const neighborhoodIds = new Set(neighborhood.nodeIds);
            const nodes = filteredRailNodes.filter((node) => neighborhoodIds.has(node.id));
            if (!nodes.length) return null;
            return (
              <section className="rail-group" key={neighborhood.id} style={{ "--district-accent": NEIGHBORHOOD_ACCENTS[neighborhoodIndex % NEIGHBORHOOD_ACCENTS.length] } as React.CSSProperties}>
                <button className="neighborhood-button" type="button" aria-pressed={activeNeighborhoodId === neighborhood.id} onClick={() => exploreNeighborhood(neighborhood.id)}><span>{`N${neighborhoodIndex + 1}`}</span><strong>{neighborhood.label}</strong></button>
                {nodes.map((node) => <ComponentRow key={node.id} node={node} markerIndex={visibleNodes.indexOf(node)} roomCount={map.nodes.filter((candidate) => candidate.parentId === node.id).length} active={node.id === effectiveSelectedId} onSelect={() => exploreNode(node.id)} />)}
              </section>
            );
          })}
        </div>
      </aside>

      <section className="viewport" aria-label="Interactive repository city">
        {visibleNodes.length ? <CityScene nodes={visibleNodes} allNodes={map.nodes} edges={visibleEdges} allEdges={map.edges} selectedId={effectiveSelectedId} activeEdgeId={campusActiveEdgeId} interiorActiveEdgeId={selectedConnectionId} expandedId={activeExpandedId} focusId={activeFocusId} neighborhoodId={activeNeighborhoodId} onSelect={selectNode} onEnter={exploreNode} viewKey={`${map.id}:${activeExpandedId ? `rooms:${activeExpandedId}` : activeFocusId ? `connections:${activeFocusId}` : activeNeighborhoodId ? `neighborhood:${activeNeighborhoodId}` : "campus"}`} /> : <div className="empty-view"><strong>No mapped structures.</strong></div>}
        <div className="viewport-location">
          {activeExpandedId
            ? <button type="button" onClick={closeBuilding}>Back to city</button>
            : activeFocusId
              ? <button type="button" onClick={closeFocus}>Back to city</button>
              : activeNeighborhoodId
                ? <button type="button" onClick={closeNeighborhood}>Back to city</button>
              : <span><i className="pulse" /> Front → back flow · {layout.neighborhoods.length} neighborhoods</span>}
          {activeExpandedId && <span className="breadcrumb"><b>{map.name}</b><i>/</i><span>{expandedNode?.label} rooms open</span></span>}
          {activeFocusId && <span className="breadcrumb"><b>{focusedNode?.label}</b><i>/</i><span>{focusConnections.length} direct connection{focusConnections.length === 1 ? "" : "s"}{selectedConnection?.label ? ` · ${selectedConnection.label}` : ""}</span></span>}
          {activeNeighborhoodId && <span className="breadcrumb"><b>{map.name}</b><i>/</i><span>{layout.neighborhoods.find((neighborhood) => neighborhood.id === activeNeighborhoodId)?.label}</span></span>}
        </div>
        <p className="viewport-help">{activeExpandedId ? "Select a room · Esc to return · the city remains around you" : activeFocusId ? "Click a connected structure to trace that path · Esc to return" : activeNeighborhoodId ? "Choose a building to open it · Esc to return to the whole city" : "Click any nameplate to explore · double-clicking a structure also works"}</p>
        {notice && <button className="notice" type="button" key={notice} aria-live="polite" onClick={onDismissNotice}>{notice}<span>×</span><i aria-hidden="true" /></button>}
      </section>

      <aside className="inspector">
        {selected && <div className="inspector-content" key={selected.id}>
          <p className="eyebrow">What it does</p>
          <div className={`plain-type type-${selected.kind}`}>{plainType(selected, selectedChildren.length)}</div>
          <h2>{selected.label}</h2>
          <p className="description">{selected.description ?? "Purpose not yet mapped."}</p>
          {!!selected.sourceRefs?.length && <section className="source-list"><p className="eyebrow">Found in code</p>{selected.sourceRefs.map((ref, index) => {
            const label = `${ref.path ?? ref.url}${ref.line ? `:${ref.line}` : ""}`;
            const href = sourceHref(map, ref);
            return href
              ? <a href={href} target="_blank" rel="noreferrer" key={`${ref.path ?? ref.url}-${index}`} aria-label={`Open ${label} in source`}><code>{label}</code><span aria-hidden="true">↗</span></a>
              : <div key={`${ref.path ?? ref.url}-${index}`}><code>{label}</code></div>;
          })}</section>}
        </div>}
      </aside>
    </main>
  );
}

export default function Functionary() {
  const [surface, setSurface] = useState<Surface>("home");
  const [map, setMap] = useState<CityMap>(defaultShowcase.map);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

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
      {surface === "home" ? <Landing onOpen={openShowcase} onImport={() => fileInput.current?.click()} /> : <MapViewer key={map.id} map={map} notice={notice} onDismissNotice={dismissNotice} onHome={() => setSurface("home")} onImport={() => fileInput.current?.click()} />}
    </>
  );
}

function ComponentRow({ node, markerIndex, roomCount, active, onSelect }: { node: CityNode; markerIndex: number; roomCount: number; active: boolean; onSelect: () => void }) {
  const className = ["component-row", roomCount ? "landmark" : "", node.kind === "external" ? "quieter" : "", active ? "active" : ""].filter(Boolean).join(" ");
  return <button className={className} aria-pressed={active} onClick={onSelect} type="button"><span className="row-index">{String(markerIndex + 1).padStart(2, "0")}</span><span><strong>{node.label}</strong><small>{plainType(node, roomCount)}</small></span></button>;
}
