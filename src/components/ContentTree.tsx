"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { Icon } from "./Icon";
import { mdiFileOutline, mdiMagnify, mdiClose } from "@mdi/js";
import { ItemDetailModal } from "./ItemDetailModal";
import { getClientRateLimiter, configureClientRateLimit } from "../utils/rateLimit";
import { useAppConfig } from "../utils/hooks/useAppConfig";

export interface TreeNode {
  itemId: string;
  name: string;
  path: string;
  hasChildren: boolean;
  hasPresentation?: boolean;
  updated?: string;
  workflow?: {
    workflowState: {
      final: boolean;
      displayName: string;
    };
  };
  children?: TreeNode[];
}

interface ContentTreeProps {
  client: ClientSDK;
  appContext: ApplicationContext;
  rootItemId?: string;
  onTreeUpdate?: (visibleTree: TreeNode) => void;
  onLanguageChange?: (language: string) => void;
  onHoverChange?: (line: number | null) => void;
  hoveredLine?: number | null;
}

interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  expandedIds: Set<string>;
  loadingIds: Set<string>;
  onToggle: (node: TreeNode) => void;
  onHoverChange: (line: number | null) => void;
  lineIndexMap: Map<string, number>;
  onOpenItem: (node: TreeNode) => void;
  hoveredLine?: number | null;
}

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

function buildVisibleTree(node: TreeNode, expandedIds: Set<string>): TreeNode {
  if (expandedIds.has(node.itemId) && node.children) {
    return {
      ...node,
      children: node.children.map((child) => buildVisibleTree(child, expandedIds)),
    };
  }
  return { ...node, children: undefined };
}

function flattenVisibleNodes(node: TreeNode, expandedIds: Set<string>, result: Map<string, number> = new Map()): Map<string, number> {
  result.set(node.itemId, result.size);
  if (expandedIds.has(node.itemId) && node.children) {
    for (const child of node.children) {
      flattenVisibleNodes(child, expandedIds, result);
    }
  }
  return result;
}

function TreeNodeItem({ node, depth, expandedIds, loadingIds, onToggle, onHoverChange, lineIndexMap, onOpenItem, hoveredLine }: TreeNodeItemProps) {
  const [hovered, setHovered] = useState(false);
  const expanded = expandedIds.has(node.itemId);
  const loading = loadingIds.has(node.itemId);
  const clickable = node.hasChildren;
  const lineIndex = lineIndexMap.get(node.itemId) ?? 0;
  const isExternallyHovered = !hovered && hoveredLine != null && lineIndex === hoveredLine;

  return (
    <div>
      <div
        onClick={() => clickable && onToggle(node)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-1)",
          padding: `var(--spacing-0-5) var(--spacing-1) var(--spacing-0-5) ${depth * 16 + 4}px`,
          cursor: clickable ? "pointer" : "default",
          userSelect: "none",
          borderRadius: "var(--radius-base)",
          fontSize: "var(--font-size-sm)",
          lineHeight: "20px",
          opacity: 1,
          backgroundColor: isExternallyHovered ? "var(--color-accent)" : "transparent",
          transition: "background-color 0.1s ease",
        }}
        onMouseEnter={(e) => {
          setHovered(true);
          e.currentTarget.style.backgroundColor = "var(--color-accent)";
          onHoverChange(lineIndex);
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          e.currentTarget.style.backgroundColor = isExternallyHovered ? "var(--color-accent)" : "transparent";
          onHoverChange(null);
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
            color: "var(--color-muted-foreground)",
            fontFamily: "Arial, sans-serif",
            fontSize: "10px",
            transition: "transform 0.15s ease",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          {node.hasChildren ? "▶" : ""}
        </span>
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
          <Icon path={mdiFileOutline} size={16} color="hsl(215.4, 16.3%, 46.9%)" />
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.name}
        </span>
        {node.workflow && !node?.workflow?.workflowState?.final && (
          <span
            style={{
              marginLeft: "var(--spacing-1-5)",
              padding: "var(--spacing-0-5) var(--spacing-2)",
              fontSize: "var(--font-size-2xs)",
              fontWeight: "var(--font-weight-semibold)",
              color: "hsl(215.4, 16.3%, 46.9%)",
              backgroundColor: "hsl(210, 40%, 96.1%)",
              border: "1px solid hsl(214.3, 31.8%, 91.4%)",
              borderRadius: "var(--radius-sm)",
              flexShrink: 0,
              lineHeight: "1.2",
              textTransform: "uppercase",
              letterSpacing: "0.025em",
            }}
          >
            {node.workflow?.workflowState?.displayName}
          </span>
        )}
        {node.updated && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginLeft: "var(--spacing-1-5)", flexShrink: 0 }}>
            {formatUpdated(node.updated)}
          </span>
        )}
        {loading && (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginLeft: "var(--spacing-1)" }}>
            loading…
          </span>
        )}
        {hovered && (
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-background)";
            }}
          >
            Open
          </span>
        )}
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.itemId}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              onToggle={onToggle}
              onHoverChange={onHoverChange}
              lineIndexMap={lineIndexMap}
              onOpenItem={onOpenItem}
              hoveredLine={hoveredLine}
            />
          ))}
        </div>
      )}
    </div>
  );
}


