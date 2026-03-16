"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "./Icon";
import { mdiClose } from "@mdi/js";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { getClientRateLimiter } from "../utils/rateLimit";

type DeliveryEndpoint = "xmc.preview.graphql" | "xmc.live.graphql";

export interface DeliveryItemNode {
  itemId: string;
  name: string;
  path: string;
}

export interface DeliveryItemDetailModalProps {
  node: DeliveryItemNode;
  client: ClientSDK;
  appContext: ApplicationContext;
  endpoint: DeliveryEndpoint;
  language: string;
  onClose: () => void;
}

type ActiveTab = "structured" | "raw" | "layout";

interface DeliveryItemField {
  name: string;
  value: string;
}

interface DeliveryItemDetail {
  id: string;
  name: string;
  path: string;
  url?: { hostName?: string; path?: string; scheme?: string; siteName?: string; url?: string };
  template?: { id?: string; name?: string };
  fields?: DeliveryItemField[];
  version?: string;
  personalization?: { variantIds?: string[] };
  children?: { total?: number; results?: Array<{ id: string; name: string; path: string }> };
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "var(--spacing-1-5) var(--spacing-2-5)",
          fontWeight: "var(--font-weight-semibold)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-muted-foreground)",
          whiteSpace: "nowrap",
          verticalAlign: "top",
          width: "140px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "var(--spacing-1-5) var(--spacing-2-5)",
          fontSize: "var(--font-size-xs)",
          color: "var(--color-foreground)",
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function FieldsTable({ fields }: { fields: DeliveryItemField[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid var(--color-border)", fontSize: "var(--font-size-xs)" }}>
      <thead>
        <tr style={{ backgroundColor: "var(--color-muted)" }}>
          <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)", width: "220px" }}>
            Field Name
          </th>
          <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)" }}>
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field, i) => (
          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "var(--color-background)" : "var(--color-muted)" }}>
            <td
              style={{
                padding: "var(--spacing-1-5) var(--spacing-2-5)",
                verticalAlign: "top",
                fontWeight: "var(--font-weight-semibold)",
                color: field.name.startsWith("__") ? "hsl(215.4, 16.3%, 56.9%)" : "var(--color-foreground)",
                fontStyle: field.name.startsWith("__") ? "italic" : "normal",
                borderBottom: "1px solid var(--color-border)",
                wordBreak: "break-word",
              }}
            >
              {field.name}
            </td>
            <td
              style={{
                padding: "var(--spacing-1-5) var(--spacing-2-5)",
                verticalAlign: "top",
                color: field.name.startsWith("__") ? "var(--color-muted-foreground)" : "var(--color-foreground)",
                borderBottom: "1px solid var(--color-border)",
                wordBreak: "break-all",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-2xs)",
              }}
            >
              {field.value || <span style={{ color: "hsl(214.3, 31.8%, 75%)", fontStyle: "italic" }}>empty</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function JsonBlock({ data }: { data: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: "var(--spacing-5)",
        fontSize: "var(--font-size-xs)",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "var(--font-mono)",
        color: "var(--color-foreground)",
      }}
    >
      {data}
    </pre>
  );
}

