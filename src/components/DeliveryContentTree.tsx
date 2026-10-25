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
import { getClientRateLimiter, configureClientRateLimit } from "../utils/rateLimit";
import { useAppConfig } from "../utils/hooks/useAppConfig";

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
          e.currentTarget.style.backgroundColor = "var(--color-accent)";
          onHoverChange?.(lineIndex);
        }}
        onMouseLeave={(e) => {
          setLocalHovered(false);
          e.currentTarget.style.backgroundColor = isHovered ? "var(--color-accent)" : "transparent";
          onHoverChange?.(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-1)",
          padding: `var(--spacing-0-5) var(--spacing-1) var(--spacing-0-5) ${depth * 16 + 4}px`,
          userSelect: "none",
          borderRadius: "var(--radius-base)",
          fontSize: "var(--font-size-sm)",
          lineHeight: "20px",
          opacity: node.status === "not-found" ? 0.5 : 1,
          backgroundColor: isHovered ? "var(--color-accent)" : "transparent",
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
          {node.status === "loading" && <Icon path={mdiAutorenew} size={16} color="hsl(215.4, 16.3%, 46.9%)" spin />}
          {node.status === "not-found" && <Icon path={mdiAlertCircleOutline} size={16} color="hsl(346.8, 77.2%, 49.8%)" />}
          {node.status === "error" && <Icon path={mdiAlertOutline} size={16} color="hsl(346.8, 77.2%, 49.8%)" />}
          {node.status === "found" && !isOutdated && <Icon path={mdiFileOutline} size={16} color="hsl(215.4, 16.3%, 46.9%)" />}
          {node.status === "found" && isOutdated && <Icon path={mdiUpdate} size={16} color="hsl(32.1, 98%, 53.9%)" />}
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: node.status === "not-found" || node.status === "error" ? "var(--color-danger)" : isOutdated ? "var(--color-warning)" : undefined,
          }}
        >
          {node.name}
        </span>
        {node.status === "found" && node.updated && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: isOutdated ? "var(--color-warning)" : "var(--color-muted-foreground)", marginLeft: "var(--spacing-1-5)", flexShrink: 0 }}>
            {formatUpdated(node.updated)}
          </span>
        )}
        {node.status === "loading" && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginLeft: "var(--spacing-1)" }}>
            loading…
          </span>
        )}
        {node.status === "not-found" && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-danger)", marginLeft: "var(--spacing-1)" }}>
            not found
          </span>
        )}
        {node.status === "error" && node.errorMessage && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-danger)", marginLeft: "var(--spacing-1)" }}>
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
              padding: "var(--spacing-px) var(--spacing-1-5)",
              fontSize: "var(--font-size-2xs)",
              fontWeight: "var(--font-weight-medium)",
              color: "var(--color-foreground)",
              backgroundColor: "var(--color-background)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-base)",
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: "1.4",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-background)"; }}
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
  const config = useAppConfig();
  const [deliveryTree, setDeliveryTree] = useState<DeliveryNode | null>(null);
  const deliveryTreeRef = useRef<DeliveryNode | null>(null);
  const deliveryTreeLangRef = useRef<string>(language);
  const [error, setError] = useState<string | null>(null);
  const [modalNode, setModalNode] = useState<DeliveryNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Configure rate limiter when config changes
  useEffect(() => {
    configureClientRateLimit(config.rateLimit);
  }, [config.rateLimit]);

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
        // Apply rate limiting
        const rateLimiter = getClientRateLimiter();
        await rateLimiter.acquire();

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
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

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
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled && String(err) !== "Error: cancelled") {
          setError(String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authoringTree, fetchDeliveryItem, language, onDeliveryTreeUpdate]);

  return (
    <div
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--font-size-sm)",
      }}
    >
      <div
        style={{
          padding: "var(--spacing-1-5) var(--spacing-3)",
          fontWeight: "var(--font-weight-semibold)",
          fontSize: "var(--font-size-xs)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--color-muted-foreground)",
          borderBottom: "1px solid var(--color-border)",
          minHeight: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--spacing-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)" }}>
          <span>{label}</span>
          {isLoading && <Icon path={mdiAutorenew} size={16} color="hsl(215.4, 16.3%, 46.9%)" spin />}
        </div>
      </div>
      <div style={{ padding: "var(--spacing-1) 0" }}>
        {error && (
          <div style={{ color: "var(--color-danger)", padding: "var(--spacing-2) var(--spacing-3)", fontSize: "var(--font-size-xs)" }}>
            {error}
          </div>
        )}
        {!deliveryTree && !error && (
          <div style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>
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
