#!/bin/bash
# Function to increment version numbers
version_increment() {
    local current_version=$1
    local increment_type=$2
    
    # Extract major, minor, patch from version string
    local major=$(echo $current_version | cut -d. -f1)
    local minor=$(echo $current_version | cut -d. -f2)
    local patch=$(echo $current_version | cut -d. -f3)
    
    case $increment_type in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            echo "Invalid increment type: $increment_type" >&2
            exit 1
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

echo "Testing patch: $(version_increment "1.2.3" "patch")"
echo "Testing minor: $(version_increment "1.2.3" "minor")"
echo "Testing major: $(version_increment "1.2.3" "major")"
