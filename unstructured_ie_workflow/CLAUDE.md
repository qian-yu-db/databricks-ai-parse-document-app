# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Databricks Asset Bundle that implements an incremental document processing pipeline using Structured Streaming. The workflow processes PDFs and images through a 4-stage pipeline: cleaning → parsing → text extraction → structured data extraction, with each stage using Databricks AI functions and checkpointed streaming for incremental processing.

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
# Complete workflow with file management (use the enhanced shell script)
./run_workflow.sh --profile PROFILE --upload-pdfs --download-jsonl

# Upload PDFs from custom directory
./run_workflow.sh --upload-pdfs --pdfs-dir ./documents --profile PROFILE

# Download JSONL files to custom directory  
./run_workflow.sh --download-jsonl --jsonl-dir ./results --profile PROFILE

# Run existing job directly
./run_workflow.sh --job-id 123456 --profile PROFILE
```

## Architecture

### Pipeline Stages
The workflow consists of 4 sequential Databricks notebook tasks:

1. **Clean Pipeline Tables** (`00-clean-pipeline-tables.py`)
   - Conditionally cleans tables and checkpoints based on `clean_pipeline_tables` variable
   - Prepares environment for fresh processing when needed

2. **Document Parsing** (`01_parse_documents.py`) 
   - Uses `ai_parse_document` to extract text, tables, and metadata from PDFs/images
   - Streams files from `source_volume_path` and outputs to `parsed_documents_raw` table
   - Stores variant format with bounding boxes and confidence scores

3. **Content Extraction** (`02_extract_document_content.py`)
   - Extracts clean concatenated text from parsed variant data
   - Handles both parser v1.0 and v2.0 formats 
   - Outputs to `parsed_documents_content` table

4. **Structured Data Extraction** (`03_extract_key_info.py`)
   - Uses `ai_query` with Claude Sonnet 4 or Agent Bricks endpoint to extract structured information
   - Configured for financial document analysis (CUSIP bond data extraction)
   - Outputs structured JSON to `parsed_documents_structured` table
   - **Exports JSONL files** to `output_volume_path/extracted_entities/`

### Streaming Architecture
- All processing uses **Structured Streaming** with `trigger(availableNow=True)` for batch-like execution
- **Checkpointing** prevents reprocessing of already-handled documents
- Each stage waits for previous stage completion using `awaitTermination()`
- **Incremental processing**: Only new files trigger pipeline execution

### Configuration System
- Main config: `databricks.yml` with parameterized variables
- AI extraction config: `src/transformations/config.yaml` 
  - Contains LLM model selection, extraction prompts, and JSON schema
  - Currently configured for financial document CUSIP extraction
- Job definition: `resources/ai_parse_document_workflow.job.yml`

## Important Implementation Details

### Volume Paths
- **Input**: `/Volumes/{catalog}/{schema}/ai_parse_document_workflow/inputs/` - Place PDF files here
- **Output**: `/Volumes/{catalog}/{schema}/ai_parse_document_workflow/outputs/` - Parsed images and JSONL files
- **Checkpoints**: `/Volumes/{catalog}/{schema}/checkpoints/ai_parse_document_workflow/` - Streaming state

### AI Function Configuration
- **Document parsing**: Uses `ai_parse_document` with version 2.0 and automatic format detection
- **Content extraction**: Extracts clean text from variant format, handles both v1.0 and v2.0 parser outputs
- **Structured extraction**: Supports both `ai_query` (default: `databricks-claude-sonnet-4`) and `agent_bricks` endpoint via `agent_choice` parameter

### JSONL Export
The final stage exports extracted entities as JSONL files:
- **Timing**: Runs after structured data extraction completes 
- **Location**: `output_volume_path/extracted_entities/`
- **Format**: One JSON object per line (standard JSONL)
- **Content**: Contains the `extracted_entities` column from structured table

### Streaming Considerations
- Use `query.awaitTermination()` when adding new processing steps to ensure sequential execution
- Each stage has its own checkpoint location to track progress independently
- The pipeline handles empty results gracefully (e.g., when no new documents are found)

### File Management
The `run_workflow.sh` script provides enhanced file management:
- **PDF Upload**: Automatically uploads PDFs from local directory to Databricks volume
- **JSONL Download**: Downloads generated JSONL files to local directory
- **Error Handling**: Validates directories and provides detailed progress feedback

## Target Environments

- **dev**: Development mode with user-prefixed resources, schedules paused
- **prod**: Production mode with proper permissions, schedules active
- **Workspace**: Currently configured for `https://e2-demo-field-eng.cloud.databricks.com`

## Configuration Customization

### Modifying AI Extraction
Edit `src/transformations/config.yaml`:
- Change `LLM_MODEL` for different model selection (default: `databricks-claude-sonnet-4`)
- Modify `PROMPT` for different extraction tasks (currently configured for CUSIP bond extraction)
- Update `RESPONSE_FORMAT` JSON schema for different output structures
- Configure `AGENT_BRICKS_ENDPOINT` for agent bricks usage (default: `kie-966147c4-endpoint`)
- Switch `agent_choice` variable in `databricks.yml` between `ai_query` and `agent_bricks`

### Table and Volume Configuration
Edit variables in `databricks.yml`:
- `catalog/schema`: Database location
- `source_volume_path/output_volume_path`: File storage locations  
- `*_table_name`: Output table names
- `checkpoint_base_path`: Streaming checkpoint location