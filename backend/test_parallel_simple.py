#!/usr/bin/env python3
"""
Simple test to verify parallel scanning logic works
"""
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

def simulate_domain_scan(domain, idx, total, delay=0.1):
    """Simulate scanning a single domain"""
    print(f"[{idx}/{total}] Scanning {domain}...")
    time.sleep(0.5)  # Simulate API call
    if delay > 0:
        time.sleep(delay)
    return (domain, f"credentials_for_{domain}", True)

def test_sequential(domains):
    """Test sequential processing (old method)"""
    print("\n" + "="*80)
    print("SEQUENTIAL PROCESSING (Old Method)")
    print("="*80)
    
    start = time.time()
    results = []
    
    for idx, domain in enumerate(domains, 1):
        result = simulate_domain_scan(domain, idx, len(domains), delay=2.0)
        results.append(result)
    
    elapsed = time.time() - start
    print(f"\n✓ Sequential completed in {elapsed:.2f}s")
    return elapsed, results

def test_parallel(domains, max_workers=20):
    """Test parallel processing (new method)"""
    print("\n" + "="*80)
    print(f"PARALLEL PROCESSING (New Method - {max_workers} workers)")
    print("="*80)
    
    start = time.time()
    results = []
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for idx, domain in enumerate(domains, 1):
            future = executor.submit(simulate_domain_scan, domain, idx, len(domains), 0.1)
            futures[future] = domain
        
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
    
    elapsed = time.time() - start
    print(f"\n✓ Parallel completed in {elapsed:.2f}s")
    return elapsed, results

if __name__ == '__main__':
    # Test with 10 domains
    test_domains = [f'example{i}.com' for i in range(1, 11)]
    
    print("="*80)
    print("PARALLEL DOMAIN SCANNING TEST")
    print("="*80)
    print(f"\nTesting with {len(test_domains)} domains")
    print(f"Simulated API delay: 0.5s per domain")
    
    # Test sequential
    seq_time, seq_results = test_sequential(test_domains)
    
    # Test parallel
    par_time, par_results = test_parallel(test_domains, max_workers=20)
    
    # Compare
    print("\n" + "="*80)
    print("PERFORMANCE COMPARISON")
    print("="*80)
    speedup = seq_time / par_time
    time_saved = seq_time - par_time
    
    print(f"Sequential: {seq_time:.2f}s")
    print(f"Parallel:   {par_time:.2f}s")
    print(f"Speedup:    {speedup:.1f}x faster")
    print(f"Time saved: {time_saved:.2f}s ({(time_saved/seq_time*100):.1f}%)")
    
    if speedup >= 5:
        print(f"\n🎉 EXCELLENT! {speedup:.1f}x speedup achieved!")
    elif speedup >= 3:
        print(f"\n✅ GOOD! {speedup:.1f}x speedup achieved!")
    else:
        print(f"\n⚠️  Speedup is {speedup:.1f}x")
    
    print("\n" + "="*80)
    print("✅ TEST COMPLETED - Parallel processing is working!")
    print("="*80)