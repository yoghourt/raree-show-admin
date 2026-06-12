export type SourceConnectorMode = "mock" | "live";

export function getSourceConnectorMode(): SourceConnectorMode {
  const raw = process.env.SOURCE_CONNECTOR_MODE?.trim().toLowerCase();
  if (raw === "live") return "live";
  return "mock";
}
