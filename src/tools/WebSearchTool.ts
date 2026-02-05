/**
 * WebSearchTool - Tool tim kiem tren web
 *
 * Cho phep tim kiem thong tin tren internet.
 *
 * Dac diem:
 * - Tra ve ket qua tim kiem tu cac search engines
 * - Ho tro loc theo domain (allowed/blocked)
 * - Cung cap thong tin cap nhat ngoai knowledge cutoff
 *
 * QUAN TRONG:
 * - SAU KHI tra loi, PHAI them phan "Sources:" voi links
 * - Chi kha dung tai US
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Tham so dau vao cho WebSearchTool
 */
export interface WebSearchToolInput {
  /** Query tim kiem */
  query: string;
  /** Chi lay ket qua tu cac domain nay */
  allowedDomains?: string[];
  /** Khong lay ket qua tu cac domain nay */
  blockedDomains?: string[];
}

/**
 * Mot ket qua tim kiem
 */
export interface SearchResult {
  /** Tieu de cua trang */
  title: string;
  /** URL cua trang */
  url: string;
  /** Mo ta ngan */
  snippet: string;
  /** Domain cua trang */
  domain: string;
  /** Thoi gian publish (neu co) */
  publishedDate?: string;
}

/**
 * Ket qua tra ve tu WebSearchTool
 */
export interface WebSearchToolOutput {
  /** Danh sach ket qua tim kiem */
  results: SearchResult[];
  /** Query da su dung */
  query: string;
  /** So ket qua tra ve */
  resultCount: number;
  /** Da loc theo domain chua */
  filtered: boolean;
  /** Thoi gian tim kiem (ms) */
  searchTime: number;
}

// ============================================================================
// Constants - Cac hang so
// ============================================================================

/** So ket qua toi da mac dinh */
const DEFAULT_MAX_RESULTS = 10;

/** Timeout cho tim kiem: 15 giay */
const SEARCH_TIMEOUT_MS = 15000;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Dinh nghia cua WebSearchTool
 */
