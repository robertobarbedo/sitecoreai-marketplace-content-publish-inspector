Publish Inspector - Troubleshoot published data across all endpoints with side-by-side comparison of authoring content, preview delivery API, live delivery API, and your website. Quickly lookup and search for any field or layout data to debug publishing issues and verify content is correctly published.


Publish Inspector

Publish Inspector is a debugging tool for SitecoreAI that provides real-time visibility into your content publishing pipeline through a synchronized four-column comparison view tracking content from authoring to the live website.

What It Does

Solve content publishing issues by:





Comparing content across all stages - Simultaneously view Authoring API, Preview Delivery API, Live Delivery API, and rendered website



Identifying publishing failures - Spot exactly where content gets stuck in the pipeline



Tracking content freshness - Monitor __Updated timestamps to detect outdated content or stale caches



Verifying workflow states - See which items have non-final workflow states preventing publishing

Key Features

Multi-Column Synchronized View





Four side-by-side columns with synchronized scrolling and hover effects



Visual status indicators (loading, found, not found, outdated, HTTP errors)

Intelligent Status Detection





Authoring API: Content tree with workflow states and presentation flags



Preview/Live Delivery: Real-time GraphQL queries showing publish status



Website: HTTP fetches verify page accessibility and HTTP status codes

Advanced Capabilities





Search by item path or GUID with multi-language support



Detailed item inspection showing metadata, fields, versions, and raw GraphQL responses



Timestamp comparison across all endpoints with visual mismatch indicators



Configurable trailing slash handling and redirect following



Built-in rate limiting (default 30 requests/second) to prevent API overload

Use Cases

Troubleshooting - Identify why content isn't appearing or is outdated on live sites

Field Lookups - Quickly search items and inspect field values, layouts, and rendering details

Content Audit - Verify presentation settings, workflow states, and published content accuracy

Multi-Language QA - Validate translations are published correctly across all language versions

Perfect For





Developers debugging publishing pipelines and delivery APIs



QA Teams validating content across preview and live environments

Eliminates manual environment checking, condensing debugging into seconds of visual comparison.