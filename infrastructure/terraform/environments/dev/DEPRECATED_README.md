# ⚠️ DEPRECATED - Old Development Environment

This directory contains the legacy Terraform configuration that creates resources with "dev" in their names.

## Why Deprecated?

We made a decision to start fresh with a new GCP project (`ringer-warp-v01`) using clean resource naming without environment prefixes.

## Current Configuration Location

Please use: `/warp/terraform/environments/v01/`

## Key Differences

| Old (this directory) | New (v01) |
|---------------------|-----------|
| project_name = "warp-${environment}" | Clean names without prefix |
| Creates "warp-dev-*" resources | Creates "warp-*" resources |
| Project: ringer-472421 | Project: ringer-warp-v01 |

---
*Deprecated: 2025-01-21*
*Reason: Fresh start with clean naming conventions*