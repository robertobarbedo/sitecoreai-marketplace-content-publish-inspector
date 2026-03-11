"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import type { TreeNode } from "./ContentTree";
import { Icon } from "./Icon";
import {
  mdiFileOutline,
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiAutorenew,
  mdiUpdate,
} from "@mdi/js";
import { DeliveryItemDetailModal } from "./DeliveryItemDetailModal";

function formatUpdated(raw?: string): string {
  if (!raw) return "";
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
  const date = new Date(raw);
  if (isNaN(date.getTime())) return raw;
  return date.toISOString().replace("T", " ").slice(0, 19);
}

type DeliveryStatus = "loading" | "found" | "not-found" | "error";

export interface DeliveryNode {
  itemId: string;
  name: string;
  path: string;
  hasChildren: boolean;
  updated?: string;
  authoringUpdated?: string;
  url?: string;
  status: DeliveryStatus;
  errorMessage?: string;
  children?: DeliveryNode[];
}

type DeliveryEndpoint = "xmc.preview.graphql" | "xmc.live.graphql";

interface DeliveryContentTreeProps {
  client: ClientSDK;
  appContext: ApplicationContext;
  authoringTree: TreeNode | null;
  endpoint: DeliveryEndpoint;
  language: string;
  label: string;
  onDeliveryTreeUpdate?: (tree: DeliveryNode | null) => void;
  hoveredLine?: number | null;
  onHoverChange?: (line: number | null) => void;
}

function flattenDeliveryNodes(node: DeliveryNode, result: Map<string, number> = new Map()): Map<string, number> {
  result.set(node.itemId, result.size);
  if (node.children) {
    for (const child of node.children) {
      flattenDeliveryNodes(child, result);
    }
  }
  return result;
}

