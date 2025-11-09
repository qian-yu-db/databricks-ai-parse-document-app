# AI Document Processing Workflow with Structured Streaming

A Databricks Asset Bundle demonstrating **incremental document processing** using `ai_parse_document` and Databricks Workflows with Structured Streaming.

## Overview

This workflow implements a streamlined document processing pipeline that:
1. **Cleans** pipeline tables and checkpoints (optional)
2. **Parses** PDFs and images using [`ai_parse_document`](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document)
3. **Extracts** clean text with incremental processing

All stages run as Python notebook tasks in a Databricks Workflow using Structured Streaming with serverless compute.

## Architecture

```
Source Documents (UC Volume)
         ↓
  Task 0: clean_pipeline_tables (optional)
         ↓
  Task 1: ai_parse_document → parsed_documents_raw (variant)
         ↓
  Task 2: content extraction → parsed_documents_content (string)
```

### Key Features

- **Incremental processing**: Only new files are processed using Structured Streaming checkpoints
- **Serverless compute**: Runs on serverless compute for cost efficiency
- **Task dependencies**: Sequential execution with automatic dependency management
- **Parameterized**: Catalog, schema, volumes, and table names configurable via variables
- **Error handling**: Gracefully handles parsing failures and streaming coordination
- **Automatic directory creation**: All required directories are created automatically if they don't exist

## Prerequisites

- Databricks workspace with Unity Catalog
- Databricks CLI v0.218.0+
- Unity Catalog resources:
  - **Catalog**: Unity Catalog catalog (e.g., `main`)
  - **Schema**: Database/schema within the catalog (e.g., `ai_parse_document_demo`)
  - **Volume**: UC Volume for file storage (e.g., `ai_parse_document_app_workflow`)
- AI function: `ai_parse_document`

**Note**: All subdirectories, tables, and checkpoints will be created automatically by the workflow.

## Quick Start

### Deploy and Run

1. **Install and authenticate**
   ```bash
   databricks auth login --host https://your-workspace.cloud.databricks.com
   ```

2. **Configure** `databricks.yml` with your workspace settings

3. **Deploy the bundle** (deploy-only mode, recommended for use with Databricks App UI)
   ```bash
   ./run_workflow.sh --profile YOUR_PROFILE
   ```

   The script will:
   - Validate the bundle configuration
   - Deploy the job to your workspace
   - Display the Job ID for use in the Databricks App UI

4. **Trigger from Databricks App**: Copy the displayed Job ID and use it in the Databricks App UI

### Alternative: Deploy and Run Immediately

```bash
./run_workflow.sh --run-now --profile YOUR_PROFILE
```

This will deploy the bundle and execute the job immediately without waiting for manual triggering.

## Configuration

### Bundle Configuration
Edit `databricks.yml`:

```yaml
variables:
  catalog: main                                                   # Your catalog
  schema: ai_parse_document_demo                                  # Your schema
  source_volume_path: /Volumes/main/.../inputs/                  # Source PDFs
  output_volume_path: /Volumes/main/.../outputs/                 # Parsed images
  checkpoint_base_path: /Volumes/main/.../checkpoints/           # Streaming checkpoints
  clean_pipeline_tables: Yes                                     # Clean tables on run
  raw_table_name: parsed_documents_raw                           # Table names
  content_table_name: parsed_documents_content
```

### Shell Script Options

```bash
# Deploy only (default - for use with Databricks App)
./run_workflow.sh --profile YOUR_PROFILE

# Deploy and run immediately
./run_workflow.sh --run-now --profile YOUR_PROFILE

# Production deployment
./run_workflow.sh --target prod --profile PROD_PROFILE

# Run existing job directly
./run_workflow.sh --job-id 123456 --profile YOUR_PROFILE

# Skip validation step
./run_workflow.sh --skip-validation --profile YOUR_PROFILE
```

## Workflow Tasks

### Task 0: Pipeline Cleanup (Optional)
**File**: `src/transformations/00-clean-pipeline-tables.py`

Conditionally cleans tables and checkpoints:
- Controlled by `clean_pipeline_tables` variable (Yes/No)
- Drops existing tables and removes checkpoint directories
- **Creates required directories** if they don't exist
- Enables fresh processing runs when needed

### Task 1: Document Parsing
**File**: `src/transformations/01_parse_documents.py`

Uses `ai_parse_document` to extract text, tables, and metadata from PDFs/images:
- Reads files from volume using Structured Streaming
- Stores variant output with bounding boxes and confidence scores
- Incremental: checkpointed streaming prevents reprocessing
- Handles parsing errors gracefully

### Task 2: Content Extraction
**File**: `src/transformations/02_extract_document_content.py`

Extracts clean concatenated text:
- Reads from previous task's table via streaming
- Handles both parser v1.0 and v2.0 formats
- Concatenates text elements while preserving structure
- Includes error handling for failed parses

## Visual Debugger

The included notebook visualizes parsing results with interactive bounding boxes.

**Open**: `src/explorations/ai_parse_document -- debug output.py`

**Configure widgets**:
- `input_file`: `/Volumes/main/default/source_docs/sample.pdf`
- `image_output_path`: `/Volumes/main/default/parsed_out/`
- `page_selection`: `all` (or `1-3`, `1,5,10`)

**Features**:
- Color-coded bounding boxes by element type
- Hover tooltips showing extracted content
- Automatic image scaling
- Page selection support

## Project Structure

```
.
├── databricks.yml                      # Bundle configuration
├── run_workflow.sh                     # Workflow deployment script
├── resources/
│   └── ai_parse_document_workflow.job.yml  # Job definition
├── src/
│   ├── transformations/
│   │   ├── 00-clean-pipeline-tables.py     # Pipeline cleanup
│   │   ├── 01_parse_documents.py           # PDF/image parsing
│   │   └── 02_extract_document_content.py  # Text extraction
│   └── explorations/
│       └── ai_parse_document -- debug output.py  # Visual debugger
├── README.md
└── CLAUDE.md                           # Developer guidance
```

## Output and Results

### Generated Assets
- **Delta Tables**:
  - `parsed_documents_raw`: Raw variant output from `ai_parse_document`
  - `parsed_documents_content`: Extracted text content
- **Images**: Parsed document images stored in `output_volume_path/` for visualization
- **Checkpoints**: Streaming state stored in `checkpoint_base_path/`

## Resources

- [Databricks Asset Bundles](https://docs.databricks.com/dev-tools/bundles/)
- [Databricks Workflows](https://docs.databricks.com/workflows/)
- [Structured Streaming](https://docs.databricks.com/structured-streaming/)
- [`ai_parse_document` Function](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document)
