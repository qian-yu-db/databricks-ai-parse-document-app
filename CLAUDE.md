# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Databricks AI Functions Document Intelligence Demo - a full-stack application that leverages Databricks' AI Functions (`ai_parse_document`) to extract structured data from documents and visualize bounding boxes around detected elements. The application consists of a Next.js 15 frontend with static export and a FastAPI backend, designed to run as a Databricks App.

**Key Features:**
- **Dual Processing Modes**: Interactive mode for single-file processing and Batch mode for workflow-based multi-file processing
- Document upload and processing using Databricks AI Functions
- Interactive page visualization with color-coded bounding boxes
- Multi-page document support with page navigation
- Delta table storage for processed document data
- **Batch Job Integration**: Integration with Databricks Asset Bundle workflows for scalable batch processing
- Real-time configuration management for warehouse, volume, and table paths
- Responsive UI with zoom controls and collapsible panels
- **Automatic cleanup**: Batch mode automatically cleans upload directory before each run

## Core Architecture

### Frontend (Next.js with Static Export)
- **Framework**: Next.js 15 with TypeScript and static export (`output: 'export'`)
- **UI Components**: Custom components using Tailwind CSS v4 and Radix UI primitives
- **State Management**: React hooks with comprehensive state tracking for file uploads, processing status, page navigation, and UI interactions
- **API Communication**: Robust API client with fallback URL strategy for Databricks Apps environment (`frontend/src/lib/api-config.ts`)
- **Processing Modes**:
  - **Interactive Mode**: Single-file document processing with immediate visualization
  - **Batch Mode**: Multi-file processing via Databricks Workflows with job status tracking
- **Key Pages**:
  - `/document-intelligence`: Main application page with mode selection, document upload, processing, and visualization
  - `/next-steps`: Information page about next steps
  - `/`: Landing page with value proposition
- **Key Components**:
  - Mode selector (Interactive vs Batch)
  - Interactive page selector with numeric sorting
  - Zoomable document visualization with bounding boxes
  - Batch job configuration and status tracking
  - Collapsible UI panels for better UX
  - Progress tracking and status indicators

### Backend (FastAPI)
- **Framework**: FastAPI with Uvicorn server (`backend/app.py`)
- **Configuration**: YAML-based configuration (`backend/app.yaml`) with environment variable support
- **Dependencies**: FastAPI, Uvicorn, Databricks SDK, PIL for image processing, PyYAML, python-multipart
- **Databricks Integration**: Uses `databricks-sdk` for Workspace API access with automatic authentication
- **Key Functionalities**:
  - **Interactive Mode**:
    - Document upload to UC Volumes with conflict resolution
    - AI document parsing using `ai_parse_document` function v2.0
    - Delta table operations for storing extracted data
    - Page visualization with color-coded bounding box overlay generation
  - **Batch Mode**:
    - Batch file upload to dedicated volume path (`BATCH_INPUT_VOLUME_PATH`)
    - Automatic cleanup of batch input directory before each upload
    - Databricks workflow job triggering and status monitoring
    - Job configuration management (job ID updates)
  - Dynamic configuration management (warehouse, volume, table paths)
  - Static file serving for Next.js frontend
  - Comprehensive error handling and timeout management

### Batch Processing Workflow
The application integrates with a Databricks Asset Bundle workflow (`unstructured_workflow/`) for scalable batch processing:

1. **Workflow Deployment**: Deploy via `./run_workflow.sh` (deploy-only mode by default)
2. **Job Configuration**: Configure job ID in the Databricks App UI
3. **File Upload**: Files uploaded to `BATCH_INPUT_VOLUME_PATH` with automatic cleanup
4. **Job Execution**: Workflow triggered via Databricks Jobs API
5. **Status Monitoring**: Real-time job status and task progress tracking
6. **Workflow Steps**:
   - Task 0: Clean pipeline tables and checkpoints (creates required directories)
   - Task 1: Parse documents using `ai_parse_document`
   - Task 2: Extract content from parsed documents

### Data Flow

#### Interactive Mode
1. **Upload**: Documents uploaded to Databricks UC Volumes via Files API
2. **Processing**: `ai_parse_document` extracts structured data and generates page images
3. **Storage**: Results stored in Delta tables with schema: `path, element_id, type, bbox, page_id, content, description, image_uri`
4. **Visualization**: Backend generates images with color-coded bounding boxes using PIL
5. **Frontend**: Displays extracted data and interactive visualizations with zoom controls

#### Batch Mode
1. **Cleanup**: Automatic deletion of existing files in batch input directory
2. **Upload**: Multiple PDFs uploaded to `BATCH_INPUT_VOLUME_PATH`
3. **Job Trigger**: Databricks workflow job triggered via Jobs API
4. **Processing**: Structured Streaming workflow processes all files incrementally
5. **Monitoring**: Frontend polls job status and displays task progress
6. **Results**: Processed data stored in Delta tables defined in workflow

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

### Batch Workflow Deployment
```bash
cd unstructured_workflow
./run_workflow.sh --profile YOUR_PROFILE               # Deploy workflow (default: deploy-only)
./run_workflow.sh --run-now --profile YOUR_PROFILE     # Deploy and run immediately
```

## Configuration Management

