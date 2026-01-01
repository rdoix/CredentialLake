#!/usr/bin/env python3
# IntelX Scanner Engine
# Ports credential parsing and file ingestion from legacy test8.py with fixes and telemetry

import os
import sys
import re
import csv
import time
import html
import json
import zipfile
import tarfile
import gzip
import tempfile
import shutil
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime
from termcolor import colored
import colorama

# Optional compression libraries
try:
    import py7zr
    HAS_7Z = True
except ImportError:
    HAS_7Z = False

try:
    import rarfile
    HAS_RAR = True
except ImportError:
    HAS_RAR = False

colorama.init(autoreset=True)

BOLD = '\033[1m'
END = '\033[0m'

class CredentialParser:
    """
    Parse raw credential lines into structured entries with URL, username, password.
    Includes enhanced patterns and telemetry for pattern hit statistics.
    """
    def __init__(self):
        self.parsed_credentials = []
        self.skipped_lines = []
        self.pattern_stats = {}  # {pattern_id: count}

    def _mark_hit(self, pattern_id):
        self.pattern_stats[pattern_id] = self.pattern_stats.get(pattern_id, 0) + 1

    def normalize_url(self, url_part):
        """Normalize URL to proper format with enhanced detection"""
        if url_part.startswith('company/') or 'Company,' in url_part:
            return None

        url_part = re.sub(r'^\d+;?', '', url_part).strip()

        if url_part.startswith(('http://', 'https://')):
            return url_part

        if '/' in url_part and not url_part.startswith('www.'):
            return f"https://{url_part}"

        if '.' in url_part:
            if url_part.startswith('www.'):
                return f"https://{url_part}"
            else:
                return f"https://{url_part}"

        return None

    def parse_credential_line(self, line):
        """
        Parse a single line of credentials with enhanced pattern recognition.
        Returns dict with keys: url, username, password, original, pattern_id
        or None if not parsed.
        """
        line = line.strip()
        if not line or line.startswith('#'):
            return None

        if ('company/' in line.lower() or
            'public company' in line.lower() or
            'e-learning providers' in line.lower()):
            return None

        if re.match(r'^\d+;', line):
            line = re.sub(r'^\d+;', '', line)

        # Pattern 1: URL + email:password
        pattern1 = r'^(https?://[^\s]+)\s+([^\s:]+@[^\s:]+):(.+)$'
        match = re.match(pattern1, line)
        if match:
            url, email, password = match.groups()
            self._mark_hit(1)
            return {
                'url': url.strip(),
                'username': email.strip(),
                'password': password.strip(),
                'original': line,
                'pattern_id': 1
            }

        # Pattern 2: URL + username:password
        pattern2 = r'^(https?://[^\s]+)\s+([^\s:@]+):(.+)$'
        match = re.match(pattern2, line)
        if match:
            url, username, password = match.groups()
            if not username.startswith('http') and '.' in url:
                self._mark_hit(2)
                return {
                    'url': url.strip(),
                    'username': username.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 2
                }

        # Pattern 3: URL : username : password
        pattern3 = r'^(https?://[^\s]+)\s*:\s*([^:]+?)\s*:\s*(.+)$'
        match = re.match(pattern3, line)
        if match:
            url, username, password = match.groups()
            self._mark_hit(3)
            return {
                'url': url.strip(),
                'username': username.strip(),
                'password': password.strip(),
                'original': line,
                'pattern_id': 3
            }

        # Pattern 4: domain : username : password
        pattern4 = r'^([^\s:]+)\s*:\s*([^:]+?)\s*:\s*(.+)$'
        match = re.match(pattern4, line)
        if match:
            url_part, username, password = match.groups()
            normalized_url = self.normalize_url(url_part.strip())
            if normalized_url:
                self._mark_hit(4)
                return {
                    'url': normalized_url,
                    'username': username.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 4
                }

        # Pattern 5: domain:username:password
        pattern5 = r'^([^:\s]+):([^:]+):(.+)$'
        match = re.match(pattern5, line)
        if match:
            url_part, username, password = match.groups()
            normalized_url = self.normalize_url(url_part.strip())
            if normalized_url:
                self._mark_hit(5)
                return {
                    'url': normalized_url,
                    'username': username.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 5
                }

        # Pattern 6: pipe separator
        if '|' in line and line.count('|') >= 2:
            parts = line.split('|')
            if len(parts) >= 3:
                url_part = parts[0].strip()
                username = parts[1].strip()
                password = '|'.join(parts[2:]).strip()
                if url_part.startswith('http'):
                    url = url_part
                else:
                    url = self.normalize_url(url_part)
                if url and username and password:
                    self._mark_hit(6)
                    return {
                        'url': url,
                        'username': username,
                        'password': password,
                        'original': line,
                        'pattern_id': 6
                    }

        # Pattern 7: semicolon separator
        if ';' in line and line.count(';') >= 2:
            parts = line.split(';')
            if len(parts) >= 3:
                url_part = parts[0].strip()
                username = parts[1].strip()
                password = ';'.join(parts[2:]).strip()
                if url_part.startswith('http'):
                    url = url_part
                else:
                    url = self.normalize_url(url_part)
                if url and username and password:
                    self._mark_hit(7)
                    return {
                        'url': url,
                        'username': username,
                        'password': password,
                        'original': line,
                        'pattern_id': 7
                    }

        # Pattern 8: tab separator
        if '\t' in line:
            parts = line.split('\t')
            if len(parts) >= 3:
                url_part = parts[0].strip()
                username = parts[1].strip()
                password = '\t'.join(parts[2:]).strip()
                if url_part.startswith('http'):
                    url = url_part
                else:
                    url = self.normalize_url(url_part)
                if url and username and password:
                    self._mark_hit(8)
                    return {
                        'url': url,
                        'username': username,
                        'password': password,
                        'original': line,
                        'pattern_id': 8
                    }

        # Pattern 9: comma separator
        if ',' in line and line.count(',') >= 2:
            parts = line.split(',')
            if len(parts) >= 3:
                url_part = parts[0].strip()
                username = parts[1].strip()
                password = ','.join(parts[2:]).strip()
                if url_part.startswith('http'):
                    url = url_part
                else:
                    url = self.normalize_url(url_part)
                if url and username and password:
                    self._mark_hit(9)
                    return {
                        'url': url,
                        'username': username,
                        'password': password,
                        'original': line,
                        'pattern_id': 9
                    }

        # Pattern 10: username:password@domain
        reverse_pattern = r'^([^@:]+):([^@]+)@([^@\s]+)$'
        reverse_match = re.match(reverse_pattern, line)
        if reverse_match:
            username = reverse_match.group(1).strip()
            password = reverse_match.group(2).strip()
            domain = reverse_match.group(3).strip()
            url = self.normalize_url(domain)
            if url and username and password:
                self._mark_hit(10)
                return {
                    'url': url,
                    'username': username,
                    'password': password,
                    'original': line,
                    'pattern_id': 10
                }

        # Pattern 11: [url] username:password
        bracket_pattern = r'^\[([^\]]+)\]\s*(.+)$'
        bracket_match = re.match(bracket_pattern, line)
        if bracket_match:
            url_part = bracket_match.group(1).strip()
            cred_part = bracket_match.group(2).strip()
            if ':' in cred_part:
                cred_parts = cred_part.split(':')
                if len(cred_parts) >= 2:
                    username = cred_parts[0].strip()
                    password = ':'.join(cred_parts[1:]).strip()
                    if url_part.startswith('http'):
                        url = url_part
                    else:
                        url = self.normalize_url(url_part)
                    if url and username and password:
                        self._mark_hit(11)
                        return {
                            'url': url,
                            'username': username,
                            'password': password,
                            'original': line,
                            'pattern_id': 11
                        }

        # Pattern 12: complex colon separation for URLs
        parts = line.split(':')
        if len(parts) >= 3:
            first_part = parts[0].strip()
            if first_part.startswith('http'):
                url_parts = [first_part]
                cred_start_idx = 1
                if len(parts) > 1 and parts[1].strip().isdigit():
                    url_parts.append(parts[1])
                    cred_start_idx = 2
                if cred_start_idx < len(parts) - 1:
                    username = parts[cred_start_idx].strip()
                    password = ':'.join(parts[cred_start_idx + 1:]).strip()
                    url = ':'.join(url_parts)
                    if username and password:
                        self._mark_hit(12)
                        return {
                            'url': url,
                            'username': username,
                            'password': password,
                            'original': line,
                            'pattern_id': 12
                        }

        # Pattern 13: email anywhere + URL
        email_pattern = r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}):([^\s]+)'
        email_match = re.search(email_pattern, line)
        if email_match:
            email = email_match.group(1)
            password = email_match.group(2)
            url_pattern = r'(https?://[^\s]+)'
            url_match = re.search(url_pattern, line)
            if url_match:
                url = url_match.group(1)
                self._mark_hit(13)
                return {
                    'url': url,
                    'username': email,
                    'password': password,
                    'original': line,
                    'pattern_id': 13
                }

        # Pattern 14: domain/URL + email:password (missing http)
        pattern14 = r'^([^\s]+)\s+([^\s:]+@[^\s:]+):(.+)$'
        match = re.match(pattern14, line)
        if match:
            url_part, email, password = match.groups()
            if not url_part.startswith('http'):
                if '/' in url_part or '.' in url_part:
                    url = f"https://{url_part}"
                else:
                    url = self.normalize_url(url_part)
            else:
                url = url_part
            if url and email and password:
                self._mark_hit(14)
                return {
                    'url': url,
                    'username': email.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 14
                }

        # Pattern 15: incomplete URL + email :
        pattern15 = r'^(https?://[^\s]+)\s+([^\s:]+@[^\s:]+)\s+:$'
        match = re.match(pattern15, line)
        if match:
            # Incomplete credentials, skip
            return None

        # Pattern 16: URL + email + password (optional trailing colon)
        pattern16 = r'^(https?://[^\s]+)\s+([^\s:]+@[^\s:]+)\s+([^:\s]+):?$'
        match = re.match(pattern16, line)
        if match:
            url, email, password = match.groups()
            self._mark_hit(16)
            return {
                'url': url.strip(),
                'username': email.strip(),
                'password': password.strip(),
                'original': line,
                'pattern_id': 16
            }

        # Pattern 17: arbitrary prefix : email : password ...
        pattern17 = r'^[^:]*:([^:]+@[^:]+):([^\s]+)\s.*$'
        match = re.match(pattern17, line)
        if match:
            email, password = match.groups()
            domain = email.split('@')[1] if '@' in email else None
            if domain:
                url = self.normalize_url(domain)
                if url and email and password:
                    self._mark_hit(17)
                    return {
                        'url': url,
                        'username': email.strip(),
                        'password': password.strip(),
                        'original': line,
                        'pattern_id': 17
                    }

        # Pattern 18: partial URL + email:password
        pattern18 = r'^([a-zA-Z0-9.-]+(?:/[^\s]*)?)\s+([^\s:]+@[^\s:]+):(.+)$'
        match = re.match(pattern18, line)
        if match:
            url_part, email, password = match.groups()
            if not url_part.startswith('http'):
                if '.' in url_part:
                    url = f"https://{url_part}"
                else:
                    url = None
            else:
                url = url_part
            if url and email and password:
                self._mark_hit(18)
                return {
                    'url': url,
                    'username': email.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 18
                }

        # Pattern 19: domain + password + email
        pattern19 = r'^([^\s]+)\s+([^\s@]+)\s+([^\s:]+@[^\s:]+)$'
        match = re.match(pattern19, line)
        if match:
            url_part, password, email = match.groups()
            url = self.normalize_url(url_part)
            if url and email and password:
                self._mark_hit(19)
                return {
                    'url': url,
                    'username': email.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 19
                }

        # Pattern 20: domain + email + password (space-separated)
        pattern20 = r'^([^\s]+)\s+([^\s:]+@[^\s:]+)\s+([^\s]+)$'
        match = re.match(pattern20, line)
        if match:
            url_part, email, password = match.groups()
            url = self.normalize_url(url_part)
            if url and email and password and not password.startswith('http'):
                self._mark_hit(20)
                return {
                    'url': url,
                    'username': email.strip(),
                    'password': password.strip(),
                    'original': line,
                    'pattern_id': 20
                }

        return None

    def parse_credentials_from_list(self, credential_lines, show_stats=True, should_stop=None):
        """Parse credentials from list of lines with duplicate suppression and optional stats.
        Supports cooperative cancellation via should_stop('parsing').
        """
        print(colored(f"🔍 Parsing {len(credential_lines)} credential lines...", 'cyan'))
    
        seen_credentials = set()
        self.parsed_credentials = []
    
        for line_num, line in enumerate(credential_lines, 1):
            # Cooperative cancellation checkpoint at each parsed line
            if should_stop:
                try:
                    should_stop('parsing')
                except Exception:
                    # Propagate to caller (worker catches CancelRequested/PauseRequested)
                    raise
    
            parsed = self.parse_credential_line(line)
            if parsed:
                unique_key = f"{parsed['url']}:{parsed['username']}:{parsed['password']}"
                if unique_key not in seen_credentials:
                    seen_credentials.add(unique_key)
                    self.parsed_credentials.append({
                        'line_num': line_num,
                        **parsed
                    })
                else:
                    print(colored(f"   ⚠️  Skipping duplicate: {parsed['url']} | {parsed['username']}", 'yellow'))
    
        unique_count = len(self.parsed_credentials)
        print(colored(f"✅ Successfully parsed {unique_count} unique credentials", 'green'))
    
        if show_stats and self.pattern_stats:
            print(colored("📈 Pattern hit statistics:", 'blue'))
            for pid in sorted(self.pattern_stats.keys()):
                print(colored(f"   - Pattern {pid}: {self.pattern_stats[pid]}", 'white'))
    
        return unique_count

    def save_to_csv(self, output_file):
        """Save parsed credentials to CSV file"""
        if not self.parsed_credentials:
            return False

        try:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f, delimiter=';')
                writer.writerow(['URL', 'Username', 'Password', 'Line_Number', 'Pattern_ID'])
                for cred in self.parsed_credentials:
                    writer.writerow([cred['url'], cred['username'], cred['password'], cred.get('line_num', 'N/A'), cred.get('pattern_id', 'N/A')])

            print(colored(f"💾 Saved {len(self.parsed_credentials)} parsed credentials to: {output_file}", 'green'))
            return True
        except Exception as e:
            print(colored(f"❌ Error saving parsed CSV: {e}", 'red'))
            return False

    def save_unparsed_to_csv(self, credential_lines, output_file):
        """Save unparsed credential lines to CSV file"""
        unparsed_lines = []

        for line_num, line in enumerate(credential_lines, 1):
            parsed = self.parse_credential_line(line)
            if not parsed:
                unparsed_lines.append({'line_num': line_num, 'raw_line': line})

        if not unparsed_lines:
            return False

        try:
            with open(output_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f, delimiter=';')
                writer.writerow(['Line_Number', 'Raw_Credential'])
                for item in unparsed_lines:
                    writer.writerow([item['line_num'], item['raw_line']])

            print(colored(f"💾 Saved {len(unparsed_lines)} unparsed credentials to: {output_file}", 'yellow'))
            return True
        except Exception as e:
            print(colored(f"❌ Error saving unparsed CSV: {e}", 'red'))
            return False

    def get_domain_list(self):
        """Get unique domains from parsed credentials"""
        domains = set()
        for cred in self.parsed_credentials:
            try:
                parsed_url = urlparse(cred['url'])
                domain = parsed_url.netloc
                if domain:
                    domains.add(domain)
            except Exception:
                continue
        return sorted(list(domains))


