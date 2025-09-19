#!/usr/bin/env python3
"""
WARP Platform Secret Manager
Interactive script to manage Google Secret Manager credentials for all WARP integrations.
"""

import json
import subprocess
import sys
import getpass
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

# GCP Project Configuration
PROJECT_ID = "ringer-472421"

class SecretCategory(Enum):
    AUTH = "Authentication & Identity"
    TELECOM = "Telecom Core Services"
    MESSAGING = "Messaging Services"
    BUSINESS = "Business Systems"
    PAYMENT = "Payment Processing"
    INFRA = "Infrastructure Services"

@dataclass
class SecretConfig:
    name: str
    description: str
    category: SecretCategory
    fields: Dict[str, str]  # field_name: description
    optional_fields: Dict[str, str] = None  # optional fields

# Complete secret inventory based on api_docs
SECRETS_INVENTORY = {
    "gcp-identity-platform": SecretConfig(
        name="gcp-identity-platform",
        description="Google Identity Platform / Firebase Auth configuration",
        category=SecretCategory.AUTH,
        fields={
            "api_key": "Firebase Web API key",
            "project_id": "GCP project ID (ringer-472421)"
        },
        optional_fields={
            "auth_domain": "Custom auth domain (e.g., auth.ringer.tel)",
            "tenant_id": "Identity Platform tenant ID (for multi-tenancy)"
        }
    ),
    "telique-credentials": SecretConfig(
        name="telique-credentials",
        description="Telique API for LRN/LERG/CNAM lookups",
        category=SecretCategory.TELECOM,
        fields={
            "api_key": "Telique API key",
            "api_url": "Telique API base URL",
            "account_id": "Telique account identifier"
        },
        optional_fields={
            "enable_lrn": "Enable LRN lookups (true/false)",
            "enable_cnam": "Enable CNAM lookups (true/false)",
            "enable_lerg": "Enable LERG lookups (true/false)"
        }
    ),
    "somos-credentials": SecretConfig(
        name="somos-credentials",
        description="Somos toll-free number management and RespOrg operations",
        category=SecretCategory.TELECOM,
        fields={
            "username": "Somos API username",
            "password": "Somos API password",
            "resp_org_id": "RespOrg identifier"
        },
        optional_fields={
            "client_key": "OAuth client key (if using OAuth)",
            "client_secret": "OAuth client secret (if using OAuth)",
            "api_url": "API endpoint (production/sandbox)"
        }
    ),
    "transunion-credentials": SecretConfig(
        name="transunion-credentials",
        description="TransUnion CNAM provisioning",
        category=SecretCategory.TELECOM,
        fields={
            "api_key": "TransUnion API key",
            "api_url": "TransUnion API endpoint"
        }
    ),
    "teliport-credentials": SecretConfig(
        name="teliport-credentials",
        description="Teliport number porting operations",
        category=SecretCategory.TELECOM,
        fields={
            "api_key": "Teliport API key",
            "api_url": "Teliport API base URL",
            "account_id": "Teliport account ID"
        }
    ),
    "sinch-credentials": SecretConfig(
        name="sinch-credentials",
        description="Sinch SMS/Voice provider",
        category=SecretCategory.MESSAGING,
        fields={
            "app_key": "Sinch application key",
            "app_secret": "Sinch application secret",
            "service_plan_id": "Sinch service plan identifier"
        },
        optional_fields={
            "api_url": "Sinch API URL (default: https://sms.api.sinch.com)"
        }
    ),
    "sinch-smpp-credentials": SecretConfig(
        name="sinch-smpp-credentials",
        description="Sinch SMPP gateway for SMS",
        category=SecretCategory.MESSAGING,
        fields={
            "host": "SMPP host (e.g., smpp.sinch.com)",
            "port": "SMPP port (e.g., 2775)",
            "system_id": "SMPP system ID",
            "password": "SMPP password",
            "system_type": "SMPP system type"
        }
    ),
    "tcr-credentials": SecretConfig(
        name="tcr-credentials",
        description="10DLC Campaign Registry",
        category=SecretCategory.MESSAGING,
        fields={
            "api_key": "TCR API key",
            "csp_id": "Campaign Service Provider ID",
            "api_url": "TCR API URL (e.g., https://csp-api.campaignregistry.com/v2)"
        }
    ),
    "lsms-credentials": SecretConfig(
        name="lsms-credentials",
        description="Local SMS routing",
        category=SecretCategory.MESSAGING,
        fields={
            "api_key": "LSMS API key",
            "api_url": "LSMS API endpoint"
        }
    ),
    "netsuite-credentials": SecretConfig(
        name="netsuite-credentials",
        description="NetSuite ERP and billing",
        category=SecretCategory.BUSINESS,
        fields={
            "account_id": "NetSuite account ID",
            "consumer_key": "OAuth consumer key",
            "consumer_secret": "OAuth consumer secret",
            "token_id": "Access token ID",
            "token_secret": "Access token secret"
        }
    ),
    "hubspot-credentials": SecretConfig(
        name="hubspot-credentials",
        description="HubSpot CRM integration",
        category=SecretCategory.BUSINESS,
        fields={
            "api_key": "HubSpot API key",
            "portal_id": "HubSpot portal/account ID"
        }
    ),
    "avalara-credentials": SecretConfig(
        name="avalara-credentials",
        description="Avalara tax calculation",
        category=SecretCategory.BUSINESS,
        fields={
            "account_id": "Avalara account ID",
            "license_key": "Avalara license key",
            "company_code": "Company code for tax calculation"
        },
        optional_fields={
            "api_url": "API URL (default: https://sandbox-rest.avatax.com)"
        }
    ),
    "authorizenet-credentials": SecretConfig(
        name="authorizenet-credentials",
        description="Authorize.Net credit card processing",
        category=SecretCategory.PAYMENT,
        fields={
            "api_login_id": "API login ID",
            "transaction_key": "Transaction key"
        },
        optional_fields={
            "sandbox": "Use sandbox environment (true/false)",
            "api_url": "API URL (production/sandbox)"
        }
    ),
    "mustache-credentials": SecretConfig(
        name="mustache-credentials",
        description="Mustache/Plaid ACH payments",
        category=SecretCategory.PAYMENT,
        fields={
            "api_key": "Mustache API key",
            "secret_key": "Mustache secret key"
        },
        optional_fields={
            "environment": "Environment (sandbox/production)"
        }
    ),
    "sendgrid-credentials": SecretConfig(
        name="sendgrid-credentials",
        description="SendGrid email delivery",
        category=SecretCategory.INFRA,
        fields={
            "api_key": "SendGrid API key"
        },
        optional_fields={
            "from_email": "Default from email (e.g., noreply@ringer.tel)",
            "from_name": "Default from name (e.g., WARP Platform)"
        }
    ),
    "gandi-credentials": SecretConfig(
        name="gandi-credentials",
        description="Gandi DNS management",
        category=SecretCategory.INFRA,
        fields={
            "api_key": "Gandi API key"
        },
        optional_fields={
            "api_url": "API URL (default: https://api.gandi.net/v5/livedns)"
        }
    ),
    "airbrake-credentials": SecretConfig(
        name="airbrake-credentials",
        description="Airbrake error tracking",
        category=SecretCategory.INFRA,
        fields={
            "project_id": "Airbrake project ID",
            "project_key": "Airbrake project API key"
        },
        optional_fields={
            "environment": "Environment name (development/staging/production)"
        }
    )
}

