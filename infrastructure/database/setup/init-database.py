#!/usr/bin/env python3
"""
WARP Database Schema Initialization Script
A robust database initialization tool with retry logic and detailed error handling.
"""

import os
import sys
import time
import glob
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import argparse
import logging
from typing import Optional, List, Tuple
import subprocess

# Database configuration
DEFAULT_CONFIG = {
    'host': '10.126.0.3',
    'port': '5432',
    'database': 'warp',
    'user': 'warp',
    'password': ')T]!sXUi>SE+DeWt6a8Wmy*Q)A4q6R:}'
}

# WARP schemas
WARP_SCHEMAS = [
    'accounts', 'auth', 'billing', 'numbers', 'routing',
    'cdr', 'messaging', 'audit', 'vendor_mgmt'
]

# Key tables to verify
KEY_TABLES = [
    ('accounts', 'accounts'),
    ('auth', 'api_keys'),
    ('numbers', 'phone_numbers'),
    ('routing', 'routes')
]

# Logging configuration
class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors"""
    
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[34m',     # Blue
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'SUCCESS': '\033[32m',  # Green
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Add SUCCESS level
        if record.levelno == 25:  # Custom SUCCESS level
            record.levelname = 'SUCCESS'
        
        log_color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{log_color}[{record.levelname}]{self.RESET}"
        return super().format(record)

# Add custom SUCCESS level
logging.SUCCESS = 25
logging.addLevelName(logging.SUCCESS, 'SUCCESS')
def success(self, message, *args, **kwargs):
    if self.isEnabledFor(logging.SUCCESS):
        self._log(logging.SUCCESS, message, args, **kwargs)
logging.Logger.success = success

def setup_logging(verbose: bool = False):
    """Setup colored logging"""
    logger = logging.getLogger('db_init')
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(
        ColoredFormatter('%(levelname)s %(message)s')
    )
    logger.addHandler(console_handler)
    
    return logger

class DatabaseInitializer:
    """Database initialization manager with robust error handling"""
    
    def __init__(self, config: dict, schema_dir: str, logger: logging.Logger):
        self.config = config
        self.schema_dir = schema_dir
        self.logger = logger
        self.conn = None
        self.cursor = None
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        
    def close(self):
        """Close database connections"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            
    def test_connection(self, max_retries: int = 30) -> bool:
        """Test database connectivity with retries"""
        self.logger.info("Testing database connectivity...")
        
        for attempt in range(1, max_retries + 1):
            try:
                # Test basic connectivity
                test_conn = psycopg2.connect(
                    host=self.config['host'],
                    port=self.config['port'],
                    database=self.config['database'],
                    user=self.config['user'],
                    password=self.config['password'],
                    connect_timeout=5
                )
                test_conn.close()
                self.logger.success("Successfully connected to database")
                return True
                
            except psycopg2.OperationalError as e:
                if "could not connect to server" in str(e):
                    self.logger.warning(f"Database not ready (attempt {attempt}/{max_retries})")
                    time.sleep(2)
                elif "password authentication failed" in str(e):
                    self.logger.error("Authentication failed. Check credentials.")
                    return False
                else:
                    self.logger.error(f"Connection error: {e}")
                    time.sleep(2)
            except Exception as e:
                self.logger.error(f"Unexpected error: {e}")
                time.sleep(2)
                
        self.logger.error(f"Failed to connect after {max_retries} attempts")
        return False
        
    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(
                host=self.config['host'],
                port=self.config['port'],
                database=self.config['database'],
                user=self.config['user'],
                password=self.config['password']
            )
            self.conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            self.cursor = self.conn.cursor()
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect: {e}")
            return False
            
    def schema_exists(self, schema_name: str) -> bool:
        """Check if schema exists"""
        try:
            self.cursor.execute(
                "SELECT 1 FROM pg_namespace WHERE nspname = %s",
                (schema_name,)
            )
            return self.cursor.fetchone() is not None
        except Exception as e:
            self.logger.error(f"Error checking schema: {e}")
            return False
            
    def get_table_count(self) -> int:
        """Get count of WARP tables"""
        try:
            self.cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = ANY(%s)
            """, (WARP_SCHEMAS,))
            return self.cursor.fetchone()[0]
        except Exception:
            return 0
            
    def execute_sql_file(self, file_path: str) -> bool:
        """Execute SQL file with error handling"""
        filename = os.path.basename(file_path)
        self.logger.info(f"Executing {filename}...")
        
        try:
            with open(file_path, 'r') as f:
                sql_content = f.read()
                
            # Execute within transaction
            temp_conn = psycopg2.connect(
                host=self.config['host'],
                port=self.config['port'],
                database=self.config['database'],
                user=self.config['user'],
                password=self.config['password']
            )
            temp_cursor = temp_conn.cursor()
            
            try:
                # Start transaction
                temp_conn.autocommit = False
                temp_cursor.execute(sql_content)
                temp_conn.commit()
                self.logger.success(f"Successfully executed {filename}")
                return True
                
            except Exception as e:
                temp_conn.rollback()
                self.logger.error(f"Failed to execute {filename}: {e}")
                # Log the specific line if possible
                if hasattr(e, 'pgerror') and e.pgerror:
                    self.logger.error(f"PostgreSQL error:\n{e.pgerror}")
                return False
                
            finally:
                temp_cursor.close()
                temp_conn.close()
                
        except Exception as e:
            self.logger.error(f"Error reading {filename}: {e}")
            return False
            
    def drop_schemas(self):
        """Drop all WARP schemas"""
        self.logger.warning("Dropping all existing schemas...")
        try:
            schemas_list = ', '.join(WARP_SCHEMAS)
            self.cursor.execute(f"DROP SCHEMA IF EXISTS {schemas_list} CASCADE")
            self.logger.success("Schemas dropped successfully")
        except Exception as e:
            self.logger.error(f"Error dropping schemas: {e}")
            
    def verify_installation(self):
        """Verify database installation"""
        self.logger.info("Verifying database installation...")
        
        # Check schemas
        print("\n=== Installed Schemas ===")
        self.cursor.execute("""
            SELECT nspname as schema_name 
            FROM pg_namespace 
            WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'public') 
            ORDER BY nspname
        """)
        for row in self.cursor.fetchall():
            print(f"  - {row[0]}")
            
        # Check table counts
        print("\n=== Tables per Schema ===")
        self.cursor.execute("""
            SELECT table_schema, COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = ANY(%s)
            GROUP BY table_schema 
            ORDER BY table_schema
        """, (WARP_SCHEMAS,))
        for row in self.cursor.fetchall():
            print(f"  - {row[0]}: {row[1]} tables")
            
        # Check extensions
        print("\n=== Installed Extensions ===")
        self.cursor.execute("""
            SELECT extname as extension, extversion as version 
            FROM pg_extension 
            WHERE extname NOT IN ('plpgsql') 
            ORDER BY extname
        """)
        for row in self.cursor.fetchall():
            print(f"  - {row[0]} (v{row[1]})")
            
        # Check key tables
        print("\n=== Key Tables Status ===")
        for schema, table in KEY_TABLES:
            self.cursor.execute("""
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = %s AND table_name = %s
            """, (schema, table))
            exists = self.cursor.fetchone() is not None
            status = "✓" if exists else "✗"
            color = "\033[32m" if exists else "\033[31m"
            print(f"  {color}{status}\033[0m {schema}.{table}")
            
    def initialize(self, force: bool = False) -> bool:
        """Main initialization process"""
        self.logger.info("=== WARP Database Schema Initialization ===")
        self.logger.info(f"Database: {self.config['host']}:{self.config['port']}/{self.config['database']}")
        self.logger.info(f"User: {self.config['user']}")
        self.logger.info(f"Schema Directory: {self.schema_dir}")
        
        # Test connection
        if not self.test_connection():
            self.logger.error("Cannot proceed without database connection")
            return False
            
        # Connect to database
        if not self.connect():
            return False
            
        # Check if already initialized
        table_count = self.get_table_count()
        if table_count > 0:
            self.logger.warning(f"Database already contains {table_count} tables")
            
            if not force and not sys.stdin.isatty():
                self.logger.info("Database already initialized. Use --force to reinitialize.")
                self.verify_installation()
                return True
                
            if not force:
                response = input("Do you want to reinitialize? This will DROP all data! (yes/no): ")
                if response.lower() != 'yes':
                    self.logger.info("Initialization cancelled")
                    self.verify_installation()
                    return True
                    
            self.drop_schemas()
            
        # Get SQL files
        sql_files = sorted(glob.glob(os.path.join(self.schema_dir, '*.sql')))
        if not sql_files:
            self.logger.error(f"No SQL files found in {self.schema_dir}")
            return False
            
        self.logger.info(f"Found {len(sql_files)} SQL files to execute")
        
        # Execute SQL files
        success = True
        for sql_file in sql_files:
            if not self.execute_sql_file(sql_file):
                success = False
                break
                
        if success:
            self.logger.success("All SQL files executed successfully!")
            self.verify_installation()
            
            # Final summary
            print("\n=== Initialization Complete ===")
            schema_count = len([s for s in WARP_SCHEMAS if self.schema_exists(s)])
            table_count = self.get_table_count()
            
            self.cursor.execute(
                "SELECT COUNT(*) FROM pg_extension WHERE extname NOT IN ('plpgsql')"
            )
            ext_count = self.cursor.fetchone()[0]
            
            print(f"Database initialized successfully with:")
            print(f"  - {schema_count} schemas")
            print(f"  - {table_count} tables")
            print(f"  - {ext_count} extensions")
            
        return success

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Initialize WARP database schema'
    )
    parser.add_argument(
        '--host', 
        default=os.getenv('DB_HOST', DEFAULT_CONFIG['host']),
        help='Database host'
    )
    parser.add_argument(
        '--port', 
        default=os.getenv('DB_PORT', DEFAULT_CONFIG['port']),
        help='Database port'
    )
    parser.add_argument(
        '--database', 
        default=os.getenv('DB_NAME', DEFAULT_CONFIG['database']),
        help='Database name'
    )
    parser.add_argument(
        '--user', 
        default=os.getenv('DB_USER', DEFAULT_CONFIG['user']),
        help='Database user'
    )
    parser.add_argument(
        '--password', 
        default=os.getenv('DB_PASSWORD', DEFAULT_CONFIG['password']),
        help='Database password'
    )
    parser.add_argument(
        '--schema-dir',
        default=os.getenv('SCHEMA_DIR', '../schema'),
        help='Directory containing SQL schema files'
    )
    parser.add_argument(
        '--force', '-f',
        action='store_true',
        help='Force reinitialization without prompting'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Setup logging
    logger = setup_logging(args.verbose)
    
    # Build config
    config = {
        'host': args.host,
        'port': args.port,
        'database': args.database,
        'user': args.user,
        'password': args.password
    }
    
    # Check schema directory
    schema_dir = args.schema_dir
    if not os.path.isdir(schema_dir):
        # Try relative to script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        schema_dir = os.path.join(script_dir, '..', 'schema')
        
    if not os.path.isdir(schema_dir):
        logger.error(f"Schema directory not found: {schema_dir}")
        sys.exit(1)
        
    # Run initialization
    try:
        with DatabaseInitializer(config, schema_dir, logger) as initializer:
            success = initializer.initialize(args.force)
            sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.warning("\nInitialization interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()