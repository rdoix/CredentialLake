#!/usr/bin/env python3
# IntelX Client
# Ports IntelX search and content inspection from legacy test8.py with time-filter fixes and diagnostics

import os
import sys
import html
import json
import time
from datetime import datetime, timedelta
from termcolor import colored
import colorama
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

colorama.init(autoreset=True)

BOLD = '\033[1m'
END = '\033[0m'

def rightnow():
    return time.strftime("%H:%M:%S")

def format_size(size_bytes):
    """Convert bytes to human readable format"""
    if size_bytes == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB", "TB"]
    import math
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 1)
    return f"{s} {size_names[i]}"

def parse_time_filter(time_arg):
    """Parse time filter arguments (D1, D7, W1, W2, M1, Y1)"""
    if not time_arg:
        return 1, 'days'  # Default: yesterday

    time_arg = time_arg.upper()

    if time_arg.startswith('D'):
        try:
            days = int(time_arg[1:]) if len(time_arg) > 1 else 1
            return days, 'days'
        except ValueError:
            print(colored(f"❌ Invalid day format: {time_arg}. Use D1, D7, etc.", 'red'))
            return 1, 'days'

    elif time_arg.startswith('W'):
        try:
            weeks = int(time_arg[1:]) if len(time_arg) > 1 else 1
            return weeks * 7, 'days'
        except ValueError:
            print(colored(f"❌ Invalid week format: {time_arg}. Use W1, W2, etc.", 'red'))
            return 7, 'days'

    elif time_arg.startswith('M'):
        try:
            months = int(time_arg[1:]) if len(time_arg) > 1 else 1
            return months * 30, 'days'
        except ValueError:
            print(colored(f"❌ Invalid month format: {time_arg}. Use M1, M3, etc.", 'red'))
            return 30, 'days'

    elif time_arg.startswith('Y'):
        try:
            years = int(time_arg[1:]) if len(time_arg) > 1 else 1
            return years * 365, 'days'
        except ValueError:
            print(colored(f"❌ Invalid year format: {time_arg}. Use Y1, Y2, etc.", 'red'))
            return 365, 'days'

    else:
        print(colored(f"❌ Invalid time format: {time_arg}. Use D[n], W[n], M[n], or Y[n]", 'red'))
        return 1, 'days'

def get_date_filter(days_ago=1):
    """Get date filter range (from-to) with explicit time-of-day boundaries for IntelX search."""
    if days_ago == 1:
        target_date = datetime.now() - timedelta(days=days_ago)
        # Inclusive bounds for the single day
        date_from = target_date.strftime("%Y-%m-%d") + " 00:00:00"
        date_to = target_date.strftime("%Y-%m-%d") + " 23:59:59"
    else:
        # From N days ago at 00:00:00 to yesterday at 23:59:59
        date_from = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d") + " 00:00:00"
        date_to = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d") + " 23:59:59"
    return date_from, date_to

def search_leaks(ix, query, maxresults=100, time_filter=None, should_stop=None):
    """
    Search specifically in leaks.private bucket.
    Adds explicit diagnostics for resolved date range when time_filter is provided.
    Supports cooperative cancellation via should_stop('collecting').
    """
    if time_filter:
        days_ago, _ = parse_time_filter(time_filter)
        date_from, date_to = get_date_filter(days_ago)

        if days_ago == 1:
            print(colored(f"📅 Searching for '{query}' on {date_from.split()[0]} (yesterday)", 'yellow'))
        else:
            print(colored(f"📅 Searching for '{query}' from {date_from} to {date_to} ({days_ago} days back)", 'yellow'))
        print(colored(f"🧪 DEBUG: Applied time_filter={time_filter} -> date_from={date_from}, date_to={date_to}", 'blue'))
        print(colored(f"🧪 DEBUG: ix.search(query={query}, datefrom='{date_from}', dateto='{date_to}', buckets=['leaks.private'])", 'blue'))
    else:
        date_from, date_to = "", ""
        print(colored(f"🔍 [{rightnow()}] Searching for '{query}' in private leaks database (all time)...", 'green'))

    # Cooperative cancellation checkpoint before network call
    if should_stop:
        try:
            should_stop('collecting')
        except Exception:
            # Propagate stop to caller
            raise

    buckets = ['leaks.private']
    timeout = 10
    sort = 4  # relevance
    media = 0

    try:
        search_result = ix.search(
            query,
            maxresults=maxresults,
            buckets=buckets,
            timeout=timeout,
            datefrom=date_from,
            dateto=date_to,
            sort=sort,
            media=media,
            terminate=[]
        )
        # Attach the date bounds to the result for downstream filtering/logging
        if search_result is not None:
            try:
                search_result['datefrom'] = date_from
                search_result['dateto'] = date_to
                search_result['time_filter'] = time_filter or ""
            except Exception:
                # Best-effort; ignore if result is not mutable
                pass
        return search_result
    except Exception as e:
        print(colored(f"❌ Error during search: {str(e)}", 'red'))
        return None

