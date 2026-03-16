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
import { getClientRateLimiter, configureClientRateLimit } from "../utils/rateLimit";
import { useAppConfig } from "../utils/hooks/useAppConfig";

const getSettingsKey = (appContext?: ApplicationContext) => {
  if (!appContext?.id || !appContext?.installationId) return "websiteTree_updatedSource";
  const appIdSegment = appContext.id.split('-')[0];
  const installationIdSegment = appContext.installationId.split('-')[0];
  return `websiteTree_updatedSource_${appIdSegment}_${installationIdSegment}`;
};

interface UpdatedSourceSettings {
  source: "header" | "meta";
  name: string;
  trailingSlash: "as-is" | "add" | "remove";
  followRedirectHomepage: boolean;
  followRedirectOtherPages: boolean;
}

const DEFAULT_SETTINGS: UpdatedSourceSettings = { 
  source: "meta", 
  name: "Last-Modified",
  trailingSlash: "as-is",
  followRedirectHomepage: true,
  followRedirectOtherPages: false
};

function loadSettings(appContext?: ApplicationContext): UpdatedSourceSettings {
  try {
    const raw = localStorage.getItem(getSettingsKey(appContext));
    if (raw) {
      const parsed = JSON.parse(raw);
      if ((parsed.source === "header" || parsed.source === "meta") && typeof parsed.name === "string") {
        return {
          source: parsed.source,
          name: parsed.name,
          trailingSlash: parsed.trailingSlash === "add" || parsed.trailingSlash === "remove" 
            ? parsed.trailingSlash 
            : "as-is",
          followRedirectHomepage: typeof parsed.followRedirectHomepage === "boolean" 
            ? parsed.followRedirectHomepage 
            : true,
          followRedirectOtherPages: typeof parsed.followRedirectOtherPages === "boolean" 
            ? parsed.followRedirectOtherPages 
            : false
        };
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

function applyTrailingSlash(url: string, setting: "as-is" | "add" | "remove"): string {
  if (setting === "as-is") return url;
  
  try {
    const urlObj = new URL(url);
    const hasTrailingSlash = urlObj.pathname.endsWith('/');
    const hasExtension = /\.[^/.]+$/.test(urlObj.pathname);
    
    if (hasExtension) {
      return url;
    }
    
    if (setting === "add" && !hasTrailingSlash) {
      urlObj.pathname += '/';
      return urlObj.toString();
    }
    
    if (setting === "remove" && hasTrailingSlash && urlObj.pathname !== '/') {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
      return urlObj.toString();
    }
    
    return url;
  } catch {
    return url;
  }
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
  | "http-redirect"
  | "http-error"
  | "no-meta"
  | "all-same"
  | "outdated-preview"
  | "outdated-live";

const COLOR_ERROR = "hsl(346.8, 77.2%, 49.8%)"; // var(--color-danger)
const COLOR_REDIRECT = "hsl(215.4, 16.3%, 46.9%)"; // var(--color-muted-foreground)
const COLOR_OUTDATED_PREVIEW = "hsl(32.1, 98%, 53.9%)"; // var(--color-warning)
const COLOR_OUTDATED_LIVE = "hsl(14, 100%, 50%)"; // darker warning/error

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

  if (fetchResult.httpStatus >= 300 && fetchResult.httpStatus < 400) {
    return {
      state: "http-redirect",
      httpStatus: fetchResult.httpStatus,
      url,
    };
  }

  if (fetchResult.httpStatus < 200 || fetchResult.httpStatus >= 400) {
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
      case "http-redirect":
        return COLOR_REDIRECT;
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
        return <Icon path={mdiFileOutline} size={16} color="hsl(214.3, 31.8%, 85%)" />;
      case "loading":
        return <Icon path={mdiAutorenew} size={16} color="hsl(215.4, 16.3%, 46.9%)" spin />;
      case "http-redirect":
        return (
          <Icon path={mdiWeb} size={16} color={COLOR_REDIRECT} />
        );
      case "http-error":
        return (
          <Icon path={mdiAlertCircleOutline} size={16} color={COLOR_ERROR} />
        );
      case "no-meta":
      case "all-same":
        return <Icon path={mdiWeb} size={16} color="hsl(215.4, 16.3%, 46.9%)" />;
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
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginLeft: "var(--spacing-1)" }}>
            loading…
          </span>
        );
      case "http-redirect":
      case "http-error":
        return null;
      case "no-meta":
        return (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "hsl(214.3, 31.8%, 75%)", marginLeft: "var(--spacing-1)" }}>
            &nbsp;
          </span>
        );
      case "all-same":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginLeft: "var(--spacing-1-5)", flexShrink: 0 }}>
            {formatUpdated(display.websiteUpdated)}
          </span>
        ) : null;
      case "outdated-preview":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "var(--font-size-2xs)", color: COLOR_OUTDATED_PREVIEW, marginLeft: "var(--spacing-1-5)", flexShrink: 0 }}>
            {formatUpdated(display.websiteUpdated)}
          </span>
        ) : null;
      case "outdated-live":
        return display.websiteUpdated ? (
          <span style={{ fontSize: "var(--font-size-2xs)", color: COLOR_OUTDATED_LIVE, marginLeft: "var(--spacing-1-5)", flexShrink: 0 }}>
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
          e.currentTarget.style.backgroundColor = "var(--color-accent)";
          onHoverChange?.(lineIndex);
        }}
        onMouseLeave={(e) => {
          setLocalHovered(false);
          e.currentTarget.style.backgroundColor = isHovered
            ? "var(--color-accent)"
            : "transparent";
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
          opacity: isNotInSite ? 0.45 : 1,
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
        {(display.state === "http-redirect" || display.state === "http-error") && display.httpStatus && (
          <span
            style={{
              marginLeft: "var(--spacing-1-5)",
              padding: "var(--spacing-0-5) var(--spacing-2)",
              fontSize: "var(--font-size-2xs)",
              fontWeight: "var(--font-weight-semibold)",
              backgroundColor: display.state === "http-error" 
                ? "hsl(346.8, 77.2%, 95%)" 
                : "hsl(210, 40%, 96.1%)",
              border: display.state === "http-error"
                ? "1px solid hsl(346.8, 77.2%, 85%)"
                : "1px solid hsl(214.3, 31.8%, 91.4%)",
              color: display.state === "http-error" 
                ? "var(--color-danger)" 
                : "hsl(215.4, 16.3%, 46.9%)",
              borderRadius: "var(--radius-sm)",
              flexShrink: 0,
              lineHeight: "1.2",
              textTransform: "uppercase",
              letterSpacing: "0.025em",
            }}
          >
            {display.httpStatus}
          </span>
        )}
        {getAnnotation()}
        {localHovered && display.url && !isNotInSite && (
          <a
            href={display.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
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
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-background)";
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
  const config = useAppConfig();
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

  // Configure rate limiter when config changes
  useEffect(() => {
    configureClientRateLimit(config.rateLimit);
  }, [config.rateLimit]);

  useEffect(() => {
    const loaded = loadSettings(appContext);
    setSettings(loaded);
    settingsRef.current = loaded;
  }, [appContext, appContext.id, appContext.installationId]);

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
        // Apply rate limiting
        const rateLimiter = getClientRateLimiter();
        await rateLimiter.acquire();

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
          fetchPage(url, liveNode?.name || node.name);
        }
      }
      if (node.children) {
        for (const child of node.children) walk(child);
      }
    }

    async function fetchPage(url: string, pageName: string) {
      try {
        // Apply rate limiting for HTTP fetches
        const rateLimiter = getClientRateLimiter();
        await rateLimiter.acquire();

        const s = settingsRef.current;
        const adjustedUrl = applyTrailingSlash(url, s.trailingSlash);
        const isHomePage = pageName.toLowerCase() === "home" || pageName.toLowerCase() === "homepage";
        const followRedirect = isHomePage ? s.followRedirectHomepage : s.followRedirectOtherPages;
        const res = await fetch(
          `/api/fetch-page?url=${encodeURIComponent(adjustedUrl)}&source=${s.source}&name=${encodeURIComponent(s.name)}&followRedirect=${followRedirect}`
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
        <span>Website</span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-1)" }}>
          <span
            onClick={() => setSettingsOpen(true)}
            title="Configure __Updated source"
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
            <Icon path={mdiCogOutline} size={16} color="hsl(215.4, 16.3%, 53%)" />
          </span>
          {hasData && (
            <button
              onClick={handleRefresh}
              title="Re-fetch all pages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--spacing-1)",
                padding: "0 var(--spacing-2)",
                height: "24px",
                fontSize: "var(--font-size-2xs)",
                fontWeight: "var(--font-weight-semibold)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "transparent",
                color: "var(--color-foreground)",
                cursor: "pointer",
                textTransform: "none",
                letterSpacing: 0,
                transition: "background-color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--color-accent)";
                e.currentTarget.style.borderColor = "var(--color-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "var(--color-border)";
              }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: "var(--spacing-1) 0" }}>
        {sitesLoading && (
          <div
            style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}
          >
            Loading site information…
          </div>
        )}
        {!sitesLoading && sites.length === 0 && (
          <div
            style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}
          >
            No sites found.
          </div>
        )}
        {!authoringTree && sites.length > 0 && (
          <div
            style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}
          >
            Waiting for content tree…
          </div>
        )}
        {(!previewTree || !liveTree) && authoringTree && sites.length > 0 && (
          <div
            style={{ padding: "var(--spacing-2) var(--spacing-3)", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}
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
              backgroundColor: "var(--color-background)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.28)",
              width: "min(420px, 92vw)",
              maxHeight: "90vh",
              fontFamily: "var(--font-body)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--spacing-5)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <span style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-base)", color: "var(--color-foreground)" }}>
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
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <Icon path={mdiClose} size={18} color="hsl(215.4, 16.3%, 46.9%)" />
              </span>
            </div>
            <div style={{ padding: "var(--spacing-5)", fontSize: "var(--font-size-sm)", lineHeight: "1.7", color: "var(--color-foreground)", overflow: "auto" }}>
              <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2-5)" }}>
                Source for __Updated comparison
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", cursor: "pointer", marginBottom: "var(--spacing-2)" }}>
                <input
                  type="radio"
                  name="updatedSource"
                  checked={settings.source === "header"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { 
                      ...settings,
                      source: "header", 
                      name: settings.source === "header" ? settings.name : "Last-Modified" 
                    };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>HTTP Header</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", cursor: "pointer", marginBottom: "var(--spacing-3-5)" }}>
                <input
                  type="radio"
                  name="updatedSource"
                  checked={settings.source === "meta"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { 
                      ...settings,
                      source: "meta", 
                      name: settings.source === "meta" ? settings.name : "Last-Modified" 
                    };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Meta Tag</span>
              </label>
              <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-1-5)" }}>
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
                  fontSize: "var(--font-size-xs)",
                  padding: "var(--spacing-1-5) var(--spacing-2-5)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--color-foreground)",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-ring)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
              <div style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginTop: "var(--spacing-1-5)" }}>
                {settings.source === "header"
                  ? "The HTTP response header to extract the updated timestamp from."
                  : "The <meta> tag name attribute to extract the updated timestamp from."}
              </div>
              <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginTop: "var(--spacing-5)", marginBottom: "var(--spacing-2-5)" }}>
                Redirect Handling
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", cursor: "pointer", marginBottom: "var(--spacing-2)" }}>
                <input
                  type="checkbox"
                  checked={settings.followRedirectHomepage}
                  onChange={(e) => {
                    const next: UpdatedSourceSettings = { ...settings, followRedirectHomepage: e.target.checked };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Follow redirects for Homepage</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                <input
                  type="checkbox"
                  checked={settings.followRedirectOtherPages}
                  onChange={(e) => {
                    const next: UpdatedSourceSettings = { ...settings, followRedirectOtherPages: e.target.checked };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Follow redirects for other pages</span>
              </label>
              <div style={{ fontSize: "11px", color: "#aaa", marginTop: "6px" }}>
                When checked, redirects (3xx) are followed automatically. When unchecked, redirect status codes are shown. Applies to pages named &quot;Home&quot; or &quot;Homepage&quot; vs all other pages.
              </div>
              <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginTop: "20px", marginBottom: "10px" }}>
                Redirects Handling - Trailing Slash
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                <input
                  type="radio"
                  name="trailingSlash"
                  checked={settings.trailingSlash === "as-is"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { ...settings, trailingSlash: "as-is" };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Leave URL as is</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                <input
                  type="radio"
                  name="trailingSlash"
                  checked={settings.trailingSlash === "add"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { ...settings, trailingSlash: "add" };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Always add trailing slash to prevent redirects</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: "8px" }}>
                <input
                  type="radio"
                  name="trailingSlash"
                  checked={settings.trailingSlash === "remove"}
                  onChange={() => {
                    const next: UpdatedSourceSettings = { ...settings, trailingSlash: "remove" };
                    setSettings(next);
                    settingsRef.current = next;
                    saveSettings(next, appContext);
                  }}
                  style={{ margin: 0 }}
                />
                <span>Always remove trailing slash to prevent redirects</span>
              </label>
              <div style={{ fontSize: "11px", color: "#aaa", marginTop: "6px" }}>
                Controls whether URLs should have a trailing slash when fetching pages. Files with extensions are not modified.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
