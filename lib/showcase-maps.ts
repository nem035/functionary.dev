import type { CityMap, CityNode } from "./city-map";

export type Showcase = {
  slug: string;
  map: CityMap;
  language: string;
  shape: string;
  accent: string;
};

const scope = (id: string, label: string, description: string): CityNode => ({
  id,
  label,
  kind: "scope",
  archetype: "district",
  description,
});

const reactMap: CityMap = {
  schemaVersion: 1,
  id: "facebook-react",
  name: "React",
  repository: "github.com/facebook/react",
  summary: "Public component APIs flow into reconciliation, scheduling, host rendering, compiler tooling, and developer inspection.",
  nodes: [
    scope("react-interface", "Public interface", "Packages application developers import."),
    scope("react-rendering", "Rendering engine", "Core reconciliation and host rendering machinery."),
    scope("react-tooling", "Compiler & tooling", "Build-time optimization and developer inspection."),
    { id: "react-api", label: "React API", kind: "deployable", archetype: "building", parentId: "react-interface", description: "Elements, components, hooks, context, and public types.", sourceRefs: [{ path: "packages/react" }], display: { flowLayer: 0, flowOrder: 0, size: [1.9, 1.7, 1.55], color: "#e1b95d" } },
    { id: "react-dom", label: "React DOM", kind: "deployable", archetype: "gateway", parentId: "react-interface", description: "Browser rendering and hydration entry points.", sourceRefs: [{ path: "packages/react-dom" }], display: { flowLayer: 0, flowOrder: 1, size: [1.9, 1.45, 1.5], color: "#e1b95d" } },
    { id: "reconciler", label: "Reconciler", kind: "module", archetype: "building", parentId: "react-rendering", description: "Coordinates fibers, updates, effects, and rendering work.", sourceRefs: [{ path: "packages/react-reconciler" }], display: { flowLayer: 1, flowOrder: 0, size: [2.2, 2.5, 1.8], color: "#81afa6" } },
    { id: "scheduler", label: "Scheduler", kind: "module", archetype: "worker", parentId: "react-rendering", description: "Prioritizes and yields rendering work.", sourceRefs: [{ path: "packages/scheduler" }], display: { flowLayer: 2, flowOrder: 0, size: [1.65, 1.65, 1.45], color: "#7f91bf" } },
    { id: "host-config", label: "Host configs", kind: "module", archetype: "room", parentId: "react-rendering", description: "Adapts reconciliation to DOM and other host environments.", sourceRefs: [{ path: "packages/react-reconciler/src/forks" }], display: { flowLayer: 2, flowOrder: 1, size: [1.75, 1.25, 1.45], color: "#81afa6" } },
    { id: "react-compiler", label: "React Compiler", kind: "deployable", archetype: "building", parentId: "react-tooling", description: "Build-time compiler for automatic React optimization.", sourceRefs: [{ path: "compiler" }], display: { flowLayer: 1, flowOrder: 1, size: [1.85, 2.1, 1.55], color: "#c58ba5" } },
    { id: "devtools", label: "Developer Tools", kind: "deployable", archetype: "building", parentId: "react-tooling", description: "Inspects component trees and runtime state.", sourceRefs: [{ path: "packages/react-devtools" }], display: { flowLayer: 3, flowOrder: 0, size: [1.8, 1.55, 1.5], color: "#cf8278" } },
    { id: "browser-host", label: "Browser host", kind: "external", archetype: "cloud", parentId: "react-rendering", description: "DOM, events, scheduling primitives, and browser paint.", display: { flowLayer: 3, flowOrder: 1, size: [1.7, 1.25, 1.45], color: "#cf8278" } },
  ],
  edges: [
    { id: "api-reconciler", from: "react-api", to: "reconciler", kind: "calls", evidence: "declared" },
    { id: "dom-reconciler", from: "react-dom", to: "reconciler", kind: "calls", evidence: "declared" },
    { id: "compiler-api", from: "react-compiler", to: "react-api", kind: "depends_on", evidence: "declared" },
    { id: "reconciler-scheduler", from: "reconciler", to: "scheduler", kind: "calls", evidence: "declared" },
    { id: "reconciler-host", from: "reconciler", to: "host-config", kind: "calls", evidence: "declared" },
    { id: "host-browser", from: "host-config", to: "browser-host", kind: "data_flow", evidence: "inferred", confidence: 0.96 },
    { id: "runtime-devtools", from: "reconciler", to: "devtools", kind: "data_flow", evidence: "declared" },
  ],
  warnings: ["Curated showcase map; run Functionary against a checkout for a source-complete map."],
};

