from fastapi import FastAPI, HTTPException, UploadFile, File as FastAPIFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.files import FileInfo
from databricks.sdk.service.sql import StatementState
import os
import yaml
from dotenv import load_dotenv
from typing import List
import tempfile
import shutil
import base64
import time
from PIL import Image, ImageDraw, ImageFont
import io
import re
from pathlib import Path

def load_yaml_config():
    """Load configuration from app.yaml file"""
    try:
        with open('app.yaml', 'r') as file:
            config = yaml.safe_load(file)
            # Convert env array to a dictionary for easy access
            yaml_config = {}
            if 'env' in config:
                for env_var in config['env']:
                    yaml_config[env_var['name']] = env_var['value']
            return yaml_config
    except Exception as e:
        print(f"Warning: Could not load app.yaml config: {e}")
        return {}

# Load YAML configuration
YAML_CONFIG = load_yaml_config()

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class WriteToTableRequest(BaseModel):
    file_paths: List[str]
    limit: int = 10
    operation_mode: str = 'append'  # 'replace' or 'append'

class QueryDeltaTableRequest(BaseModel):
    file_paths: List[str] = []
    limit: int = 10
    page_number: int = None  # Optional: filter by specific page number

# Helper functions
def get_uc_volume_path() -> str:
    """Get the current UC Volume path"""
    return current_volume_path or "/Volumes/main/default/ai_functions_demo"

def get_delta_table_path() -> str:
    """Get the current Delta table path"""  
    return current_delta_table_path or "main.default.ai_functions_demo_documents"

# Initialize Databricks client - uses automatic authentication in Databricks Apps
try:
    w = WorkspaceClient()  # Automatic authentication
    warehouse_id = os.getenv("DATABRICKS_WAREHOUSE_ID", YAML_CONFIG.get("DATABRICKS_WAREHOUSE_ID"))
    print(f"✅ Databricks client initialized with warehouse: {warehouse_id}")
except Exception as e:
    print(f"⚠️ Databricks client initialization failed: {e}")
    w = None
    warehouse_id = None

# Global variables to store dynamic configuration
current_warehouse_id = warehouse_id
current_volume_path = os.getenv("DATABRICKS_VOLUME_PATH", YAML_CONFIG.get("DATABRICKS_VOLUME_PATH"))
current_delta_table_path = os.getenv("DATABRICKS_DELTA_TABLE_PATH", YAML_CONFIG.get("DATABRICKS_DELTA_TABLE_PATH"))

# Batch job configuration
batch_job_id = os.getenv("BATCH_JOB_ID", YAML_CONFIG.get("BATCH_JOB_ID"))
batch_input_volume_path = os.getenv("BATCH_INPUT_VOLUME_PATH", YAML_CONFIG.get("BATCH_INPUT_VOLUME_PATH"))

class WarehouseConfigRequest(BaseModel):
    warehouse_id: str

class VolumePathConfigRequest(BaseModel):
    volume_path: str

class DeltaTablePathConfigRequest(BaseModel):
    delta_table_path: str

class VisualizePageRequest(BaseModel):
    file_path: str = None
    page_number: int = None  # Optional: visualize specific page only

class PageMetadataRequest(BaseModel):
    file_paths: List[str] = []



@app.get("/api/warehouse-config")
def get_warehouse_config():
    """Get current warehouse configuration"""
    return {
        "warehouse_id": current_warehouse_id,
        "default_warehouse_id": warehouse_id
    }

@app.post("/api/warehouse-config")
def update_warehouse_config(request: WarehouseConfigRequest):
    """Update warehouse configuration"""
    global current_warehouse_id
    current_warehouse_id = request.warehouse_id
    print(f"🔧 Warehouse ID updated to: {current_warehouse_id}")
    return {
        "success": True,
        "warehouse_id": current_warehouse_id,
        "message": "Warehouse ID updated successfully"
    }

@app.get("/api/volume-path-config")
def get_volume_path_config():
    """Get current volume path configuration"""
    default_path = YAML_CONFIG.get("DATABRICKS_VOLUME_PATH", "/Volumes/fins_genai/unstructured_documents/pdf_tpg/")
    return {
        "volume_path": current_volume_path or default_path,
        "default_volume_path": default_path
    }

@app.post("/api/volume-path-config")
def update_volume_path_config(request: VolumePathConfigRequest):
    """Update volume path configuration"""
    global current_volume_path
    current_volume_path = request.volume_path
    print(f"🔧 Volume path updated to: {current_volume_path}")
    return {
        "success": True,
        "volume_path": current_volume_path,
        "message": "Volume path updated successfully"
    }

@app.get("/api/delta-table-path-config")
def get_delta_table_path_config():
    """Get current delta table path configuration"""
    default_path = YAML_CONFIG.get("DATABRICKS_DELTA_TABLE_PATH", "/fins_genai.unstructured_documents.files_parsed")
    return {
        "delta_table_path": current_delta_table_path or default_path,
        "default_delta_table_path": default_path
    }

@app.post("/api/delta-table-path-config")
def update_delta_table_path_config(request: DeltaTablePathConfigRequest):
    """Update delta table path configuration"""
    global current_delta_table_path
    current_delta_table_path = request.delta_table_path
    print(f"🔧 Delta table path updated to: {current_delta_table_path}")
    return {
        "success": True,
        "delta_table_path": current_delta_table_path,
        "message": "Delta table path updated successfully"
    }


# ============================================================================
# BATCH JOB APIs
# ============================================================================

