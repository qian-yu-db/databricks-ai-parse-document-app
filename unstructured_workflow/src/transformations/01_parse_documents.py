# Databricks notebook source
# MAGIC %md
# MAGIC # Parse Documents using ai_parse_document
# MAGIC
# MAGIC This notebook uses batch processing to parse PDFs and images using the ai_parse_document function.

# COMMAND ----------

# Get parameters
dbutils.widgets.text("catalog", "fins_genai", "Catalog name")
dbutils.widgets.text("schema", "unstructured_documents", "Schema name")
dbutils.widgets.text(
    "source_volume_path",
    "/Volumes/fins_genai/unstructured_documents/ai_parse_document_workflow/inputs/",
    "Source volume path",
)
dbutils.widgets.text(
    "output_volume_path",
    "/Volumes/fins_genai/unstructured_documents/ai_parse_document_workflow/outputs/",
    "Output volume path",
)
dbutils.widgets.text("table_name", "parsed_documents_raw", "Output table name")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
source_volume_path = dbutils.widgets.get("source_volume_path")
output_volume_path = dbutils.widgets.get("output_volume_path")
table_name = dbutils.widgets.get("table_name")

# COMMAND ----------

# Set catalog and schema
spark.sql(f"USE CATALOG {catalog}")
spark.sql(f"USE SCHEMA {schema}")

# COMMAND ----------

print("🚀 Starting Document Parsing Pipeline (Batch Mode)...")
print(f"📂 Source Path: {source_volume_path}")
print(f"📄 Output Table: {catalog}.{schema}.{table_name}")

from pyspark.sql.functions import col, current_timestamp, expr

# Read files using batch processing
print("📖 Reading files with pattern: *.{pdf,jpg,jpeg,png}")
files_df = (
    spark.read.format("binaryFile")
    .option("pathGlobFilter", "*.{pdf,jpg,jpeg,png}")
    .load(source_volume_path)
)

# Count files to process
file_count = files_df.count()
print(f"📊 Found {file_count} files to process")

if file_count == 0:
    print("⚠️  No files found to process. Exiting.")
    dbutils.notebook.exit("No files found")

# Parse documents with ai_parse_document
print("🔍 Parsing documents with ai_parse_document (version 2.0)...")
print(f"📁 Images will be saved to: {output_volume_path}")
parsed_df = (
    files_df
    .withColumn(
        "parsed",
        expr(f"""
            ai_parse_document(
                content,
                map(
                    'version', '2.0',
                    'imageOutputPath', '{output_volume_path}',
                    'descriptionElementTypes', '*'
                )
            )
        """),
    )
    .withColumn("parsed_at", current_timestamp())
    .select("path", "parsed", "parsed_at")
)

# Write to Delta table in batch mode
print("💾 Writing to Delta table...")
parsed_df.write.format("delta") \
    .mode("append") \
    .option("delta.feature.variantType-preview", "supported") \
    .option("mergeSchema", "true") \
    .saveAsTable(table_name)

print("✅ Document parsing pipeline completed successfully!")
print(f"📊 Processed {file_count} files and saved to: {catalog}.{schema}.{table_name}")
