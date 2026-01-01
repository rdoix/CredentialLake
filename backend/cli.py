#!/usr/bin/env python3
# Modular CLI orchestrator for IntelX Scanner
# Wires scanner_engine (parser + file pipeline), intelx_client (IntelX API), and notifier (Teams)

import os
import sys
import json
import time
import argparse
from datetime import datetime
from termcolor import colored
import colorama
from pathlib import Path

# Ensure local module imports work even when run from project root
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from backend.scanner_engine import CredentialParser, process_file_mode
from backend.intelx_client import (
    search_leaks,
    inspect_file_contents,
    process_search_results,
    process_multiple_domains
)
from backend.notifier import send_teams_alert

# External IntelX API client
from intelxapi import intelx

colorama.init(autoreset=True)

BOLD = '\033[1m'
END = '\033[0m'

BANNER = r'''
{}🔍 Enhanced IntelX Credential Leak Scanner (Modular)
   Engine + IntelX Client + Teams Notifier

   Usage examples:
     IntelX mode:
       python intelx_scanner/cli.py -x acmecorp.com
       python intelx_scanner/cli.py -x domains.txt --multiple --W2 --maxresults 200
       python intelx_scanner/cli.py -x user@company.com --D7 --limit 20 --sendreport

     File mode:
       python intelx_scanner/cli.py -f credentials.txt
       python intelx_scanner/cli.py -f leaked_data.zip --sendreport
{}
'''

def rightnow():
    return time.strftime("%H:%M:%S")

def read_domain_list(file_path):
    """Read domain list for --multiple mode, skip comments and empty lines"""
    try:
        file_path = os.path.abspath(file_path)
        if not os.path.exists(file_path):
            print(colored(f"❌ Domain file not found: {file_path}", 'red'))
            return []

        print(colored(f"📖 Reading domain list from: {os.path.basename(file_path)}", 'cyan'))

        encodings = ['utf-8', 'latin-1', 'cp1252', 'ascii']
        content = None
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                print(colored(f"✅ Successfully read domain file with {enc} encoding", 'green'))
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            print(colored(f"❌ Could not read domain file with any encoding", 'red'))
            return []

        lines = content.split('\n')
        domains = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            # Strip URL prefixes if any
            if line.startswith(('http://', 'https://')):
                from urllib.parse import urlparse
                line = urlparse(line).netloc
            domains.append(line)

        print(colored(f"📊 Loaded {len(domains)} domains from file", 'yellow'))
        return domains

    except Exception as e:
        print(colored(f"❌ Error reading domain file: {str(e)}", 'red'))
        return []

def display_consolidated_credentials(credentials, query):
    """Display consolidated unique lines (IntelX mode)."""
    print(colored(f"\n🎯 CONSOLIDATED CREDENTIALS FOUND FOR '{query}'", 'cyan', attrs=['bold']))
    print("=" * 80)

    # Important first, then alphabetical
    credentials.sort(key=lambda x: (not x.get('important', False), x.get('line', '').lower()))

    important_count = sum(1 for cred in credentials if cred.get('important'))
    total_count = len(credentials)

    print(colored(f"📊 Total unique credentials: {total_count}", 'white', attrs=['bold']))
    if important_count > 0:
        print(colored(f"⚠️  Important (contains 'admin'): {important_count}", 'red', attrs=['bold']))
    print()

    for idx, cred in enumerate(credentials, 1):
        line = cred.get('line', '')
        if cred.get('important'):
            print(colored(f"❗ [IMPORTANT] [{idx:2d}] {line}", 'red', attrs=['bold']))
        else:
            print(colored(f"✅ [{idx:2d}] {line}", 'green'))

    return [cred['line'] for cred in credentials]