def extract_compressed_file(file_path, temp_dir):
    """Extract compressed files and return list of extracted file paths"""
    file_path = Path(file_path)
    extracted_files = []

    print(colored(f"🗜️  Detecting compression format for: {file_path.name}", 'cyan'))

    try:
        # ZIP
        if file_path.suffix.lower() in ['.zip']:
            print(colored(f"📦 Extracting ZIP file...", 'yellow'))
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                for item in zip_ref.namelist():
                    extracted_path = Path(temp_dir) / item
                    if extracted_path.is_file():
                        extracted_files.append(str(extracted_path))

        # TAR family
        elif file_path.suffix.lower() in ['.tar', '.tgz'] or '.tar.' in file_path.name.lower():
            print(colored(f"📦 Extracting TAR file...", 'yellow'))
            with tarfile.open(file_path, 'r:*') as tar_ref:
                tar_ref.extractall(temp_dir)
                for member in tar_ref.getmembers():
                    if member.isfile():
                        extracted_path = Path(temp_dir) / member.name
                        extracted_files.append(str(extracted_path))

        # GZIP single
        elif file_path.suffix.lower() in ['.gz'] and not '.tar.' in file_path.name.lower():
            print(colored(f"📦 Extracting GZIP file...", 'yellow'))
            output_name = file_path.stem
            output_path = Path(temp_dir) / output_name
            with gzip.open(file_path, 'rb') as gz_file:
                with open(output_path, 'wb') as out_file:
                    shutil.copyfileobj(gz_file, out_file)
            extracted_files.append(str(output_path))

        # 7Z
        elif file_path.suffix.lower() in ['.7z']:
            if HAS_7Z:
                print(colored(f"📦 Extracting 7Z file...", 'yellow'))
                with py7zr.SevenZipFile(file_path, mode='r') as z:
                    z.extractall(path=temp_dir)
                    for item in z.getnames():
                        extracted_path = Path(temp_dir) / item
                        if extracted_path.is_file():
                            extracted_files.append(str(extracted_path))
            else:
                print(colored(f"❌ 7Z support not available. Install py7zr", 'red'))
                return None

        # RAR
        elif file_path.suffix.lower() in ['.rar']:
            if HAS_RAR:
                print(colored(f"📦 Extracting RAR file...", 'yellow'))
                with rarfile.RarFile(file_path) as rar_ref:
                    rar_ref.extractall(temp_dir)
                    for item in rar_ref.namelist():
                        extracted_path = Path(temp_dir) / item
                        if extracted_path.is_file():
                            extracted_files.append(str(extracted_path))
            else:
                print(colored(f"❌ RAR support not available. Install rarfile and unrar", 'red'))
                return None

        else:
            print(colored(f"📄 File is not compressed, processing directly...", 'green'))
            return [str(file_path)]

        print(colored(f"✅ Extracted {len(extracted_files)} files", 'green'))
        return extracted_files

    except Exception as e:
        print(colored(f"❌ Error extracting file: {str(e)}", 'red'))
        return None