const GUID_RE = /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;

function isValidRootInput(value: string): boolean {
  return value.startsWith("/") || GUID_RE.test(value);
}

export function ContentTree({ client, appContext, rootItemId, onTreeUpdate, onLanguageChange, onHoverChange, hoveredLine }: ContentTreeProps) {
  const config = useAppConfig();
  const [rootNode, setRootNode] = useState<TreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [modalNode, setModalNode] = useState<TreeNode | null>(null);
  const [modalData, setModalData] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Configure rate limiter when config changes
  useEffect(() => {
    configureClientRateLimit(config.rateLimit);
  }, [config.rateLimit]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [customRoot, setCustomRoot] = useState<string | null>(null);

  const [languages, setLanguages] = useState<string[]>(["en"]);
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    let key = "contentTree_language";
    if (appContext?.id && appContext?.installationId) {
      const appIdSegment = appContext.id.split('-')[0];
      const installationIdSegment = appContext.installationId.split('-')[0];
      key = `contentTree_language_${appIdSegment}_${installationIdSegment}`;
    }
    try { return localStorage.getItem(key) || "en"; } catch { return "en"; }
  });

  const visibleTree = useMemo(() => {
    if (!rootNode) return null;
    return buildVisibleTree(rootNode, expandedIds);
  }, [rootNode, expandedIds]);

  const lineIndexMap = useMemo(() => {
    if (!rootNode) return new Map<string, number>();
    return flattenVisibleNodes(rootNode, expandedIds);
  }, [rootNode, expandedIds]);

  useEffect(() => {
    if (visibleTree && onTreeUpdate) {
      onTreeUpdate(visibleTree);
    }
  }, [visibleTree, onTreeUpdate]);

  const getSitecoreContextId = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string } }>
      | undefined;
    return resourceAccess?.[0]?.context?.preview;
  }, [appContext]);

  useEffect(() => {
    const sitecoreContextId = getSitecoreContextId();
    if (!sitecoreContextId) return;

    const graphqlQuery = {
      query: `
        query {
          item(where: { database: "master", path: "/sitecore/system/Languages" }) {
            children {
              nodes {
                name
              }
            }
          }
        }
      `,
    };

    // Apply rate limiting
    const fetchLanguages = async () => {
      try {
        const rateLimiter = getClientRateLimiter();
        await rateLimiter.acquire();

        const response = await client.mutate("xmc.authoring.graphql", {
          params: { query: { sitecoreContextId }, body: graphqlQuery },
        });

        const nodes = (
          response as {
            data?: { data?: { item?: { children?: { nodes?: Array<{ name: string }> } } } };
          }
        )?.data?.data?.item?.children?.nodes;
        if (nodes && nodes.length > 0) {
          const names = nodes.map((n) => n.name);
          setLanguages(names);
          let stored: string | null = null;
          let key = "contentTree_language";
          if (appContext?.id && appContext?.installationId) {
            const appIdSegment = appContext.id.split('-')[0];
            const installationIdSegment = appContext.installationId.split('-')[0];
            key = `contentTree_language_${appIdSegment}_${installationIdSegment}`;
          }
          try { stored = localStorage.getItem(key); } catch { /* ignore */ }
          const effective = stored && names.includes(stored) ? stored : names[0];
          setSelectedLanguage(effective);
          onLanguageChange?.(effective);
        }
      } catch (err) {
        console.error("Error fetching languages:", err);
      }
    };

    fetchLanguages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, getSitecoreContextId]);

  const handleLanguageChange = useCallback((lang: string) => {
    setSelectedLanguage(lang);
    onLanguageChange?.(lang);
    let key = "contentTree_language";
    if (appContext?.id && appContext?.installationId) {
      const appIdSegment = appContext.id.split('-')[0];
      const installationIdSegment = appContext.installationId.split('-')[0];
      key = `contentTree_language_${appIdSegment}_${installationIdSegment}`;
    }
    try { localStorage.setItem(key, lang); } catch { /* ignore */ }
    setRootNode(null);
    setExpandedIds(new Set());
    setError(null);
  }, [onLanguageChange, appContext?.id, appContext?.installationId]);

  const fetchItem = useCallback(
    async (itemId: string): Promise<TreeNode | null> => {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        setError("No Sitecore context ID available");
        return null;
      }

      const graphqlQuery = {
        query: `
          query {
            item(where: { database: "master", itemId: "${itemId}", language: "${selectedLanguage}" }) {
              itemId
              name
              path
              hasChildren
              hasPresentation
              field(name: "__Updated") { value }
              workflow {
                workflowState {
                  final
                  displayName
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

        const response = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId },
            body: graphqlQuery,
          },
        });

        const raw = (response as { data?: { data?: { item?: Record<string, unknown> } } })
          ?.data?.data?.item;
        if (!raw) {
          setError("Item not found");
          return null;
        }
        const fieldValue = (raw.field as { value?: string } | undefined)?.value;
        return { ...raw, updated: fieldValue } as unknown as TreeNode;
      } catch (err) {
        console.error("Error fetching item:", err);
        setError(`Failed to fetch item: ${String(err)}`);
        return null;
      }
    },
    [client, getSitecoreContextId, selectedLanguage]
  );

  const fetchItemByPath = useCallback(
    async (path: string): Promise<TreeNode | null> => {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        setError("No Sitecore context ID available");
        return null;
      }

      const graphqlQuery = {
        query: `
          query {
            item(where: { database: "master", path: "${path}", language: "${selectedLanguage}" }) {
              itemId
              name
              path
              hasChildren
              hasPresentation
              field(name: "__Updated") { value }
              workflow {
                workflowState {
                  final
                  displayName
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

        const response = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId },
            body: graphqlQuery,
          },
        });

        const raw = (response as { data?: { data?: { item?: Record<string, unknown> } } })
          ?.data?.data?.item;
        if (!raw) {
          setError("Item not found at this path");
          return null;
        }
        const fieldValue = (raw.field as { value?: string } | undefined)?.value;
        return { ...raw, updated: fieldValue } as unknown as TreeNode;
      } catch (err) {
        console.error("Error fetching item by path:", err);
        setError(`Failed to fetch item: ${String(err)}`);
        return null;
      }
    },
    [client, getSitecoreContextId, selectedLanguage]
  );

  const fetchChildren = useCallback(
    async (parentId: string): Promise<TreeNode[]> => {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) return [];

      const graphqlQuery = {
        query: `
          query {
            item(where: { database: "master", itemId: "${parentId}", language: "${selectedLanguage}" }) {
              children {
                nodes {
                  itemId
                  name
                  path
                  hasChildren
                  hasPresentation
                  field(name: "__Updated") { value }
                  workflow {
                    workflowState {
                      final
                      displayName
                    }
                  }
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

        const response = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId },
            body: graphqlQuery,
          },
        });

        const item = (
          response as {
            data?: {
              data?: {
                item?: { children?: { nodes?: Array<Record<string, unknown>> } };
              };
            };
          }
        )?.data?.data?.item;

        const rawNodes = item?.children?.nodes ?? [];
        return rawNodes.map((n) => {
          const fieldValue = (n.field as { value?: string } | undefined)?.value;
          return { ...n, updated: fieldValue } as unknown as TreeNode;
        });
      } catch (err) {
        console.error("Error fetching children:", err);
        return [];
      }
    },
    [client, getSitecoreContextId, selectedLanguage]
  );

  const updateNodeChildren = (
    node: TreeNode,
    targetId: string,
    children: TreeNode[]
  ): TreeNode => {
    if (node.itemId === targetId) {
      return { ...node, children };
    }
    if (node.children) {
      return {
        ...node,
        children: node.children.map((child) =>
          updateNodeChildren(child, targetId, children)
        ),
      };
    }
    return node;
  };

  const handleToggle = useCallback(
    async (node: TreeNode) => {
      if (expandedIds.has(node.itemId)) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.delete(node.itemId);
          return next;
        });
        return;
      }

      if (!node.children) {
        setLoadingIds((prev) => new Set(prev).add(node.itemId));
        const children = await fetchChildren(node.itemId);
        setRootNode((prev) => {
          if (!prev) return prev;
          return updateNodeChildren(prev, node.itemId, children);
        });
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(node.itemId);
          return next;
        });
      }

      setExpandedIds((prev) => new Set(prev).add(node.itemId));
    },
    [expandedIds, fetchChildren, updateNodeChildren]
  );

  const handleOpenItem = useCallback(
    async (node: TreeNode) => {
      setModalNode(node);
      setModalData(null);
      setModalLoading(true);

      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        setModalData(null);
        setModalLoading(false);
        return;
      }

      const graphqlQuery = {
        query: `
          query GetPageContents {
            item(where: { database: "master", itemId: "${node.itemId}", language: "${selectedLanguage}" }) {
              itemId
              name
              path
              hasChildren
              hasPresentation
              access { canAdmin canCreate canDelete canRead canRename canWrite }
              database
              displayName
              icon
              itemUri
              language { name }
              isFallback
              publish { neverPublish validFrom validTo }
              thumbnailUrl
              template { name }
              version
              versionName
              versions { version versionName }
              workflow { workflowState { displayName final } }
              fields(ownFields: false, excludeStandardFields: false) {
                nodes {
                  name
                  fieldId
                  value
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

        const response = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId },
            body: graphqlQuery,
          },
        });
        const data = (response as { data?: { data?: unknown } })?.data?.data;
        setModalData(JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("Error fetching item detail:", err);
        setModalData(null);
      } finally {
        setModalLoading(false);
      }
    },
    [client, getSitecoreContextId, selectedLanguage]
  );

  const handleCloseModal = useCallback(() => {
    setModalNode(null);
    setModalData(null);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;

    if (!isValidRootInput(trimmed)) {
      setSearchError("Only item paths (starting with /) or IDs (GUIDs) are allowed.");
      return;
    }

    setSearchError(null);
    setRootNode(null);
    setExpandedIds(new Set());
    setError(null);
    setCustomRoot(trimmed);
    setSearchOpen(false);
  }, [searchInput]);

  const handleSearchClear = useCallback(() => {
    setCustomRoot(null);
    setSearchInput("");
    setSearchError(null);
    setSearchOpen(false);
    setRootNode(null);
    setExpandedIds(new Set());
    setError(null);
  }, []);

  useEffect(() => {
    const target = customRoot ?? rootItemId ?? "{0DE95AE4-41AB-4D01-9EB0-67441B7C2450}";
    const isPath = target.startsWith("/");
    const fetcher = isPath ? fetchItemByPath(target) : fetchItem(target);
    fetcher.then((item) => {
      if (item) setRootNode(item);
    });
  }, [customRoot, rootItemId, fetchItem, fetchItemByPath]);

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
          display: "flex",
          flexDirection: "column",
          minHeight: "56px",
          justifyContent: "center",
          gap: "0px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Authoring API</span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-1)" }}>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                fontSize: "var(--font-size-2xs)",
                padding: "var(--spacing-0-5) var(--spacing-1)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-base)",
                color: "var(--color-foreground)",
                backgroundColor: "var(--color-background)",
                cursor: "pointer",
                fontWeight: "var(--font-weight-normal)",
                textTransform: "none",
                letterSpacing: 0,
                outline: "none",
              }}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
            {customRoot && (
              <span
                onClick={handleSearchClear}
                title="Clear search and reset to default root"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "22px",
                  height: "22px",
                  borderRadius: "var(--radius-base)",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon path={mdiClose} size={14} color="hsl(215.4, 16.3%, 46.9%)" />
              </span>
            )}
            <span
              onClick={() => setSearchOpen((p) => !p)}
              title="Search by path or ID"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "var(--radius-base)",
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: searchOpen ? "var(--color-muted)" : "transparent",
              }}
              onMouseEnter={(e) => { if (!searchOpen) e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
              onMouseLeave={(e) => { if (!searchOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Icon path={mdiMagnify} size={16} color="hsl(215.4, 16.3%, 46.9%)" />
            </span>
          </div>
        </div>
        {searchOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)", paddingTop: "var(--spacing-1-5)", paddingBottom: "var(--spacing-0-5)" }}>
            <div style={{ display: "flex", gap: "var(--spacing-1)", alignItems: "center" }}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setSearchError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="/sitecore/content/... or {GUID}"
                autoFocus
                style={{
                  flex: 1,
                  fontSize: "var(--font-size-xs)",
                  padding: "var(--spacing-1) var(--spacing-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-foreground)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-normal)",
                  textTransform: "none",
                  letterSpacing: 0,
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-ring)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
              <button
                onClick={handleSearchSubmit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "var(--font-size-2xs)",
                  fontWeight: "var(--font-weight-semibold)",
                  padding: "0 var(--spacing-2-5)",
                  height: "24px",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                  cursor: "pointer",
                  textTransform: "none",
                  letterSpacing: 0,
                  flexShrink: 0,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-primary-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--color-primary)"; }}
              >
                Go
              </button>
            </div>
            {searchError && (
              <div style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-danger)", fontWeight: "var(--font-weight-normal)", textTransform: "none", letterSpacing: 0 }}>
                {searchError}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "var(--spacing-1) 0" }}>
        {error && (
          <div style={{ color: "var(--color-danger)", padding: "var(--spacing-2) var(--spacing-3)", fontSize: "var(--font-size-xs)" }}>
            {error}
          </div>
        )}
        {!rootNode && !error && (
          <div style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>
            Loading…
          </div>
        )}
        {rootNode && (
          <TreeNodeItem
            node={rootNode}
            depth={0}
            expandedIds={expandedIds}
            loadingIds={loadingIds}
            onToggle={handleToggle}
            onHoverChange={onHoverChange ?? (() => {})}
            lineIndexMap={lineIndexMap}
            onOpenItem={handleOpenItem}
            hoveredLine={hoveredLine}
          />
        )}
      </div>
      {modalNode && (
        <ItemDetailModal
          node={modalNode}
          rawData={modalData}
          loading={modalLoading}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
