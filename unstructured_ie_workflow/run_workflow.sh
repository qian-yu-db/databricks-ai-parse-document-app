#!/bin/bash

# Databricks Asset Bundle Workflow Runner
# Usage: ./run_workflow.sh [--profile PROFILE] [--target TARGET] [OPTIONS]

set -e  # Exit on any error

# Default values
PROFILE=""
TARGET="dev"
SKIP_VALIDATION=false
SKIP_DEPLOYMENT=false
SKIP_RUN=false
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
    --skip-run              Deploy only, don't run the job
    --job-id JOB_ID         Job ID to run (skip deployment and use existing job)
    --help                  Show this help message

EXAMPLES:
    $0                                          # Validate, deploy, and run with dev target
    $0 --profile my-profile --target prod       # Use specific profile and prod target
    $0 --skip-run                               # Deploy only, don't run the job
    $0 --job-id 123456 --profile my-profile     # Run specific job ID directly
    $0 --skip-validation --profile my-profile   # Skip validation step

WORKFLOW:
    1. Bundle validation (optional)
    2. Bundle deployment (optional)
    3. Job execution (optional)

NOTE:
    - PDF uploads are handled by the Databricks App UI
    - This script is for bundle deployment and job management only

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
        --skip-run)
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
if [[ "$SKIP_DEPLOYMENT" == false && -z "$JOB_ID" ]]; then
    print_info "Deploying Databricks asset bundle to '$TARGET' target..."
    if databricks bundle deploy --target $TARGET $PROFILE_ARG; then
        print_success "Bundle deployed successfully to '$TARGET' target!"
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
    print_warning "Skipping job execution (--skip-run specified)"
    print_info "Job has been deployed and is ready to be triggered via the Databricks App"
fi

print_success "🎉 All done!"
