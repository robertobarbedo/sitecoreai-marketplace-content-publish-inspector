"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { Icon } from "./Icon";
import { mdiFileOutline, mdiMagnify, mdiClose } from "@mdi/js";
import { ItemDetailModal } from "./ItemDetailModal";

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
          gap: "4px",
          padding: `3px 4px 3px ${depth * 16 + 4}px`,
          cursor: clickable ? "pointer" : "default",
          userSelect: "none",
          borderRadius: "3px",
          fontSize: "13px",
          lineHeight: "1.4",
          opacity: 1,
          backgroundColor: isExternallyHovered ? "#e8f0fe" : "transparent",
          transition: "background-color 0.1s ease",
        }}
        onMouseEnter={(e) => {
          setHovered(true);
          e.currentTarget.style.backgroundColor = "#e8f0fe";
          onHoverChange(lineIndex);
        }}
        onMouseLeave={(e) => {
          setHovered(false);
          e.currentTarget.style.backgroundColor = isExternallyHovered ? "#e8f0fe" : "transparent";
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
            fontSize: "10px",
            color: "#666",
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
          <Icon path={mdiFileOutline} size={16} color="#666" />
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
        {node.workflow && !node.workflow.workflowState.final && (
          <span
            style={{
              marginLeft: "6px",
              padding: "1px 6px",
              fontSize: "11px",
              fontWeight: 500,
              color: "#b0b0b0",
              backgroundColor: "#fff",
              border: "1px solid #d0d0d0",
              borderRadius: "3px",
              flexShrink: 0,
              lineHeight: "1.4",
            }}
          >
            {node.workflow.workflowState.displayName}
          </span>
        )}
        {node.updated && (
          <span style={{ fontSize: "11px", color: "#b0b0b0", marginLeft: "6px", flexShrink: 0 }}>
            {formatUpdated(node.updated)}
          </span>
        )}
        {loading && (
          <span style={{ fontSize: "11px", color: "#999", marginLeft: "4px" }}>
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
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#eee";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
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
  const [rootNode, setRootNode] = useState<TreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [modalNode, setModalNode] = useState<TreeNode | null>(null);
  const [modalData, setModalData] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

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

    client.mutate("xmc.authoring.graphql", {
      params: { query: { sitecoreContextId }, body: graphqlQuery },
    }).then((response) => {
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
    }).catch((err) => {
      console.error("Error fetching languages:", err);
    });
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
    [expandedIds, fetchChildren]
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
          display: "flex",
          flexDirection: "column",
          gap: "0px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: "35px" }}>
          <span>Authoring API</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              style={{
                fontSize: "11px",
                padding: "2px 4px",
                border: "1px solid #d0d0d0",
                borderRadius: "3px",
                color: "#444",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontWeight: 400,
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
                  borderRadius: "4px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#e8e8e8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon path={mdiClose} size={14} color="#999" />
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
                borderRadius: "4px",
                cursor: "pointer",
                flexShrink: 0,
                backgroundColor: searchOpen ? "#e0e0e0" : "transparent",
              }}
              onMouseEnter={(e) => { if (!searchOpen) e.currentTarget.style.backgroundColor = "#e8e8e8"; }}
              onMouseLeave={(e) => { if (!searchOpen) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Icon path={mdiMagnify} size={16} color="#666" />
            </span>
          </div>
        </div>
        {searchOpen && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingTop: "6px", paddingBottom: "2px" }}>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setSearchError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearchSubmit(); if (e.key === "Escape") setSearchOpen(false); }}
                placeholder="/sitecore/content/... or {GUID}"
                autoFocus
                style={{
                  flex: 1,
                  fontSize: "12px",
                  padding: "4px 8px",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  color: "#222",
                  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                  fontWeight: 400,
                  textTransform: "none",
                  letterSpacing: 0,
                  outline: "none",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#90caf9"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#d0d0d0"; }}
              />
              <button
                onClick={handleSearchSubmit}
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "0 10px",
                  height: "26px",
                  border: "none",
                  borderRadius: "4px",
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  cursor: "pointer",
                  textTransform: "none",
                  letterSpacing: 0,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1565c0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1976d2"; }}
              >
                Go
              </button>
            </div>
            {searchError && (
              <div style={{ fontSize: "11px", color: "#e57373", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {searchError}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "4px 0" }}>
        {error && (
          <div style={{ color: "red", padding: "8px 12px", fontSize: "12px" }}>
            {error}
          </div>
        )}
        {!rootNode && !error && (
          <div style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}>
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
