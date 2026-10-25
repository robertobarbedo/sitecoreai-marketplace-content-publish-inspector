"use client";

import React, { useState, useMemo } from "react";
import { Icon } from "./Icon";
import { mdiClose } from "@mdi/js";
import type { TreeNode } from "./ContentTree";

export type ParsedItemField = { name: string; fieldId?: string; value: string };
export type ParsedItem = {
  itemId: string;
  name: string;
  path: string;
  hasChildren: boolean;
  hasPresentation?: boolean;
  template?: { name: string };
  language?: { name: string };
  version?: number;
  workflow?: {
    workflowState: {
      final: boolean;
      displayName: string;
    };
  };
  fields?: { nodes: ParsedItemField[] };
};

function MetaRow({ label, value }: { label: string; value: string | boolean }) {
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
        {String(value)}
      </td>
    </tr>
  );
}

function FieldsTable({ fields, dim }: { fields: ParsedItemField[]; dim?: boolean }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid var(--color-border)", fontSize: "var(--font-size-xs)" }}>
      <thead>
        <tr style={{ backgroundColor: "var(--color-muted)" }}>
          <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)", width: "180px" }}>
            Field Name
          </th>
          <th style={{ padding: "var(--spacing-2) var(--spacing-2-5)", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "var(--color-muted-foreground)", borderBottom: "1px solid var(--color-border)", width: "290px" }}>
            Field ID
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
                color: dim ? "hsl(215.4, 16.3%, 56.9%)" : "var(--color-foreground)",
                fontStyle: dim ? "italic" : "normal",
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
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-2xs)",
                color: dim ? "hsl(214.3, 31.8%, 75%)" : "var(--color-muted-foreground)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {field.fieldId ?? "—"}
            </td>
            <td
              style={{
                padding: "var(--spacing-1-5) var(--spacing-2-5)",
                verticalAlign: "top",
                color: dim ? "hsl(215.4, 16.3%, 40%)" : "var(--color-foreground)",
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

export interface ItemDetailModalProps {
  node: TreeNode;
  rawData: string | null;
  queryData: string | null;
  loading: boolean;
  onClose: () => void;
}

export function ItemDetailModal({ node, rawData, queryData, loading, onClose }: ItemDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"structured" | "raw" | "query">("structured");

  const parsedItem = useMemo<ParsedItem | null>(() => {
    if (!rawData) return null;
    try {
      const parsed = JSON.parse(rawData);
      return (parsed as { item?: ParsedItem })?.item ?? null;
    } catch {
      return null;
    }
  }, [rawData]);

  const contentFields = parsedItem?.fields?.nodes?.filter((f) => !f.name.startsWith("__")) ?? [];
  const systemFields = parsedItem?.fields?.nodes?.filter((f) => f.name.startsWith("__")) ?? [];

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
              Item Details
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
        {!loading && parsedItem && (
          <div style={{ display: "flex", gap: "var(--spacing-1)", padding: "0 var(--spacing-4-5)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
            <button style={tabStyle(activeTab === "structured")} onClick={() => setActiveTab("structured")}>
              Structured View
            </button>
            <button style={tabStyle(activeTab === "raw")} onClick={() => setActiveTab("raw")}>
              Raw JSON
            </button>
            <button style={tabStyle(activeTab === "query")} onClick={() => setActiveTab("query")}>
              Query
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: loading ? "var(--spacing-5)" : "0" }}>
          {loading && (
            <div style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-sm)" }}>Fetching item data…</div>
          )}

          {!loading && !rawData && (
            <div style={{ color: "var(--color-danger)", fontSize: "var(--font-size-sm)", padding: "var(--spacing-5)" }}>Failed to fetch item data.</div>
          )}

          {!loading && (rawData && !parsedItem) && (
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
              {rawData}
            </pre>
          )}

          {!loading && parsedItem && activeTab === "structured" && (
            <div style={{ padding: "var(--spacing-5)", display: "flex", flexDirection: "column", gap: "var(--spacing-5)" }}>
              <section>
                <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted-foreground)", marginBottom: "var(--spacing-2)" }}>
                  Item Properties
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                  <tbody>
                    <MetaRow label="Item ID" value={parsedItem.itemId} />
                    <MetaRow label="Name" value={parsedItem.name} />
                    <MetaRow label="Path" value={parsedItem.path} />
                    <MetaRow label="Template Name" value={parsedItem.template?.name ?? "—"} />
                    <MetaRow label="Language" value={parsedItem.language?.name ?? "—"} />
                    <MetaRow label="Version" value={parsedItem.version != null ? String(parsedItem.version) : "—"} />
                    <MetaRow label="Has Children" value={parsedItem.hasChildren} />
                    <MetaRow label="Has Presentation" value={parsedItem.hasPresentation ?? false} />
                    <MetaRow label="Workflow Is Final" value={parsedItem.workflow?.workflowState?.final ?? false} />
                    <MetaRow label="Workflow State" value={parsedItem.workflow?.workflowState?.displayName ?? "—"} />
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
                  <FieldsTable fields={systemFields} dim />
                </section>
              )}
            </div>
          )}

          {!loading && parsedItem && activeTab === "raw" && (
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
              {rawData}
            </pre>
          )}

          {!loading && parsedItem && activeTab === "query" && (
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
              {queryData ?? "No query data available."}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