export const webSearchToolDefinition: ToolDefinition = {
  name: 'WebSearch',
  description: 'Allows Claude to search the web and use the results to inform responses',
  category: 'web',
  requiresConfirmation: false,
  parameters: {
    query: {
      type: 'string',
      description: 'The search query to use',
      required: true,
    },
    allowed_domains: {
      type: 'array',
      description: 'Only include search results from these domains',
      required: false,
    },
    blocked_domains: {
      type: 'array',
      description: 'Never include search results from these domains',
      required: false,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Loc ket qua theo domain filters
 * @param results - Danh sach ket qua
 * @param allowedDomains - Cac domain cho phep
 * @param blockedDomains - Cac domain bi chan
 * @returns Ket qua da loc
 */
export function filterResultsByDomain(
  results: SearchResult[],
  allowedDomains?: string[],
  blockedDomains?: string[]
): SearchResult[] {
  let filtered = results;

  // Loc allowed domains (neu co)
  if (allowedDomains && allowedDomains.length > 0) {
    filtered = filtered.filter(result => {
      return allowedDomains.some(domain =>
        result.domain.includes(domain.toLowerCase())
      );
    });
  }

  // Loc blocked domains (neu co)
  if (blockedDomains && blockedDomains.length > 0) {
    filtered = filtered.filter(result => {
      return !blockedDomains.some(domain =>
        result.domain.includes(domain.toLowerCase())
      );
    });
  }

  return filtered;
}

/**
 * Extract domain tu URL
 * @param url - URL can extract
 * @returns Domain name
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return url;
  }
}

/**
 * Format ket qua thanh markdown cho output
 * @param results - Danh sach ket qua
 * @returns Markdown string
 */
export function formatResultsAsMarkdown(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map((result, index) => {
    return `### ${index + 1}. [${result.title}](${result.url})\n**Domain:** ${result.domain}\n${result.publishedDate ? `**Published:** ${result.publishedDate}\n` : ''}\n${result.snippet}\n`;
  }).join('\n---\n\n');
}

/**
 * Tao phan Sources tu ket qua
 * @param results - Danh sach ket qua
 * @returns Sources markdown
 */
export function generateSources(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const sources = results.map(result => `- [${result.title}](${result.url})`);
  return `\nSources:\n${sources.join('\n')}`;
}

/**
 * Validate input cho WebSearchTool
 * @param input - Input can validate
 * @returns true neu hop le, string neu co loi
 */
export function validateWebSearchInput(input: WebSearchToolInput): boolean | string {
  // Kiem tra query bat buoc
  if (!input.query || typeof input.query !== 'string') {
    return 'query is required and must be a string';
  }

  // Kiem tra query khong qua ngan
  if (input.query.trim().length < 2) {
    return 'query must be at least 2 characters';
  }

  // Kiem tra allowed_domains hop le
  if (input.allowedDomains !== undefined) {
    if (!Array.isArray(input.allowedDomains)) {
      return 'allowed_domains must be an array of strings';
    }
    if (!input.allowedDomains.every(d => typeof d === 'string')) {
      return 'all allowed_domains entries must be strings';
    }
  }

  // Kiem tra blocked_domains hop le
  if (input.blockedDomains !== undefined) {
    if (!Array.isArray(input.blockedDomains)) {
      return 'blocked_domains must be an array of strings';
    }
    if (!input.blockedDomains.every(d => typeof d === 'string')) {
      return 'all blocked_domains entries must be strings';
    }
  }

  return true;
}

// ============================================================================
// Tool Handler Implementation
// ============================================================================

/**
 * Tao WebSearchTool handler
 * @param context - Execution context
 * @returns Tool handler instance
 */
export function createWebSearchToolHandler(context: ExecutionContext): ToolHandler<WebSearchToolInput, WebSearchToolOutput> {
  return {
    name: 'WebSearch',
    definition: webSearchToolDefinition,

    validateInput(input: WebSearchToolInput): boolean | string {
      return validateWebSearchInput(input);
    },

    async execute(input: WebSearchToolInput, ctx: ExecutionContext): Promise<WebSearchToolOutput> {
      const startTime = Date.now();

      // NOTE: Day la placeholder implementation
      // Trong thuc te, can tich hop voi search API (Google, Bing, etc.)

      // Simulate search results
      const mockResults = await simulateWebSearch(input.query);

      // Loc theo domain
      const filteredResults = filterResultsByDomain(
        mockResults,
        input.allowedDomains,
        input.blockedDomains
      );

      const searchTime = Date.now() - startTime;

      return {
        results: filteredResults,
        query: input.query,
        resultCount: filteredResults.length,
        filtered: filteredResults.length !== mockResults.length,
        searchTime,
      };
    },
  };
}

/**
 * Simulate web search (placeholder)
 * Trong thuc te se goi real search API
 */
async function simulateWebSearch(query: string): Promise<SearchResult[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Tra ve mock results
  return [
    {
      title: `Search result for: ${query}`,
      url: `https://example.com/search?q=${encodeURIComponent(query)}`,
      snippet: `This is a sample search result for the query "${query}". In production, this would be real search results.`,
      domain: 'example.com',
      publishedDate: new Date().toISOString().split('T')[0],
    },
    {
      title: `Documentation about ${query}`,
      url: `https://docs.example.com/${encodeURIComponent(query)}`,
      snippet: `Official documentation and guides related to ${query}.`,
      domain: 'docs.example.com',
    },
    {
      title: `${query} - Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      snippet: `Wikipedia article about ${query} with comprehensive information.`,
      domain: 'en.wikipedia.org',
    },
  ];
}

// ============================================================================
// Exports
// ============================================================================

export default {
  definition: webSearchToolDefinition,
  createHandler: createWebSearchToolHandler,
  validateInput: validateWebSearchInput,
  filterResultsByDomain,
  extractDomain,
  formatResultsAsMarkdown,
  generateSources,
};
