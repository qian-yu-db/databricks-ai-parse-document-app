#!/bin/bash

# Databricks Asset Bundle Workflow Runner
# Usage: ./run_workflow.sh [--profile PROFILE] [--target TARGET] [OPTIONS]

set -e  # Exit on any error

# Default values
PROFILE=""
TARGET="dev"
SKIP_VALIDATION=false
SKIP_DEPLOYMENT=false
SKIP_RUN=true  # Default to deploy-only mode (run job via UI)
JOB_ID=""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    --profile PROFILE       Databricks profile to use for authentication
    --target TARGET         Deployment target (dev or prod, default: dev)
    --skip-validation       Skip bundle validation step
    --skip-deployment       Skip bundle deployment step
    --run-now               Deploy AND run the job immediately (default: deploy only)
    --job-id JOB_ID         Job ID to run (skip deployment and use existing job)
    --help                  Show this help message

EXAMPLES:
    $0                                          # Validate and deploy (deploy-only mode)
    $0 --profile my-profile --target prod       # Use specific profile and prod target
    $0 --run-now --profile my-profile           # Deploy and run the job immediately
    $0 --job-id 123456 --profile my-profile     # Run specific job ID directly
    $0 --skip-validation --profile my-profile   # Skip validation step

WORKFLOW (Default):
    1. Bundle validation
    2. Bundle deployment
    3. Display Job ID for use in Databricks App UI

WORKFLOW (with --run-now):
    1. Bundle validation
    2. Bundle deployment
    3. Run the job immediately

NOTE:
    - By default, the script only deploys the job (does not run it)
    - Jobs are meant to be triggered via the Databricks App UI
    - The script will display the Job ID to configure in the app
    - Use --run-now if you want to run the job immediately after deployment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --target)
            TARGET="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --skip-deployment)
            SKIP_DEPLOYMENT=true
            shift
            ;;
        --run-now)
            SKIP_RUN=false
            shift
            ;;
        --skip-run)
            # Deprecated: kept for backwards compatibility
            SKIP_RUN=true
            shift
            ;;
        --job-id)
            JOB_ID="$2"
            shift 2
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate target
if [[ "$TARGET" != "dev" && "$TARGET" != "prod" ]]; then
    print_error "Invalid target: $TARGET. Must be 'dev' or 'prod'"
    exit 1
fi

# Build profile argument
PROFILE_ARG=""
if [[ -n "$PROFILE" ]]; then
    PROFILE_ARG="--profile $PROFILE"
fi

print_info "Starting Databricks Asset Bundle Workflow"
print_info "Profile: ${PROFILE:-default}"
print_info "Target: $TARGET"

# Extract workflow name from job YAML file
WORKFLOW_NAME=""
if [[ -f "resources/ai_parse_document_workflow.job.yml" ]]; then
    WORKFLOW_NAME=$(grep -A 1 "^  jobs:" resources/ai_parse_document_workflow.job.yml | grep -v "jobs:" | awk '{print $1}' | sed 's/:$//')
    print_info "Workflow name: $WORKFLOW_NAME"
fi

# Step 1: Validate bundle (unless skipped or using existing job)
if [[ "$SKIP_VALIDATION" == false && -z "$JOB_ID" ]]; then
    print_info "Validating Databricks asset bundle..."
    if databricks bundle validate $PROFILE_ARG; then
        print_success "Bundle validation completed successfully!"
    else
        print_error "Bundle validation failed!"
        exit 1
    fi
else
    print_warning "Skipping bundle validation"
fi

