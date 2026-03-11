"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Icon } from "./Icon";
import { mdiClose } from "@mdi/js";
import type { ClientSDK, ApplicationContext } from "@sitecore-marketplace-sdk/client";

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
          padding: "6px 10px",
          fontWeight: 600,
          fontSize: "12px",
          color: "#555",
          whiteSpace: "nowrap",
          verticalAlign: "top",
          width: "140px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {label}
      </td>
      <td
        style={{
          padding: "6px 10px",
          fontSize: "12px",
          color: "#222",
          wordBreak: "break-all",
          fontFamily: '"SF Mono", "Cascadia Code", Menlo, Consolas, monospace',
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function FieldsTable({ fields }: { fields: DeliveryItemField[] }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e8e8e8", fontSize: "12px" }}>
      <thead>
        <tr style={{ backgroundColor: "#f7f8fa" }}>
          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "1px solid #e0e0e0", width: "220px" }}>
            Field Name
          </th>
          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "1px solid #e0e0e0" }}>
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field, i) => (
          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
            <td
              style={{
                padding: "6px 10px",
                verticalAlign: "top",
                fontWeight: 600,
                color: field.name.startsWith("__") ? "#999" : "#333",
                fontStyle: field.name.startsWith("__") ? "italic" : "normal",
                borderBottom: "1px solid #f0f0f0",
                wordBreak: "break-word",
              }}
            >
              {field.name}
            </td>
            <td
              style={{
                padding: "6px 10px",
                verticalAlign: "top",
                color: field.name.startsWith("__") ? "#888" : "#222",
                borderBottom: "1px solid #f0f0f0",
                wordBreak: "break-all",
                fontFamily: '"SF Mono", Menlo, Consolas, monospace',
                fontSize: "11px",
              }}
            >
              {field.value || <span style={{ color: "#bbb", fontStyle: "italic" }}>empty</span>}
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
        padding: "16px 18px",
        fontSize: "12px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace',
        color: "#333",
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
      } catch (err) {
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
  }, [activeTab, client, endpoint, getSitecoreContextId]);

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
      const routePath = itemDetail?.url?.path || "/";

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
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    color: active ? "#1976d2" : "#666",
    cursor: "pointer",
    userSelect: "none",
    background: "none",
    border: "none",
    borderBottomWidth: "2px",
    borderBottomStyle: "solid",
    borderBottomColor: active ? "#1976d2" : "transparent",
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
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 12px 48px rgba(0,0,0,0.28)",
          width: "min(1300px, 96vw)",
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "14px 18px 10px",
            borderBottom: "1px solid #e0e0e0",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "11px", color: "#999", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Delivery API — {endpoint === "xmc.live.graphql" ? "Live" : "Preview"}
            </div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              borderRadius: "6px",
              cursor: "pointer",
              flexShrink: 0,
              marginLeft: "12px",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f0f0f0"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Icon path={mdiClose} size={18} color="#666" />
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "0 18px", borderBottom: "1px solid #e8e8e8", flexShrink: 0 }}>
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
        <div style={{ flex: 1, overflow: "auto", padding: itemLoading && activeTab !== "layout" ? "16px 18px" : "0" }}>

          {/* Structured View */}
          {activeTab === "structured" && (
            <>
              {itemLoading && (
                <div style={{ color: "#999", fontSize: "13px", padding: "16px 18px" }}>Fetching item data…</div>
              )}
              {!itemLoading && !itemRaw && (
                <div style={{ color: "#e57373", fontSize: "13px", padding: "16px 18px" }}>Failed to fetch item data.</div>
              )}
              {!itemLoading && itemRaw && !itemDetail && (
                <JsonBlock data={itemRaw} />
              )}
              {!itemLoading && itemDetail && (
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  <section>
                    <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                      Item Properties
                    </div>
                    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e8e8e8", borderRadius: "6px", overflow: "hidden" }}>
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
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                        Content Fields ({contentFields.length})
                      </div>
                      <FieldsTable fields={contentFields} />
                    </section>
                  )}

                  {systemFields.length > 0 && (
                    <section>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                        System Fields ({systemFields.length})
                      </div>
                      <FieldsTable fields={systemFields} />
                    </section>
                  )}

                  {(itemDetail.children?.results?.length ?? 0) > 0 && (
                    <section>
                      <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                        Children ({itemDetail.children!.results!.length})
                      </div>
                      <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e8e8e8", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f7f8fa" }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "1px solid #e0e0e0", width: "180px" }}>Name</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "1px solid #e0e0e0" }}>Path</th>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 600, color: "#555", borderBottom: "1px solid #e0e0e0", width: "290px" }}>ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemDetail.children!.results!.map((child, i) => (
                            <tr key={child.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                              <td style={{ padding: "6px 10px", fontWeight: 600, color: "#333", borderBottom: "1px solid #f0f0f0", wordBreak: "break-word" }}>{child.name}</td>
                              <td style={{ padding: "6px 10px", fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: "11px", color: "#555", borderBottom: "1px solid #f0f0f0", wordBreak: "break-all" }}>{child.path}</td>
                              <td style={{ padding: "6px 10px", fontFamily: '"SF Mono", Menlo, Consolas, monospace', fontSize: "11px", color: "#888", borderBottom: "1px solid #f0f0f0" }}>{child.id}</td>
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
                <div style={{ color: "#999", fontSize: "13px", padding: "16px 18px" }}>Fetching item data…</div>
              )}
              {!itemLoading && !itemRaw && (
                <div style={{ color: "#e57373", fontSize: "13px", padding: "16px 18px" }}>Failed to fetch item data.</div>
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
                  gap: "10px",
                  padding: "10px 18px",
                  borderBottom: "1px solid #e8e8e8",
                  flexShrink: 0,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Site
                  </label>
                  {layoutSitesLoading ? (
                    <div style={{ fontSize: "12px", color: "#999", height: "28px", display: "flex", alignItems: "center" }}>Loading sites…</div>
                  ) : layoutSites.length > 0 ? (
                    <select
                      value={layoutSite}
                      onChange={(e) => setLayoutSite(e.target.value)}
                      style={{
                        fontSize: "12px",
                        padding: "4px 8px",
                        border: "1px solid #d0d0d0",
                        borderRadius: "4px",
                        color: "#222",
                        backgroundColor: "#fff",
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
                        fontSize: "12px",
                        padding: "4px 8px",
                        border: "1px solid #d0d0d0",
                        borderRadius: "4px",
                        color: "#222",
                        height: "28px",
                        minWidth: "160px",
                      }}
                    />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    Language
                  </label>
                  <input
                    type="text"
                    value={layoutLanguage}
                    onChange={(e) => setLayoutLanguage(e.target.value)}
                    style={{
                      fontSize: "12px",
                      padding: "0px 8px",
                      border: "1px solid #d0d0d0",
                      borderRadius: "4px",
                      color: "#222",
                      height: "26px",
                      width: "80px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <label style={{ fontSize: "11px", color: "transparent", userSelect: "none" }}>_</label>
                  <button
                    onClick={runLayoutQuery}
                    disabled={layoutLoading || !layoutSite}
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "0 16px",
                      height: "28px",
                      border: "none",
                      borderRadius: "4px",
                      backgroundColor: layoutLoading || !layoutSite ? "#c5d8f7" : "#1976d2",
                      color: "#fff",
                      cursor: layoutLoading || !layoutSite ? "not-allowed" : "pointer",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!layoutLoading && layoutSite) e.currentTarget.style.backgroundColor = "#1565c0"; }}
                    onMouseLeave={(e) => { if (!layoutLoading && layoutSite) e.currentTarget.style.backgroundColor = "#1976d2"; }}
                  >
                    {layoutLoading ? "Running…" : "Execute"}
                  </button>
                </div>
              </div>

              {/* Result area */}
              <div style={{ flex: 1, overflow: "auto" }}>
                {!layoutLoading && !layoutRaw && !layoutError && (
                  <div style={{ color: "#bbb", fontSize: "13px", padding: "24px 18px" }}>
                    Select a site and click Execute to fetch layout data.
                  </div>
                )}
                {layoutLoading && (
                  <div style={{ color: "#999", fontSize: "13px", padding: "16px 18px" }}>Fetching layout data…</div>
                )}
                {!layoutLoading && layoutError && (
                  <div style={{ color: "#e57373", fontSize: "13px", padding: "16px 18px" }}>{layoutError}</div>
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
