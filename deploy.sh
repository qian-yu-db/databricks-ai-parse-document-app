#!/bin/bash

# Accept parameters
APP_FOLDER_IN_WORKSPACE=${1:-"/Workspace/Users/q.yu@databricks.com/databricks_apps/ai-parse-document-demo"}
LAKEHOUSE_APP_NAME=${2:-"ai-parse-document-demo"}
PROFILE=${3:-"DEFAULT"}

echo "🚀 Deploying AI Functions Document Intelligence Demo"
echo "📁 Workspace Path: $APP_FOLDER_IN_WORKSPACE"
echo "🏷️  App Name: $LAKEHOUSE_APP_NAME"
echo "🔑 Profile: $PROFILE"

# Frontend build and import
echo "🔨 Building frontend..."
(
 cd frontend
 npm run build
 
 # Fix routing for static export - ensure proper file structure
 echo "🔧 Fixing static export routing..."
 cp out/next-steps/index.html out/next-steps.html 2>/dev/null || true
 cp out/document-intelligence/index.html out/document-intelligence.html 2>/dev/null || true
 
 echo "📤 Uploading frontend static files..."
 databricks workspace import-dir out "$APP_FOLDER_IN_WORKSPACE/static" --overwrite --profile $PROFILE
) &

# Backend packaging
echo "📦 Packaging backend..."
(
 cd backend
 mkdir -p build
 # Copy all necessary files except hidden files and build directories
 find . -mindepth 1 -maxdepth 1 -not -name '.*' -not -name "local_conf*" -not -name 'build' -not -name '__pycache__' -exec cp -r {} build/ \;
 
 echo "📤 Uploading backend..."
 # Import and deploy the application
 databricks workspace import-dir build "$APP_FOLDER_IN_WORKSPACE" --overwrite --profile $PROFILE
 rm -rf build
) &

# Wait for both background processes to finish
wait

echo "🚀 Deploying application..."
# Deploy the application
databricks apps deploy "$LAKEHOUSE_APP_NAME" --source-code-path "$APP_FOLDER_IN_WORKSPACE" --profile $PROFILE

echo "✅ Deployment complete!"
echo "🌐 App URL: Check your Databricks workspace for the app URL"
echo "📊 App Name: $LAKEHOUSE_APP_NAME" 