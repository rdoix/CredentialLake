/**
 * SearchController
 * Gateway endpoints for fast analytics and filtered queries backed by Elasticsearch.
 *
 * Endpoints:
 * - GET /api/search               => query with filters/pagination
 * - POST /api/search/index        => bulk index parsed documents (admin/collector only)
 * - GET /api/search/ensure-index  => create index with mappings if missing (admin only)
 *
 * Service references:
 * - [SearchService.search()](web/gateway/src/search.service.ts:185)
 * - [SearchService.indexDocuments()](web/gateway/src/search.service.ts:145)
 * - [SearchService.ensureIndex()](web/gateway/src/search.service.ts:92)
 *
 * SECURITY: All endpoints require authentication via JwtAuthGuard
 */

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  SearchService,
  IndexedDocument,
  SearchParams,
  SearchResult,
} from './search.service';
import { CurrentUser, Roles } from './auth.decorators';
import type { UserRole } from './auth.guard';

type IndexRequest = {
  docs: IndexedDocument[];
};

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /**
   * Initialize the Elasticsearch index (idempotent).
   */
  @Roles('administrator')
  @Get('ensure-index')
  async ensureIndex(
    @CurrentUser() user: { sub: string; role: UserRole },
  ): Promise<{ created: boolean }> {
    await this.search.ensureIndex();
    return { created: true };
  }

  /**
   * Bulk index parsed documents into Elasticsearch.
   */
  @Roles('administrator', 'collector')
  @Post('index')
  async index(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Body() body: IndexRequest,
  ): Promise<{ errors: boolean; items: any[] }> {
    const docs = Array.isArray(body?.docs) ? body.docs : [];
    return this.search.indexDocuments(docs);
  }

  /**
   * Perform a search query with filters and pagination.
   * Query params:
   * - query: keyword query
   * - org_id, subdomain, domain, type
   * - tags: comma-separated list
   * - from_date, to_date: ISO date range
   * - page, pageSize: numbers
   */
  @Get()
  async searchEndpoint(
    @CurrentUser() user: { sub: string; role: UserRole },
    @Query('query') query?: string,
    @Query('org_id') org_id?: string,
    @Query('subdomain') subdomain?: string,
    @Query('domain') domain?: string,
    @Query('type') type?: string,
    @Query('tags') tags?: string,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<SearchResult> {
    const params: SearchParams = {
      query,
      filters: {
        org_id,
        subdomain,
        domain,
        type,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        from_date,
        to_date,
      },
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    };

    return this.search.search(params);
  }
}