class SecretManager:
    def __init__(self, project_id: str = PROJECT_ID):
        self.project_id = project_id
        
    def check_gcloud(self) -> bool:
        """Check if gcloud is installed and configured"""
        try:
            result = subprocess.run(
                ["gcloud", "config", "get-value", "project"],
                capture_output=True, text=True, check=True
            )
            current_project = result.stdout.strip()
            if current_project != self.project_id:
                print(f"⚠️  Current project is {current_project}, expected {self.project_id}")
                set_project = input("Set correct project? (y/n): ")
                if set_project.lower() == 'y':
                    subprocess.run(
                        ["gcloud", "config", "set", "project", self.project_id],
                        check=True
                    )
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ gcloud CLI not found or not configured")
            print("Please install gcloud CLI and run: gcloud auth login")
            return False
    
    def secret_exists(self, secret_name: str) -> bool:
        """Check if a secret already exists"""
        try:
            subprocess.run(
                ["gcloud", "secrets", "describe", secret_name, 
                 "--project", self.project_id],
                capture_output=True, check=True
            )
            return True
        except subprocess.CalledProcessError:
            return False
    
    def create_secret(self, secret_name: str, secret_data: Dict[str, Any]) -> bool:
        """Create or update a secret in Google Secret Manager"""
        try:
            json_data = json.dumps(secret_data, indent=2)
            
            if self.secret_exists(secret_name):
                print(f"Secret {secret_name} already exists. Creating new version...")
                # Add a new version to existing secret
                process = subprocess.Popen(
                    ["gcloud", "secrets", "versions", "add", secret_name,
                     "--data-file=-", "--project", self.project_id],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = process.communicate(input=json_data)
            else:
                print(f"Creating new secret: {secret_name}")
                # Create new secret
                process = subprocess.Popen(
                    ["gcloud", "secrets", "create", secret_name,
                     "--data-file=-", "--replication-policy=automatic",
                     "--project", self.project_id],
                    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    text=True
                )
                stdout, stderr = process.communicate(input=json_data)
            
            if process.returncode == 0:
                print(f"✅ Successfully created/updated {secret_name}")
                return True
            else:
                print(f"❌ Failed to create/update {secret_name}: {stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error creating secret: {e}")
            return False
    
    def list_secrets(self) -> list:
        """List all secrets in the project"""
        try:
            result = subprocess.run(
                ["gcloud", "secrets", "list", "--project", self.project_id,
                 "--format=json"],
                capture_output=True, text=True, check=True
            )
            secrets = json.loads(result.stdout)
            return [s['name'].split('/')[-1] for s in secrets]
        except subprocess.CalledProcessError:
            return []
    
    def delete_secret(self, secret_name: str) -> bool:
        """Delete a secret"""
        try:
            confirm = input(f"⚠️  Are you sure you want to delete {secret_name}? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Cancelled")
                return False
                
            subprocess.run(
                ["gcloud", "secrets", "delete", secret_name,
                 "--project", self.project_id, "--quiet"],
                check=True
            )
            print(f"✅ Deleted {secret_name}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to delete: {e}")
            return False

def display_menu():
    """Display main menu"""
    print("\n" + "="*60)
    print("🔐 WARP Platform Secret Manager")
    print("="*60)
    print("1. View all secret categories")
    print("2. Create/Update a secret")
    print("3. Create all secrets (batch mode)")
    print("4. List existing secrets")
    print("5. Delete a secret")
    print("6. Export secret template")
    print("0. Exit")
    print("="*60)

def display_categories():
    """Display all secret categories"""
    for category in SecretCategory:
        print(f"\n📁 {category.value}")
        print("-" * 40)
        for secret_name, config in SECRETS_INVENTORY.items():
            if config.category == category:
                print(f"  • {secret_name}: {config.description}")

def get_secret_input(config: SecretConfig) -> Dict[str, Any]:
    """Get user input for a secret configuration"""
    print(f"\n🔧 Configuring: {config.description}")
    print("-" * 40)
    
    secret_data = {}
    
    # Required fields
    print("Required fields:")
    for field_name, description in config.fields.items():
        if "password" in field_name.lower() or "secret" in field_name.lower():
            value = getpass.getpass(f"  {field_name} ({description}): ")
        else:
            value = input(f"  {field_name} ({description}): ")
        if value:
            secret_data[field_name] = value
    
    # Optional fields
    if config.optional_fields:
        print("\nOptional fields (press Enter to skip):")
        for field_name, description in config.optional_fields.items():
            if "password" in field_name.lower() or "secret" in field_name.lower():
                value = getpass.getpass(f"  {field_name} ({description}): ")
            else:
                value = input(f"  {field_name} ({description}): ")
            if value:
                secret_data[field_name] = value
    
    return secret_data

def create_single_secret(manager: SecretManager):
    """Create or update a single secret"""
    print("\nAvailable secrets:")
    for i, (name, config) in enumerate(SECRETS_INVENTORY.items(), 1):
        print(f"{i:2}. {name} - {config.description}")
    
    try:
        choice = int(input("\nSelect secret number (0 to cancel): "))
        if choice == 0:
            return
        
        secret_items = list(SECRETS_INVENTORY.items())
        if 1 <= choice <= len(secret_items):
            secret_name, config = secret_items[choice - 1]
            secret_data = get_secret_input(config)
            
            if secret_data:
                manager.create_secret(secret_name, secret_data)
        else:
            print("Invalid choice")
    except ValueError:
        print("Invalid input")

def create_all_secrets(manager: SecretManager):
    """Batch create all secrets"""
    print("\n🚀 Batch Secret Creation Mode")
    print("This will guide you through creating all secrets.")
    print("You can skip any secret by leaving all fields blank.\n")
    
    created = 0
    skipped = 0
    
    for category in SecretCategory:
        print(f"\n{'='*60}")
        print(f"📁 {category.value}")
        print('='*60)
        
        for secret_name, config in SECRETS_INVENTORY.items():
            if config.category != category:
                continue
                
            if manager.secret_exists(secret_name):
                update = input(f"\n{secret_name} already exists. Update? (y/n/skip all): ")
                if update.lower() == 'skip all':
                    return
                elif update.lower() != 'y':
                    skipped += 1
                    continue
            
            secret_data = get_secret_input(config)
            
            if secret_data:
                if manager.create_secret(secret_name, secret_data):
                    created += 1
            else:
                print(f"⏭️  Skipped {secret_name}")
                skipped += 1
    
    print(f"\n📊 Summary: Created/Updated: {created}, Skipped: {skipped}")

def export_template(manager: SecretManager):
    """Export a template file for all secrets"""
    template = {
        "instructions": "Fill in the values for each secret and use this file to batch import",
        "project_id": PROJECT_ID,
        "secrets": {}
    }
    
    for secret_name, config in SECRETS_INVENTORY.items():
        template["secrets"][secret_name] = {
            "description": config.description,
            "category": config.category.value,
            "required": {field: "" for field in config.fields.keys()},
            "optional": {field: "" for field in (config.optional_fields or {}).keys()}
        }
    
    filename = "warp_secrets_template.json"
    with open(filename, 'w') as f:
        json.dump(template, f, indent=2)
    
    print(f"✅ Template exported to {filename}")
    print("Fill in the values and import with:")
    print(f"  python {sys.argv[0]} --import {filename}")

def main():
    manager = SecretManager()
    
    # Check for import mode
    if len(sys.argv) > 2 and sys.argv[1] == '--import':
        if not manager.check_gcloud():
            return
            
        try:
            with open(sys.argv[2], 'r') as f:
                data = json.load(f)
            
            for secret_name, secret_info in data.get('secrets', {}).items():
                secret_data = {**secret_info.get('required', {}), 
                              **secret_info.get('optional', {})}
                # Remove empty values
                secret_data = {k: v for k, v in secret_data.items() if v}
                
                if secret_data:
                    print(f"Importing {secret_name}...")
                    manager.create_secret(secret_name, secret_data)
            return
        except Exception as e:
            print(f"Error importing: {e}")
            return
    
    # Interactive mode
    if not manager.check_gcloud():
        return
    
    while True:
        display_menu()
        choice = input("Select option: ")
        
        if choice == '0':
            print("👋 Goodbye!")
            break
        elif choice == '1':
            display_categories()
        elif choice == '2':
            create_single_secret(manager)
        elif choice == '3':
            create_all_secrets(manager)
        elif choice == '4':
            secrets = manager.list_secrets()
            if secrets:
                print("\n📋 Existing secrets:")
                for secret in sorted(secrets):
                    status = "✅" if secret in SECRETS_INVENTORY else "❓"
                    print(f"  {status} {secret}")
            else:
                print("No secrets found")
        elif choice == '5':
            secret_name = input("Enter secret name to delete: ")
            manager.delete_secret(secret_name)
        elif choice == '6':
            export_template(manager)
        else:
            print("Invalid option")

if __name__ == "__main__":
    main()