def display_file_mode_credentials(credentials, query_name, max_display=500):
    """Priority display for File Mode raw lines before parsing."""
    print(colored(f"\n🎯 CREDENTIALS FOUND IN FILE MODE FOR '{query_name}'", 'cyan', attrs=['bold']))
    print("=" * 80)

    total_count = len(credentials)

    if total_count > max_display:
        print(colored(f"⚠️  Found {total_count} credentials! Displaying top {max_display} by priority.", 'yellow', attrs=['bold']))
        print(colored(f"   Check CSV files for complete details.", 'yellow'))
        print()

    # Categorize by priority: admin + .id, admin, .id, others
    priority_1, priority_2, priority_3, priority_4 = [], [], [], []
    admin_keywords = ['admin', 'administrator', 'root', 'superuser', 'sysadmin', 'webadmin', 'dbadmin']

    for cred in credentials:
        line = cred['line'].lower()
        has_admin = any(keyword in line for keyword in admin_keywords)
        has_id_domain = '.id' in line

        if has_admin and has_id_domain:
            priority_1.append(cred)
        elif has_admin:
            priority_2.append(cred)
        elif has_id_domain:
            priority_3.append(cred)
        else:
            priority_4.append(cred)

    print(colored(f"📊 Total credentials: {total_count}", 'white', attrs=['bold']))
    if priority_1:
        print(colored(f"🚨 HIGH PRIORITY (Admin + .id domain): {len(priority_1)}", 'red', attrs=['bold']))
    if priority_2:
        print(colored(f"⚠️  MEDIUM PRIORITY (Admin): {len(priority_2)}", 'yellow', attrs=['bold']))
    if priority_3:
        print(colored(f"🇮🇩 ID DOMAINS: {len(priority_3)}", 'blue', attrs=['bold']))
    if priority_4:
        print(colored(f"📝 OTHERS: {len(priority_4)}", 'white'))
    print()

    displayed_count = 0
    idx = 1

    def show_group(title_color, title, emote, group):
        nonlocal displayed_count, idx
        if group and displayed_count < max_display:
            remaining_slots = max_display - displayed_count
            display_count = min(len(group), remaining_slots)
            print(colored(title, title_color, attrs=['bold']))
            print(colored("=" * 50, title_color))
            for i, c in enumerate(group[:display_count]):
                print(colored(f"{emote} [{idx:3d}] {c['line']}", title_color if emote != '✅' else 'green', attrs=['bold'] if emote != '✅' else None))
                idx += 1
                displayed_count += 1
            if len(group) > display_count:
                print(colored(f"   ... and {len(group) - display_count} more in CSV", title_color))
            print()

    show_group('red', "🚨 HIGH PRIORITY - ADMIN + .ID DOMAIN:", '🚨', priority_1)
    show_group('yellow', "⚠️  MEDIUM PRIORITY - ADMIN CREDENTIALS:", '⚠️', priority_2)
    show_group('blue', "🇮🇩 ID DOMAIN CREDENTIALS:", '🇮🇩', priority_3)
    show_group('white', "📝 OTHER CREDENTIALS:", '✅', priority_4)

    if priority_1:
        print(colored("🚨 CRITICAL ALERT: Found admin credentials with .id domains!", 'red', attrs=['bold']))
    if priority_2:
        print(colored("⚠️  WARNING: Found admin credentials!", 'yellow', attrs=['bold']))
    if priority_3 and not priority_1:
        print(colored("🇮🇩 INFO: Found Indonesian domain credentials", 'blue'))

    if total_count > max_display:
        print()
        print(colored(f"📋 Displayed {display_count} of {total_count} credentials (limited to {max_display})", 'cyan', attrs=['bold']))
        print(colored(f"📄 Check CSV files for complete credential list", 'cyan', attrs=['bold']))

    return [cred['line'] for cred in credentials]

def resolve_time_filter_from_args(args):
    """Return time_filter code or None based on flags."""
    if getattr(args, 'daily', False):
        return 'D1'
    if getattr(args, 'time_filter', None):
        return args.time_filter
    return None