def read_credentials_from_file(file_path, query=None):
    """Read credentials from a text file and filter by query if provided"""
    try:
        file_path = Path(file_path)

        if not file_path.exists():
            print(colored(f"❌ File not found: {file_path}", 'red'))
            return []

        print(colored(f"📖 Reading file: {file_path.name}", 'cyan'))

        # Restrict to UTF-8 and ASCII to avoid binary garbage
        encodings = ['utf-8', 'ascii']
        content = None

        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                print(colored(f"✅ Successfully read file with {encoding} encoding", 'green'))
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            print(colored(f"⚠️  Could not confidently read as text (UTF-8/ASCII). Skipping.", 'yellow'))
            return []

        lines = content.split('\n')
        total_lines = len(lines)

        if query:
            filtered_lines = []
            for line in lines:
                if query.lower() in line.lower():
                    filtered_lines.append(line.strip())
            print(colored(f"🔍 Found {len(filtered_lines)} lines containing '{query}' out of {total_lines} total lines", 'yellow'))
            return filtered_lines
        else:
            all_lines = [line.strip() for line in lines if line.strip()]
            print(colored(f"📊 Loaded {len(all_lines)} non-empty lines from file", 'yellow'))
            return all_lines

    except Exception as e:
        print(colored(f"❌ Error reading file: {str(e)}", 'red'))
        return []


