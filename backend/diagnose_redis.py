#!/usr/bin/env python3
"""
Diagnostic script to check Redis connectivity and configuration.
Run this on your server to identify the issue.
"""
import sys
import os
from redis import Redis
from redis.exceptions import ConnectionError, TimeoutError

def check_redis_connection(redis_url):
    """Test Redis connection"""
    print(f"\n{'='*60}")
    print(f"Testing Redis connection: {redis_url}")
    print(f"{'='*60}")
    
    try:
        redis_conn = Redis.from_url(redis_url, socket_connect_timeout=5)
        
        # Test ping
        print("✓ Attempting to ping Redis...")
        response = redis_conn.ping()
        if response:
            print("✓ Redis PING successful!")
        
        # Test set/get
        print("✓ Testing SET operation...")
        redis_conn.set('test_key', 'test_value', ex=10)
        print("✓ SET successful!")
        
        print("✓ Testing GET operation...")
        value = redis_conn.get('test_key')
        if value == b'test_value':
            print("✓ GET successful!")
        
        # Get info
        print("\n✓ Redis server info:")
        info = redis_conn.info('server')
        print(f"  - Redis version: {info.get('redis_version', 'unknown')}")
        print(f"  - OS: {info.get('os', 'unknown')}")
        print(f"  - Uptime (seconds): {info.get('uptime_in_seconds', 'unknown')}")
        
        print("\n✅ Redis connection is WORKING!")
        return True
        
    except ConnectionError as e:
        print(f"\n❌ Redis Connection Error: {e}")
        print("\nPossible causes:")
        print("  1. Redis container is not running")
        print("  2. Wrong hostname/port in REDIS_URL")
        print("  3. Network connectivity issues")
        print("  4. Firewall blocking the connection")
        return False
        
    except TimeoutError as e:
        print(f"\n❌ Redis Timeout Error: {e}")
        print("\nPossible causes:")
        print("  1. Redis is too slow to respond")
        print("  2. Network latency issues")
        print("  3. Redis is overloaded")
        return False
        
    except Exception as e:
        print(f"\n❌ Unexpected Error: {type(e).__name__}: {e}")
        return False

def main():
    print("="*60)
    print("Redis Connectivity Diagnostic Tool")
    print("="*60)
    
    # Check environment variables
    print("\n1. Checking environment variables...")
    redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    database_url = os.getenv('DATABASE_URL', 'Not set')
    intelx_key = os.getenv('INTELX_KEY', 'Not set')
    
    print(f"  REDIS_URL: {redis_url}")
    print(f"  DATABASE_URL: {database_url[:50]}..." if len(database_url) > 50 else f"  DATABASE_URL: {database_url}")
    print(f"  INTELX_KEY: {'Set' if intelx_key != 'Not set' else 'Not set'}")
    
    # Test different Redis URLs
    redis_urls_to_test = [
        redis_url,  # From environment
        "redis://localhost:6379/0",  # Local
        "redis://redis:6379/0",  # Docker compose
        "redis://127.0.0.1:6379/0",  # Localhost IP
    ]
    
    print("\n2. Testing Redis connections...")
    success = False
    for url in redis_urls_to_test:
        if check_redis_connection(url):
            success = True
            break
    
    if not success:
        print("\n" + "="*60)
        print("❌ ALL REDIS CONNECTIONS FAILED")
        print("="*60)
        print("\nTroubleshooting steps:")
        print("1. Check if Redis container is running:")
        print("   docker ps | grep redis")
        print("\n2. Check Redis container logs:")
        print("   docker logs credlake_redis")
        print("\n3. Restart Redis container:")
        print("   docker-compose restart redis")
        print("\n4. Check if Redis port is accessible:")
        print("   telnet localhost 6379")
        print("\n5. Verify .env file has correct REDIS_URL")
        sys.exit(1)
    else:
        print("\n" + "="*60)
        print("✅ DIAGNOSIS COMPLETE - Redis is accessible")
        print("="*60)
        sys.exit(0)

if __name__ == "__main__":
    main()