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
          padding: "6px 10px",
          fontWeight: "var(--font-weight-semibold)",
          fontSize: "var(--font-size-xs)",
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
          fontSize: "var(--font-size-xs)",
          color: "#222",
          wordBreak: "break-all",
          fontFamily: "var(--font-mono)",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {String(value)}
      </td>
    </tr>
  );
}

function FieldsTable({ fields, dim }: { fields: ParsedItemField[]; dim?: boolean }) {
  return (
    <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e8e8e8", fontSize: "var(--font-size-xs)" }}>
      <thead>
        <tr style={{ backgroundColor: "#f7f8fa" }}>
          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "#555", borderBottom: "1px solid #e0e0e0", width: "180px" }}>
            Field Name
          </th>
          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "#555", borderBottom: "1px solid #e0e0e0", width: "290px" }}>
            Field ID
          </th>
          <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "var(--font-weight-semibold)", color: "#555", borderBottom: "1px solid #e0e0e0" }}>
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
                fontWeight: "var(--font-weight-semibold)",
                color: dim ? "#777" : "#333",
                fontStyle: dim ? "italic" : "normal",
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
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-2xs)",
                color: dim ? "#aaa" : "#888",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              {field.fieldId ?? "—"}
            </td>
            <td
              style={{
                padding: "6px 10px",
                verticalAlign: "top",
                color: dim ? "#555" : "#222",
                borderBottom: "1px solid #f0f0f0",
                wordBreak: "break-all",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--font-size-2xs)",
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

export interface ItemDetailModalProps {
  node: TreeNode;
  rawData: string | null;
  loading: boolean;
  onClose: () => void;
}

export function ItemDetailModal({ node, rawData, loading, onClose }: ItemDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"structured" | "raw">("structured");

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
    padding: "6px 14px",
    fontSize: "var(--font-size-xs)",
    fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-normal)",
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
            padding: "14px 18px 10px",
            borderBottom: "1px solid #e0e0e0",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "var(--font-size-2xs)", color: "#999", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Item Details
            </div>
            <div style={{ fontWeight: "var(--font-weight-semibold)", fontSize: "var(--font-size-lg)", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        {!loading && parsedItem && (
          <div style={{ display: "flex", gap: "4px", padding: "0 18px", borderBottom: "1px solid #e8e8e8", flexShrink: 0 }}>
            <button style={tabStyle(activeTab === "structured")} onClick={() => setActiveTab("structured")}>
              Structured View
            </button>
            <button style={tabStyle(activeTab === "raw")} onClick={() => setActiveTab("raw")}>
              Raw JSON
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: loading ? "16px 18px" : "0" }}>
          {loading && (
            <div style={{ color: "#999", fontSize: "var(--font-size-sm)" }}>Fetching item data…</div>
          )}

          {!loading && !rawData && (
            <div style={{ color: "#e57373", fontSize: "var(--font-size-sm)", padding: "16px 18px" }}>Failed to fetch item data.</div>
          )}

          {!loading && (rawData && !parsedItem) && (
            <pre
              style={{
                margin: 0,
                padding: "16px 18px",
                fontSize: "var(--font-size-xs)",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
                color: "#333",
              }}
            >
              {rawData}
            </pre>
          )}

          {!loading && parsedItem && activeTab === "structured" && (
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <section>
                <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                  Item Properties
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #e8e8e8", borderRadius: "6px", overflow: "hidden" }}>
                  <tbody>
                    <MetaRow label="Item ID" value={parsedItem.itemId} />
                    <MetaRow label="Name" value={parsedItem.name} />
                    <MetaRow label="Path" value={parsedItem.path} />
                    <MetaRow label="Template Name" value={parsedItem.template?.name ?? "—"} />
                    <MetaRow label="Language" value={parsedItem.language?.name ?? "—"} />
                    <MetaRow label="Version" value={parsedItem.version != null ? String(parsedItem.version) : "—"} />
                    <MetaRow label="Has Children" value={parsedItem.hasChildren} />
                    <MetaRow label="Has Presentation" value={parsedItem.hasPresentation ?? false} />
                    <MetaRow label="Workflow Is Final" value={parsedItem.workflow?.workflowState.final ?? false} />
                    <MetaRow label="Workflow State" value={parsedItem.workflow?.workflowState.displayName ?? "—"} />
                  </tbody>
                </table>
              </section>

              {contentFields.length > 0 && (
                <section>
                  <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
                    Content Fields ({contentFields.length})
                  </div>
                  <FieldsTable fields={contentFields} />
                </section>
              )}

              {systemFields.length > 0 && (
                <section>
                  <div style={{ fontSize: "var(--font-size-2xs)", fontWeight: "var(--font-weight-semibold)", textTransform: "uppercase", letterSpacing: "0.6px", color: "#888", marginBottom: "8px" }}>
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
                padding: "16px 18px",
                fontSize: "var(--font-size-xs)",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
                color: "#333",
              }}
            >
              {rawData}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
