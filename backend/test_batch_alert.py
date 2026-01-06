#!/usr/bin/env python3
"""Test script for batch alert functionality"""
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.database import SessionLocal
from backend.services.batch_alert_service import BatchAlertService
from backend.models.scan_job import ScanJob
import uuid


def create_test_jobs(db, num_jobs=3, with_findings=True):
    """Create test scan jobs for batch alert testing"""
    job_ids = []
    
    for i in range(num_jobs):
        job_id = str(uuid.uuid4())
        
        # Vary the results for realistic testing
        if with_findings:
            if i == 0:
                # Job with new credentials
                total_raw = 25
                total_new = 8
                total_duplicates = 17
            elif i == 1:
                # Job with only duplicates
                total_raw = 20
                total_new = 0
                total_duplicates = 20
            else:
                # Job with no findings
                total_raw = 0
                total_new = 0
                total_duplicates = 0
        else:
            # All jobs with no findings
            total_raw = 0
            total_new = 0
            total_duplicates = 0
        
        job = ScanJob(
            id=job_id,
            job_type="intelx_single",
            name="Test Scheduled Job",
            query=f"subdomain{i+1}.example.com",
            time_filter="D1",
            status="completed",
            total_raw=total_raw,
            total_parsed=total_raw,
            total_new=total_new,
            total_duplicates=total_duplicates,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        
        db.add(job)
        job_ids.append(job_id)
    
    db.commit()
    return job_ids


def test_collect_results():
    """Test result collection from multiple jobs"""
    print("\n" + "="*60)
    print("TEST 1: Collect Results from Multiple Jobs")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Create test jobs with findings
        print("\n📝 Creating test jobs with findings...")
        job_ids = create_test_jobs(db, num_jobs=3, with_findings=True)
        print(f"✅ Created {len(job_ids)} test jobs")
        
        # Collect results
        print("\n📊 Collecting results...")
        results = BatchAlertService.collect_job_results(db, job_ids)
        
        # Display results
        print("\n📈 Results Summary:")
        print(f"  Total Queries: {results['total_queries']}")
        print(f"  Queries with Findings: {results['queries_with_findings']}")
        print(f"  Queries without Findings: {results['queries_without_findings']}")
        print(f"  Total Credentials Found: {results['total_credentials_found']}")
        print(f"  Total New Credentials: {results['total_new_credentials']}")
        print(f"  Total Duplicates: {results['total_duplicates']}")
        
        print("\n📋 Query Details:")
        for detail in results['query_details']:
            status_emoji = "🚨" if detail['total_new'] > 0 else ("⚠️" if detail['has_findings'] else "✅")
            print(f"  {status_emoji} {detail['query']}: "
                  f"Raw={detail['total_raw']}, "
                  f"New={detail['total_new']}, "
                  f"Dup={detail['total_duplicates']}")
        
        # Cleanup
        for job_id in job_ids:
            db.query(ScanJob).filter(ScanJob.id == job_id).delete()
        db.commit()
        
        print("\n✅ TEST 1 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_no_findings_scenario():
    """Test scenario where no credentials are found"""
    print("\n" + "="*60)
    print("TEST 2: No Findings Scenario")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Create test jobs without findings
        print("\n📝 Creating test jobs without findings...")
        job_ids = create_test_jobs(db, num_jobs=3, with_findings=False)
        print(f"✅ Created {len(job_ids)} test jobs")
        
        # Collect results
        print("\n📊 Collecting results...")
        results = BatchAlertService.collect_job_results(db, job_ids)
        
        # Verify no findings
        assert results['queries_with_findings'] == 0, "Should have 0 queries with findings"
        assert results['queries_without_findings'] == 3, "Should have 3 queries without findings"
        assert results['total_credentials_found'] == 0, "Should have 0 total credentials"
        
        print("\n✅ Verified: All queries returned clean results")
        print(f"  Total Queries: {results['total_queries']}")
        print(f"  Queries without Findings: {results['queries_without_findings']}")
        
        # Cleanup
        for job_id in job_ids:
            db.query(ScanJob).filter(ScanJob.id == job_id).delete()
        db.commit()
        
        print("\n✅ TEST 2 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_alert_text_generation():
    """Test alert text generation"""
    print("\n" + "="*60)
    print("TEST 3: Alert Text Generation")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Create test jobs
        print("\n📝 Creating test jobs...")
        job_ids = create_test_jobs(db, num_jobs=3, with_findings=True)
        
        # Collect results
        results = BatchAlertService.collect_job_results(db, job_ids)
        
        # Generate alert text
        print("\n📝 Generating alert text...")
        alert_text = BatchAlertService._build_query_details_text(results)
        
        print("\n📄 Generated Alert Text:")
        print("-" * 60)
        print(alert_text)
        print("-" * 60)
        
        # Verify key elements are present
        assert "🔴 Queries with Credential Leaks:" in alert_text
        assert "🟢 Queries without Findings:" in alert_text
        assert "📖 Legend:" in alert_text
        assert "subdomain1.example.com" in alert_text
        
        print("\n✅ Verified: Alert text contains all required elements")
        
        # Cleanup
        for job_id in job_ids:
            db.query(ScanJob).filter(ScanJob.id == job_id).delete()
        db.commit()
        
        print("\n✅ TEST 3 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_mixed_results():
    """Test with mixed results (some with findings, some without)"""
    print("\n" + "="*60)
    print("TEST 4: Mixed Results Scenario")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Create jobs with mixed results
        print("\n📝 Creating jobs with mixed results...")
        job_ids = []
        
        # Job 1: With new credentials
        job1 = ScanJob(
            id=str(uuid.uuid4()),
            job_type="intelx_single",
            name="Test Job",
            query="critical.example.com",
            status="completed",
            total_raw=50,
            total_parsed=50,
            total_new=15,
            total_duplicates=35,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.add(job1)
        job_ids.append(str(job1.id))
        
        # Job 2: Only duplicates
        job2 = ScanJob(
            id=str(uuid.uuid4()),
            job_type="intelx_single",
            name="Test Job",
            query="staging.example.com",
            status="completed",
            total_raw=30,
            total_parsed=30,
            total_new=0,
            total_duplicates=30,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.add(job2)
        job_ids.append(str(job2.id))
        
        # Job 3: No findings
        job3 = ScanJob(
            id=str(uuid.uuid4()),
            job_type="intelx_single",
            name="Test Job",
            query="clean.example.com",
            status="completed",
            total_raw=0,
            total_parsed=0,
            total_new=0,
            total_duplicates=0,
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc)
        )
        db.add(job3)
        job_ids.append(str(job3.id))
        
        db.commit()
        print(f"✅ Created {len(job_ids)} jobs with mixed results")
        
        # Collect and verify
        results = BatchAlertService.collect_job_results(db, job_ids)
        
        assert results['total_queries'] == 3
        assert results['queries_with_findings'] == 2
        assert results['queries_without_findings'] == 1
        assert results['total_new_credentials'] == 15
        assert results['total_duplicates'] == 65
        
        print("\n✅ Verified mixed results:")
        print(f"  Queries with findings: {results['queries_with_findings']}/3")
        print(f"  New credentials: {results['total_new_credentials']}")
        print(f"  Duplicates: {results['total_duplicates']}")
        
        # Cleanup
        for job_id in job_ids:
            db.query(ScanJob).filter(ScanJob.id == job_id).delete()
        db.commit()
        
        print("\n✅ TEST 4 PASSED")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("BATCH ALERT SERVICE - TEST SUITE")
    print("="*60)
    
    tests = [
        ("Collect Results", test_collect_results),
        ("No Findings Scenario", test_no_findings_scenario),
        ("Alert Text Generation", test_alert_text_generation),
        ("Mixed Results", test_mixed_results),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())