def process_file_mode(file_path, query=None):
    """
    Process credentials from local file(s) (text-focused).
    Skips likely-binary extracted files to avoid noisy parsing.
    """
    all_credentials = []
    temp_dir = None

    TEXT_EXTS = {
        '', '.txt', '.log', '.csv', '.json', '.xml', '.sql', '.conf', '.ini'
    }
    BINARY_EXTS = {
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.tif', '.avif',
        '.zip', '.gz', '.tar', '.tgz', '.rar', '.7z'
    }

    try:
        file_path = Path(file_path)

        if not file_path.exists():
            print(colored(f"❌ File not found: {file_path}", 'red'))
            return []

        # Create temp dir
        temp_dir = tempfile.mkdtemp(prefix='credential_scanner_')
        print(colored(f"📁 Created temp directory: {temp_dir}", 'blue'))

        # Extract if compressed
        extracted_files = extract_compressed_file(file_path, temp_dir)
        if extracted_files is None:
            return []

        # Process each file
        for extracted_file in extracted_files:
            extracted_path = Path(extracted_file)
            suffix = extracted_path.suffix.lower()

            # Decide if text-safe
            is_text_candidate = (suffix in TEXT_EXTS) and (suffix not in BINARY_EXTS)

            print(colored(f"🔍 Considering: {extracted_path.name} (ext={suffix}) -> text={is_text_candidate}", 'cyan'))

            if not is_text_candidate:
                print(colored(f"   ⛔ Skipping non-text or binary-like file: {extracted_path.name}", 'yellow'))
                continue

            credentials = read_credentials_from_file(extracted_file, query)
            if credentials:
                all_credentials.extend(credentials)

        # Remove duplicates while preserving order
        unique_credentials = list(dict.fromkeys(all_credentials))
        removed_duplicates = len(all_credentials) - len(unique_credentials)
        if removed_duplicates > 0:
            print(colored(f"📊 Removed {removed_duplicates} duplicate lines", 'yellow'))

        return unique_credentials

    except Exception as e:
        print(colored(f"❌ Error processing file: {str(e)}", 'red'))
        return []

    finally:
        if temp_dir and Path(temp_dir).exists():
            try:
                shutil.rmtree(temp_dir)
                print(colored(f"🗑️  Cleaned up temp directory", 'blue'))
            except Exception as e:
                print(colored(f"⚠️  Could not clean temp directory: {str(e)}", 'yellow'))