def inspect_file_contents(ix, results, query, should_stop=None):
    """
    Inspect file contents and extract lines containing the query.
    Returns a list of credential-like dicts: {line, important, file_name, file_idx}
    Supports cooperative cancellation via should_stop('collecting') between file operations.
    """
    all_credentials = []
    seen_credentials = set()

    for idx, result in enumerate(results):
        # Cooperative cancellation checkpoint per record
        if should_stop:
            try:
                should_stop('collecting')
            except Exception:
                raise

        name = html.unescape(result.get('name', 'Untitled Document'))
        if len(name) > 60:
            name = name[:57] + "..."

        print(colored(f"🔍 [{idx + 1}] Inspecting: {name}", 'cyan'))

        try:
            storage_id = result.get('storageid', result.get('systemid'))
            bucket = result.get('bucket', '')
            media_type = result.get('media', 0)
            file_type = result.get('type', 0)

            if not storage_id:
                print(colored("   ❌ No storage ID available", 'red'))
                continue

            content = ix.FILE_VIEW(file_type, media_type, storage_id, bucket)
            if not content:
                content = ix.FILE_PREVIEW(file_type, media_type, 0, storage_id, bucket)

            if content:
                lines = content.split('\n')
                file_matches = 0

                for line_num, line in enumerate(lines, 1):
                    # Cooperative cancellation inside line loop
                    if should_stop:
                        try:
                            should_stop('collecting')
                        except Exception:
                            raise

                    if query.lower() in line.lower():
                        clean_line = line.strip()
                        if len(clean_line) > 150:
                            clean_line = clean_line[:147] + "..."

                        if clean_line not in seen_credentials:
                            seen_credentials.add(clean_line)

                            is_important = 'admin' in clean_line.lower()

                            all_credentials.append({
                                'line': clean_line,
                                'important': is_important,
                                'file_name': name,
                                'file_idx': idx + 1
                            })
                            file_matches += 1

                if file_matches > 0:
                    print(colored(f"   ✅ Found {file_matches} unique matches", 'green'))
                else:
                    print(colored(f"   ⚠️  Keyword '{query}' not found in visible content", 'yellow'))
            else:
                print(colored("   ❌ Could not retrieve file content", 'red'))

        except Exception as e:
            # If cooperative stop is configured, propagate exceptions (Cancel/Pause) to worker
            if should_stop:
                raise
            print(colored(f"   ❌ Error inspecting file: {str(e)}", 'red'))

        print()

    return all_credentials

def process_search_results(ix, search_result, query, limit=10, should_stop=None):
    """
    Process search results and extract credential lines.
    Returns a list of {line, important, file_name, file_idx}
    Supports cooperative cancellation via should_stop('collecting').
    """
    if not search_result or 'records' not in search_result:
        print(colored("❌ No results found or search failed.", 'red'))
        return []

    results = search_result['records']
    total_results = len(results)

    if total_results == 0:
        print(colored(f"❌ No leaks found for '{query}'", 'red'))
        return []

    # Optional client-side filtering by date range if search provided date bounds
    datefrom_str = search_result.get('datefrom') if isinstance(search_result, dict) else None
    dateto_str = search_result.get('dateto') if isinstance(search_result, dict) else None

    def _parse_iso(s: str):
        try:
            return datetime.fromisoformat(s.replace('Z', '+00:00'))
        except Exception:
            return None

    dt_from = None
    dt_to = None
    filtered = results
    if datefrom_str and dateto_str and datefrom_str.strip() and dateto_str.strip():
        try:
            dt_from = datetime.strptime(datefrom_str.strip(), "%Y-%m-%d %H:%M:%S")
            dt_to = datetime.strptime(dateto_str.strip(), "%Y-%m-%d %H:%M:%S")
        except Exception:
            dt_from = None
            dt_to = None

        if dt_from and dt_to:
            kept = []
            dropped = 0
            for r in results:
                rdate = r.get('date')
                rdt = _parse_iso(rdate) if isinstance(rdate, str) else None
                if rdt:
                    # Compare naive vs aware: strip tz for comparison bounds
                    rdt_naive = rdt.replace(tzinfo=None)
                    if dt_from <= rdt_naive <= dt_to:
                        kept.append(r)
                    else:
                        dropped += 1
                else:
                    # If no date, keep conservatively
                    kept.append(r)
            filtered = kept
            print(colored(f"🧪 DEBUG: Client-side date filtering kept {len(kept)} / {len(results)} records, dropped {dropped}", 'blue'))

    results = filtered
    total_results = len(results)

    print(colored(f"\n📋 FOUND {total_results} RESULTS (after filtering)" if (filtered is not None and (dt_from or dt_to)) else f"\n📋 FOUND {total_results} RESULTS", 'cyan', attrs=['bold']))
    print("=" * 80)

    displayed_count = 0
    valid_results = []

    for idx, result in enumerate(results):
        if displayed_count >= limit:
            break

        # Cooperative cancellation checkpoint before adding to valid_results
        if should_stop:
            try:
                should_stop('collecting')
            except Exception:
                raise

        name = html.unescape(result.get('name', 'Untitled Document'))
        if len(name) == 0:
            name = "Untitled Document"

        size = result.get('size', 0)
        size_formatted = format_size(int(size)) if size else "Unknown"

        date = result.get('date', 'Unknown')
        bucket = result.get('bucketh', result.get('bucket', 'Unknown'))
        system_id = result.get('systemid', result.get('storageid', 'Unknown'))

        print(colored(f"📄 [{displayed_count + 1:2d}] {name}", 'white', attrs=['bold']))
        print(colored(f"    📂 Bucket: {bucket}", 'blue'))
        print(colored(f"    📏 Size: {size_formatted}", 'yellow'))
        print(colored(f"    📅 Date: {date}", 'green'))
        print(colored(f"    🆔 ID: {system_id}", 'magenta'))

        valid_results.append(result)
        displayed_count += 1

    if valid_results:
        print(colored(f"\n🔍 Inspecting file contents for keyword: '{query}'", 'cyan', attrs=['bold']))
        print("=" * 80)
        credentials = inspect_file_contents(ix, valid_results, query, should_stop=should_stop)
        return credentials

    return []

