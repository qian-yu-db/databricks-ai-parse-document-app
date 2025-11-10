# Databricks notebook source
# MAGIC %md
# MAGIC # Extract Text from Parsed Documents
# MAGIC
# MAGIC This notebook uses batch processing to extract clean text from parsed documents.

# COMMAND ----------

# Get parameters
dbutils.widgets.text("catalog", "fins_genai", "Catalog name")
dbutils.widgets.text("schema", "unstructured_documents", "Schema name")
dbutils.widgets.text("source_table_name", "parsed_documents_raw", "Source table name")
dbutils.widgets.text("table_name", "parsed_documents_content", "Output table name")

catalog = dbutils.widgets.get("catalog")
schema = dbutils.widgets.get("schema")
source_table_name = dbutils.widgets.get("source_table_name")
table_name = dbutils.widgets.get("table_name")

# COMMAND ----------

# Set catalog and schema
spark.sql(f"USE CATALOG {catalog}")
spark.sql(f"USE SCHEMA {schema}")

# COMMAND ----------

print("📝 Starting Document Content Extraction (Batch Mode)...")
print(f"📖 Source Table: {catalog}.{schema}.{source_table_name}")
print(f"📄 Output Table: {catalog}.{schema}.{table_name}")

from pyspark.sql.functions import col, concat_ws, expr, lit, when

# Read from source table using batch processing
print("🔄 Reading from source table...")
parsed_df = spark.read.format("delta").table(source_table_name)

# Count records to process
record_count = parsed_df.count()
print(f"📊 Found {record_count} parsed documents to extract content from")

if record_count == 0:
    print("⚠️  No records found to process. Exiting.")
    dbutils.notebook.exit("No records found")

# Extract text from parsed documents
print("🔍 Extracting and concatenating text content from document elements...")
text_df = (
    parsed_df.withColumn(
        "content",
        when(
            expr("try_cast(parsed:error_status AS STRING)").isNotNull(), lit(None)
        ).otherwise(
            concat_ws(
                "\n\n",
                expr("""
                transform(
                    try_cast(parsed:document:elements AS ARRAY<VARIANT>),
                    elements -> (CASE WHEN try_cast(elements:type as STRING) = 'figure'
                                THEN try_cast(elements:description as STRING)
                                ELSE try_cast(elements:content AS STRING) END)
                )
                """),
            )
        ),
    )
    .withColumn("error_status", expr("try_cast(parsed:error_status AS STRING)"))
    .select("path", "content", "error_status", "parsed_at")
)

# Write to Delta table in batch mode
print("💾 Writing to Delta table...")
text_df.write.format("delta") \
    .mode("append") \
    .option("mergeSchema", "true") \
    .saveAsTable(table_name)

print("✅ Document content extraction completed successfully!")
print(f"📊 Processed {record_count} documents and saved to: {catalog}.{schema}.{table_name}")
