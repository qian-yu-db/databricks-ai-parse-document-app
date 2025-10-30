# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Databricks AI Functions Document Intelligence Demo - a full-stack application that leverages Databricks' AI Functions (`ai_parse_document`) to extract structured data from documents and visualize bounding boxes around detected elements. The application consists of a Next.js 15 frontend with static export and a FastAPI backend, designed to run as a Databricks App.

**Key Features:**
- Document upload and processing using Databricks AI Functions
- Interactive page visualization with color-coded bounding boxes
- Multi-page document support with page navigation
- Delta table storage for processed document data
- Real-time configuration management for warehouse, volume, and table paths
- Responsive UI with zoom controls and collapsible panels

## Core Architecture

### Frontend (Next.js with Static Export)
- **Framework**: Next.js 15 with TypeScript and static export (`output: 'export'`)
- **UI Components**: Custom components using Tailwind CSS v4 and Radix UI primitives
- **State Management**: React hooks with comprehensive state tracking for file uploads, processing status, page navigation, and UI interactions
- **API Communication**: Robust API client with fallback URL strategy for Databricks Apps environment (`frontend/src/lib/api-config.ts`)
- **Key Pages**:
  - `/document-intelligence`: Main application page with document upload, processing, and visualization
  - `/next-steps`: Information page about next steps  
  - `/`: Landing page with value proposition
- **Key Components**:
  - Interactive page selector with numeric sorting
  - Zoomable document visualization with bounding boxes
  - Collapsible UI panels for better UX
  - Progress tracking and status indicators

### Backend (FastAPI)
- **Framework**: FastAPI with Uvicorn server (`backend/app.py`)
- **Configuration**: YAML-based configuration (`backend/app.yaml`) with environment variable support
- **Dependencies**: FastAPI, Uvicorn, Databricks SDK, PIL for image processing, PyYAML, python-multipart
- **Databricks Integration**: Uses `databricks-sdk` for Workspace API access with automatic authentication
- **Key Functionalities**:
  - Document upload to UC Volumes with conflict resolution
  - AI document parsing using `ai_parse_document` function v2.0
  - Delta table operations for storing extracted data
  - Page visualization with color-coded bounding box overlay generation
  - Dynamic configuration management (warehouse, volume, table paths)
  - Static file serving for Next.js frontend
  - Comprehensive error handling and timeout management

### Data Flow
1. **Upload**: Documents uploaded to Databricks UC Volumes via Files API
2. **Processing**: `ai_parse_document` extracts structured data and generates page images
3. **Storage**: Results stored in Delta tables with schema: `path, element_id, type, bbox, page_id, content, description, image_uri`
4. **Visualization**: Backend generates images with color-coded bounding boxes using PIL
5. **Frontend**: Displays extracted data and interactive visualizations with zoom controls

## Development Commands