export function DeliveryItemDetailModal({
  node,
  client,
  appContext,
  endpoint,
  language,
  onClose,
}: DeliveryItemDetailModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("structured");

  const [itemLoading, setItemLoading] = useState(true);
  const [itemRaw, setItemRaw] = useState<string | null>(null);
  const [itemDetail, setItemDetail] = useState<DeliveryItemDetail | null>(null);

  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutRaw, setLayoutRaw] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const layoutSitesFetchedRef = useRef(false);
  const [layoutSitesLoading, setLayoutSitesLoading] = useState(false);
  const [layoutSites, setLayoutSites] = useState<Array<{ name: string; rootPath: string }>>([]);
  const [layoutSite, setLayoutSite] = useState("");
  const [layoutLanguage, setLayoutLanguage] = useState(() => {
    let key = "contentTree_language";
    if (appContext?.id && appContext?.installationId) {
      const appIdSegment = appContext.id.split('-')[0];
      const installationIdSegment = appContext.installationId.split('-')[0];
      key = `contentTree_language_${appIdSegment}_${installationIdSegment}`;
    }
    try { return localStorage.getItem(key) || "en"; } catch { return "en"; }
  });

  const getSitecoreContextId = useCallback(() => {
    const resourceAccess = appContext.resourceAccess as
      | Array<{ context?: { preview?: string; live?: string } }>
      | undefined;
    const context = resourceAccess?.[0]?.context;
    return endpoint === "xmc.live.graphql" ? context?.live : context?.preview;
  }, [appContext, endpoint]);

  useEffect(() => {
    let cancelled = false;
    setItemLoading(true);
    setItemRaw(null);
    setItemDetail(null);

    async function fetchDetail() {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        if (!cancelled) {
          setItemRaw(null);
          setItemLoading(false);
        }
        return;
      }

      const graphqlQuery = {
        query: `
          query {
            item(path: "${node.path}", language: "${language}") {
              id
              name
              path
              url {
                hostName
                path
                scheme
                siteName
                url
              }
              template {
                id
                name
              }
              fields {
                name
                value
              }
              version
              personalization {
                variantIds
              }
              children {
                total
                results {
                  id
                  name
                  path
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
        if (cancelled) return;

        const data = (response as { data?: { data?: unknown } })?.data?.data;
        const raw = JSON.stringify(data, null, 2);
        setItemRaw(raw);

        const parsed = (data as { item?: DeliveryItemDetail })?.item ?? null;
        setItemDetail(parsed);
      } catch {
        if (!cancelled) {
          setItemRaw(null);
        }
      } finally {
        if (!cancelled) setItemLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [node.path, client, endpoint, language, getSitecoreContextId]);

  useEffect(() => {
    if (activeTab !== "layout" || layoutSitesFetchedRef.current) return;

    let cancelled = false;
    layoutSitesFetchedRef.current = true;
    setLayoutSitesLoading(true);

    async function fetchSites() {
      const sitecoreContextId = getSitecoreContextId();
      if (!sitecoreContextId) {
        if (!cancelled) setLayoutSitesLoading(false);
        return;
      }

      try {
        // Apply rate limiting
        const rateLimiter = getClientRateLimiter();
        await rateLimiter.acquire();

        const response = await client.mutate(endpoint, {
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
                      total
                    }
                  }
                }
              `,
            },
          },
        });
        if (cancelled) return;
        const data = (response as { data?: { data?: { site?: { allSiteInfo?: { results?: Array<{ name: string; rootPath: string }> } } } } })?.data?.data;
        const results = data?.site?.allSiteInfo?.results ?? [];
        setLayoutSites(results);

        const itemPathLower = node.path.toLowerCase();
        const matched = results.find((s) => s.rootPath && itemPathLower.startsWith(s.rootPath.toLowerCase()));
        setLayoutSite(matched?.name ?? results[0]?.name ?? "");
      } catch {
        // silently fail — user can still type the site name manually
      } finally {
        if (!cancelled) setLayoutSitesLoading(false);
      }
    }

    fetchSites();
    return () => { cancelled = true; };
  }, [activeTab, client, endpoint, getSitecoreContextId, node.path]);

  const runLayoutQuery = useCallback(async () => {
    const sitecoreContextId = getSitecoreContextId();
    if (!sitecoreContextId) {
      setLayoutError("No Sitecore context ID available");
      return;
    }

    setLayoutLoading(true);
    setLayoutRaw(null);
    setLayoutError(null);

    try {
      let routePath = itemDetail?.url?.path || "/";
      if (routePath.startsWith(`/${layoutLanguage}`)) {
        routePath = routePath.substring(layoutLanguage.length + 1);
      }

      // Apply rate limiting
      const rateLimiter = getClientRateLimiter();
      await rateLimiter.acquire();

      const response = await client.mutate(endpoint, {
        params: {
          query: { sitecoreContextId },
          body: {
            query: `
              query {
                layout(site: "${layoutSite}", routePath: "${routePath}", language: "${layoutLanguage}") {
                  item {
                    rendered
                  }
                }
              }
            `,
          },
        },
      });
      const data = (response as { data?: { data?: unknown } })?.data?.data;
      setLayoutRaw(JSON.stringify(data, null, 2));
    } catch (err) {
      setLayoutError(String(err));
    } finally {
      setLayoutLoading(false);
    }
  }, [client, endpoint, getSitecoreContextId, layoutSite, layoutLanguage, itemDetail]);

  const contentFields = itemDetail?.fields?.filter((f) => !f.name.startsWith("__")) ?? [];
  const systemFields = itemDetail?.fields?.filter((f) => f.name.startsWith("__")) ?? [];

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "var(--spacing-1-5) var(--spacing-3-5)",
    fontSize: "var(--font-size-xs)",
    fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
    color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
    cursor: "pointer",
    userSelect: "none",
    background: "none",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: active ? "var(--color-primary)" : "transparent",
  });


  return (
    <div
      onClick={onClose}
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
          width: "min(1300px, 96vw)",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-body)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "var(--spacing-5)",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-0-5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Delivery API — {endpoint === "xmc.live.graphql" ? "Live" : "Preview"}
            </div>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-lg)", color: "var(--color-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.path}
            </div>
          </div>
          <span
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: "var(--spacing-3)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Icon path={mdiClose} size={18} color="hsl(215.4, 16.3%, 46.9%)" />
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "var(--spacing-1)", padding: "0 var(--spacing-4-5)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
          <button style={tabStyle(activeTab === "structured")} onClick={() => setActiveTab("structured")}>
            Structured View
          </button>
          <button style={tabStyle(activeTab === "raw")} onClick={() => setActiveTab("raw")}>
            Raw JSON
          </button>
          <button style={tabStyle(activeTab === "layout")} onClick={() => setActiveTab("layout")}>
            Layout
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: itemLoading && activeTab !== "layout" ? "var(--spacing-5)" : "0" }}>

          {/* Structured View */}
          {activeTab === "structured" && (
            <>
              {itemLoading && (
                <div style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Fetching item data…</div>
              )}
              {!itemLoading && !itemRaw && (
                <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Failed to fetch item data.</div>
              )}
              {!itemLoading && itemRaw && !itemDetail && (
                <JsonBlock data={itemRaw} />
              )}
              {!itemLoading && itemDetail && (
                <div style={{ padding: "var(--spacing-5)", display: "flex", flexDirection: "column", gap: "var(--spacing-5)" }}>
                  <section>
                    <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2)" }}>
                      Item Properties
                    </div>
                    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                      <tbody>
                        <MetaRow label="ID" value={itemDetail.id} />
                        <MetaRow label="Name" value={itemDetail.name} />
                        <MetaRow label="Path" value={itemDetail.path} />
                        {itemDetail.url?.url && <MetaRow label="URL.URL" value={itemDetail.url.url} />}
                        {itemDetail.url?.path && <MetaRow label="URL.Path" value={itemDetail.url.path} />}
                        {itemDetail.url?.hostName && <MetaRow label="URL.HostName" value={itemDetail.url.hostName} />}
                        {itemDetail.url?.scheme && <MetaRow label="URL.Scheme" value={itemDetail.url.scheme} />}
                        {itemDetail.url?.siteName && <MetaRow label="URL.SiteName" value={itemDetail.url.siteName} />}
                        {itemDetail.template?.name && <MetaRow label="Template.Name" value={itemDetail.template.name} />}
                        {itemDetail.template?.id && <MetaRow label="Template.ID" value={itemDetail.template.id} />}
                        {itemDetail.version != null && <MetaRow label="Version" value={String(itemDetail.version)} />}
                        {itemDetail.personalization?.variantIds != null && (
                          <MetaRow label="Personalization" value={itemDetail.personalization.variantIds.join(", ") || "—"} />
                        )}
                        {itemDetail.children?.total != null && (
                          <MetaRow label="Children" value={String(itemDetail.children.total)} />
                        )}
                      </tbody>
                    </table>
                  </section>

                  {contentFields.length > 0 && (
                    <section>
                      <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2)" }}>
                        Content Fields ({contentFields.length})
                      </div>
                      <FieldsTable fields={contentFields} />
                    </section>
                  )}

                  {systemFields.length > 0 && (
                    <section>
                      <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2)" }}>
                        System Fields ({systemFields.length})
                      </div>
                      <FieldsTable fields={systemFields} />
                    </section>
                  )}

                  {(itemDetail.children?.results?.length ?? 0) > 0 && (
                    <section>
                      <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2)" }}>
                        Children ({itemDetail.children!.results!.length})
                      </div>
                      <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid var(--color-border)", fontSize: "var(--font-size-xs)" }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--color-muted)" }}>
                            <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)", width: "180px" }}>Name</th>
                            <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)" }}>Path</th>
                            <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)", width: "290px" }}>ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemDetail.children!.results!.map((child, i) => (
                            <tr key={child.id} style={{ backgroundColor: i % 2 === 0 ? "var(--color-background)" : "var(--color-muted)" }}>
                              <td style={{ padding: "var(--spacing-1-5) var(--spacing-2-5)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-foreground)", borderBottom: "1px solid var(--color-border)", wordBreak: "break-word" }}>{child.name}</td>
                              <td style={{ padding: "var(--spacing-1-5) var(--spacing-2-5)", fontFamily: "var(--font-mono)", fontSize: "var(--font-size-2xs)", color: "hsl(215.4, 16.3%, 40%)", borderBottom: "1px solid var(--color-border)", wordBreak: "break-all" }}>{child.path}</td>
                              <td style={{ padding: "var(--spacing-1-5) var(--spacing-2-5)", fontFamily: "var(--font-mono)", fontSize: "var(--font-size-2xs)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)" }}>{child.id}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </div>
              )}
            </>
          )}

          {/* Raw JSON */}
          {activeTab === "raw" && (
            <>
              {itemLoading && (
                <div style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Fetching item data…</div>
              )}
              {!itemLoading && !itemRaw && (
                <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Failed to fetch item data.</div>
              )}
              {!itemLoading && itemRaw && (
                <JsonBlock data={itemRaw} />
              )}
            </>
          )}

          {/* Layout Tab */}
          {activeTab === "layout" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* Controls bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-2-5)",
                  padding: "var(--spacing-5)",
                  borderBottom: "1px solid var(--color-border)",
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
                  <label style={{ fontSize: "var(--font-size-3xs)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Site
                  </label>
                  {layoutSitesLoading ? (
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", height: "28px", display: "flex", alignItems: "center" }}>Loading sites…</div>
                  ) : layoutSites.length > 0 ? (
                    <select
                      value={layoutSite}
                      onChange={(e) => setLayoutSite(e.target.value)}
                      style={{
                        fontSize: "var(--font-size-xs)",
                        padding: "var(--spacing-1) var(--spacing-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-base)",
                        color: "var(--color-foreground)",
                        backgroundColor: "var(--color-background)",
                        height: "28px",
                        minWidth: "160px",
                        cursor: "pointer",
                      }}
                    >
                      {layoutSites.map((s) => (
                        <option key={s.name} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={layoutSite}
                      onChange={(e) => setLayoutSite(e.target.value)}
                      placeholder="e.g. experienceedge"
                      style={{
                        fontSize: "var(--font-size-xs)",
                        padding: "var(--spacing-1) var(--spacing-2)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-base)",
                        color: "var(--color-foreground)",
                        height: "28px",
                        minWidth: "160px",
                      }}
                    />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
                  <label style={{ fontSize: "var(--font-size-3xs)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Language
                  </label>
                  <input
                    type="text"
                    value={layoutLanguage}
                    onChange={(e) => setLayoutLanguage(e.target.value)}
                    disabled={true}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      padding: "0 var(--spacing-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-base)",
                      color: "hsl(214.3, 31.8%, 75%)",
                      height: "26px",
                      width: "80px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-1)" }}>
                  <label style={{ fontSize: "var(--font-size-3xs)", color: "transparent", userSelect: "none" }}>_</label>
                  <button
                    onClick={runLayoutQuery}
                    disabled={layoutLoading || !layoutSite}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: "var(--font-weight-semibold)",
                      padding: "0 var(--spacing-4)",
                      height: "28px",
                      border: "none",
                      borderRadius: "var(--radius-base)",
                      backgroundColor: layoutLoading || !layoutSite ? "hsl(221.2, 83.2%, 73.3%)" : "var(--color-info)",
                      color: "var(--color-info-foreground)",
                      cursor: layoutLoading || !layoutSite ? "not-allowed" : "pointer",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!layoutLoading && layoutSite) e.currentTarget.style.backgroundColor = "hsl(221.2, 83.2%, 48.3%)"; }}
                    onMouseLeave={(e) => { if (!layoutLoading && layoutSite) e.currentTarget.style.backgroundColor = "var(--color-info)"; }}
                  >
                    {layoutLoading ? "Running…" : "Execute"}
                  </button>
                </div>
              </div>

              {/* Result area */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {!layoutLoading && !layoutRaw && !layoutError && (
                  <div style={{ color: "hsl(214.3, 31.8%, 75%)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>
                    Select a site and click Execute to fetch layout data.
                  </div>
                )}
                {layoutLoading && (
                  <div style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Fetching layout data…</div>
                )}
                {!layoutLoading && layoutError && (
                  <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>{layoutError}</div>
                )}
                {!layoutLoading && layoutRaw && (
                  <JsonBlock data={layoutRaw} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
