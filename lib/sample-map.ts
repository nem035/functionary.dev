import type { CityMap, CityNode } from "./city-map";

const scopes: CityNode[] = [
  { id: "scope-experience", label: "Experience", kind: "scope", archetype: "district", description: "Customer-facing surfaces." },
  { id: "scope-commerce", label: "Commerce", kind: "scope", archetype: "district", description: "Order and payment orchestration." },
  { id: "scope-platform", label: "Platform", kind: "scope", archetype: "district", description: "Shared runtime infrastructure." },
  { id: "scope-data", label: "Data", kind: "scope", archetype: "district", description: "Durable application state." },
  { id: "scope-external", label: "External", kind: "scope", archetype: "district", description: "Systems outside this repository." },
];

export const sampleMap: CityMap = {
  schemaVersion: 1,
  id: "acme-commerce",
  name: "Commerce platform",
  repository: "acme/commerce",
  summary: "A semantic map generated from source, infrastructure, and architectural evidence.",
  generatedAt: "2026-08-15T14:30:00Z",
  nodes: [
    ...scopes,
    { id: "web", label: "Web app", kind: "deployable", archetype: "building", parentId: "scope-experience", description: "Customer-facing application and route handlers.", metrics: { rooms: 18, loc: 18400, churn: 0.22 }, sourceRefs: [{ path: "apps/web/package.json" }, { path: "apps/web/src/routes.ts", line: 14 }], display: { position: [-4.6, 2.2], size: [2.05, 1.8, 1.65], color: "#c98f70" } },
    { id: "gateway", label: "API gateway", kind: "infra", archetype: "gateway", parentId: "scope-experience", description: "Public entry point, authentication, and request routing.", metrics: { rooms: 7, routes: 24 }, sourceRefs: [{ path: "infra/gateway.tf", line: 8 }, { path: "deploy/gateway.yaml" }], display: { position: [-4.4, -0.8], size: [1.65, 1.25, 1.3], color: "#e6c565" } },
    { id: "checkout", label: "Checkout", kind: "deployable", archetype: "building", parentId: "scope-commerce", description: "Coordinates carts, payments, and order creation.", metrics: { rooms: 31, loc: 32740, churn: 0.31 }, sourceRefs: [{ path: "services/checkout/package.json" }, { path: "services/checkout/src/index.ts", line: 1 }, { path: "deploy/checkout.yaml" }], display: { position: [-1.25, 0.75], size: [2.3, 2.75, 2.05], color: "#8cb7a7" } },
    { id: "worker", label: "Order workers", kind: "deployable", archetype: "worker", parentId: "scope-commerce", description: "Asynchronous fulfillment and notification jobs.", metrics: { rooms: 14, loc: 12600, churn: 0.17 }, sourceRefs: [{ path: "services/workers/package.json" }, { path: "services/workers/src/consumer.ts", line: 21 }], display: { position: [1.75, 2.4], size: [1.7, 2.1, 1.5], color: "#8e9dca" } },
    { id: "events", label: "Event stream", kind: "infra", archetype: "queue", parentId: "scope-platform", description: "Carries order and inventory events between services.", metrics: { rooms: 5, topics: 8 }, sourceRefs: [{ path: "infra/events.tf", line: 19 }], display: { position: [0.0, -2.4], size: [2.35, 0.85, 1.05], color: "#d6a45f" } },
    { id: "database", label: "Orders DB", kind: "infra", archetype: "database", parentId: "scope-data", description: "Primary relational store for orders and payment state.", metrics: { rooms: 22, tables: 22 }, sourceRefs: [{ path: "infra/database.tf", line: 4 }, { path: "services/checkout/db/schema.sql" }], display: { position: [2.75, -0.55], size: [1.8, 2.2, 1.8], color: "#b17f9f" } },
    { id: "storage", label: "Receipts", kind: "infra", archetype: "storage", parentId: "scope-data", description: "Durable object storage for generated receipts.", metrics: { rooms: 4, buckets: 1 }, sourceRefs: [{ path: "infra/storage.tf", line: 3 }], display: { position: [4.65, -2.6], size: [1.65, 1.05, 1.45], color: "#ab9b74" } },
    { id: "payments", label: "Payment provider", kind: "external", archetype: "cloud", parentId: "scope-external", description: "Third-party payment authorization and settlement.", metrics: { rooms: 0 }, sourceRefs: [{ path: "services/checkout/src/payments/client.ts", line: 11 }], display: { position: [4.65, 2.4], size: [1.75, 1.55, 1.55], color: "#cf7e78" } },

    { id: "checkout-api", label: "API", kind: "module", archetype: "room", parentId: "checkout", description: "HTTP routes and request validation.", metrics: { loc: 5400 }, sourceRefs: [{ path: "services/checkout/src/api" }], display: { position: [-2.4, 0.9], size: [1.5, 1.15, 1.3], color: "#c98f70" } },
    { id: "checkout-domain", label: "Order domain", kind: "module", archetype: "room", parentId: "checkout", description: "Order state machine and business rules.", metrics: { loc: 9200 }, sourceRefs: [{ path: "services/checkout/src/domain" }], display: { position: [0, 0.9], size: [1.8, 1.75, 1.5], color: "#8cb7a7" } },
    { id: "checkout-payment", label: "Payments", kind: "module", archetype: "room", parentId: "checkout", description: "Payment intents and provider adaptation.", metrics: { loc: 7100 }, sourceRefs: [{ path: "services/checkout/src/payments" }], display: { position: [2.45, 0.9], size: [1.5, 1.4, 1.3], color: "#cf7e78" } },
    { id: "checkout-events", label: "Event adapters", kind: "module", archetype: "room", parentId: "checkout", description: "Publishes domain events and handles retries.", metrics: { loc: 3800 }, sourceRefs: [{ path: "services/checkout/src/events" }], display: { position: [-1.25, -1.65], size: [1.45, 1.05, 1.25], color: "#d6a45f" } },
    { id: "checkout-repository", label: "Persistence", kind: "module", archetype: "room", parentId: "checkout", description: "Database repositories and transaction boundaries.", metrics: { loc: 5100 }, sourceRefs: [{ path: "services/checkout/src/repositories" }], display: { position: [1.25, -1.65], size: [1.55, 1.25, 1.25], color: "#b17f9f" } },
  ],
  edges: [
    { id: "web-gateway", from: "web", to: "gateway", kind: "calls", evidence: "observed", confidence: 1, weight: 0.91, label: "HTTPS" },
    { id: "gateway-checkout", from: "gateway", to: "checkout", kind: "calls", evidence: "declared", confidence: 1, label: "HTTP" },
    { id: "checkout-worker", from: "checkout", to: "worker", kind: "data_flow", evidence: "observed", confidence: 0.99, label: "order.created" },
    { id: "checkout-events-top", from: "checkout", to: "events", kind: "data_flow", evidence: "declared", confidence: 1, label: "publish" },
    { id: "checkout-database", from: "checkout", to: "database", kind: "depends_on", evidence: "declared", confidence: 1, label: "SQL" },
    { id: "checkout-payments", from: "checkout", to: "payments", kind: "calls", evidence: "inferred", confidence: 0.94, label: "HTTPS" },
    { id: "worker-events", from: "worker", to: "events", kind: "data_flow", evidence: "observed", confidence: 0.98, label: "consume" },
    { id: "worker-storage", from: "worker", to: "storage", kind: "depends_on", evidence: "declared", confidence: 1, label: "putObject" },
    { id: "worker-database", from: "worker", to: "database", kind: "depends_on", evidence: "inferred", confidence: 0.86, label: "SQL" },

    { id: "room-api-domain", from: "checkout-api", to: "checkout-domain", kind: "calls", evidence: "declared", confidence: 1 },
    { id: "room-domain-payments", from: "checkout-domain", to: "checkout-payment", kind: "calls", evidence: "inferred", confidence: 0.96 },
    { id: "room-domain-events", from: "checkout-domain", to: "checkout-events", kind: "data_flow", evidence: "declared", confidence: 1 },
    { id: "room-domain-repo", from: "checkout-domain", to: "checkout-repository", kind: "depends_on", evidence: "declared", confidence: 1 },
  ],
  warnings: ["Payment provider ownership inferred from client configuration."],
};