function DeliveryNodeItem({
  node,
  depth,
  hoveredLine,
  lineIndexMap,
  onHoverChange,
  onOpenItem,
}: {
  node: DeliveryNode;
  depth: number;
  hoveredLine?: number | null;
  lineIndexMap: Map<string, number>;
  onHoverChange?: (line: number | null) => void;
  onOpenItem?: (node: DeliveryNode) => void;
}) {
  const [localHovered, setLocalHovered] = useState(false);
  const lineIndex = lineIndexMap.get(node.itemId) ?? 0;
  const isHovered = hoveredLine != null && lineIndex === hoveredLine;
  const isOutdated =
    node.status === "found" &&
    node.updated != null &&
    node.authoringUpdated != null &&
    node.updated !== node.authoringUpdated;
  return (
    <div>
      <div
        onMouseEnter={(e) => {
          setLocalHovered(true);
          e.currentTarget.style.backgroundColor = "#e8f0fe";
          onHoverChange?.(lineIndex);
        }}
        onMouseLeave={(e) => {
          setLocalHovered(false);
          e.currentTarget.style.backgroundColor = isHovered ? "#e8f0fe" : "transparent";
          onHoverChange?.(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: `3px 4px 3px ${depth * 16 + 4}px`,
          userSelect: "none",
          borderRadius: "3px",
          fontSize: "13px",
          lineHeight: "1.4",
          opacity: node.status === "not-found" ? 0.5 : 1,
          backgroundColor: isHovered ? "#e8f0fe" : "transparent",
          transition: "background-color 0.1s ease",
          cursor: "default",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "16px",
            height: "16px",
            flexShrink: 0,
          }}
        >
          {node.status === "loading" && <Icon path={mdiAutorenew} size={16} color="#999" spin />}
          {node.status === "not-found" && <Icon path={mdiAlertCircleOutline} size={16} color="#e57373" />}
          {node.status === "error" && <Icon path={mdiAlertOutline} size={16} color="#e57373" />}
          {node.status === "found" && !isOutdated && <Icon path={mdiFileOutline} size={16} color="#666" />}
          {node.status === "found" && isOutdated && <Icon path={mdiUpdate} size={16} color="#f57c00" />}
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: node.status === "not-found" || node.status === "error" ? "#e57373" : isOutdated ? "#f57c00" : undefined,
          }}
        >
          {node.name}
        </span>
        {node.status === "found" && node.updated && (
          <span style={{ fontSize: "11px", color: isOutdated ? "#f57c00" : "#b0b0b0", marginLeft: "6px", flexShrink: 0 }}>
            {formatUpdated(node.updated)}
          </span>
        )}
        {node.status === "loading" && (
          <span style={{ fontSize: "11px", color: "#999", marginLeft: "4px" }}>
            loading…
          </span>
        )}
        {node.status === "not-found" && (
          <span style={{ fontSize: "11px", color: "#e57373", marginLeft: "4px" }}>
            not found
          </span>
        )}
        {node.status === "error" && node.errorMessage && (
          <span style={{ fontSize: "11px", color: "#e57373", marginLeft: "4px" }}>
            {node.errorMessage}
          </span>
        )}
        {localHovered && node.status === "found" && onOpenItem && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onOpenItem(node);
            }}
            style={{
              marginLeft: "auto",
              padding: "1px 6px",
              fontSize: "11px",
              fontWeight: 500,
              color: "#444",
              backgroundColor: "#fff",
              border: "1px solid #d0d0d0",
              borderRadius: "3px",
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: "1.4",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#eee"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#fff"; }}
          >
            Open
          </span>
        )}
      </div>
      {node.children && (
        <div>
          {node.children.map((child) => (
            <DeliveryNodeItem key={child.itemId} node={child} depth={depth + 1} hoveredLine={hoveredLine} lineIndexMap={lineIndexMap} onHoverChange={onHoverChange} onOpenItem={onOpenItem} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DeliveryContentTree({
  client,
  appContext,
  authoringTree,
  endpoint,
  language,
  label,
  onDeliveryTreeUpdate,
  hoveredLine,
  onHoverChange,
}: DeliveryContentTreeProps) {
  const [deliveryTree, setDeliveryTree] = useState<DeliveryNode | null>(null);
  const deliveryTreeRef = useRef<DeliveryNode | null>(null);
  const deliveryTreeLangRef = useRef<string>(language);
  const [error, setError] = useState<string | null>(null);
  const [modalNode, setModalNode] = useState<DeliveryNode | null>(null);

  const handleOpenItem = useCallback((node: DeliveryNode) => {
    setModalNode(node);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalNode(null);
  }, []);

  const lineIndexMap = useMemo(() => {
    if (!deliveryTree) return new Map<string, number>();
    return flattenDeliveryNodes(deliveryTree);
  }, [deliveryTree]);

  const getSitecoreContextId = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string; live?: string } }>
      | undefined;
    const context = resourceAccess?.[0]?.context;
    return endpoint === "xmc.live.graphql" ? context?.live : context?.preview;
  }, [appContext, endpoint]);

  const fetchDeliveryItem = useCallback(
    async (authoringNode: TreeNode): Promise<DeliveryNode> => {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        return {
          itemId: authoringNode.itemId,
          name: authoringNode.name,
          path: authoringNode.path,
          hasChildren: authoringNode.hasChildren,
          status: "error",
          errorMessage: "No context ID",
        };
      }

      const graphqlQuery = {
        query: `
          query {
            item(path: "${authoringNode.path}", language: "${language}") {
              id
              name
              path
              field(name: "__Updated") { value }
              url { url }
              children {
                results {
                  id
                  name
                  path
                  field(name: "__Updated") { value }
                }
              }
            }
          }
        `,
      };

      try {
        const response = await client.mutate(endpoint, {
          params: {
            query: { sitecoreContextId },
            body: graphqlQuery,
          },
        });

        const raw = (response as {
          data?: {
            data?: {
              item?: {
                id?: string;
                name?: string;
                path?: string;
                field?: { value?: string };
                url?: { url?: string };
                children?: { results?: Array<Record<string, unknown>> };
              };
            };
          };
        })?.data?.data?.item;

        if (!raw) {
          return {
            itemId: authoringNode.itemId,
            name: authoringNode.name,
            path: authoringNode.path,
            hasChildren: authoringNode.hasChildren,
            status: "not-found",
          };
        }

        const hasChildResults = (raw.children?.results?.length ?? 0) > 0;
        return {
          itemId: raw.id ?? authoringNode.itemId,
          name: raw.name ?? authoringNode.name,
          path: raw.path ?? authoringNode.path,
          hasChildren: hasChildResults || authoringNode.hasChildren,
          updated: raw.field?.value,
          url: raw.url?.url || undefined,
          status: "found",
        };
      } catch (err) {
        console.error(`Error fetching item from ${endpoint}:`, err);
        return {
          itemId: authoringNode.itemId,
          name: authoringNode.name,
          path: authoringNode.path,
          hasChildren: authoringNode.hasChildren,
          status: "error",
          errorMessage: String(err),
        };
      }
    },
    [client, endpoint, language, getSitecoreContextId]
  );

  useEffect(() => {
    if (!authoringTree) {
      deliveryTreeRef.current = null;
      setDeliveryTree(null);
      onDeliveryTreeUpdate?.(null);
      return;
    }

    let cancelled = false;

    async function buildDeliveryTree(
      authoringNode: TreeNode,
      existingNode?: DeliveryNode,
    ): Promise<DeliveryNode> {
      if (cancelled) throw new Error("cancelled");

      const reuse = existingNode && existingNode.itemId === authoringNode.itemId;
      const deliveryNode = reuse ? existingNode : await fetchDeliveryItem(authoringNode);
      const nodeWithAuthoring: DeliveryNode = { ...deliveryNode, authoringUpdated: authoringNode.updated };

      if (authoringNode.children) {
        const existingChildMap = new Map<string, DeliveryNode>();
        if (reuse && existingNode.children) {
          for (const child of existingNode.children) {
            existingChildMap.set(child.itemId, child);
          }
        }
        const children = await Promise.all(
          authoringNode.children.map((child) =>
            buildDeliveryTree(child, existingChildMap.get(child.itemId))
          )
        );
        return { ...nodeWithAuthoring, children };
      }

      return { ...nodeWithAuthoring, children: undefined };
    }

    setError(null);
    const langChanged = deliveryTreeLangRef.current !== language;
    const existing = langChanged ? undefined : deliveryTreeRef.current ?? undefined;
    buildDeliveryTree(authoringTree, existing)
      .then((tree) => {
        if (!cancelled) {
          deliveryTreeRef.current = tree;
          deliveryTreeLangRef.current = language;
          setDeliveryTree(tree);
          onDeliveryTreeUpdate?.(tree);
        }
      })
      .catch((err) => {
        if (!cancelled && String(err) !== "Error: cancelled") {
          setError(String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authoringTree, fetchDeliveryItem, onDeliveryTreeUpdate]);

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: "13px",
      }}
    >
      <div
        style={{
          padding: "6px 12px",
          fontWeight: 600,
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "#555",
          borderBottom: "1px solid #e0e0e0",
          minHeight: "35px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span>{label}</span>
      </div>
      <div style={{ padding: "4px 0" }}>
        {error && (
          <div style={{ color: "red", padding: "8px 12px", fontSize: "12px" }}>
            {error}
          </div>
        )}
        {!deliveryTree && !error && (
          <div style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}>
            Waiting for content tree…
          </div>
        )}
        {deliveryTree && (
          <DeliveryNodeItem node={deliveryTree} depth={0} hoveredLine={hoveredLine} lineIndexMap={lineIndexMap} onHoverChange={onHoverChange} onOpenItem={handleOpenItem} />
        )}
      </div>
      {modalNode && (
        <DeliveryItemDetailModal
          node={{ itemId: modalNode.itemId, name: modalNode.name, path: modalNode.path }}
          client={client}
          appContext={appContext}
          endpoint={endpoint}
          language={language}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