@app.get("/api/batch-job-config")
def get_batch_job_config():
    """Get batch job configuration and verify job exists"""
    if not w:
        return {
            "success": False,
            "job_deployed": False,
            "error": "Databricks connection not configured"
        }

    if not batch_job_id:
        return {
            "success": False,
            "job_deployed": False,
            "error": "BATCH_JOB_ID not configured in app.yaml",
            "message": "Please deploy the asset bundle and configure BATCH_JOB_ID"
        }

    try:
        # Check if job exists
        job = w.jobs.get(job_id=int(batch_job_id))

        return {
            "success": True,
            "job_deployed": True,
            "job_id": batch_job_id,
            "job_name": job.settings.name if job.settings else None,
            "input_volume_path": batch_input_volume_path,
            "message": f"Batch job '{job.settings.name}' is ready"
        }
    except Exception as e:
        return {
            "success": False,
            "job_deployed": False,
            "job_id": batch_job_id,
            "error": str(e),
            "message": "Job not found. Please deploy the asset bundle first."
        }


@app.post("/api/upload-batch-pdfs")
async def upload_batch_pdfs(files: List[UploadFile] = FastAPIFile(...)):
    """Upload multiple PDF files to batch input volume"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection not configured")

    if not batch_input_volume_path:
        raise HTTPException(status_code=500, detail="BATCH_INPUT_VOLUME_PATH not configured")

    try:
        uploaded_files = []
        base_path = batch_input_volume_path.rstrip('/')

        # Ensure input directory exists
        try:
            w.files.list_directory_contents(base_path)
        except Exception:
            # Directory doesn't exist, try to create it
            print(f"📁 Creating batch input directory: {base_path}")
            # Note: UC Volumes directories are created automatically on first file upload

        for file in files:
            if not file.filename.lower().endswith('.pdf'):
                print(f"⚠️ Skipping non-PDF file: {file.filename}")
                continue

            # Read file content
            content = await file.read()

            # Construct full UC path
            file_path = f"{base_path}/{file.filename}"

            # Upload to UC Volume using Files API
            w.files.upload(
                file_path=file_path,
                contents=io.BytesIO(content),
                overwrite=True
            )

            uploaded_files.append({
                "filename": file.filename,
                "path": file_path,
                "size": len(content)
            })

            print(f"✅ Uploaded batch PDF: {file_path}")

        return {
            "success": True,
            "uploaded_files": uploaded_files,
            "total_files": len(uploaded_files),
            "volume_path": base_path
        }

    except Exception as e:
        print(f"❌ Error uploading batch PDFs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload batch PDFs: {str(e)}")


@app.post("/api/trigger-batch-job")
def trigger_batch_job():
    """Trigger the batch processing Databricks job"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection not configured")

    if not batch_job_id:
        raise HTTPException(status_code=500, detail="BATCH_JOB_ID not configured")

    try:
        # Trigger the job
        run = w.jobs.run_now(job_id=int(batch_job_id))

        print(f"🚀 Triggered batch job {batch_job_id}, run_id: {run.run_id}")

        return {
            "success": True,
            "run_id": run.run_id,
            "job_id": batch_job_id,
            "message": "Batch job triggered successfully"
        }

    except Exception as e:
        print(f"❌ Error triggering batch job: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger batch job: {str(e)}")


