# Content Publish Inspector

A Next.js-based debugging tool for inspecting content publishing status across Sitecore XM Cloud environments. This application provides a side-by-side comparison of content as it exists in the authoring environment, preview delivery API, live delivery API, and the actual rendered website.

## Overview

The Content Publish Inspector helps developers and content editors troubleshoot content publishing issues by displaying a synchronized, four-column view of your content tree:

1. **Content Tree (Authoring)** - Shows the content structure from the authoring environment with workflow states, presentation settings, and metadata
2. **Delivery API - Preview** - Displays content available through the preview GraphQL endpoint
3. **Delivery API - Live** - Displays content available through the live GraphQL endpoint
4. **Website Check** - Validates if pages are actually accessible on the rendered website

All columns are synchronized for scrolling and hover interactions, making it easy to track content across different stages of the publishing pipeline.

## Features

- **Multi-language support** - Select different language versions to inspect content in various languages
- **Workflow state visualization** - See the current workflow state for each item with color-coded indicators
- **Presentation detection** - Identify which items have presentation settings configured
- **Item details modal** - Click any item to view detailed information including fields, versions, and metadata
- **Real-time status checking** - Automatically verifies if pages are accessible on the live website
- **Synchronized navigation** - Hover and scroll interactions are synchronized across all four columns for easy comparison
- **Search functionality** - Quickly find specific items within the content tree

## Technology Stack

- **Next.js 15** - React framework for the UI
- **Sitecore Marketplace SDK** - For integrating with XM Cloud authoring and delivery APIs
- **TypeScript** - Type-safe development
- **React 19** - Latest React features for optimal performance

## Setup