const kubernetesMap: CityMap = {
  schemaVersion: 1,
  id: "kubernetes-kubernetes",
  name: "Kubernetes",
  repository: "github.com/kubernetes/kubernetes",
  summary: "Operator intent enters through clients and the API server, then fans into control loops, scheduling, node agents, durable state, and container runtimes.",
  nodes: [
    scope("k8s-interface", "Operator interface", "Human and automated cluster clients."),
    scope("k8s-control", "Control plane", "Desired-state validation and reconciliation."),
    scope("k8s-nodes", "Node execution", "Workload realization on cluster nodes."),
    { id: "kubectl", label: "kubectl", kind: "deployable", archetype: "gateway", parentId: "k8s-interface", description: "Command-line client for cluster operations.", sourceRefs: [{ path: "cmd/kubectl" }], display: { flowLayer: 0, flowOrder: 0, size: [1.65, 1.35, 1.4], color: "#e1b95d" } },
    { id: "api-server", label: "kube-apiserver", kind: "deployable", archetype: "gateway", parentId: "k8s-control", description: "Validates and serves the Kubernetes API.", sourceRefs: [{ path: "cmd/kube-apiserver" }], display: { flowLayer: 1, flowOrder: 0, size: [2.15, 2.4, 1.8], color: "#81afa6" } },
    { id: "controllers", label: "Controller manager", kind: "deployable", archetype: "worker", parentId: "k8s-control", description: "Runs reconciliation loops that drive actual state toward desired state.", sourceRefs: [{ path: "cmd/kube-controller-manager" }], display: { flowLayer: 2, flowOrder: 0, size: [2, 2.05, 1.65], color: "#7f91bf" } },
    { id: "scheduler-k8s", label: "Scheduler", kind: "deployable", archetype: "worker", parentId: "k8s-control", description: "Assigns unscheduled pods to viable nodes.", sourceRefs: [{ path: "cmd/kube-scheduler" }], display: { flowLayer: 2, flowOrder: 1, size: [1.75, 1.7, 1.5], color: "#7f91bf" } },
    { id: "etcd", label: "etcd state", kind: "external", archetype: "database", parentId: "k8s-control", description: "Durable backing store for API objects and cluster state.", display: { flowLayer: 3, flowOrder: 0, size: [1.75, 1.65, 1.65], color: "#b17f9f" } },
    { id: "kubelet", label: "kubelet", kind: "deployable", archetype: "worker", parentId: "k8s-nodes", description: "Node agent that realizes pod specifications.", sourceRefs: [{ path: "cmd/kubelet" }], display: { flowLayer: 3, flowOrder: 1, size: [1.8, 1.9, 1.55], color: "#81afa6" } },
    { id: "container-runtime", label: "Container runtime", kind: "external", archetype: "cloud", parentId: "k8s-nodes", description: "CRI-compatible runtime that creates and supervises containers.", display: { flowLayer: 4, flowOrder: 0, size: [1.9, 1.4, 1.55], color: "#cf8278" } },
  ],
  edges: [
    { id: "kubectl-api", from: "kubectl", to: "api-server", kind: "calls", evidence: "declared" },
    { id: "api-etcd", from: "api-server", to: "etcd", kind: "data_flow", evidence: "declared" },
    { id: "api-controllers", from: "api-server", to: "controllers", kind: "data_flow", evidence: "declared" },
    { id: "api-scheduler", from: "api-server", to: "scheduler-k8s", kind: "data_flow", evidence: "declared" },
    { id: "scheduler-api", from: "scheduler-k8s", to: "api-server", kind: "calls", evidence: "declared" },
    { id: "api-kubelet", from: "api-server", to: "kubelet", kind: "data_flow", evidence: "declared" },
    { id: "kubelet-runtime", from: "kubelet", to: "container-runtime", kind: "calls", evidence: "declared" },
  ],
  warnings: ["Curated showcase map; ecosystem add-ons and cloud-provider repositories are outside this repository boundary."],
};

