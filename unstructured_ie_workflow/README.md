# AI Document Processing Workflow with Structured Streaming

A Databricks Asset Bundle demonstrating **incremental document processing** using `ai_parse_document`, `ai_query`, and Databricks Workflows with Structured Streaming.

## Overview

This workflow implements a complete document processing pipeline that:
1. **Cleans** pipeline tables and checkpoints (optional)
2. **Parses** PDFs and images using [`ai_parse_document`](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document)
3. **Extracts** clean text with incremental processing
4. **Analyzes** content using [`ai_query`](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query) with LLMs
5. **Exports** structured data as JSONL files

All stages run as Python notebook tasks in a Databricks Workflow using Structured Streaming with serverless compute. The workflow includes automated file management for uploading PDFs and downloading results.

## Architecture

```
Source Documents (UC Volume)
         ↓
  Task 0: clean_pipeline_tables (optional)
         ↓
  Task 1: ai_parse_document → parsed_documents_raw (variant)
         ↓
  Task 2: content extraction → parsed_documents_content (string)
         ↓
  Task 3: ai_query analysis → parsed_documents_structured (json)
         ↓
         JSONL Export → output_volume_path/extracted_entities/
```

### Key Features

- **Incremental processing**: Only new files are processed using Structured Streaming checkpoints
- **Serverless compute**: Runs on serverless compute for cost efficiency
- **Task dependencies**: Sequential execution with automatic dependency management
- **Automated file management**: Upload PDFs and download JSONL results via shell script
- **JSONL export**: Structured extraction results exported as JSONL files
- **Parameterized**: Catalog, schema, volumes, and table names configurable via variables
- **Error handling**: Gracefully handles parsing failures and streaming coordination
- **Financial focus**: Pre-configured for CUSIP bond data extraction from financial documents

## Prerequisites

- Databricks workspace with Unity Catalog
- Databricks CLI v0.218.0+
- Unity Catalog volumes for:
  - Source documents (PDFs/images)
  - Parsed output images
  - Streaming checkpoints
- AI functions (`ai_parse_document`, `ai_query`)

## Quick Start

### Option 1: Enhanced Shell Script (Recommended)

1. **Install and authenticate**
   ```bash
   databricks auth login --host https://your-workspace.cloud.databricks.com
   ```

2. **Configure** `databricks.yml` with your workspace settings

3. **Prepare your PDFs** in a local directory (default: `./pdfs/`)

4. **Run complete workflow** with file management
   ```bash
   ./run_workflow.sh --profile YOUR_PROFILE --upload-pdfs --download-jsonl
   ```

The script will:
- Validate and deploy the bundle
- Upload PDFs from `./pdfs/` to Databricks volume
- Run the complete processing workflow  
- Download JSONL results to `./jsonl/`

### Option 2: Manual Steps

1. **Install and authenticate**
   ```bash
   databricks auth login --host https://your-workspace.cloud.databricks.com
   ```

2. **Configure** `databricks.yml` with your workspace settings

3. **Validate** the bundle configuration
   ```bash
   databricks bundle validate --profile YOUR_PROFILE
   ```

4. **Deploy**
   ```bash
   databricks bundle deploy --profile YOUR_PROFILE
   ```

5. **Upload documents** to your source volume manually

6. **Run workflow**
   ```bash
   databricks bundle run ai_parse_document_workflow --profile YOUR_PROFILE
   ```

## Configuration

### Bundle Configuration
Edit `databricks.yml`:

```yaml
variables:
  catalog: fins_genai                                             # Your catalog
  schema: unstructured_documents                                  # Your schema
  source_volume_path: /Volumes/fins_genai/.../inputs/            # Source PDFs
  output_volume_path: /Volumes/fins_genai/.../outputs/           # Parsed images & JSONL
  checkpoint_base_path: /Volumes/fins_genai/.../checkpoints/     # Streaming checkpoints
  clean_pipeline_tables: Yes                                     # Clean tables on run
  raw_table_name: parsed_documents_raw                           # Table names
  content_table_name: parsed_documents_content
  structured_table_name: parsed_documents_structured
  agent_choice: ai_query                                          # ai_query or agent_bricks
```

### AI Extraction Configuration
Edit `src/transformations/config.yaml` to customize extraction:

```yaml
LLM_MODEL: "databricks-claude-sonnet-4"
PROMPT: |
  Your extraction prompt here...
RESPONSE_FORMAT: |
  JSON schema for structured output...
```

### Shell Script Options

```bash
# Upload from custom directory
./run_workflow.sh --upload-pdfs --pdfs-dir ./documents

# Download to custom directory  
./run_workflow.sh --download-jsonl --jsonl-dir ./results

# Production deployment
./run_workflow.sh --target prod --profile PROD_PROFILE

# Skip validation or deployment
./run_workflow.sh --skip-validation --skip-deployment --job-id 123456
```

## Workflow Tasks

### Task 0: Pipeline Cleanup (Optional)
**File**: `src/transformations/00-clean-pipeline-tables.py`

Conditionally cleans tables and checkpoints:
- Controlled by `clean_pipeline_tables` variable (Yes/No)
- Drops existing tables and removes checkpoint directories
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

### Task 3: Structured Data Extraction
**File**: `src/transformations/03_extract_key_info.py`

Applies LLM to extract structured insights:
- Reads from content table via streaming
- Uses `ai_query` with Claude Sonnet 4 or an existing agent bricks information extraction agent endpoint(configurable)
- Currently configured for CUSIP bond data extraction
- Outputs structured JSON to Delta table
- **Exports JSONL files** to output volume for downstream consumption
- Uses `awaitTermination()` to ensure streaming completion before JSONL export

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
├── run_workflow.sh                     # Enhanced workflow runner (recommended)
├── run_workflow.py                     # Python alternative (deprecated)
├── resources/
│   └── ai_parse_document_workflow.job.yml  # Job definition
├── src/
│   ├── transformations/
│   │   ├── 00-clean-pipeline-tables.py     # Pipeline cleanup
│   │   ├── 01_parse_documents.py           # PDF/image parsing
│   │   ├── 02_extract_document_content.py  # Text extraction
│   │   ├── 03_extract_key_info.py          # AI analysis + JSONL export
│   │   └── config.yaml                     # AI extraction configuration
│   └── explorations/
│       └── ai_parse_document -- debug output.py  # Visual debugger
├── pdfs/                               # Local PDF directory (you create)
├── jsonl/                              # Downloaded JSONL results (auto-created)
├── README.md
└── CLAUDE.md                           # Developer guidance
```

## Output and Results

### Generated Files
- **Delta Tables**: Raw, content, and structured data stored in Unity Catalog
- **JSONL Export**: `output_volume_path/extracted_entities/` contains structured extraction results
- **Images**: Parsed document images stored in `output_volume_path/` for visualization

### Local File Management
- **Upload**: PDFs from `./pdfs/` → Databricks volume automatically
- **Download**: JSONL files from Databricks volume → `./jsonl/` automatically
- **Custom paths**: Use `--pdfs-dir` and `--jsonl-dir` options

## Resources

- [Databricks Asset Bundles](https://docs.databricks.com/dev-tools/bundles/)
- [Databricks Workflows](https://docs.databricks.com/workflows/)
- [Structured Streaming](https://docs.databricks.com/structured-streaming/)
- [`ai_parse_document` Function](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_parse_document)
- [`ai_query` Function](https://docs.databricks.com/aws/en/sql/language-manual/functions/ai_query)
