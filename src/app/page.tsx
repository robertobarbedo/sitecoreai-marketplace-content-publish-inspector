"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ApplicationContext } from "@sitecore-marketplace-sdk/client";
import { useMarketplaceClient } from "@/src/utils/hooks/useMarketplaceClient";
import { ContentTree, type TreeNode } from "@/src/components/ContentTree";
import { DeliveryContentTree, type DeliveryNode } from "@/src/components/DeliveryContentTree";
import { WebsiteTree } from "@/src/components/WebsiteTree";

const ROOT_ITEM_ID = "{0DE95AE4-41AB-4D01-9EB0-67441B7C2450}";

function App() {
  const { client, error, isInitialized } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext>();
  const [authoringTree, setAuthoringTree] = useState<TreeNode | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [previewDeliveryTree, setPreviewDeliveryTree] = useState<DeliveryNode | null>(null);
  const [liveDeliveryTree, setLiveDeliveryTree] = useState<DeliveryNode | null>(null);
  const [language, setLanguage] = useState("en");

  const columnRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const isSyncingScroll = useRef(false);

  const handleColumnScroll = useCallback((sourceIndex: number) => {
    if (isSyncingScroll.current) return;
    const source = columnRefs.current[sourceIndex];
    if (!source) return;
    isSyncingScroll.current = true;
    const { scrollTop } = source;
    for (let i = 0; i < columnRefs.current.length; i++) {
      if (i !== sourceIndex && columnRefs.current[i]) {
        columnRefs.current[i]!.scrollTop = scrollTop;
      }
    }
    isSyncingScroll.current = false;
  }, []);

  const handleTreeUpdate = useCallback((rootNode: TreeNode) => {
    setAuthoringTree(rootNode);
  }, []);

  const handlePreviewTreeUpdate = useCallback((tree: DeliveryNode | null) => {
    setPreviewDeliveryTree(tree);
  }, []);

  const handleLiveTreeUpdate = useCallback((tree: DeliveryNode | null) => {
    setLiveDeliveryTree(tree);
  }, []);

  useEffect(() => {
    if (!error && isInitialized && client) {
      console.log("Marketplace client initialized successfully.");

      client.query("application.context")
        .then((res) => {
          console.log("Success retrieving application.context:", res.data);
          setAppContext(res.data);
        })
        .catch((error) => {
          console.error("Error retrieving application.context:", error);
        });

    } else if (error) {
      console.error("Error initializing Marketplace client:", error);
    }
  }, [client, error, isInitialized]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {error && <p style={{ color: "red", padding: "8px 12px", margin: 0 }}>Error: {String(error)}</p>}
      {isInitialized && appContext && client && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Column 1: Content Tree */}
          <div
            ref={(el) => { columnRefs.current[0] = el; }}
            onScroll={() => handleColumnScroll(0)}
            style={{
              borderRight: "1px solid #e0e0e0",
              overflow: "auto",
              background: "#fafafa",
            }}
          >
            <ContentTree
              client={client}
              appContext={appContext}
              rootItemId={ROOT_ITEM_ID}
              onTreeUpdate={handleTreeUpdate}
              onLanguageChange={setLanguage}
              onHoverChange={setHoveredLine}
              hoveredLine={hoveredLine}
            />
          </div>

          {/* Column 2: Preview Delivery Tree */}
          <div
            ref={(el) => { columnRefs.current[1] = el; }}
            onScroll={() => handleColumnScroll(1)}
            style={{
              borderRight: "1px solid #e0e0e0",
              overflow: "auto",
              background: "#fafafa",
            }}
          >
            <DeliveryContentTree
              client={client}
              appContext={appContext}
              authoringTree={authoringTree}
              endpoint="xmc.preview.graphql"
              language={language}
              label="Delivery API - Preview"
              onDeliveryTreeUpdate={handlePreviewTreeUpdate}
              hoveredLine={hoveredLine}
              onHoverChange={setHoveredLine}
            />
          </div>

          {/* Column 3: Live Delivery Tree */}
          <div
            ref={(el) => { columnRefs.current[2] = el; }}
            onScroll={() => handleColumnScroll(2)}
            style={{
              borderRight: "1px solid #e0e0e0",
              overflow: "auto",
              background: "#fafafa",
            }}
          >
            <DeliveryContentTree
              client={client}
              appContext={appContext}
              authoringTree={authoringTree}
              endpoint="xmc.live.graphql"
              language={language}
              label="Delivery API - Live"
              onDeliveryTreeUpdate={handleLiveTreeUpdate}
              hoveredLine={hoveredLine}
              onHoverChange={setHoveredLine}
            />
          </div>

          {/* Column 4: Website Check */}
          <div
            ref={(el) => { columnRefs.current[3] = el; }}
            onScroll={() => handleColumnScroll(3)}
            style={{
              overflow: "auto",
              background: "#fafafa",
            }}
          >
            <WebsiteTree
              client={client}
              appContext={appContext}
              authoringTree={authoringTree}
              previewTree={previewDeliveryTree}
              liveTree={liveDeliveryTree}
              hoveredLine={hoveredLine}
              onHoverChange={setHoveredLine}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
