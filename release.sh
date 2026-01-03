#!/bin/bash

# Automatic release script for hacker-news-quick-read
# This script automates the process of versioning, tagging, and triggering Docker image builds

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print info messages
print_info() {
    print_color "${BLUE}" "[INFO] $1"
}

# Function to print success messages
print_success() {
    print_color "${GREEN}" "[SUCCESS] $1"
}

# Function to print warning messages
print_warning() {
    print_color "${YELLOW}" "[WARNING] $1"
}

# Function to print error messages
print_error() {
    print_color "${RED}" "[ERROR] $1"
}

# Function to ask for user confirmation
ask_confirmation() {
    local message=$1
    read -p "${message} (y/N): " -n 1 -r
    echo  # Move to a new line
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled by user."
        exit 0
    fi
}

# Check if running from git repository root
if [[ ! -d ".git" ]]; then
    print_error "This script must be run from the root of the git repository."
    exit 1
fi

# Check if git working directory is clean
if [[ -n $(git status --porcelain) ]]; then
    print_error "Working directory is not clean. Please commit or stash your changes before running this script."
    git status --short
    exit 1
fi

# Check if git remote origin exists
if ! git remote get-url origin > /dev/null 2>&1; then
    print_error "Git remote 'origin' does not exist."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

print_info "Current version: ${CURRENT_VERSION}"

# Get version type from command line argument or prompt user
VERSION_TYPE="${1:-}"  # Use first argument or empty string

if [[ -z "$VERSION_TYPE" ]]; then
    echo "Select version type:"
    echo "1) patch ($CURRENT_VERSION -> $(npm version patch --dry-run 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "N/A"))"
    echo "2) minor ($CURRENT_VERSION -> $(npm version minor --dry-run 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "N/A"))"
    echo "3) major ($CURRENT_VERSION -> $(npm version major --dry-run 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "N/A"))"
    echo "4) custom (specify version manually)"
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1) VERSION_TYPE="patch" ;;
        2) VERSION_TYPE="minor" ;;
        3) VERSION_TYPE="major" ;;
        4) 
            read -p "Enter new version (e.g., 1.2.3): " CUSTOM_VERSION
            if [[ ! $CUSTOM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                print_error "Invalid version format. Please use semantic versioning (e.g., 1.2.3)."
                exit 1
            fi
            NEW_VERSION=$CUSTOM_VERSION
            ;;
        *)
            print_error "Invalid choice."
            exit 1
            ;;
    esac
fi

# Calculate new version if not already set
if [[ -z "$NEW_VERSION" ]]; then
    if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
        print_error "Invalid version type: $VERSION_TYPE. Use patch, minor, or major."
        exit 1
    fi
    
    # Get new version without applying changes
    NEW_VERSION=$(npm version $VERSION_TYPE --dry-run 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || {
        print_error "Failed to determine new version using npm version $VERSION_TYPE"
        exit 1
    })
fi

print_info "New version will be: $NEW_VERSION"

# Confirm with user before proceeding
ask_confirmation "Proceed with release version $NEW_VERSION?"

print_info "Starting release process for version $NEW_VERSION..."

# If we're using npm version (patch/minor/major), update the version
if [[ -z "$CUSTOM_VERSION" ]]; then
    print_info "Updating version using npm version $VERSION_TYPE..."
    npm version $VERSION_TYPE -m "Release version %s"
else
    print_info "Updating version to $NEW_VERSION..."
    npm version $NEW_VERSION -m "Release version %s"
fi

# Get the actual new version from package.json after update
NEW_VERSION=$(node -p "require('./package.json').version")
print_success "Version updated to $NEW_VERSION"

# Push changes and tag to remote repository
print_info "Pushing changes and tags to remote repository..."
git push origin main
git push origin v$NEW_VERSION

print_success "Changes and tags pushed successfully!"

# Inform user about the triggered GitHub Actions
print_info "Docker image build and publish workflow has been triggered."
print_info "The GitHub Actions workflow will build and publish the Docker image to GHCR with tags:"
print_info "- $NEW_VERSION"
print_info "- $(echo $NEW_VERSION | cut -d. -f1).$(echo $NEW_VERSION | cut -d. -f2)"  # major.minor
print_info "- $(echo $NEW_VERSION | cut -d. -f1)"  # major
print_info "- SHA tag"

print_success "Release process completed successfully!"
print_success "Docker image will be available at: ghcr.io/$(basename $(git remote get-url origin .git) .git):$NEW_VERSION"