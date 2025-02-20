#!/bin/bash
set -euo pipefail

# Get current date components
year=$(date +%Y)
month=$(date +%m)
day=$(date +%d)
formatted_date=$(date +"%Y-%m-%d")

# Construct the directory path
dir_path="src/content/blog/$year/$month/$day"

# Create directories if they don't exist
mkdir -p "$dir_path"

# Convert filename to kebab case:
# 1. Convert to lowercase
# 2. Replace spaces and underscores with hyphens
# 3. Remove all characters except alphanumeric and hyphens
# 4. Replace multiple hyphens with single hyphen
# 5. Trim hyphens from start and end
filename=$(echo "${1:-"filename"}" |
    tr '[:upper:]' '[:lower:]' |
    tr ' _' '-' |
    sed 's/[^a-z0-9-]//g' |
    sed 's/-\+/-/g' |
    sed 's/^-\|-$//g')

# Add .md extension if not present
[[ $filename != *.md ]] && filename="${filename}.md"

# Construct full file path
file_path="$dir_path/$filename"

# Convert kebab case filename to title case for the title field
# Remove .md extension, replace hyphens with spaces, and capitalize first letter of each word
title=$(echo "${filename%.md}" | \
    sed 's/-/ /g' | \
    sed 's/\b\(.\)/\u\1/g')

# Create the file with YAML frontmatter
cat > "$file_path" << EOL
---
title: ${title}
date: ${formatted_date}
description:
category: blog
tags: []
---

EOL

echo "Created file: $file_path"