# Step 2: Deploy bundle (unless skipped or using existing job)
DEPLOYED_JOB_ID=""
if [[ "$SKIP_DEPLOYMENT" == false && -z "$JOB_ID" ]]; then
    print_info "Deploying Databricks asset bundle to '$TARGET' target..."

    if databricks bundle deploy --target $TARGET $PROFILE_ARG; then
        print_success "Bundle deployed successfully to '$TARGET' target!"

        # Retrieve the deployed job ID using bundle summary
        if [[ -n "$WORKFLOW_NAME" ]]; then
            print_info "Retrieving deployed job ID..."

            # Extract job ID from bundle summary URL
            DEPLOYED_JOB_ID=$(databricks bundle summary --target $TARGET $PROFILE_ARG 2>/dev/null | grep "URL:" | grep -oE '/jobs/[0-9]+' | grep -oE '[0-9]+' | head -1)

            if [[ -n "$DEPLOYED_JOB_ID" ]]; then
                print_success "✓ Found deployed job ID: $DEPLOYED_JOB_ID"
            else
                print_warning "Could not retrieve job ID automatically"
                print_info "Find the Job ID in: Databricks workspace > Workflows > Search: \"$WORKFLOW_NAME\""
            fi
        fi
    else
        print_error "Bundle deployment failed!"
        exit 1
    fi
else
    print_warning "Skipping bundle deployment"
fi

# Step 3: Run the workflow (unless skipped)
if [[ "$SKIP_RUN" == false ]]; then
    print_info "Running the workflow..."

    if [[ -n "$JOB_ID" ]]; then
        # Use provided job ID
        print_info "Using provided job ID: $JOB_ID"
        if databricks jobs run-now --job-id $JOB_ID $PROFILE_ARG; then
            print_success "Workflow launched successfully!"
        else
            print_error "Failed to launch workflow!"
            exit 1
        fi
    else
        # Use bundle run command
        if [[ -z "$WORKFLOW_NAME" ]]; then
            print_error "Could not extract workflow name from job YAML file"
            exit 1
        fi
        print_info "Launching workflow via bundle..."
        if databricks bundle run $WORKFLOW_NAME --target $TARGET $PROFILE_ARG; then
            print_success "Workflow completed successfully!"
        else
            print_error "Workflow execution failed!"
            exit 1
        fi
    fi
else
    print_warning "Skipping job execution (deploy-only mode)"
    print_info "Job has been deployed and is ready to be triggered via the Databricks App UI"
    echo ""
    print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "📋 NEXT STEPS:"
    print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [[ -n "$DEPLOYED_JOB_ID" ]]; then
        # Job ID was successfully retrieved
        print_info "1. Copy the Job ID below:"
        echo ""
        print_success "   ┌─────────────────────────────────────────────────────┐"
        print_success "   │  Job ID: ${DEPLOYED_JOB_ID}"
        print_success "   │  Job Name: ${WORKFLOW_NAME}"
        print_success "   └─────────────────────────────────────────────────────┘"
        echo ""
        print_info "2. Configure the Databricks App:"
        print_info "   • Open the Databricks App UI in your browser"
        print_info "   • Navigate to 'Batch Processing Mode'"
        print_info "   • Click 'Update Job ID' button"
        print_info "   • Paste the Job ID: ${DEPLOYED_JOB_ID}"
        echo ""
        print_info "3. Start processing!"
        print_info "   • Upload your PDF files and click 'Upload and Start Batch Processing'"
    else
        # Job ID could not be retrieved (no recent runs)
        print_info "1. Find the Job ID in your Databricks workspace:"
        print_info "   • Open your Databricks workspace in a browser"
        print_info "   • Navigate to 'Workflows' in the left sidebar"
        print_info "   • Search for job name: \"$WORKFLOW_NAME\""
        print_info "   • Copy the Job ID from the job details page"
        echo ""
        print_info "2. Configure the Databricks App:"
        print_info "   • Open the Databricks App UI in your browser"
        print_info "   • Navigate to 'Batch Processing Mode'"
        print_info "   • Click 'Update Job ID' button"
        print_info "   • Paste the Job ID you copied from step 1"
        echo ""
        print_info "3. Start processing!"
        print_info "   • Upload your PDF files and click 'Upload and Start Batch Processing'"
    fi

    echo ""
    print_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

print_success "🎉 All done!"
