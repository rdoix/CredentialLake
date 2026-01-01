/**
 * SearchService
 * Elasticsearch client wrapper for fast analytics and filtered queries.
 *
 * Document schema targets common filters/fields mentioned in requirements:
 * - org_id: organization separation
 * - subdomain: filter/select by subdomain
 * - domain: primary domain
 * - type: document type/category (e.g., credential, leak, paste, etc.)
 * - title: short title or label
 * - content: full text content for search
 * - tags: keyword tags for filtering
 * - timestamp: main time field (derived from first_seen/last_seen if needed)
 * - job_id: associating data back to a scan job in FastAPI [ScanJob](backend/models/scan_job.py:11)
 *
 * Backend endpoints proxied for data: [results.list_credentials()](backend/routes/results.py:24)
 */

import { Injectable, Logger } from '@nestjs/common';

// NOTE: Ensure '@elastic/elasticsearch' is installed in gateway:
// cd web/gateway && npm i @elastic/elasticsearch
import { Client, estypes } from '@elastic/elasticsearch';

export interface IndexedDocument {
  id?: string; // optional explicit id, otherwise auto
  org_id?: string;
  subdomain?: string;
  domain?: string;
  type?: string;
  title?: string;
  content?: string;
  tags?: string[];
  timestamp?: string; // ISO 8601 date-time
  job_id?: string;
  // additional fields from backend results can be added here (e.g., url, username, is_admin, etc.)
  [key: string]: any;
}

export interface SearchFilters {
  org_id?: string;
  subdomain?: string;
  domain?: string;
  type?: string;
  tags?: string[];
  from_date?: string; // ISO 8601
  to_date?: string; // ISO 8601
}

export interface SearchParams {
  query?: string;
  filters?: SearchFilters;
  page?: number;
  pageSize?: number;
}

export interface SearchHit {
  id: string;
  score?: number;
  source: IndexedDocument;
  highlight?: Record<string, string[]>;
}

export interface SearchResult {
  items: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private readonly indexName: string;

  constructor() {
    const node = process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200';
    this.indexName = process.env.ELASTICSEARCH_INDEX ?? 'intelx_data';

    this.client = new Client({
      node,
      // For secured clusters, add auth here or via ELASTICSEARCH_APIKEY/username/password
      // auth: { apiKey: process.env.ELASTICSEARCH_APIKEY as string }
    });
  }

  /**
   * Ensure index exists with suitable mappings/settings for our search/filters.
   */
  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName });
    if (exists) {
      return;
    }

    this.logger.log(`Creating Elasticsearch index: ${this.indexName}`);

    const body: estypes.IndicesCreateRequest = {
      index: this.indexName,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            // simple analyzer for content
            text_analyzer: {
              type: 'standard',
            },
          },
        },
      },
      mappings: {
        dynamic: 'true',
        properties: {
          org_id: { type: 'keyword' },
          subdomain: { type: 'keyword' },
          domain: { type: 'keyword' },
          type: { type: 'keyword' },
          title: {
            type: 'text',
            fields: {
              raw: { type: 'keyword', ignore_above: 256 },
            },
          },
          content: {
            type: 'text',
            analyzer: 'standard',
          },
          tags: { type: 'keyword' },
          timestamp: { type: 'date' },
          job_id: { type: 'keyword' },
        },
      },
    };

    await this.client.indices.create(body);
    this.logger.log(`Elasticsearch index created: ${this.indexName}`);
  }

  /**
   * Index a batch of documents using bulk API.
   */
  async indexDocuments(docs: IndexedDocument[]): Promise<{ errors: boolean; items: any[] }> {
    if (!docs || docs.length === 0) {
      return { errors: false, items: [] };
    }

    const operations: estypes.BulkOperationContainer[] = [];
    for (const doc of docs) {
      const indexOp: estypes.BulkOperationContainer = {
        index: {
          _index: this.indexName,
          ...(doc.id ? { _id: doc.id } : {}),
        },
      };
      operations.push(indexOp);
      const { id, ...source } = doc;
      operations.push(source as any);
    }

    const res = await this.client.bulk({
      operations,
      refresh: 'wait_for',
    });

    const errors = Boolean(res.errors);
    const items = (res.items ?? []) as any[];

    if (errors) {
      const failures = items.filter((i: any) => i.index && i.index.error);
      this.logger.error(`Bulk index had errors: ${failures.length}`);
      if (failures.length <= 5) {
        this.logger.error(JSON.stringify(failures, null, 2));
      }
    }

    return { errors, items };
  }

  /**
   * Search documents with query and filters, paginated.
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const {
      query,
      filters = {},
      page = 1,
      pageSize = 50,
    } = params;

    const from = (page - 1) * pageSize;

    const must: estypes.QueryDslQueryContainer[] = [];
    if (query && query.trim().length > 0) {
      must.push({
        simple_query_string: {
          query: query,
          fields: ['title^2', 'content'],
          default_operator: 'and',
        },
      });
    }

    const filter: estypes.QueryDslQueryContainer[] = [];

    if (filters.org_id) {
      filter.push({ term: { org_id: filters.org_id } });
    }
    if (filters.subdomain) {
      filter.push({ term: { subdomain: filters.subdomain } });
    }
    if (filters.domain) {
      filter.push({ term: { domain: filters.domain } });
    }
    if (filters.type) {
      filter.push({ term: { type: filters.type } });
    }
    if (filters.tags && filters.tags.length > 0) {
      filter.push({ terms: { tags: filters.tags } });
    }
    if (filters.from_date || filters.to_date) {
      const timestampRange: estypes.QueryDslQueryContainer = {
        range: {
          timestamp: {
            ...(filters.from_date ? { gte: filters.from_date } : {}),
            ...(filters.to_date ? { lte: filters.to_date } : {}),
          } as any,
        } as any,
      };
      filter.push(timestampRange);
    }

    const esQuery: estypes.QueryDslBoolQuery = {
      must: must.length ? must : undefined,
      filter: filter.length ? filter : undefined,
    };

    const res = await this.client.search<IndexedDocument>({
      index: this.indexName,
      from,
      size: pageSize,
      query: { bool: esQuery },
      sort: [{ timestamp: { order: 'desc', unmapped_type: 'date' } }],
      highlight: query
        ? {
            fields: {
              content: {},
              title: {},
            },
          }
        : undefined,
    });

    const total = typeof res.hits.total === 'number'
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

    const items: SearchHit[] = (res.hits.hits ?? []).map((hit: any) => ({
      id: hit._id ?? '',
      score: hit._score ?? undefined,
      source: (hit._source as IndexedDocument) ?? {},
      highlight: hit.highlight as any,
    }));

    const totalPages = Math.ceil(total / pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}