def main():
    parser = argparse.ArgumentParser(
        description="IntelX Scanner CLI (Modular)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  IntelX mode (single domain):
    python intelx_scanner/cli.py -x acmecorp.com
    python intelx_scanner/cli.py -x acmecorp.com --daily
    python intelx_scanner/cli.py -x acmecorp.com --sendreport
    python intelx_scanner/cli.py -x user@company.com --D7 --limit 20

  IntelX mode (multiple domains):
    python intelx_scanner/cli.py -x domains.txt --multiple
    python intelx_scanner/cli.py -x domains.txt --multiple --W2 --maxresults 200

  File mode:
    python intelx_scanner/cli.py -f credentials.txt
    python intelx_scanner/cli.py -f leaked_data.zip
    python intelx_scanner/cli.py -f combo.txt -q "mycompany.com"
        """
    )

    # Mode selection
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument('-x', '--intelx', metavar='QUERY/FILE',
                            help="IntelX mode: search for domain/email or domain file (use with --multiple)")
    mode_group.add_argument('-f', '--file', metavar='FILE',
                            help="File mode: process local credential file")
    mode_group.add_argument('--generate-dummy', action='store_true',
                            help="Generate dummy data (up to 120k credentials)")
    mode_group.add_argument('--import-dummy', metavar='JSON_FILE',
                            help="Import dummy data from JSON file")

    # File mode option
    parser.add_argument('-q', '--query',
                        help="Filter file contents by query (file mode only)")

    # IntelX mode options
    parser.add_argument('--multiple', action='store_true',
                        help="Treat -x argument as file containing list of domains (IntelX mode)")
    parser.add_argument('-apikey', '--apikey',
                        help="Set the API key via command line (IntelX mode)")

    # Search limits with validation
    parser.add_argument('-limit', '--limit', type=int, default=10, choices=range(1, 101),
                        help="Limit results displayed per domain (IntelX mode, 1-100, default: 10)")
    parser.add_argument('-maxresults', '--maxresults', type=int, default=100, choices=range(1, 1001),
                        help="Maximum results to fetch from API (IntelX mode, 1-1000, default: 100)")

    # Time filter options (mutually exclusive)
    time_group = parser.add_mutually_exclusive_group()
    time_group.add_argument('--daily', action='store_true',
                            help="Search yesterday's data only (IntelX mode)")
    time_group.add_argument('--D1', action='store_const', const='D1', dest='time_filter',
                            help="Search yesterday (same as --daily)")
    time_group.add_argument('--D7', action='store_const', const='D7', dest='time_filter',
                            help="Search last 7 days")
    time_group.add_argument('--D30', action='store_const', const='D30', dest='time_filter',
                            help="Search last 30 days")
    time_group.add_argument('--W1', action='store_const', const='W1', dest='time_filter',
                            help="Search last week")
    time_group.add_argument('--W2', action='store_const', const='W2', dest='time_filter',
                            help="Search last 2 weeks")
    time_group.add_argument('--W4', action='store_const', const='W4', dest='time_filter',
                            help="Search last 4 weeks")
    time_group.add_argument('--M1', action='store_const', const='M1', dest='time_filter',
                            help="Search last month")
    time_group.add_argument('--M3', action='store_const', const='M3', dest='time_filter',
                            help="Search last 3 months")
    time_group.add_argument('--M6', action='store_const', const='M6', dest='time_filter',
                            help="Search last 6 months")
    time_group.add_argument('--Y1', action='store_const', const='Y1', dest='time_filter',
                            help="Search last year")

    # Common options
    parser.add_argument('--sendreport', action='store_true',
                        help="Send alert to Teams webhook")
    parser.add_argument('--raw', action='store_true',
                        help="Show raw JSON output (IntelX mode only)")

    args = parser.parse_args()

    # Show banner
    print(BANNER.format(BOLD, END))

    # Argument validation
    if args.multiple and not args.intelx:
        parser.error("--multiple can only be used with -x/--intelx mode")

    if args.raw and not args.intelx:
        parser.error("--raw can only be used with -x/--intelx mode")

    if (args.daily or args.time_filter) and not args.intelx:
        parser.error("Time filters can only be used with -x/--intelx mode")

    # Initialize common vars
    credentials = []
    credential_lines_display = []
    credential_lines_for_parsing = []
    domains = []
    query_name = ""

    # GENERATE DUMMY DATA MODE
    if args.generate_dummy:
        print(colored("🎲 GENERATE DUMMY DATA MODE", 'green', attrs=['bold']))
        print()
        
        try:
            from backend.dummy_data_generator import DummyDataGenerator
            
            generator = DummyDataGenerator(seed=None)
            credentials_data = generator.generate_batch(count=None)
            
            # Generate statistics
            stats = generator.generate_statistics(credentials_data)
            
            print("\n" + "=" * 80)
            print(colored("Statistics", 'cyan', attrs=['bold']))
            print("=" * 80)
            print(f"Total Credentials: {stats['total_credentials']:,}")
            print(f"Admin Credentials: {stats['admin_credentials']:,} ({stats['admin_percentage']}%)")
            print(f"Unique Domains: {stats['unique_domains']:,}")
            print(f"Unique TLDs: {stats['unique_tlds']}")
            
            # Save to file
            output_file = 'dummy_credentials.json'
            generator.save_to_json(credentials_data, output_file)
            
            # Save statistics
            with open('dummy_credentials_stats.json', 'w') as f:
                json.dump(stats, f, indent=2)
            
            print(colored(f"\n✅ Dummy data generation complete!", 'green', attrs=['bold']))
            print(colored(f"   Generated: {output_file}", 'white'))
            print(colored(f"   Statistics: dummy_credentials_stats.json", 'white'))
            print()
            print(colored("Next steps:", 'yellow'))
            print(colored(f"  1. Import data: python backend/cli.py --import-dummy {output_file}", 'white'))
            print(colored(f"  2. Start the app and login with your admin credentials", 'white'))
            
        except Exception as e:
            print(colored(f"❌ Error generating dummy data: {str(e)}", 'red'))
            import traceback
            traceback.print_exc()
            sys.exit(1)
        
        return

    # IMPORT DUMMY DATA MODE
    elif args.import_dummy:
        print(colored("📥 IMPORT DUMMY DATA MODE", 'green', attrs=['bold']))
        print()
        
        json_file = args.import_dummy
        
        if not os.path.exists(json_file):
            print(colored(f"❌ Error: File not found: {json_file}", 'red'))
            sys.exit(1)
        
        try:
            from backend.dummy_data_importer import import_from_json
            
            import_from_json(json_file, create_jobs=True)
            
        except Exception as e:
            print(colored(f"❌ Error importing dummy data: {str(e)}", 'red'))
            import traceback
            traceback.print_exc()
            sys.exit(1)
        
        return

    # FILE MODE
    elif args.file:
        print(colored(f"📁 FILE MODE: Processing file '{args.file}'", 'green', attrs=['bold']))

        if args.query:
            print(colored(f"🔍 Filtering by query: '{args.query}'", 'yellow'))
            query_name = args.query
        else:
            from pathlib import Path
            query_name = Path(args.file).stem

        # Read lines
        lines = process_file_mode(args.file, args.query)
        if not lines:
            print(colored("❌ No credentials found in file.", 'red'))
            return

        credentials = [{'line': line, 'important': 'admin' in line.lower(), 'file_name': args.file, 'file_idx': 1}
                       for line in lines]

        # Display raw prioritized view (optional; mirrors legacy behavior)
        credential_lines_display = display_file_mode_credentials(credentials, query_name)
        credential_lines_for_parsing = [c['line'] for c in credentials]

    # INTELX MODE
    elif args.intelx:
        print(colored(f"🌐 INTELX MODE: {'Multiple domains' if args.multiple else 'Single domain'}", 'green', attrs=['bold']))

        # API key
        api_key = None
        if 'INTELX_KEY' in os.environ:
            api_key = os.environ['INTELX_KEY']
        elif args.apikey:
            api_key = args.apikey
        else:
            print(colored('❌ No API key specified.', 'red'))
            print(colored('   Use "-apikey" or set "INTELX_KEY".', 'yellow'))
            sys.exit(1)

        # Initialize IntelX
        try:
            ix = intelx(api_key)
            print(colored(f"✅ IntelX API initialized successfully", 'green'))
        except Exception as e:
            print(colored(f"❌ Failed to initialize IntelX API: {str(e)}", 'red'))
            sys.exit(1)

        # Resolve time filter
        time_filter = resolve_time_filter_from_args(args)

        # Multiple domains
        if args.multiple:
            domain_list = read_domain_list(args.intelx)
            if not domain_list:
                print(colored("❌ No domains found in file.", 'red'))
                return

            query_name = f"Multiple domains ({len(domain_list)} domains)"

            creds, domains = process_multiple_domains(
                ix,
                domain_list,
                time_filter=time_filter,
                maxresults=args.maxresults,
                limit=args.limit
            )
            credentials = creds

            if not credentials:
                print(colored("✅ No credentials found for any domain.", 'green'))
                return
            credential_lines_display = display_consolidated_credentials(credentials, query_name)
            credential_lines_for_parsing = credential_lines_display

        # Single domain/email
        else:
            query_name = args.intelx

            search_result = search_leaks(ix, args.intelx, args.maxresults, time_filter)
            if args.raw:
                print(json.dumps(search_result, indent=2))
                return

            credentials = process_search_results(ix, search_result, args.intelx, args.limit)
            if not credentials:
                print(colored("✅ No credentials found.", 'green'))
                return

            credential_lines_display = display_consolidated_credentials(credentials, query_name)
            credential_lines_for_parsing = credential_lines_display

    # Teams webhook (optional)
    teams_webhook = None
    if args.sendreport:
        teams_webhook = os.environ.get('TEAMS_WEBHOOK_URL')
        if not teams_webhook:
            print(colored('❌ Teams webhook URL not found.', 'red'))
            print(colored('   Set environment variable "TEAMS_WEBHOOK_URL".', 'yellow'))
            sys.exit(1)

    # Parse with CredentialParser
    parser_instance = CredentialParser()
    parsed_count = parser_instance.parse_credentials_from_list(credential_lines_for_parsing)

    # CSV filenames
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode_prefix = "file" if args.file else ("multi" if args.multiple else "intelx")
    csv_filename_parsed = f"credential_leak_{mode_prefix}_parsed_{timestamp}.csv"
    csv_filename_unparsed = f"credential_leak_{mode_prefix}_unparsed_{timestamp}.csv"

    csv_files_created = []

    if parsed_count > 0:
        if parser_instance.save_to_csv(csv_filename_parsed):
            csv_files_created.append(csv_filename_parsed)

            if not domains:
                domains = parser_instance.get_domain_list()

            # Send Teams alert
            if args.sendreport:
                print(colored("\n📤 Sending Teams alert...", 'cyan'))
                send_teams_alert(
                    teams_webhook,
                    query_name,
                    credential_lines_for_parsing,
                    domains,
                    csv_filename_parsed,
                    parser_instance,
                    is_file_mode=bool(args.file)
                )
        else:
            print(colored("❌ Failed to save parsed credentials to CSV", 'red'))

    # Save unparsed
    if parser_instance.save_unparsed_to_csv(credential_lines_for_parsing, csv_filename_unparsed):
        csv_files_created.append(csv_filename_unparsed)

    # Summary
    unparsed_count = len(credential_lines_for_parsing) - parsed_count
    parsing_rate = (parsed_count / len(credential_lines_for_parsing) * 100) if len(credential_lines_for_parsing) > 0 else 0.0

    print(colored(f"\n🎉 Scan completed!", 'green', attrs=['bold']))
    print(colored(f"   - Mode: {'File' if args.file else ('Multiple domains' if args.multiple else 'Single domain')}", 'white'))
    print(colored(f"   - Query: {query_name}", 'white'))

    if args.intelx:
        # Describe time filter
        time_desc = "All time"
        if args.daily or getattr(args, 'time_filter', None) == 'D1':
            time_desc = "Yesterday"
        elif getattr(args, 'time_filter', None):
            tf = args.time_filter
            if tf.startswith('D'):
                from intelx_client import parse_time_filter as _ptf
                days_ago, _ = _ptf(tf)
                time_desc = f"Last {days_ago} days"
            elif tf.startswith('W'):
                from intelx_client import parse_time_filter as _ptf
                days_ago, _ = _ptf(tf)
                weeks = days_ago // 7
                time_desc = f"Last {weeks} week{'s' if weeks > 1 else ''}"
            elif tf.startswith('M'):
                from intelx_client import parse_time_filter as _ptf
                days_ago, _ = _ptf(tf)
                months = days_ago // 30
                time_desc = f"Last {months} month{'s' if months > 1 else ''}"
            elif tf.startswith('Y'):
                from intelx_client import parse_time_filter as _ptf
                days_ago, _ = _ptf(tf)
                years = days_ago // 365
                time_desc = f"Last {years} year{'s' if years > 1 else ''}"

        print(colored(f"   - Time filter: {time_desc}", 'white'))
        print(colored(f"   - API limits: {args.limit} display, {args.maxresults} fetch", 'white'))
        if args.multiple and domains:
            print(colored(f"   - Domains with results: {len(domains)}", 'white'))

    print(colored(f"   - Raw credentials found: {len(credential_lines_for_parsing):,}", 'white'))
    print(colored(f"   - Parsed credentials: {parsed_count:,}", 'white'))
    print(colored(f"   - Unparsed credentials: {unparsed_count:,}", 'white'))
    print(colored(f"   - Parsing rate: {parsing_rate:.2f}%", 'green' if parsing_rate >= 90 else 'yellow' if parsing_rate >= 70 else 'red', attrs=['bold']))

    if parsing_rate >= 97:
        print(colored(f"   🚀 Excellent parsing rate! Enhanced patterns working well.", 'green'))
    elif parsing_rate >= 95:
        print(colored(f"   ✅ Great parsing rate! Most patterns captured.", 'green'))
    elif parsing_rate >= 90:
        print(colored(f"   👍 Good parsing rate! Room for minor improvements.", 'yellow'))
    else:
        print(colored(f"   ⚠️  Consider analyzing unparsed file for new patterns.", 'yellow'))

    print(colored(f"   - CSV files created: {len(csv_files_created)}", 'white'))
    for csv_file in csv_files_created:
        print(colored(f"     📄 {csv_file}", 'blue'))
    print(colored(f"   - Teams alert: {'Sent' if args.sendreport else 'Disabled'}", 'white'))

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(colored(f"\n\n⚠️  Search interrupted by user", 'yellow'))
        sys.exit(0)
    except Exception as e:
        print(colored(f"\n❌ Unexpected error: {str(e)}", 'red'))
        sys.exit(1)