@app.get("/api/batch-job-status/{run_id}")
def get_batch_job_status(run_id: int):
    """Get status of a batch job run"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection not configured")

    try:
        # Get run details
        run = w.jobs.get_run(run_id=run_id)

        # Extract task statuses
        tasks = []
        if run.tasks:
            for task in run.tasks:
                tasks.append({
                    "task_key": task.task_key,
                    "state": task.state.life_cycle_state.value if task.state and task.state.life_cycle_state else "UNKNOWN",
                    "result_state": task.state.result_state.value if task.state and task.state.result_state else None,
                    "start_time": task.start_time,
                    "end_time": task.end_time
                })

        # Overall run state
        state = run.state
        life_cycle_state = state.life_cycle_state.value if state and state.life_cycle_state else "UNKNOWN"
        result_state = state.result_state.value if state and state.result_state else None

        # Determine if job is still running
        is_running = life_cycle_state in ["PENDING", "RUNNING", "TERMINATING"]
        is_success = result_state == "SUCCESS"
        is_failed = result_state in ["FAILED", "TIMEDOUT", "CANCELED"]

        return {
            "success": True,
            "run_id": run_id,
            "state": life_cycle_state,
            "result_state": result_state,
            "is_running": is_running,
            "is_success": is_success,
            "is_failed": is_failed,
            "start_time": run.start_time,
            "end_time": run.end_time,
            "tasks": tasks,
            "run_page_url": run.run_page_url
        }

    except Exception as e:
        print(f"❌ Error getting batch job status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get batch job status: {str(e)}")


@app.post("/api/batch-job-config")
def update_batch_job_config(request: dict):
    """Update batch job ID configuration"""
    global batch_job_id

    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection not configured")

    new_job_id = request.get("job_id")
    if not new_job_id:
        raise HTTPException(status_code=400, detail="job_id is required")

    try:
        # Verify job exists
        job = w.jobs.get(job_id=int(new_job_id))

        # Update the global variable
        batch_job_id = str(new_job_id)

        # Update YAML config in memory
        YAML_CONFIG["BATCH_JOB_ID"] = str(new_job_id)

        # Write updated config back to app.yaml
        yaml_path = Path(__file__).parent / "app.yaml"
        with open(yaml_path, 'r') as f:
            yaml_content = yaml.safe_load(f)

        # Update the BATCH_JOB_ID in env section
        if 'env' in yaml_content:
            for env_var in yaml_content['env']:
                if env_var.get('name') == 'BATCH_JOB_ID':
                    env_var['value'] = str(new_job_id)
                    break
            else:
                # Add if not exists
                yaml_content['env'].append({
                    'name': 'BATCH_JOB_ID',
                    'value': str(new_job_id)
                })

        with open(yaml_path, 'w') as f:
            yaml.dump(yaml_content, f, default_flow_style=False)

        print(f"✅ Updated BATCH_JOB_ID to {new_job_id}")

        return {
            "success": True,
            "job_id": str(new_job_id),
            "job_name": job.settings.name if job.settings else None,
            "message": f"Batch job ID updated to {new_job_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update batch job config: {str(e)}")


@app.get("/api/search-jobs")
def search_jobs(name_filter: str = ""):
    """Search for Databricks jobs by name"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection not configured")

    try:
        # List all jobs
        jobs_list = w.jobs.list(expand_tasks=False, limit=100)

        # Filter by name if provided
        filtered_jobs = []
        for job in jobs_list:
            job_name = job.settings.name if job.settings and job.settings.name else ""
            if not name_filter or name_filter.lower() in job_name.lower():
                filtered_jobs.append({
                    "job_id": str(job.job_id),
                    "job_name": job_name,
                    "created_time": job.created_time,
                    "creator_user_name": job.creator_user_name
                })

        # Sort by created time (most recent first)
        filtered_jobs.sort(key=lambda x: x.get("created_time", 0), reverse=True)

        return {
            "success": True,
            "jobs": filtered_jobs[:20],  # Return top 20 results
            "total_found": len(filtered_jobs)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search jobs: {str(e)}")


@app.post("/api/upload-to-uc")
async def upload_to_uc(files: List[UploadFile] = FastAPIFile(...)):
    """Upload files to Databricks UC Volume"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    try:
        uploaded_files = []
        
        # Create "images" directory in UC Volume if it doesn't exist
        base_path = get_uc_volume_path().rstrip('/')  # Remove trailing slash
        images_dir_path = f"{base_path}/images"
        
        try:
            # Try to create the images directory
            w.files.create_directory(directory_path=images_dir_path)
            print(f"✅ Created images directory: {images_dir_path}")
        except Exception as dir_error:
            # Directory might already exist, check if it's a "directory already exists" error
            if "already exists" in str(dir_error).lower() or "file_already_exists" in str(dir_error).lower():
                print(f"📁 Images directory already exists: {images_dir_path}")
            else:
                print(f"⚠️ Warning: Could not create images directory: {dir_error}")
        
        for file in files:
            # Create a temporary file to store the uploaded content
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                # Copy file content to temporary file
                shutil.copyfileobj(file.file, temp_file)
                temp_file_path = temp_file.name
            
            try:
                # Upload to UC Volume
                uc_file_path = f"{base_path}/{file.filename}"
                
                # Delete existing file/directory first to prevent directory creation issue
                print(f"🔍 Checking for existing content at: {uc_file_path}")
                
                # Try multiple deletion strategies to ensure clean upload
                deleted = False
                
                # Strategy 1: Try deleting as directory first (most common issue)
                try:
                    w.files.delete(file_path=uc_file_path, recursive=True)
                    print(f"🗑️ Successfully deleted existing directory: {uc_file_path}")
                    deleted = True
                except Exception as e1:
                    print(f"📝 Directory delete attempt failed: {str(e1)[:100]}...")
                    
                    # Strategy 2: Try deleting as file
                    try:
                        w.files.delete(file_path=uc_file_path)
                        print(f"🗑️ Successfully deleted existing file: {uc_file_path}")
                        deleted = True
                    except Exception as e2:
                        print(f"📝 File delete attempt failed: {str(e2)[:100]}...")
                
                if not deleted:
                    print(f"📝 No existing content found to delete at: {uc_file_path}")
                else:
                    # Verify deletion worked
                    try:
                        # Try to get status - this should fail if deletion worked
                        w.files.get_status(path=uc_file_path)
                        print("⚠️ WARNING: Content still exists after deletion attempt!")
                    except Exception:
                        print("✅ Verified: Path is now clear for upload")
                
                # Add a longer delay to ensure delete operation completes
                import time
                time.sleep(0.5)  # Increased delay
                
                # Upload to UC Volume using the Files API with file handle
                print(f"📤 Starting upload to: {uc_file_path}")
                with open(temp_file_path, 'rb') as f:
                    w.files.upload(
                        file_path=uc_file_path,
                        contents=f,
                        overwrite=True  # Use overwrite=True as additional safety
                    )
                print(f"✅ Upload completed successfully: {uc_file_path}")
                
                # Get file size for response
                file_size = os.path.getsize(temp_file_path)
                
                uploaded_files.append({
                    "name": file.filename,
                    "path": uc_file_path,
                    "size": file_size
                })
                
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)
        
        return {
            "success": True,
            "uploaded_files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} files to UC Volume"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/api/write-to-delta-table")
def write_to_delta_table(request: WriteToTableRequest):
    """Write processed documents to delta table using ai_parse_document - supports batch and append mode"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")

    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    if not request.file_paths:
        raise HTTPException(status_code=400, detail="file_paths is required")

    try:
        # Get the existing delta table path
        destination_table = get_delta_table_path()
        print(f"Working with delta table: {destination_table}")
        print(f"Processing {len(request.file_paths)} file(s) in {request.operation_mode} mode")
        print(f"Files to process: {request.file_paths}")
        
        print("Checking table schema...")
        try:
            # Check if table has new schema
            has_new_schema = False
            if not has_new_schema:
                print("Table has old schema or doesn't exist. Creating/recreating table...")
                
                # First drop the table
                drop_query = f"DROP TABLE IF EXISTS IDENTIFIER('{destination_table}')"
                
                drop_result = w.statement_execution.execute_statement(
                    statement=drop_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if drop_result.status and drop_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to drop table: {drop_result.status}")
                
                # Then create the table with new schema
                create_query = f"""
                CREATE TABLE IDENTIFIER('{destination_table}') (
                    path STRING,
                    element_id BIGINT,
                    type STRING,
                    bbox ARRAY<DOUBLE>,
                    page_id STRING,
                    content STRING,
                    description STRING,
                    image_uri STRING
                ) USING DELTA
                """
                
                create_result = w.statement_execution.execute_statement(
                    statement=create_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if create_result.status and create_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to create table: {create_result.status}")
                    
                print("Table recreated with new schema")
            else:
                print("Table already has correct schema")
                
        except Exception as e:
            if "TABLE_OR_VIEW_NOT_FOUND" in str(e):
                print("Table doesn't exist, creating new table...")
                create_table_query = f"""
                CREATE TABLE IDENTIFIER('{destination_table}') (
                    path STRING,
                    element_id BIGINT,
                    type STRING,
                    bbox ARRAY<DOUBLE>,
                    page_id STRING,
                    content STRING,
                    description STRING,
                    image_uri STRING
                ) USING DELTA
                """
                
                create_result = w.statement_execution.execute_statement(
                    statement=create_table_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if create_result.status and create_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to create table: {create_result.status}")
            else:
                raise e
        
        print("Table exists with correct schema")

        # Handle deletion based on operation mode
        if request.operation_mode == 'replace':
            # TRUNCATE entire table - delete ALL existing records
            truncate_query = f"""
            DELETE FROM IDENTIFIER('{destination_table}')
            """

            print("Truncating entire table (replace mode)...")
            truncate_result = w.statement_execution.execute_statement(
                statement=truncate_query,
                warehouse_id=current_warehouse_id,
                wait_timeout='30s'
            )

            if truncate_result.status and truncate_result.status.state == StatementState.FAILED:
                print(f"Truncate operation failed: {truncate_result.status}")
            else:
                print("Table truncated successfully")
        elif request.operation_mode == 'append':
            # In append mode, delete only the specific files being processed to avoid duplicates
            for file_path in request.file_paths:
                if file_path.startswith('/Volumes/'):
                    dbfs_path = 'dbfs:' + file_path
                else:
                    dbfs_path = file_path

                delete_query = f"""
                DELETE FROM IDENTIFIER('{destination_table}')
                WHERE path = '{dbfs_path}'
                """

                print(f"Deleting existing records for {dbfs_path} (append mode)...")
                delete_result = w.statement_execution.execute_statement(
                    statement=delete_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )

                if delete_result.status and delete_result.status.state == StatementState.FAILED:
                    print(f"Delete operation failed for {dbfs_path}: {delete_result.status}")
                else:
                    print(f"Existing records deleted successfully for {dbfs_path}")
        
        # Process all files in a SINGLE batch INSERT using ai_parse_document
        # Convert all file paths to dbfs format
        dbfs_paths = []
        for file_path in request.file_paths:
            if file_path.startswith('/Volumes/'):
                dbfs_path = 'dbfs:' + file_path
            else:
                dbfs_path = file_path
            dbfs_paths.append(dbfs_path)

        print(f"Processing {len(dbfs_paths)} files in batch: {dbfs_paths}")

        # Use the parent directory from the first file for image output
        first_file_path = request.file_paths[0]
        base_path = re.sub(r'/[^/]+$', '', first_file_path)  # Remove the file name at the end

        # Check if all files are in the same directory
        all_same_dir = all(
            re.sub(r'/[^/]+$', '', path) == base_path
            for path in request.file_paths
        )

        # Create a single INSERT query that processes ALL files in batch
        if all_same_dir and len(request.file_paths) > 1:
            # OPTIMIZATION: All files in same directory - use glob pattern
            # This is much more efficient than UNION ALL for many files
            dbfs_base_path = f"dbfs:{base_path}" if base_path.startswith('/Volumes/') else base_path
            read_files_pattern = f"'{dbfs_base_path}/*.pdf'"
            print(f"Using optimized glob pattern for batch processing: {read_files_pattern}")
            file_cte = f"SELECT path, content FROM READ_FILES({read_files_pattern}, format => 'binaryFile')"
        else:
            # Files in different directories - use UNION ALL
            print("Using UNION ALL for files in different directories")
            read_files_union = ' UNION ALL '.join([
                f"SELECT path, content FROM READ_FILES('{dbfs_path}', format => 'binaryFile')"
                for dbfs_path in dbfs_paths
            ])
            file_cte = read_files_union

        insert_query = f"""
        INSERT INTO IDENTIFIER('{destination_table}')
        WITH file AS (
          {file_cte}
        ),
        parsed as (
          SELECT
            path,
              ai_parse_document(
                  content,
                  map('version', '2.0',
                      'imageOutputPath', '{base_path}/images',
                      'descriptionElementTypes', '*')
              ) as parsed
          FROM file
        ),
        pages as (
          SELECT
              path,
              id as page_id,
              cast(image_uri:image_uri as string) as image_uri
          FROM
          (
              SELECT
                  path,
                  posexplode(try_cast(parsed:document:pages AS ARRAY<VARIANT>)) AS (id, image_uri)
              FROM parsed
              WHERE parsed:document:pages IS NOT NULL
              AND CAST(parsed:error_status AS STRING) IS NULL
          )
        ),
        elements as (
          select
            path,
            cast(items:id as int) as element_id,
            cast(items:type as string) as type,
            cast(items:bbox[0]:coord as ARRAY<DOUBLE>) as bbox,
            cast(items:bbox[0]:page_id as int) as page_id,
            CASE
              WHEN cast(items:type as string) = 'figure' THEN cast(items:description as string)
              ELSE cast(items:content as string)
            END as content,
            cast(items:description as string) as description
          from
          (
            SELECT
              path,
              posexplode(try_cast(parsed:document:elements AS ARRAY<VARIANT>)) AS (idx, items)
            FROM parsed
            WHERE
              parsed:document:elements IS NOT NULL
              AND CAST(parsed:error_status AS STRING) IS NULL
          )
        )
        select
            e.*,
            p.image_uri
        from elements e
        inner join pages p
        on e.path = p.path and e.page_id = p.page_id
        """

        print(f"Executing BATCH INSERT for {len(request.file_paths)} files")

        try:
            insert_result = w.statement_execution.execute_statement(
                statement=insert_query,
                warehouse_id=current_warehouse_id,
                wait_timeout='50s'  # Maximum allowed by Databricks (5s-50s range)
            )

            print(f"BATCH INSERT result: {insert_result.status}")

            # If the operation is still pending or running, wait for it to complete
            if insert_result.status and insert_result.status.state in [StatementState.PENDING, StatementState.RUNNING]:
                print("BATCH INSERT operation is pending, waiting for completion...")
                try:
                    # Wait for the statement to complete
                    final_result = w.statement_execution.get_statement(insert_result.statement_id)

                    # Keep checking until it's no longer pending or running (up to 10 minutes for batch)
                    max_wait = 600
                    waited = 0
                    while final_result.status.state in [StatementState.PENDING, StatementState.RUNNING] and waited < max_wait:
                        time.sleep(5)
                        waited += 5
                        final_result = w.statement_execution.get_statement(insert_result.statement_id)
                        print(f"Waiting for BATCH INSERT completion... ({waited}s) - Status: {final_result.status.state}")

                    print(f"Final BATCH INSERT result: {final_result.status}")
                    insert_result = final_result

                except Exception as wait_error:
                    print(f"Error waiting for BATCH INSERT completion: {wait_error}")

            if insert_result.status and insert_result.status.state == StatementState.SUCCEEDED:
                print(f"Successfully processed all {len(request.file_paths)} files in batch")
                # Return all files as successful
                return {
                    "success": True,
                    "destination_table": destination_table,
                    "processed_files": request.file_paths,
                    "failed_files": [],
                    "total_processed": len(request.file_paths),
                    "total_failed": 0,
                    "operation_mode": request.operation_mode,
                    "message": f"Successfully processed all {len(request.file_paths)} files in batch ({request.operation_mode} mode)"
                }
            else:
                error_msg = "Batch processing failed"
                if insert_result.status and insert_result.status.error:
                    error_msg += f": {insert_result.status.error}"
                print(error_msg)
                # Return all files as failed
                return {
                    "success": False,
                    "destination_table": destination_table,
                    "processed_files": [],
                    "failed_files": [{"file_path": fp, "error": error_msg} for fp in request.file_paths],
                    "total_processed": 0,
                    "total_failed": len(request.file_paths),
                    "operation_mode": request.operation_mode,
                    "message": error_msg
                }

        except Exception as batch_error:
            error_msg = f"Error in batch processing: {str(batch_error)}"
            print(error_msg)
            # Return all files as failed
            return {
                "success": False,
                "destination_table": destination_table,
                "processed_files": [],
                "failed_files": [{"file_path": fp, "error": error_msg} for fp in request.file_paths],
                "total_processed": 0,
                "total_failed": len(request.file_paths),
                "operation_mode": request.operation_mode,
                "message": error_msg
            }

    except Exception as e:
        print(f"Delta table write error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to write to delta table: {str(e)}")

@app.get("/api/processed-files")
def list_processed_files():
    """Get list of all unique files in the delta table with metadata"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")

    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    try:
        destination_table = get_delta_table_path()
        print(f"Listing processed files from delta table: {destination_table}")

        query = f"""
        SELECT
            path,
            COUNT(DISTINCT page_id) as total_pages,
            COUNT(*) as total_elements,
            MIN(element_id) as first_element_id,
            MAX(element_id) as last_element_id
        FROM IDENTIFIER('{destination_table}')
        GROUP BY path
        ORDER BY path
        """

        print(f"Executing processed files query: {query}")

        result = w.statement_execution.execute_statement(
            statement=query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )

        if result.result and result.result.data_array:
            processed_files = []
            for row in result.result.data_array:
                path = row[0] if len(row) > 0 else ""
                total_pages = int(row[1]) if len(row) > 1 and row[1] is not None else 0
                total_elements = int(row[2]) if len(row) > 2 and row[2] is not None else 0

                # Extract filename from path
                filename = path.split('/')[-1] if path else "Unknown"

                processed_files.append({
                    "path": path,
                    "filename": filename,
                    "total_pages": total_pages,
                    "total_elements": total_elements
                })

            print(f"Found {len(processed_files)} processed files")
            return {
                "success": True,
                "processed_files": processed_files,
                "total_files": len(processed_files),
                "table_name": destination_table
            }
        else:
            print("No processed files found")
            return {
                "success": True,
                "processed_files": [],
                "total_files": 0,
                "message": "No processed files found in delta table"
            }

    except Exception as e:
        print(f"Processed files query error: {e}")
        return {
            "success": False,
            "processed_files": [],
            "total_files": 0,
            "error": f"Failed to list processed files: {str(e)}"
        }

@app.post("/api/query-delta-table")
def query_delta_table(request: QueryDeltaTableRequest):
    """Query delta table results for specific documents"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    try:
        # Get the delta table path
        destination_table = get_delta_table_path()
        print(f"Querying delta table: {destination_table}")
        
        # Build the query with optional file filtering and page filtering
        where_conditions = []
        
        if request.file_paths:
            # Convert to dbfs: format for filtering
            dbfs_file_paths = []
            for fp in request.file_paths:
                if fp.startswith('/Volumes/'):
                    dbfs_path = 'dbfs:' + fp
                else:
                    dbfs_path = fp
                dbfs_file_paths.append(dbfs_path)
            
            # Use exact path matching instead of LIKE with filename
            path_conditions = ", ".join([f"'{fp}'" for fp in dbfs_file_paths])
            where_conditions.append(f"path IN ({path_conditions})")
        
        if request.page_number is not None:
            where_conditions.append(f"page_id = {request.page_number}")
        
        where_clause = ""
        if where_conditions:
            where_clause = f"WHERE {' AND '.join(where_conditions)}"
        
        query = f"""
        SELECT
            path,
            element_id,
            type,
            cast(bbox as ARRAY<DOUBLE>) as bbox,
            page_id,
            content,
            description,
            image_uri
        FROM IDENTIFIER('{destination_table}')
        {where_clause}
        ORDER BY page_id, element_id
        """
        
        print(f"Executing query: {query}")
        
        result = w.statement_execution.execute_statement(
            statement=query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )

        if result.result and result.result.data_array:
            delta_results = []
            for row in result.result.data_array:
                delta_results.append({
                    "path": row[0] if len(row) > 0 else "",
                    "element_id": row[1] if len(row) > 1 else None,
                    "type": row[2] if len(row) > 2 else "",
                    "bbox": row[3] if len(row) > 3 else None,
                    "page_id": row[4] if len(row) > 4 else "",
                    "content": row[5] if len(row) > 5 else "",
                    "description": row[6] if len(row) > 6 else "",
                    "image_uri": row[7] if len(row) > 7 else ""
                })
            
            print(f"Returning {len(delta_results)} results from delta table")
            return {
                "success": True,
                "data": delta_results,
                "table_name": destination_table,
                "total_results": len(delta_results)
            }
        else:
            print("No data returned from query")
            return {
                "success": True,
                "data": [],
                "message": "No results found in delta table"
            }

    except Exception as e:
        print(f"Delta table query error: {e}")
        return {
            "success": False,
            "data": [],
            "error": f"Failed to query delta table: {str(e)}"
        }

@app.post("/api/page-metadata")
def get_page_metadata(request: PageMetadataRequest):
    """Get page metadata including total pages and elements count per page"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    try:
        destination_table = get_delta_table_path()
        print(f"Getting page metadata from delta table: {destination_table}")
        
        # Build the query with optional file filtering
        where_conditions = []
        
        if request.file_paths:
            # Convert to dbfs: format for filtering
            dbfs_file_paths = []
            for fp in request.file_paths:
                if fp.startswith('/Volumes/'):
                    dbfs_path = 'dbfs:' + fp
                else:
                    dbfs_path = fp
                dbfs_file_paths.append(dbfs_path)
            
            # Use exact path matching
            path_conditions = ", ".join([f"'{fp}'" for fp in dbfs_file_paths])
            where_conditions.append(f"path IN ({path_conditions})")
        
        where_clause = ""
        if where_conditions:
            where_clause = f"WHERE {' AND '.join(where_conditions)}"
        
        # Query to get page metadata
        query = f"""
        SELECT
            page_id,
            COUNT(*) as elements_count,
            COUNT(DISTINCT path) as file_count
        FROM IDENTIFIER('{destination_table}')
        {where_clause}
        GROUP BY page_id
        ORDER BY page_id
        """
        
        print(f"Executing page metadata query: {query}")
        
        result = w.statement_execution.execute_statement(
            statement=query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )

        if result.result and result.result.data_array:
            pages_metadata = []
            total_elements = 0
            
            for row in result.result.data_array:
                page_id = row[0] if len(row) > 0 else None
                elements_count = int(row[1]) if len(row) > 1 and row[1] is not None else 0
                file_count = int(row[2]) if len(row) > 2 and row[2] is not None else 0
                
                if page_id is not None:
                    pages_metadata.append({
                        "page_id": int(page_id),  # Ensure page_id is integer
                        "page_number": int(page_id) + 1,  # Display page number starting from 1
                        "elements_count": elements_count,
                        "file_count": file_count
                    })
                    total_elements += elements_count
            
            print(f"Returning metadata for {len(pages_metadata)} pages with {total_elements} total elements")
            return {
                "success": True,
                "total_pages": len(pages_metadata),
                "total_elements": total_elements,
                "pages": pages_metadata,
                "table_name": destination_table
            }
        else:
            print("No page metadata found")
            return {
                "success": True,
                "total_pages": 0,
                "total_elements": 0,
                "pages": [],
                "message": "No pages found in delta table"
            }

    except Exception as e:
        print(f"Page metadata query error: {e}")
        return {
            "success": False,
            "total_pages": 0,
            "total_elements": 0,
            "pages": [],
            "error": f"Failed to get page metadata: {str(e)}"
        }

@app.post("/api/visualize-page")
def visualize_page(request: VisualizePageRequest):
    """Generate page visualization with bounding boxes overlaid on the image"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    try:
        destination_table = get_delta_table_path()
        print(f"Creating document visualization for file: {request.file_path}")
        
        # Use batch query approach from image_utils.py for better performance
        where_conditions = []
        
        if request.file_path:
            # Convert to dbfs format for filtering
            if request.file_path.startswith('/Volumes/'):
                dbfs_path = 'dbfs:' + request.file_path
            else:
                dbfs_path = request.file_path
            where_conditions.append(f"path = '{dbfs_path}'")
        
        if request.page_number is not None:
            where_conditions.append(f"page_id = {request.page_number}")
        
        where_clause = ""
        if where_conditions:
            where_clause = f"WHERE {' AND '.join(where_conditions)}"
        
        query = f"""
        SELECT
            image_uri,
            page_id,
            collect_list(named_struct(
                'element_id', element_id,
                'type', type, 
                'bbox', cast(bbox as ARRAY<DOUBLE>),
                'content', content,
                'description', description
            )) as element_data_list
        FROM IDENTIFIER('{destination_table}')
        {where_clause}
        GROUP BY image_uri, page_id
        """
        
        print(f"Executing visualization query: {query}")
        
        result = w.statement_execution.execute_statement(
            statement=query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )

        if not result.result or not result.result.data_array:
            return {
                "success": False,
                "message": "No elements found for the specified page"
            }

        # Extract batch data from the optimized query
        if len(result.result.data_array) == 0:
            return {
                "success": False,
                "message": "No image data found for the specified document"
            }
        
        # Process all pages from the grouped results
        pages_data = {}
        total_elements = 0
        
        for row in result.result.data_array:
            image_uri = row[0] if len(row) > 0 else None
            page_id = row[1] if len(row) > 1 else None
            element_data_list_raw = row[2] if len(row) > 2 else []
            
            # Debug logging to understand data format
            print(f"Processing row - image_uri: {image_uri}, page_id: {page_id}")
            print(f"element_data_list_raw type: {type(element_data_list_raw)}")
            print(f"element_data_list_raw sample: {element_data_list_raw[:2] if isinstance(element_data_list_raw, list) and len(element_data_list_raw) > 0 else element_data_list_raw}")
            
            if not image_uri or page_id is None:
                continue
            
            # Convert page_id to string for consistency
            page_id_str = str(page_id)
            
            # Process the collected elements for this page
            elements = []
            if element_data_list_raw:
                try:
                    # Parse the JSON string first before iterating
                    if isinstance(element_data_list_raw, str):
                        import json
                        parsed_elements = json.loads(element_data_list_raw)
                    else:
                        parsed_elements = element_data_list_raw
                    
                    # Now iterate over the parsed elements
                    for element_data in parsed_elements:
                        try:
                            if element_data and element_data.get('bbox') and element_data.get('type'):
                                bbox_raw = element_data['bbox']
                                
                                # Convert bbox from Array<string> to Array<double> for drawing
                                try:
                                    if isinstance(bbox_raw, list):
                                        # Convert string coordinates to float
                                        bbox_coords = [float(coord) for coord in bbox_raw]
                                    else:
                                        print(f"Unexpected bbox format: {bbox_raw}")
                                        continue
                                except (ValueError, TypeError) as e:
                                    print(f"Error converting bbox coordinates: {bbox_raw}, error: {e}")
                                    continue
                                
                                elements.append({
                                    "element_id": element_data.get('element_id'),
                                    "type": element_data['type'],
                                    "bbox": bbox_coords,
                                    "content": element_data.get('content', ''),
                                    "description": element_data.get('description', '')
                                })
                        except (TypeError, AttributeError) as e:
                            print(f"Error processing individual element: {element_data}, error: {e}")
                            continue
                            
                except (json.JSONDecodeError, TypeError) as e:
                    print(f"Error parsing element_data_list_raw as JSON: {element_data_list_raw}, error: {e}")
                    continue
            
            if elements:  # Only include pages that have elements
                pages_data[page_id_str] = {
                    "image_uri": image_uri,
                    "elements": elements,
                    "elements_count": len(elements)
                }
                total_elements += len(elements)

        print(f"Found {len(pages_data)} pages with {total_elements} total elements")

        # Process each page to generate visualizations
        visualizations = {}
        
        for page_id, page_data in pages_data.items():
            image_uri = page_data["image_uri"]
            elements = page_data["elements"]
            
            try:
                # Convert image_uri from dbfs format to volume format for download
                if image_uri.startswith('dbfs:/Volumes/'):
                    download_path = image_uri[5:]  # Remove 'dbfs:' prefix
                else:
                    download_path = image_uri
                
                print(f"Downloading image from: {download_path}")
                image_response = w.files.download(file_path=download_path)
                
                # Convert response to PIL Image
                image_bytes = None
                if hasattr(image_response, 'contents'):
                    if isinstance(image_response.contents, bytes):
                        image_bytes = image_response.contents
                    elif hasattr(image_response.contents, 'iter_content'):
                        image_bytes = b''.join(chunk for chunk in image_response.contents.iter_content(chunk_size=8192))
                    elif hasattr(image_response.contents, 'read'):
                        image_bytes = image_response.contents.read()
                elif hasattr(image_response, 'content'):
                    image_bytes = image_response.content
                elif hasattr(image_response, 'iter_content'):
                    image_bytes = b''.join(chunk for chunk in image_response.iter_content(chunk_size=8192))
                
                if not image_bytes:
                    print(f"Could not extract image bytes for page {page_id}")
                    continue
                    
                image = Image.open(io.BytesIO(image_bytes))
                print(f"Loaded image for page {page_id}: Size {image.size}")
                
                # Use the exact drawing logic from image_utils.py for consistency
                type_color_map = {
                    'text': 'blue', 
                    'title': 'red', 
                    'section_header': 'purple', 
                    'table': 'lime', 
                    'figure': 'magenta', 
                    'page_footer': 'orange', 
                    'page_header': 'orange'
                }
                
                image_with_boxes = image.copy()
                
                # Convert elements to the format expected by the drawing logic
                type_bbox_tuples = [(element["type"], element["bbox"]) for element in elements if element.get("bbox")]
                
                for label, bbox_coords in type_bbox_tuples:
                    try:
                        color = type_color_map.get(label, 'gray')
                        
                        # Create draw object
                        draw = ImageDraw.Draw(image_with_boxes)
                        
                        # Draw the bounding box with thicker lines (using image_utils.py width=5)
                        draw.rectangle(bbox_coords, outline=color, width=5)
                        
                        # Draw the label
                        try:
                            # Try to use a better font if available (matching image_utils.py)
                            font = ImageFont.truetype("arial.ttf", 16)
                        except (OSError, IOError):
                            font = ImageFont.load_default()
                        
                        # Get text dimensions (using textbbox for newer PIL versions)
                        try:
                            bbox_text = draw.textbbox((0, 0), label, font=font)
                            text_width = bbox_text[2] - bbox_text[0]
                            text_height = bbox_text[3] - bbox_text[1]
                        except AttributeError:
                            # Fallback for older PIL versions
                            text_width, text_height = draw.textsize(label, font=font)
                        
                        # Position text above the bounding box
                        text_x = bbox_coords[0]
                        text_y = bbox_coords[1] - text_height - 2 if bbox_coords[1] - text_height - 2 > 0 else bbox_coords[1] + 2
                        
                        # Draw background rectangle for text
                        draw.rectangle(
                            [text_x - 2, text_y - 2, text_x + text_width + 2, text_y + text_height + 2],
                            fill='white',
                            outline=color
                        )
                        
                        # Draw the text
                        draw.text((text_x, text_y), label, fill=color, font=font)
                        
                    except Exception as e:
                        print(f"Error processing bbox: {e}")
                        continue

                # Convert image to base64 for return
                buffer = io.BytesIO()
                image_with_boxes.save(buffer, format='PNG')
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                # Store the visualization for this page
                visualizations[page_id] = {
                    "image_base64": image_base64,
                    "elements": elements,
                    "elements_count": len(elements),
                    "image_uri": image_uri
                }
                
            except Exception as e:
                print(f"Error processing page {page_id}: {e}")
                continue
        
        print(f"Successfully generated {len(visualizations)} page visualizations")
        
        return {
            "success": True,
            "visualizations": visualizations,
            "total_pages": len(visualizations),
            "total_elements": total_elements
        }

    except Exception as e:
        print(f"Page visualization error: {e}")
        return {
            "success": False,
            "message": f"Failed to generate page visualization: {str(e)}"
        }


# Mount static files for Next.js assets (_next directory, favicon, etc.)
# Use absolute path in Databricks Apps environment
if os.path.exists("/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"):
    target_dir = "/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"
elif os.path.exists("/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"):
    target_dir = "/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"
else:
    # Fallback for local development
    target_dir = "static"

print(f"📁 Serving static files from: {target_dir}")
print(f"📁 _next directory exists: {os.path.exists(f'{target_dir}/_next')}")

# Mount Next.js static assets with proper error handling
try:
    if os.path.exists(f"{target_dir}/_next"):
        app.mount("/_next", StaticFiles(directory=f"{target_dir}/_next"), name="nextjs-assets")
        print("✅ Successfully mounted /_next static files")
    else:
        print("❌ _next directory not found - static assets will not be served")
except Exception as e:
    print(f"❌ Failed to mount static files: {e}")

# Serve other static files with better error handling
@app.get("/favicon.ico")
def favicon():
    try:
        favicon_path = f"{target_dir}/favicon.ico"
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path)
        else:
            print(f"❌ Favicon not found at {favicon_path}")
            raise HTTPException(status_code=404, detail="Favicon not found")
    except Exception as e:
        print(f"❌ Error serving favicon: {e}")
        raise HTTPException(status_code=500, detail="Error serving favicon")

@app.get("/file.svg")  
def file_svg():
    try:
        file_path = f"{target_dir}/file.svg"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        else:
            print(f"❌ file.svg not found at {file_path}")
            raise HTTPException(status_code=404, detail="file.svg not found")
    except Exception as e:
        print(f"❌ Error serving file.svg: {e}")
        raise HTTPException(status_code=500, detail="Error serving file.svg")

# Add a catch-all route for static assets
@app.get("/{asset_path:path}")
def serve_static_asset(asset_path: str):
    """Serve static assets with fallback to main page"""
    # Handle static assets
    if any(asset_path.endswith(ext) for ext in ['.js', '.css', '.woff2', '.svg', '.png', '.ico']):
        static_file_path = f"{target_dir}/{asset_path}"
        if os.path.exists(static_file_path):
            print(f"✅ Serving static asset: {asset_path}")
            return FileResponse(static_file_path)
        else:
            print(f"❌ Static asset not found: {asset_path} at {static_file_path}")
            raise HTTPException(status_code=404, detail=f"Static asset not found: {asset_path}")
    
    # Handle page routes - continue with existing logic
    return serve_react_app(asset_path)

def serve_react_app(full_path: str):
    """Handle Next.js page routes - serve appropriate index.html"""
    # If the request is for a specific HTML file, serve it
    if full_path.endswith('.html'):
        file_path = f"{target_dir}/{full_path}"
        if os.path.exists(file_path):
            return FileResponse(file_path)
    
    
    # For the next-steps route, serve its specific page
    if full_path.startswith("next-steps"):
        file_path = f"{target_dir}/next-steps/index.html"
        if os.path.exists(file_path):
            return FileResponse(file_path)
    
    # For the document-intelligence route, serve its specific page
    if full_path.startswith("document-intelligence"):
        file_path = f"{target_dir}/document-intelligence/index.html"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        
    # For all other routes, serve the main index.html
    return FileResponse(f"{target_dir}/index.html") 