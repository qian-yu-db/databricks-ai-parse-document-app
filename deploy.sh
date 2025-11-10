#!/bin/bash

# Help function
show_help() {
    cat << EOF
Usage: ./deploy.sh [OPTIONS] [APP_FOLDER] [APP_NAME] [PROFILE]

Deploy AI Functions Document Intelligence Demo to Databricks Apps.

ARGUMENTS:
    APP_FOLDER    Workspace path for app deployment
                  Default: /Workspace/Users/q.yu@databricks.com/databricks_apps/ai-parse-document-demo

    APP_NAME      Lakehouse app name
                  Default: ai-parse-document-demo

    PROFILE       Databricks CLI profile to use
                  Default: DEFAULT

OPTIONS:
    -h, --help    Display this help message and exit

EXAMPLES:
    # Deploy with default settings
    ./deploy.sh

    # Deploy to custom workspace path
    ./deploy.sh "/Workspace/Users/custom.user@company.com/apps/doc-intel"

    # Deploy with custom app name
    ./deploy.sh "/Workspace/Users/me@company.com/apps/demo" "my-doc-app"

    # Deploy with specific Databricks profile
    ./deploy.sh "/Workspace/Users/me@company.com/apps/demo" "my-app" "PROD"

DEPLOYMENT PROCESS:
    1. Builds Next.js frontend (static export)
    2. Packages FastAPI backend
    3. Uploads frontend to workspace /static directory
    4. Uploads backend to workspace root
    5. Deploys as Databricks App

REQUIREMENTS:
    - Node.js and npm (for frontend build)
    - Databricks CLI configured with valid profile
    - Workspace permissions to create apps
    - UC Volume and SQL Warehouse configured

For more information, see CLAUDE.md in the project root.
EOF
    exit 0
}

# Check for help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
fi

# Accept parameters
APP_FOLDER_IN_WORKSPACE=${1:-"/Workspace/Users/q.yu@databricks.com/databricks_apps/ai-parse-job-enhanced"}
LAKEHOUSE_APP_NAME=${2:-"ai-parse-job-enhanced"}
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

 # Delete old static files to prevent conflicts
 echo "🧹 Cleaning old static files..."
 databricks workspace delete "$APP_FOLDER_IN_WORKSPACE/static" --recursive --profile $PROFILE 2>/dev/null || true

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