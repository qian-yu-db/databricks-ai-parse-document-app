# Databricks notebook source
# MAGIC %md
# MAGIC # Clean Pipeline Tables and Checkpoints
# MAGIC
# MAGIC This notebook provides a utility to clean up all tables and checkpoints created by the document processing pipeline.

# COMMAND ----------

# Get parameters
dbutils.widgets.text("catalog", "fins_genai", "Catalog name")
dbutils.widgets.text("schema", "unstructured_documents", "Schema name")
dbutils.widgets.text(
    "output_volume_path",
    "/Volumes/fins_genai/unstructured_documents/ai_parse_document_workflow/outputs/",
    "Output volume path",
)
dbutils.widgets.dropdown(
    name="clean_pipeline_tables",
    choices=["No", "Yes"],
    defaultValue="No",
    label="Clean all pipeline tables and checkpoints?",
)
dbutils.widgets.text("raw_table_name", "parsed_documents_raw", "Raw table name")
dbutils.widgets.text(
    "content_table_name", "parsed_documents_content", "Content table name"
)
dbutils.widgets.text(
    "structured_table_name", "parsed_documents_structured", "Structured table name"
)
dbutils.widgets.text(
    "checkpoint_base_path",
    "checkpoints/ai_parse_document_workflow",
    "Checkpoint base path",
)

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
output_volume_path = dbutils.widgets.get("output_volume_path")
clean_pipeline = dbutils.widgets.get("clean_pipeline_tables")
raw_table_name = dbutils.widgets.get("raw_table_name")
content_table_name = dbutils.widgets.get("content_table_name")
structured_table_name = dbutils.widgets.get("structured_table_name")
checkpoint_base_path = dbutils.widgets.get("checkpoint_base_path")

# COMMAND ----------

# Set catalog and schema
spark.sql(f"USE CATALOG {catalog}")
spark.sql(f"USE SCHEMA {schema}")

# COMMAND ----------

import shutil
import os


def ensure_directories_exist():
    """Ensure required directories exist, create if they don't"""

    print("📁 Checking and creating required directories...")

    # Define all required directories
    required_dirs = [
        output_volume_path,
        f"/Volumes/{catalog}/{schema}/{checkpoint_base_path}",
    ]

    for directory in required_dirs:
        try:
            if not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                print(f"  ✅ Created directory: {directory}")
            else:
                print(f"  ℹ️  Directory already exists: {directory}")
        except Exception as e:
            print(f"  ❌ Failed to create directory {directory}: {str(e)}")

    print("📁 Directory check completed!\n")


def cleanup_pipeline():
    """Clean up all pipeline tables and checkpoints"""

    print("🧹 Starting pipeline cleanup...")

    # Define all tables created by the pipeline
    tables_to_drop = [
        raw_table_name,
        content_table_name,
        structured_table_name,
    ]

    # Define all checkpoint locations
    checkpoint_paths = [
        f"{checkpoint_base_path}/01_parse_documents",
        f"{checkpoint_base_path}/02_extract_document_content",
        f"{checkpoint_base_path}/03_extract_key_info",
    ]

    # Drop tables
    print("📋 Dropping pipeline tables...")
    for table in tables_to_drop:
        try:
            spark.sql(f"DROP TABLE IF EXISTS {catalog}.{schema}.{table}")
            print(f"  ✅ Dropped table: {table}")
        except Exception as e:
            print(f"  ❌ Failed to drop table {table}: {str(e)}")

    # Clean checkpoint directories
    print("\n🗂️  Cleaning checkpoint directories...")
    for checkpoint_path in checkpoint_paths:
        try:
            # Check if path exists before attempting to remove
            if os.path.exists(checkpoint_path):
                shutil.rmtree(checkpoint_path)
                print(f"  ✅ Removed checkpoint: {checkpoint_path}")
            else:
                print(f"  ℹ️  Checkpoint directory not found: {checkpoint_path}")
        except Exception as e:
            print(f"  ❌ Failed to remove checkpoint {checkpoint_path}: {str(e)}")

    # Clean any additional output directories (optional)
    output_paths = [
        f"{output_volume_path}",
    ]

    print("\n📁 Cleaning output directories...")
    for output_path in output_paths:
        try:
            if os.path.exists(output_path):
                # Only remove contents, not the directory itself
                for item in os.listdir(output_path):
                    item_path = os.path.join(output_path, item)
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                    else:
                        os.remove(item_path)
                print(f"  ✅ Cleaned output directory: {output_path}")
            else:
                print(f"  ℹ️  Output directory not found: {output_path}")
        except Exception as e:
            print(f"  ❌ Failed to clean output directory {output_path}: {str(e)}")

    print("\n🎉 Pipeline cleanup completed!")

# COMMAND ----------

# Ensure directories exist if requested
ensure_directories_exist()

# Clean pipeline if requested
if clean_pipeline == "Yes":
    print("⚠️  CLEANING PIPELINE - This will remove all tables and checkpoints!")
    cleanup_pipeline()
else:
    print(
        "ℹ️  Cleanup skipped. Set 'Clean all pipeline tables and checkpoints?' to 'Yes' to proceed."
    )
    print("\n📋 Tables that would be cleaned:")
    print("  - parsed_documents_raw")
    print("  - parsed_documents_content")
    print("\n🗂️  Checkpoint directories that would be cleaned:")
    print(
        "  - /Volumes/fins_genai/unstructured_documents/checkpoints/ai_parse_document_workflow/*"
    )
    print("\n📁 Output directories that would be cleaned:")
    print("  - ", output_volume_path)
