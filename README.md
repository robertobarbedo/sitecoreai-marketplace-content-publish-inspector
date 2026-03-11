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

### Prerequisites

- Access to SitecoreAI Portal
- XM Cloud environment

### Installation Steps

#### 1. Create the App in SitecoreAI Portal

1. Navigate to **SitecoreAI Portal** > **App Studio** > **Create App**
2. Configure the new app with the following settings:
   - **App Name**: `Content Publish Inspector`
   - **Type**: `Custom`

#### 2. Configure App Settings

In the app configuration page, set the following options:

- **Extension Points**: Enable `Full Screen`
- **API Access**: Select `SitecoreAI APIs`
- **Permissions**: `Copy and Read from Clipboard`
- **Deployment URL**: `https://content-publish-inspector.vercel.app/`
- **App Logo**: 
  1. Download the icon from: `https://content-publish-inspector.vercel.app/icon.png`
  2. Upload it to the Sitecore app configuration

**Save** your new app configuration.

#### 3. Install the App

1. Go back to **SitecoreAI Portal** > **My apps**
2. Find **Content Publish Inspector** in the list
3. Click **Install**

#### 4. Access the App

Full Screen Marketplace apps are available in the environment portal in the **right top corner** menu.

