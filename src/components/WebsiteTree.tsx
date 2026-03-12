"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import type { TreeNode } from "./ContentTree";
import type { DeliveryNode } from "./DeliveryContentTree";
import { Icon } from "./Icon";
import {
  mdiFileOutline,
  mdiAlertCircleOutline,
  mdiAutorenew,
  mdiUpdate,
  mdiWeb,
  mdiCogOutline,
  mdiClose,
} from "@mdi/js";

const getSettingsKey = (appContext?: ApplicationContext) => {
  if (!appContext?.id || !appContext?.installationId) return "websiteTree_updatedSource";
  const appIdSegment = appContext.id.split('-')[0];
  const installationIdSegment = appContext.installationId.split('-')[0];
  return `websiteTree_updatedSource_${appIdSegment}_${installationIdSegment}`;
};

interface UpdatedSourceSettings {
  source: "header" | "meta";
  name: string;
}

const DEFAULT_SETTINGS: UpdatedSourceSettings = { source: "meta", name: "Last-Modified" };

function loadSettings(appContext?: ApplicationContext): UpdatedSourceSettings {
  try {
    const raw = localStorage.getItem(getSettingsKey(appContext));
    if (raw) {
      const parsed = JSON.parse(raw);
      if ((parsed.source === "header" || parsed.source === "meta") && typeof parsed.name === "string") {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: UpdatedSourceSettings, appContext?: ApplicationContext) {
  try {
    localStorage.setItem(getSettingsKey(appContext), JSON.stringify(settings));
  } catch { /* ignore */ }
}

function formatUpdated(raw?: string | null): string {
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

interface SiteInfo {
  name: string;
  rootPath: string;
}

interface FetchResult {
  httpStatus: number;
  updated: string | null;
  error?: string;
}

type DisplayState =
  | "not-in-site"
  | "no-url"
  | "loading"
  | "http-error"
  | "no-meta"
  | "all-same"
  | "outdated-preview"
  | "outdated-live";

const COLOR_ERROR = "#e57373";
const COLOR_OUTDATED_PREVIEW = "#f57c00";
const COLOR_OUTDATED_LIVE = "#e65100";

interface WebsiteTreeProps {
  client: ClientSDK;
  appContext: ApplicationContext;
  authoringTree: TreeNode | null;
  previewTree: DeliveryNode | null;
  liveTree: DeliveryNode | null;
  hoveredLine?: number | null;
  onHoverChange?: (line: number | null) => void;
}

function buildDeliveryMap(
  node: DeliveryNode | null
): Map<string, DeliveryNode> {
  const map = new Map<string, DeliveryNode>();
  if (!node) return map;
  function walk(n: DeliveryNode) {
    map.set(n.path.toLowerCase(), n);
    if (n.children) {
      for (const child of n.children) walk(child);
    }
  }
  walk(node);
  return map;
}

function flattenAuthoringNodes(
  node: TreeNode,
  result: Map<string, number> = new Map()
): Map<string, number> {
  result.set(node.itemId, result.size);
  if (node.children) {
    for (const child of node.children) {
      flattenAuthoringNodes(child, result);
    }
  }
  return result;
}

function resolveDisplayState(
  node: TreeNode,
  sites: SiteInfo[],
  previewMap: Map<string, DeliveryNode>,
  liveMap: Map<string, DeliveryNode>,
  fetchResults: Map<string, FetchResult>
): {
  state: DisplayState;
  httpStatus?: number;
  url?: string;
  websiteUpdated?: string | null;
} {
  const pathLower = node.path.toLowerCase();
  const isInSite = sites.some(
    (s) => s.rootPath && pathLower.startsWith(s.rootPath.toLowerCase())
  );

  if (!isInSite || !node.hasPresentation) {
    return { state: "not-in-site" };
  }

  const previewNode = previewMap.get(pathLower);
  const liveNode = liveMap.get(pathLower);
  const url = liveNode?.url;

  if (!url) {
    return { state: "no-url" };
  }

  const fetchResult = fetchResults.get(url);

  if (!fetchResult) {
    return { state: "loading", url };
  }

  if (fetchResult.httpStatus < 200 || fetchResult.httpStatus >= 300) {
    return {
      state: "http-error",
      httpStatus: fetchResult.httpStatus,
      url,
    };
  }

  if (fetchResult.updated == null) {
    return { state: "no-meta", url };
  }

  const websiteUpdated = fetchResult.updated;
  const previewUpdated = previewNode?.updated;
  const liveUpdated = liveNode?.updated;

  if (websiteUpdated === previewUpdated && websiteUpdated === liveUpdated) {
    return { state: "all-same", url, websiteUpdated };
  }

  if (websiteUpdated === liveUpdated && websiteUpdated !== previewUpdated) {
    return { state: "outdated-preview", url, websiteUpdated };
  }

  return { state: "outdated-live", url, websiteUpdated };
}

function WebsiteNodeItem({
  node,
  depth,
  sites,
  previewMap,
  liveMap,
  fetchResults,
  hoveredLine,
  lineIndexMap,
  onHoverChange,
}: {
  node: TreeNode;
  depth: number;
  sites: SiteInfo[];
  previewMap: Map<string, DeliveryNode>;
  liveMap: Map<string, DeliveryNode>;
  fetchResults: Map<string, FetchResult>;
  hoveredLine?: number | null;
  lineIndexMap: Map<string, number>;
  onHoverChange?: (line: number | null) => void;
}) {
  const [localHovered, setLocalHovered] = useState(false);
  const lineIndex = lineIndexMap.get(node.itemId) ?? 0;
  const isHovered = hoveredLine != null && lineIndex === hoveredLine;

  const display = resolveDisplayState(
    node,
    sites,
    previewMap,
    liveMap,
    fetchResults
  );

  const getTextColor = (): string | undefined => {
    switch (display.state) {
      case "http-error":
        return COLOR_ERROR;
      case "outdated-preview":
        return COLOR_OUTDATED_PREVIEW;
      case "outdated-live":
        return COLOR_OUTDATED_LIVE;
      default:
        return undefined;
    }
  };

  const getIcon = () => {
    switch (display.state) {
      case "not-in-site":
      case "no-url":
        return <Icon path={mdiFileOutline} size={16} color="#ccc" />;
      case "loading":
        return <Icon path={mdiAutorenew} size={16} color="#999" spin />;
      case "http-error":
        return (
          <Icon path={mdiAlertCircleOutline} size={16} color={COLOR_ERROR} />
        );
      case "no-meta":
      case "all-same":
        return <Icon path={mdiWeb} size={16} color="#666" />;
      case "outdated-preview":
        return (
          <Icon path={mdiUpdate} size={16} color={COLOR_OUTDATED_PREVIEW} />
        );
      case "outdated-live":
        return (
          <Icon path={mdiUpdate} size={16} color={COLOR_OUTDATED_LIVE} />
        );
    }
  };

  const getAnnotation = () => {
    switch (display.state) {
      case "loading":
        return (
          <span style={{ fontSize: "11px", color: "#999", marginLeft: "4px" }}>
            loading…
          </span>
        );
      case "http-error":
        return (
          <span
            style={{
              fontSize: "11px",
              color: COLOR_ERROR,
              marginLeft: "4px",
              fontWeight: 600,
            }}
          >
            {display.httpStatus || "error"}
          </span>
        );
      case "no-meta":
        return (
          <span style={{ fontSize: "11px", color: "#bbb", marginLeft: "4px" }}>
            &nbsp;
          </span>
        );
      case "all-same":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "11px", color: "#b0b0b0", marginLeft: "6px", flexShrink: 0 }}>
            {formatUpdated(display.websiteUpdated)}
          </span>
        ) : null;
      case "outdated-preview":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "11px", color: COLOR_OUTDATED_PREVIEW, marginLeft: "6px", flexShrink: 0 }}>
            {formatUpdated(display.websiteUpdated)}
          </span>
        ) : null;
      case "outdated-live":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "11px", color: COLOR_OUTDATED_LIVE, marginLeft: "6px", flexShrink: 0 }}>
            {formatUpdated(display.websiteUpdated)}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  const textColor = getTextColor();
  const isNotInSite =
    display.state === "not-in-site" || display.state === "no-url";

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
          e.currentTarget.style.backgroundColor = isHovered
            ? "#e8f0fe"
            : "transparent";
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
          opacity: isNotInSite ? 0.45 : 1,
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
          {getIcon()}
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: textColor,
          }}
        >
          {node.name}
        </span>
        {getAnnotation()}
        {localHovered && display.url && !isNotInSite && (
          <a
            href={display.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
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
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#eee";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            Ctrl Click
          </a>
        )}
      </div>
      {node.children && (
        <div>
          {node.children.map((child) => (
            <WebsiteNodeItem
              key={child.itemId}
              node={child}
              depth={depth + 1}
              sites={sites}
              previewMap={previewMap}
              liveMap={liveMap}
              fetchResults={fetchResults}
              hoveredLine={hoveredLine}
              lineIndexMap={lineIndexMap}
              onHoverChange={onHoverChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WebsiteTree({
  client,
  appContext,
  authoringTree,
  previewTree,
  liveTree,
  hoveredLine,
  onHoverChange,
}: WebsiteTreeProps) {
  const [sites, setSites] = useState<SiteInfo[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const sitesFetchedRef = useRef(false);

  const [fetchResults, setFetchResults] = useState<Map<string, FetchResult>>(
    new Map()
  );
  const processedUrlsRef = useRef<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UpdatedSourceSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef<UpdatedSourceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadSettings(appContext);
    setSettings(loaded);
    settingsRef.current = loaded;
  }, [appContext?.id, appContext?.installationId]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = useCallback(() => {
    processedUrlsRef.current.clear();
    setFetchResults(new Map());
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const getSitecoreContextId = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string } }>
      | undefined;
    return resourceAccess?.[0]?.context?.preview;
  }, [appContext]);

  useEffect(() => {
    if (sitesFetchedRef.current) return;

    let cancelled = false;
    sitesFetchedRef.current = true;
    setSitesLoading(true);

    async function fetchSites() {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        if (!cancelled) setSitesLoading(false);
        return;
      }

      try {
        const response = await client.mutate("xmc.preview.graphql", {
          params: {
            query: { sitecoreContextId },
            body: {
              query: `
                query {
                  site {
                    allSiteInfo(pageSize: 100, pageNumber: 1) {
                      results {
                        name
                        rootPath
                      }
                    }
                  }
                }
              `,
            },
          },
        });
        if (cancelled) return;

        const data = (
          response as {
            data?: {
              data?: {
                site?: {
                  allSiteInfo?: {
                    results?: Array<{ name: string; rootPath: string }>;
                  };
                };
              };
            };
          }
        )?.data?.data;

        const results = data?.site?.allSiteInfo?.results ?? [];
        setSites(results);
      } catch {
        console.error("Error fetching sites");
      } finally {
        if (!cancelled) setSitesLoading(false);
      }
    }

    fetchSites();
    return () => {
      cancelled = true;
      sitesFetchedRef.current = false;
    };
  }, [client, getSitecoreContextId]);

  const previewMap = useMemo(
    () => buildDeliveryMap(previewTree),
    [previewTree]
  );
  const liveMap = useMemo(() => buildDeliveryMap(liveTree), [liveTree]);

  const lineIndexMap = useMemo(() => {
    if (!authoringTree) return new Map<string, number>();
    return flattenAuthoringNodes(authoringTree);
  }, [authoringTree]);

  useEffect(() => {
    if (!authoringTree || sites.length === 0 || !liveTree) return;

    function walk(node: TreeNode) {
      const pathLower = node.path.toLowerCase();
      const isInSite = sites.some(
        (s) => s.rootPath && pathLower.startsWith(s.rootPath.toLowerCase())
      );
      if (isInSite && node.hasPresentation) {
        const liveNode = liveMap.get(pathLower);
        const url = liveNode?.url;
        if (url && !processedUrlsRef.current.has(url)) {
          processedUrlsRef.current.add(url);
          fetchPage(url);
        }
      }
      if (node.children) {
        for (const child of node.children) walk(child);
      }
    }

    async function fetchPage(url: string) {
      try {
        const s = settingsRef.current;
        const res = await fetch(
          `/api/fetch-page?url=${encodeURIComponent(url)}&source=${s.source}&name=${encodeURIComponent(s.name)}`
        );
        const data = await res.json();
        setFetchResults((prev) =>
          new Map(prev).set(url, {
            httpStatus: data.status ?? 0,
            updated: data.updated ?? null,
            error: data.error,
          })
        );
      } catch (err) {
        setFetchResults((prev) =>
          new Map(prev).set(url, {
            httpStatus: 0,
            updated: null,
            error: String(err),
          })
        );
      }
    }

    walk(authoringTree);
  }, [authoringTree, liveTree, sites, liveMap, refreshTrigger]);

  const hasData = authoringTree && sites.length > 0;

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
        <span>Website</span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            onClick={() => setSettingsOpen(true)}
            title="Configure __Updated source"
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
            <Icon path={mdiCogOutline} size={16} color="#888" />
          </span>
          {hasData && (
            <button
              onClick={handleRefresh}
              title="Re-fetch all pages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 7px",
                fontSize: "11px",
                fontWeight: 500,
                border: "1px solid #d0d0d0",
                borderRadius: "3px",
                backgroundColor: "#fff",
                color: "#555",
                cursor: "pointer",
                textTransform: "none",
                letterSpacing: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#fff";
              }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: "4px 0" }}>
        {sitesLoading && (
          <div
            style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}
          >
            Loading site information…
          </div>
        )}
        {!sitesLoading && sites.length === 0 && (
          <div
            style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}
          >
            No sites found.
          </div>
        )}
        {!authoringTree && sites.length > 0 && (
          <div
            style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}
          >
            Waiting for content tree…
          </div>
        )}
        {(!previewTree || !liveTree) && authoringTree && sites.length > 0 && (
          <div
            style={{ padding: "8px 12px", color: "#999", fontSize: "12px" }}
          >
            Waiting for delivery data…
          </div>
        )}
        {hasData && previewTree && liveTree && (
          <WebsiteNodeItem
            node={authoringTree}
            depth={0}
            sites={sites}
            previewMap={previewMap}
            liveMap={liveMap}
            fetchResults={fetchResults}
            hoveredLine={hoveredLine}
            lineIndexMap={lineIndexMap}
            onHoverChange={onHoverChange}
          />
        )}
      </div>
      {settingsOpen && (
        <div
          onClick={() => setSettingsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: "10px",
              boxShadow: "0 12px 48px rgba(0,0,0,0.28)",
              width: "min(420px, 92vw)",
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #e0e0e0",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#111" }}>
                Website Settings
              </span>
              <span
                onClick={() => setSettingsOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon path={mdiClose} size={18} color="#666" />
              </span>
            </div>
            <div style={{ padding: "16px 18px", fontSize: "13px", lineHeight: "1.7", color: "#333" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "10px" }}>
                Source for __Updated comparison
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                <input
                  type="radio"
                  name="updatedSource"
                  checked={settings.source === "header"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { source: "header", name: settings.source === "header" ? settings.name : "Last-Modified" };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>HTTP Header</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "14px" }}>
                <input
                  type="radio"
                  name="updatedSource"
                  checked={settings.source === "meta"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { source: "meta", name: settings.source === "meta" ? settings.name : "Last-Modified" };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Meta Tag</span>
              </label>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "6px" }}>
                {settings.source === "header" ? "Header Name" : "Meta Tag Name"}
              </div>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => {
                  const next: UpdatedSourceSettings = { ...settings, name: e.target.value };
                  setSettings(next);
                  settingsRef.current = next;
                  saveSettings(next, appContext);
                }}
                style={{
                  width: "100%",
                  fontSize: "12px",
                  padding: "6px 10px",
                  border: "1px solid #d0d0d0",
                  borderRadius: "4px",
                  color: "#222",
                  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#90caf9"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#d0d0d0"; }}
              />
              <div style={{ fontSize: "11px", color: "#aaa", marginTop: "6px" }}>
                {settings.source === "header"
                  ? "The HTTP response header to extract the updated timestamp from."
                  : "The <meta> tag name attribute to extract the updated timestamp from."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