### Frontend Development
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                   # Start development server
npm run build                 # Build for production (static export)
npm run lint                  # Run ESLint
```

### Backend Development
```bash
cd backend
pip install -r requirements.txt   # Install Python dependencies
uvicorn app:app --reload --host 0.0.0.0 --port 8000   # Start development server
```

### Deployment
```bash
./deploy.sh                   # Deploy to Databricks Apps
./deploy.sh "/custom/path" "custom-app-name"   # Deploy with custom parameters
```

## Configuration Management

### Environment Variables
- `DATABRICKS_WAREHOUSE_ID`: SQL warehouse for AI Functions execution
- `DATABRICKS_VOLUME_PATH`: UC Volume path for document storage
- `DATABRICKS_DELTA_TABLE_PATH`: Delta table for parsed document data
- `NEXT_PUBLIC_API_URL`: Frontend API base URL (auto-detected in Databricks)

### Configuration Files
- `backend/app.yaml`: Databricks App configuration with environment variables
- `frontend/next.config.ts`: Static export configuration for Databricks Apps
- `frontend/src/lib/api-config.ts`: API client with fallback URL strategy

## Key Technical Details

### API Endpoints
- **Configuration APIs**: 
  - `GET/POST /api/warehouse-config` - Manage warehouse ID
  - `GET/POST /api/volume-path-config` - Manage UC Volume paths
  - `GET/POST /api/delta-table-path-config` - Manage Delta table paths
- **Document Processing APIs**:
  - `POST /api/upload-to-uc` - Handles file uploads with conflict resolution and automatic directory creation
  - `POST /api/write-to-delta-table` - Processes documents using AI Functions with timeout handling
  - `POST /api/query-delta-table` - Retrieves parsed document data with optional page filtering
  - `POST /api/page-metadata` - Retrieves page metadata including total pages and element counts
- **Visualization APIs**:
  - `POST /api/visualize-page` - Generates color-coded bounding box visualizations
- **Static Asset Serving**: Serves Next.js static export files and handles routing

### Frontend State Management
- Uses React hooks for comprehensive state management
- **Key States**: 
  - File management (uploads, processed files, session tracking)
  - Processing status (AI Functions execution, loading states)
  - Page navigation (metadata, selected page, pagination controls)
  - Visualization data (zoom levels, image display, bounding boxes)
  - UI interactions (collapsible panels, tooltips, error states)
- **State Patterns**: 
  - Implements collapsible UI panels for better UX
  - Automatic page selection on document processing
  - Numeric sorting for page dropdowns (fixed string sorting issue)
  - Real-time status updates and progress tracking

### Databricks Integration Patterns
- **Automatic Authentication**: Uses WorkspaceClient() without explicit credentials
- **Path Handling**: Converts between UC Volume paths (`/Volumes/...`) and DBFS paths (`dbfs:/Volumes/...`)
- **Error Handling**: Robust error handling for Databricks SDK operations
- **Timeout Management**: Configurable timeouts for long-running AI Function calls

### Data Processing Pipeline
1. **File Upload**: Direct upload to UC Volumes with automatic "images" directory creation
2. **AI Parsing**: Batch processing using `ai_parse_document` with version 2.0 and description generation
3. **Data Extraction**: SQL parsing of nested JSON structures from AI Function output
4. **Visualization**: PIL-based image processing with color-coded bounding boxes by element type

### Deployment Architecture
- **Static Frontend**: Next.js static export served by FastAPI as static files
- **Route Handling**: FastAPI serves both API endpoints and static files with catch-all routing
- **Asset Management**: Handles Next.js _next directory mounting and asset serving with proper MIME types
- **Build Process**: Parallel frontend build and backend packaging in deploy script (`deploy.sh`)
- **Deployment Script**: 
  - Builds frontend with `npm run build`
  - Creates proper static file structure with route handling
  - Uploads frontend to `/static` directory in workspace
  - Packages and uploads backend code
  - Uses Databricks Apps CLI for deployment
- **Environment Configuration**: Supports custom app paths and names via script parameters

### Common Development Patterns
- **Task Management**: Use TodoWrite tool for tracking multi-step tasks and progress
- **API Communication**: API calls should handle multiple fallback URLs for Databricks environment via `api-config.ts`
- **Testing**: Always test frontend build before deployment (`npm run build`)
- **Deployment**: Backend changes require re-deployment via `./deploy.sh`
- **Development Modes**: Frontend supports both development mode (`npm run dev`) and static export modes
- **Code Style**: Follow existing patterns for component structure, hook usage, and error handling
- **UI/UX Patterns**: 
  - Use collapsible panels for complex interfaces
  - Implement proper loading states and progress indicators
  - Sort data numerically (e.g., page numbers) rather than as strings
  - Provide fallback states for error conditions

### Error Handling Strategy
- Frontend: Multiple API URL fallbacks with detailed error logging
- Backend: Comprehensive error handling for Databricks SDK operations
- File Operations: Robust conflict resolution and cleanup for UC Volume operations
- AI Functions: Timeout handling and status polling for long-running operations