### Environment Variables
- `DATABRICKS_WAREHOUSE_ID`: SQL warehouse for AI Functions execution
- `DATABRICKS_VOLUME_PATH`: UC Volume path for interactive mode document storage
- `DATABRICKS_DELTA_TABLE_PATH`: Delta table for interactive mode parsed document data
- `BATCH_INPUT_VOLUME_PATH`: UC Volume path for batch mode file uploads (e.g., `/Volumes/fins_genai/unstructured_documents/ai_parse_document_app_workflow/inputs/`)
- `BATCH_JOB_NAME`: Databricks workflow job name (optional, job ID can be configured via UI)
- `NEXT_PUBLIC_API_URL`: Frontend API base URL (auto-detected in Databricks)

### Configuration Files
- `backend/app.yaml`: Databricks App configuration with environment variables
- `frontend/next.config.ts`: Static export configuration for Databricks Apps
- `frontend/src/lib/api-config.ts`: API client with fallback URL strategy
- `unstructured_workflow/databricks.yml`: Batch workflow configuration
- `unstructured_workflow/run_workflow.sh`: Workflow deployment script

## Key Technical Details

### API Endpoints
- **Configuration APIs**:
  - `GET/POST /api/warehouse-config` - Manage warehouse ID
  - `GET/POST /api/volume-path-config` - Manage UC Volume paths
  - `GET/POST /api/delta-table-path-config` - Manage Delta table paths
  - `GET/POST /api/batch-job-config` - Manage batch job ID configuration
- **Interactive Mode Processing APIs**:
  - `POST /api/upload-to-uc` - Handles file uploads with conflict resolution and automatic directory creation
  - `POST /api/write-to-delta-table` - Processes documents using AI Functions with timeout handling
  - `POST /api/query-delta-table` - Retrieves parsed document data with optional page filtering
  - `POST /api/page-metadata` - Retrieves page metadata including total pages and element counts
- **Batch Mode Processing APIs**:
  - `POST /api/clean-batch-input-path` - Clean all files from batch input directory before upload
  - `POST /api/upload-batch-pdfs` - Upload multiple PDFs to batch input volume
  - `POST /api/trigger-batch-job` - Trigger Databricks workflow job
  - `POST /api/batch-job-status/{run_id}` - Poll job status and task progress
- **Visualization APIs**:
  - `POST /api/visualize-page` - Generates color-coded bounding box visualizations
- **Static Asset Serving**: Serves Next.js static export files and handles routing

### Frontend State Management
- Uses React hooks for comprehensive state management
- **Key States**:
  - Mode selection (interactive vs batch)
  - File management (uploads, processed files, session tracking)
  - Processing status (AI Functions execution, loading states)
  - Batch job tracking (job ID, run ID, status, task progress)
  - Page navigation (metadata, selected page, pagination controls)
  - Visualization data (zoom levels, image display, bounding boxes)
  - UI interactions (collapsible panels, tooltips, error states)
- **State Patterns**:
  - Implements collapsible UI panels for better UX
  - Automatic page selection on document processing
  - Numeric sorting for page dropdowns (fixed string sorting issue)
  - Task ordering in batch job status (sorted by workflow execution order)
  - Real-time status updates and progress tracking

### Databricks Integration Patterns
- **Automatic Authentication**: Uses WorkspaceClient() without explicit credentials
- **Path Handling**: Converts between UC Volume paths (`/Volumes/...`) and DBFS paths (`dbfs:/Volumes/...`)
- **Error Handling**: Robust error handling for Databricks SDK operations
- **Timeout Management**: Configurable timeouts for long-running AI Function calls
- **Job Management**: Databricks Jobs API integration for workflow triggering and monitoring
- **Bundle Integration**: Databricks Asset Bundle CLI for workflow deployment with `databricks bundle summary` for job ID retrieval

### Data Processing Pipeline

#### Interactive Mode
1. **File Upload**: Direct upload to UC Volumes with automatic "images" directory creation
2. **AI Parsing**: Batch processing using `ai_parse_document` with version 2.0 and description generation
3. **Data Extraction**: SQL parsing of nested JSON structures from AI Function output
4. **Visualization**: PIL-based image processing with color-coded bounding boxes by element type

#### Batch Mode
1. **Directory Cleanup**: Automatic deletion of all existing files in `BATCH_INPUT_VOLUME_PATH`
2. **Batch Upload**: Multiple PDFs uploaded to clean batch input directory
3. **Workflow Trigger**: Databricks job triggered via Jobs API (`run-now`)
4. **Incremental Processing**: Structured Streaming with checkpointing processes files incrementally
5. **Result Storage**: Data stored in Delta tables defined in workflow configuration

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
- **Batch Workflow Deployment**: Separate deployment via Asset Bundle CLI with deploy-only mode for UI-based job triggering

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
  - Sort data numerically (e.g., page numbers, task order) rather than as strings
  - Provide fallback states for error conditions
  - Display upload destinations for transparency

### Error Handling Strategy
- Frontend: Multiple API URL fallbacks with detailed error logging
- Backend: Comprehensive error handling for Databricks SDK operations
- File Operations: Robust conflict resolution and cleanup for UC Volume operations
- AI Functions: Timeout handling and status polling for long-running operations
- Batch Jobs: Graceful handling of job trigger failures and status polling errors

### Prerequisites

**For Interactive Mode:**
- Databricks SQL warehouse
- Unity Catalog volume for document storage
- Unity Catalog schema for Delta tables

**For Batch Mode (additional):**
- Unity Catalog volume for batch workflow (must exist before deployment)
  - Catalog (e.g., `main`)
  - Schema (e.g., `ai_parse_document_demo`)
  - Volume (e.g., `ai_parse_document_app_workflow`)
- Databricks CLI v0.218.0+ for workflow deployment
- Note: Subdirectories within the volume are created automatically
