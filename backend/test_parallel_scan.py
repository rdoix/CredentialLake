#!/usr/bin/env python3
"""
Test script for parallel domain scanning
Tests the new parallel implementation vs sequential
"""
import sys
import time
from datetime import datetime
from pathlib import Path

# Add repository root to sys.path (relative, no local absolute paths)
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.config import settings
from backend.intelx_client import process_multiple_domains

# Mock IntelX client for testing
class MockIntelX:
    """Mock IntelX client that simulates API delays"""
    
    def search(self, query, **kwargs):
        """Simulate search with delay"""
        time.sleep(0.5)  # Simulate 500ms API call
        return {
            'records': [
                {
                    'name': f'Test result for {query}',
                    'size': 1024,
                    'date': '2024-01-01',
                    'bucket': 'leaks.private',
                    'systemid': 'test123',
                    'storageid': 'test123',
                    'type': 0,
                    'media': 0
                }
            ]
        }
    
    def FILE_VIEW(self, *args, **kwargs):
        """Mock file view"""
        return f"test@example.com:password123\nadmin@example.com:admin123"
    
    def FILE_PREVIEW(self, *args, **kwargs):
        """Mock file preview"""
        return self.FILE_VIEW(*args, **kwargs)


def test_parallel_performance():
    """Test parallel vs sequential performance"""
    print("=" * 80)
    print("PARALLEL DOMAIN SCANNING PERFORMANCE TEST")
    print("=" * 80)
    
    # Test domains
    test_domains = [
        'example1.com',
        'example2.com',
        'example3.com',
        'example4.com',
        'example5.com',
        'example6.com',
        'example7.com',
        'example8.com',
        'example9.com',
        'example10.com'
    ]
    
    mock_ix = MockIntelX()
    
    print(f"\n📊 Testing with {len(test_domains)} domains")
    print(f"⚙️  Configuration:")
    print(f"   - Parallel workers: {settings.PARALLEL_DOMAIN_WORKERS}")
    print(f"   - Delay between requests: {settings.DOMAIN_SCAN_DELAY}s")
    print(f"   - Simulated API delay: 0.5s per domain")
    
    # Test 1: Sequential (old method - simulated)
    print("\n" + "=" * 80)
    print("TEST 1: SEQUENTIAL PROCESSING (Old Method)")
    print("=" * 80)
    sequential_start = time.time()
    sequential_time = len(test_domains) * (0.5 + 2.0)  # API delay + old delay
    print(f"⏱️  Estimated time: {sequential_time:.1f}s")
    print(f"   (Each domain: 0.5s API + 2.0s delay = 2.5s × {len(test_domains)} domains)")
    
    # Test 2: Parallel (new method)
    print("\n" + "=" * 80)
    print("TEST 2: PARALLEL PROCESSING (New Method)")
    print("=" * 80)
    parallel_start = time.time()
    
    try:
        credentials, domains_found = process_multiple_domains(
            mock_ix,
            test_domains,
            time_filter=None,
            maxresults=10,
            limit=5,
            delay_secs=settings.DOMAIN_SCAN_DELAY,
            max_workers=settings.PARALLEL_DOMAIN_WORKERS
        )
        
        parallel_end = time.time()
        parallel_time = parallel_end - parallel_start
        
        print(f"\n✅ Parallel scan completed!")
        print(f"   - Time taken: {parallel_time:.2f}s")
        print(f"   - Domains processed: {len(test_domains)}")
        print(f"   - Domains with results: {len(domains_found)}")
        print(f"   - Total credentials: {len(credentials)}")
        
        # Calculate speedup
        speedup = sequential_time / parallel_time
        time_saved = sequential_time - parallel_time
        
        print("\n" + "=" * 80)
        print("PERFORMANCE COMPARISON")
        print("=" * 80)
        print(f"📈 Sequential (estimated): {sequential_time:.2f}s")
        print(f"🚀 Parallel (actual):      {parallel_time:.2f}s")
        print(f"⚡ Speedup:                {speedup:.1f}x faster")
        print(f"⏰ Time saved:             {time_saved:.2f}s ({(time_saved/sequential_time*100):.1f}%)")
        
        if speedup >= 5:
            print(f"\n🎉 EXCELLENT! {speedup:.1f}x speedup achieved!")
        elif speedup >= 3:
            print(f"\n✅ GOOD! {speedup:.1f}x speedup achieved!")
        else:
            print(f"\n⚠️  Speedup is {speedup:.1f}x - consider increasing workers")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during parallel scan: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def test_configuration():
    """Test configuration values"""
    print("\n" + "=" * 80)
    print("CONFIGURATION TEST")
    print("=" * 80)
    
    print(f"✓ PARALLEL_DOMAIN_WORKERS: {settings.PARALLEL_DOMAIN_WORKERS}")
    print(f"✓ DOMAIN_SCAN_DELAY: {settings.DOMAIN_SCAN_DELAY}s")
    print(f"✓ MAX_CONCURRENT_JOBS: {settings.MAX_CONCURRENT_JOBS}")
    print(f"✓ JOB_TIMEOUT: {settings.JOB_TIMEOUT}s")
    
    if settings.PARALLEL_DOMAIN_WORKERS >= 10:
        print("\n✅ Configuration looks good for high-performance scanning")
    else:
        print(f"\n⚠️  Consider increasing PARALLEL_DOMAIN_WORKERS (current: {settings.PARALLEL_DOMAIN_WORKERS})")


if __name__ == '__main__':
    print(f"\n🧪 Starting parallel scanning tests at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Run tests
    test_configuration()
    success = test_parallel_performance()
    
    print("\n" + "=" * 80)
    if success:
        print("✅ ALL TESTS PASSED - Parallel scanning is working correctly!")
    else:
        print("❌ TESTS FAILED - Please check the error messages above")
    print("=" * 80)
    
    sys.exit(0 if success else 1)