const redisMap: CityMap = {
  schemaVersion: 1,
  id: "redis-redis",
  name: "Redis",
  repository: "github.com/redis/redis",
  summary: "Client commands enter through the RESP server and event loop, flow through command execution and data structures, then fan into persistence, replication, and clustering.",
  nodes: [
    scope("redis-interface", "Protocol edge", "Client connections and command ingress."),
    scope("redis-core", "In-memory engine", "Command execution and data structures."),
    scope("redis-systems", "Durability & distribution", "Persistence, replication, and cluster behavior."),
    { id: "resp-server", label: "RESP server", kind: "deployable", archetype: "gateway", parentId: "redis-interface", description: "Accepts client connections and parses commands.", sourceRefs: [{ path: "src/networking.c" }], display: { flowLayer: 0, flowOrder: 0, size: [1.85, 1.65, 1.5], color: "#e1b95d" } },
    { id: "event-loop", label: "Event loop", kind: "module", archetype: "worker", parentId: "redis-interface", description: "Coordinates non-blocking network and timed work.", sourceRefs: [{ path: "src/ae.c" }], display: { flowLayer: 1, flowOrder: 0, size: [1.7, 1.5, 1.45], color: "#7f91bf" } },
    { id: "command-engine", label: "Command engine", kind: "module", archetype: "building", parentId: "redis-core", description: "Dispatches and executes Redis commands.", sourceRefs: [{ path: "src/server.c" }], display: { flowLayer: 1, flowOrder: 1, size: [2.05, 2.25, 1.7], color: "#81afa6" } },
    { id: "keyspace", label: "Keyspace & types", kind: "module", archetype: "building", parentId: "redis-core", description: "In-memory keys, objects, and specialized data structures.", sourceRefs: [{ path: "src/db.c" }, { path: "src/t_*.c" }], display: { flowLayer: 2, flowOrder: 0, size: [2.15, 2.45, 1.8], color: "#81afa6" } },
    { id: "persistence", label: "RDB & AOF", kind: "module", archetype: "storage", parentId: "redis-systems", description: "Snapshot and append-only durability paths.", sourceRefs: [{ path: "src/rdb.c" }, { path: "src/aof.c" }], display: { flowLayer: 3, flowOrder: 0, size: [1.8, 1.3, 1.55], color: "#b17f9f" } },
    { id: "replication", label: "Replication", kind: "module", archetype: "worker", parentId: "redis-systems", description: "Propagates state from primary to replicas.", sourceRefs: [{ path: "src/replication.c" }], display: { flowLayer: 3, flowOrder: 1, size: [1.8, 1.7, 1.5], color: "#7f91bf" } },
    { id: "cluster", label: "Cluster bus", kind: "module", archetype: "cloud", parentId: "redis-systems", description: "Coordinates sharding, node membership, and failover.", sourceRefs: [{ path: "src/cluster.c" }], display: { flowLayer: 3, flowOrder: 2, size: [1.75, 1.45, 1.5], color: "#cf8278" } },
  ],
  edges: [
    { id: "resp-loop", from: "resp-server", to: "event-loop", kind: "calls", evidence: "declared" },
    { id: "resp-command", from: "resp-server", to: "command-engine", kind: "calls", evidence: "declared" },
    { id: "loop-command", from: "event-loop", to: "command-engine", kind: "calls", evidence: "declared" },
    { id: "command-keyspace", from: "command-engine", to: "keyspace", kind: "data_flow", evidence: "declared" },
    { id: "keyspace-persistence", from: "keyspace", to: "persistence", kind: "data_flow", evidence: "declared" },
    { id: "command-replication", from: "command-engine", to: "replication", kind: "data_flow", evidence: "declared" },
    { id: "command-cluster", from: "command-engine", to: "cluster", kind: "calls", evidence: "declared" },
  ],
  warnings: ["Curated showcase map; run Functionary against a checkout for a source-complete map."],
};

export const showcases: Showcase[] = [
  { slug: "react", map: reactMap, language: "JavaScript", shape: "Framework monorepo", accent: "#e1b95d" },
  { slug: "kubernetes", map: kubernetesMap, language: "Go", shape: "Distributed control plane", accent: "#81afa6" },
  { slug: "redis", map: redisMap, language: "C", shape: "Stateful data system", accent: "#cf8278" },
];

export const defaultShowcase = showcases[0];
