#!/usr/bin/env python3
"""
Dummy Data Importer for IntelX Scanner
Imports generated dummy credentials (no dummy user is created)
"""
import os
import sys
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

# Ensure local module imports work
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from backend.database import SessionLocal, init_db
from backend.models.user import User
from backend.models.credential import Credential
from backend.models.scan_job import ScanJob, JobCredential
from backend.models.scheduled_job import ScheduledJob
import uuid
import random


class DummyDataImporter:
    """Import dummy data into database"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_dummy_user(self) -> None:
        """Disabled: dummy user creation is not available in the public release."""
        print("\n" + "=" * 80)
        print("Dummy user creation is disabled in the public release.")
        print("=" * 80)
        return None
    
    def import_credentials(self, credentials_data: list, batch_size: int = 1000, progress_callback=None) -> int:
        """Import credentials in batches with optional progress callback"""
        print("\n" + "=" * 80)
        print("Importing Credentials")
        print("=" * 80)
        
        total = len(credentials_data)
        imported = 0
        skipped = 0
        
        print(f"Total credentials to import: {total:,}")
        print(f"Batch size: {batch_size:,}")
        print()
        
        for i in range(0, total, batch_size):
            batch = credentials_data[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (total + batch_size - 1) // batch_size
            
            print(f"Processing batch {batch_num}/{total_batches} ({i:,} - {min(i + batch_size, total):,})...")
            
            for cred_data in batch:
                try:
                    # Check if credential already exists
                    existing = self.db.query(Credential).filter(
                        Credential.url == cred_data['url'],
                        Credential.username == cred_data['username'],
                        Credential.password == cred_data['password']
                    ).first()
                    
                    if existing:
                        skipped += 1
                        continue
                    
                    # Create new credential
                    credential = Credential(
                        url=cred_data['url'],
                        username=cred_data['username'],
                        password=cred_data['password'],
                        domain=cred_data['domain'],
                        is_admin=cred_data['is_admin'],
                        first_seen=datetime.fromisoformat(cred_data['first_seen']),
                        last_seen=datetime.fromisoformat(cred_data['last_seen']),
                        seen_count=cred_data['seen_count']
                    )
                    
                    self.db.add(credential)
                    imported += 1
                    
                except Exception as e:
                    print(f"  ⚠️  Error importing credential: {str(e)}")
                    skipped += 1
                    continue
            
            # Commit batch
            try:
                self.db.commit()
                print(f"  ✅ Batch {batch_num} committed ({imported:,} imported, {skipped:,} skipped)")
                
                # Report progress (10% to 85% range for import phase)
                if progress_callback:
                    progress_pct = 10 + int((batch_num / total_batches) * 75)
                    progress_callback(progress_pct, f"Importing batch {batch_num}/{total_batches}...")
                    
            except Exception as e:
                print(f"  ❌ Error committing batch: {str(e)}")
                self.db.rollback()
        
        print()
        print(f"✅ Import complete:")
        print(f"   Imported: {imported:,}")
        print(f"   Skipped: {skipped:,}")
        print(f"   Total: {total:,}")
        
        return imported
    
    def create_dummy_scan_jobs(self, num_jobs: int = 10) -> list:
        """Create dummy scan jobs for testing"""
        print("\n" + "=" * 80)
        print("Creating Dummy Scan Jobs")
        print("=" * 80)
        
        jobs = []
        job_types = ['intelx_single', 'intelx_multi', 'file']
        statuses = ['completed', 'completed', 'completed', 'running', 'failed']
        queries = [
            'example.com', 'test.co.id', 'demo.com', 'acme.com', 'techcorp.io',
            'admin@company.com', 'leaked_data.txt', 'credentials.zip', 'combo.txt'
        ]
        
        print(f"Creating {num_jobs} dummy scan jobs...")
        
        for i in range(num_jobs):
            job_type = job_types[i % len(job_types)]
            status = statuses[i % len(statuses)]
            query = queries[i % len(queries)]
            
            # Create timestamps
            created_at = datetime.utcnow() - timedelta(days=30 - i * 2)
            started_at = created_at + timedelta(minutes=1)
            completed_at = started_at + timedelta(minutes=random.randint(5, 60)) if status == 'completed' else None
            
            # Generate realistic statistics with proper relationships
            total_raw = random.randint(100, 1000)
            # Parsed should be <= raw (typically 70-95% of raw)
            total_parsed = random.randint(int(total_raw * 0.7), min(total_raw, int(total_raw * 0.95)))
            # New credentials (typically 10-40% of parsed)
            total_new = random.randint(int(total_parsed * 0.1), int(total_parsed * 0.4))
            # Duplicates = parsed - new
            total_duplicates = total_parsed - total_new
            
            job = ScanJob(
                id=uuid.uuid4(),
                job_type=job_type,
                name=f"Dummy Scan {i+1}",
                query=query,
                time_filter='D1' if i % 3 == 0 else None,
                status=status,
                total_raw=total_raw,
                total_parsed=total_parsed,
                total_new=total_new,
                total_duplicates=total_duplicates,
                started_at=started_at,
                completed_at=completed_at,
                created_at=created_at,
                error_message='Connection timeout' if status == 'failed' else None
            )
            
            self.db.add(job)
            jobs.append(job)
        
        self.db.commit()
        
        print(f"✅ Created {len(jobs)} dummy scan jobs")
        
        return jobs
    
    def create_dummy_scheduled_jobs(self, num_jobs: int = 5) -> list:
        """Create dummy scheduled jobs"""
        print("\n" + "=" * 80)
        print("Creating Dummy Scheduled Jobs")
        print("=" * 80)
        
        jobs = []
        schedules = ['0 6 * * *', '0 12 * * *', '0 18 * * *', '0 0 * * 0', '0 0 1 * *']
        keywords_list = [
            'example.com,test.com',
            'admin@company.com,support@company.com',
            'acme.com,techcorp.io,demo.com',
            'leaked.co.id,secure.co.id',
            'api.example.com,portal.example.com'
        ]
        
        print(f"Creating {num_jobs} dummy scheduled jobs...")
        
        for i in range(num_jobs):
            job = ScheduledJob(
                id=uuid.uuid4(),
                name=f"Daily Scan {i+1}",
                keywords=keywords_list[i % len(keywords_list)],
                time_filter='D1',
                schedule=schedules[i % len(schedules)],
                timezone='Asia/Jakarta',
                notify_telegram=i % 2 == 0,
                notify_slack=i % 3 == 0,
                notify_teams=i % 4 == 0,
                is_active=i % 5 != 0,  # 80% active
                last_run=datetime.utcnow() - timedelta(days=1) if i % 2 == 0 else None,
                next_run=datetime.utcnow() + timedelta(days=1)
            )
            
            self.db.add(job)
            jobs.append(job)
        
        self.db.commit()
        
        print(f"✅ Created {len(jobs)} dummy scheduled jobs")
        
        return jobs
    
    def link_credentials_to_jobs(self, jobs: list, max_creds_per_job: int = 50):
        """Link some credentials to scan jobs"""
        print("\n" + "=" * 80)
        print("Linking Credentials to Jobs")
        print("=" * 80)
        
        # Get random credentials
        credentials = self.db.query(Credential).limit(1000).all()
        
        if not credentials:
            print("⚠️  No credentials found to link")
            return
        
        total_links = 0
        
        for job in jobs:
            if job.status != 'completed':
                continue
            
            # Link random credentials to this job
            num_creds = random.randint(10, min(max_creds_per_job, len(credentials)))
            selected_creds = random.sample(credentials, num_creds)
            
            for cred in selected_creds:
                link = JobCredential(
                    job_id=job.id,
                    credential_id=cred.id,
                    is_new=random.random() < 0.3  # 30% are new
                )
                self.db.add(link)
                total_links += 1
        
        self.db.commit()
        
        print(f"✅ Created {total_links} credential-job links")
    
    def get_import_statistics(self) -> dict:
        """Get statistics about imported data"""
        stats = {
            'total_users': self.db.query(func.count(User.id)).scalar(),
            'total_credentials': self.db.query(func.count(Credential.id)).scalar(),
            'admin_credentials': self.db.query(func.count(Credential.id)).filter(Credential.is_admin == True).scalar(),
            'total_scan_jobs': self.db.query(func.count(ScanJob.id)).scalar(),
            'total_scheduled_jobs': self.db.query(func.count(ScheduledJob.id)).scalar(),
            'unique_domains': self.db.query(func.count(func.distinct(Credential.domain))).scalar()
        }
        
        return stats


def import_from_json(json_file: str, create_jobs: bool = True):
    """Import dummy data from JSON file"""
    print("=" * 80)
    print("IntelX Scanner - Dummy Data Importer")
    print("=" * 80)
    print()
    
    # Initialize database
    print("Initializing database...")
    init_db()
    print("✅ Database initialized")
    
    # Create session
    db = SessionLocal()
    
    try:
        importer = DummyDataImporter(db)
        
        # Skipping dummy user creation (not used in new import flow)
        
        # Load credentials from JSON
        print("\n" + "=" * 80)
        print("Loading Credentials from JSON")
        print("=" * 80)
        print(f"Reading file: {json_file}")
        
        with open(json_file, 'r') as f:
            credentials_data = json.load(f)
        
        print(f"✅ Loaded {len(credentials_data):,} credentials from JSON")
        
        # Import credentials
        imported_count = importer.import_credentials(credentials_data, batch_size=1000)
        
        # Create dummy jobs if requested
        if create_jobs:
            from datetime import timedelta
            import random
            
            jobs = importer.create_dummy_scan_jobs(num_jobs=10)
            scheduled_jobs = importer.create_dummy_scheduled_jobs(num_jobs=5)
            importer.link_credentials_to_jobs(jobs, max_creds_per_job=50)
        
        # Get statistics
        print("\n" + "=" * 80)
        print("Import Statistics")
        print("=" * 80)
        
        stats = importer.get_import_statistics()
        
        print(f"Total Users: {stats['total_users']}")
        print(f"Total Credentials: {stats['total_credentials']:,}")
        print(f"Admin Credentials: {stats['admin_credentials']:,}")
        print(f"Unique Domains: {stats['unique_domains']:,}")
        print(f"Total Scan Jobs: {stats['total_scan_jobs']}")
        print(f"Total Scheduled Jobs: {stats['total_scheduled_jobs']}")
        
        print("\n" + "=" * 80)
        print("✅ Import Complete!")
        print("=" * 80)
        print()
        print()
        print("You can now:")
        print("1. Start the application: docker-compose up")
        print("2. Explore the dummy data in the UI")
        print()
        
    except Exception as e:
        print(f"\n❌ Error during import: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Import dummy data into IntelX Scanner')
    parser.add_argument('json_file', help='Path to JSON file with dummy credentials')
    parser.add_argument('--no-jobs', action='store_true', help='Skip creating dummy scan jobs')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.json_file):
        print(f"❌ Error: File not found: {args.json_file}")
        sys.exit(1)
    
    import_from_json(args.json_file, create_jobs=not args.no_jobs)


if __name__ == '__main__':
    main()