def process_single_domain_task(ix, domain, time_filter, maxresults, limit, idx, total_domains, delay_secs, should_stop=None):
    """
    Process a single domain (used by parallel executor).
    Returns (domain, credentials, success_flag).
    Supports cooperative cancellation via should_stop('collecting').
    """
    domain = domain.strip()
    if not domain:
        return (domain, [], False)
    
    print(colored(f"\n🌐 [{idx}/{total_domains}] Processing domain: {domain}", 'blue', attrs=['bold']))
    
    try:
        # Add small delay to avoid overwhelming the API
        if delay_secs > 0:
            time.sleep(delay_secs)

        # Cooperative cancellation checkpoint before network search
        if should_stop:
            try:
                should_stop('collecting')
            except Exception:
                raise
        
        # Perform the search using the provided time_filter
        search_result = search_leaks(ix, domain, maxresults=maxresults, time_filter=time_filter, should_stop=should_stop)
        
        if search_result:
            credentials = process_search_results(ix, search_result, domain, limit=limit, should_stop=should_stop)
            if credentials:
                print(colored(f"   ✅ Found {len(credentials)} credentials for {domain}", 'green'))
                return (domain, credentials, True)
            else:
                print(colored(f"   ⚠️  No credentials found for {domain}", 'yellow'))
                return (domain, [], False)
        else:
            print(colored(f"   ❌ Search failed for {domain}", 'red'))
            return (domain, [], False)
    except Exception as e:
        # Propagate cooperative stop exceptions to caller when enabled
        if should_stop:
            raise
        print(colored(f"   ❌ Error processing {domain}: {str(e)}", 'red'))
        return (domain, [], False)


def process_multiple_domains(ix, domains, time_filter=None, maxresults=100, limit=10, delay_secs=0.1, max_workers=20, should_stop=None):
    """
    Process multiple domains with PARALLEL execution for maximum performance.
    Returns (all_credentials, domains_with_results).
    Supports cooperative cancellation via should_stop('collecting').
    """
    all_credentials = []
    all_domains = set()
    
    total_domains = len(domains)
    print(colored(f"\n🚀 Processing {total_domains} domains with {max_workers} parallel workers...", 'cyan', attrs=['bold']))
    print("=" * 80)
    
    successful_searches = 0
    failed_searches = 0
    
    # Log the chosen filter for visibility
    print(colored(f"🧪 DEBUG: multi-domain time_filter={time_filter}, maxresults={maxresults}, limit={limit}, workers={max_workers}", 'blue'))
    
    # Use ThreadPoolExecutor for parallel processing
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all domain tasks
        future_to_domain = {}
        for idx, domain in enumerate(domains, 1):
            future = executor.submit(
                process_single_domain_task,
                ix, domain, time_filter, maxresults, limit, idx, total_domains, delay_secs, should_stop
            )
            future_to_domain[future] = domain
        
        # Collect results as they complete
        for future in as_completed(future_to_domain):
            domain_name = future_to_domain[future]
            try:
                domain, credentials, success = future.result()
                if success and credentials:
                    all_credentials.extend(credentials)
                    all_domains.add(domain)
                    successful_searches += 1
                else:
                    failed_searches += 1
            except Exception as e:
                # Propagate cooperative stop exceptions to caller when enabled
                if should_stop:
                    raise
                print(colored(f"   ❌ Exception for {domain_name}: {str(e)}", 'red'))
                failed_searches += 1
    
    print(colored(f"\n📊 Multiple domain search summary:", 'cyan', attrs=['bold']))
    print(colored(f"   - Total domains processed: {total_domains}", 'white'))
    print(colored(f"   - Successful searches: {successful_searches}", 'green'))
    print(colored(f"   - Failed searches: {failed_searches}", 'red'))
    print(colored(f"   - Domains with credentials: {len(all_domains)}", 'blue'))
    print(colored(f"   - Total credentials found: {len(all_credentials)}", 'yellow'))
    print(colored(f"   - Performance: ~{max_workers}x faster than sequential", 'magenta', attrs=['bold']))
    
    return all_credentials, list(all_domains)