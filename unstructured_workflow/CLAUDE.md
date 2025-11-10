# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Databricks Asset Bundle that implements a document processing pipeline using Structured Streaming. The workflow processes PDFs and images through a 2-stage pipeline: parsing → content extraction, with each stage using Databricks AI functions and checkpointed streaming for incremental processing.

## Key Commands

### Bundle Management
```bash
# Validate bundle configuration
databricks bundle validate [--profile PROFILE]

# Deploy to development (default)
databricks bundle deploy [--profile PROFILE]

# Deploy to production
databricks bundle deploy --target prod [--profile PROFILE]

# Run the complete workflow
databricks bundle run ai_parse_document_workflow --target dev [--profile PROFILE]
```

### Enhanced Workflow Management
```bash
# Complete workflow (deploy-only mode, does not run job)
./run_workflow.sh --profile PROFILE

# Deploy and run the job immediately
./run_workflow.sh --run-now --profile PROFILE

# Run existing job directly
./run_workflow.sh --job-id 123456 --profile PROFILE
```

## Architecture

### Pipeline Stages
The workflow consists of 3 sequential Databricks notebook tasks:

1. **Clean Pipeline Tables** (`00-clean-pipeline-tables.py`)
   - Conditionally cleans tables and checkpoints based on `clean_pipeline_tables` variable
   - **Automatically creates required directories** if they don't exist
   - Prepares environment for fresh processing when needed

2. **Document Parsing** (`01_parse_documents.py`)
   - Uses `ai_parse_document` to extract text, tables, and metadata from PDFs/images
   - Streams files from `source_volume_path` and outputs to `parsed_documents_raw` table
   - Stores variant format with bounding boxes and confidence scores

3. **Content Extraction** (`02_extract_document_content.py`)
   - Extracts clean concatenated text from parsed variant data
   - Handles both parser v1.0 and v2.0 formats
   - Outputs to `parsed_documents_content` table

### Streaming Architecture
- All processing uses **Structured Streaming** with `trigger(availableNow=True)` for batch-like execution
- **Checkpointing** prevents reprocessing of already-handled documents
- Each stage waits for previous stage completion using `awaitTermination()`
- **Incremental processing**: Only new files trigger pipeline execution

### Configuration System
- Main config: `databricks.yml` with parameterized variables
- Job definition: `resources/ai_parse_document_workflow.job.yml`

## Important Implementation Details

### Volume Paths
- **Input**: `/Volumes/{catalog}/{schema}/ai_parse_document_app_workflow/inputs/` - Place PDF files here
- **Output**: `/Volumes/{catalog}/{schema}/ai_parse_document_app_workflow/outputs/` - Parsed images
- **Checkpoints**: `/Volumes/{catalog}/{schema}/checkpoints/ai_parse_document_app_workflow/` - Streaming state

**Note**: All subdirectories are automatically created by the workflow if they don't exist.

### AI Function Configuration
- **Document parsing**: Uses `ai_parse_document` with version 2.0 and automatic format detection
- **Content extraction**: Extracts clean text from variant format, handles both v1.0 and v2.0 parser outputs

### Streaming Considerations
- Use `query.awaitTermination()` when adding new processing steps to ensure sequential execution
- Each stage has its own checkpoint location to track progress independently
- The pipeline handles empty results gracefully (e.g., when no new documents are found)

### File Management
The `run_workflow.sh` script provides deployment management:
- **Deploy-Only Mode (default)**: Deploys the job and displays the Job ID for use in the Databricks App UI
- **Run Mode**: Use `--run-now` to deploy and execute the job immediately
- **Job ID Retrieval**: Automatically retrieves the job ID using `databricks bundle summary`
- **Error Handling**: Validates bundle configuration before deployment

## Target Environments

- **dev**: Development mode with user-prefixed resources, schedules paused
- **prod**: Production mode with proper permissions, schedules active
- **Workspace**: Currently configured for `https://e2-demo-field-eng.cloud.databricks.com`

## Configuration Customization

### Table and Volume Configuration
Edit variables in `databricks.yml`:
- `catalog/schema`: Database location
- `source_volume_path/output_volume_path`: File storage locations
- `raw_table_name/content_table_name`: Output table names
- `checkpoint_base_path`: Streaming checkpoint location

### Prerequisites
Before deploying the bundle, ensure the following exist in your Databricks workspace:
- **Catalog**: The Unity Catalog catalog (e.g., `main`)
- **Schema**: The schema/database within the catalog (e.g., `ai_parse_document_demo`)
- **Volume**: The UC Volume for file storage (e.g., `ai_parse_document_app_workflow`)

All subdirectories, tables, and checkpoints will be created automatically by the workflow.
