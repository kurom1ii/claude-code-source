/**
 * Model Context Protocol (MCP) - Resource Manager
 *
 * ResourceManager quản lý việc đăng ký, tìm kiếm, và truy cập MCP resources.
 * Nó cung cấp caching, subscription management, và unified access cho
 * resources từ nhiều MCP servers.
 *
 * @see https://modelcontextprotocol.io/
 */

import type {
  McpResource,
  ResourceTemplate,
  ResourceContent,
  ResourceAnnotations,
} from './types';

// ============================================================================
// Types for Resource Manager
// ============================================================================

/**
 * Resource với metadata về nguồn gốc
 */
export interface ManagedResource extends McpResource {
  /** Server name mà resource thuộc về */
  serverName: string;
  /** Full qualified URI với server prefix */
  qualifiedUri: string;
  /** Resource có subscribed không */
  subscribed: boolean;
  /** Thời điểm đăng ký */
  registeredAt: Date;
  /** Thời điểm update cuối cùng */
  lastUpdated?: Date;
  /** Cached content (nếu có) */
  cachedContent?: ResourceContent[];
  /** Cache expiry time */
  cacheExpiry?: Date;
}

/**
 * Managed resource template
 */
export interface ManagedResourceTemplate extends ResourceTemplate {
  /** Server name mà template thuộc về */
  serverName: string;
}

/**
 * Filter options cho resources
 */
export interface ResourceFilterOptions {
  /** Lọc theo server name */
  serverName?: string;
  /** Lọc theo MIME type */
  mimeType?: string | string[];
  /** Lọc theo pattern trong URI */
  uriPattern?: string | RegExp;
  /** Lọc theo pattern trong name */
  namePattern?: string | RegExp;
  /** Chỉ lấy subscribed resources */
  subscribedOnly?: boolean;
  /** Lọc theo audience */
  audience?: 'user' | 'assistant';
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Enable caching */
  enabled: boolean;
  /** Cache TTL (ms) - mặc định 5 phút */
  ttl: number;
  /** Max số resources để cache */
  maxSize: number;
}

/**
 * Subscription callback
 */
export type ResourceUpdateCallback = (uri: string, content: ResourceContent[]) => void;

/**
 * Read handler để fetch resource content
 */
export type ResourceReadHandler = (
  serverName: string,
  uri: string
) => Promise<ResourceContent[]>;

/**
 * Stats về resource manager
 */
export interface ResourceManagerStats {
  /** Tổng số resources */
  totalResources: number;
  /** Tổng số templates */
  totalTemplates: number;
  /** Số subscriptions active */
  activeSubscriptions: number;
  /** Số resources đang cached */
  cachedResources: number;
  /** Resources theo server */
  resourcesByServer: Map<string, number>;
}

// ============================================================================
// Resource Manager Implementation
// ============================================================================

/**
 * Default cache options
 */
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5 phút
  maxSize: 100,
};

/**
 * Resource Manager - Quản lý MCP resources
 *
 * @example
 * ```typescript
 * const manager = new ResourceManager();
 *
 * // Đăng ký resources từ server
 * manager.registerResources('my-server', resources);
 *
 * // Đọc resource (với caching)
 * const content = await manager.readResource('my-server', 'file://path/to/file');
 *
 * // Subscribe vào resource updates
 * manager.subscribe('my-server', 'file://path/to/file', (uri, content) => {
 *   console.log('Resource updated:', uri);
 * });
 * ```
 */
export class ResourceManager {
  /** Map: qualifiedUri -> ManagedResource */
  private resources = new Map<string, ManagedResource>();

  /** Map: serverName -> Set of resource URIs */
  private serverResources = new Map<string, Set<string>>();

  /** Resource templates */
  private templates = new Map<string, ManagedResourceTemplate>();

  /** Subscriptions: qualifiedUri -> Set of callbacks */
  private subscriptions = new Map<string, Set<ResourceUpdateCallback>>();

  /** Handler để fetch resource content */
  private readHandler?: ResourceReadHandler;

  /** Cache options */
  private cacheOptions: CacheOptions;

  constructor(options?: Partial<CacheOptions>) {
    this.cacheOptions = {
      ...DEFAULT_CACHE_OPTIONS,
      ...options,
    };
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Set handler để fetch resource content
   *
   * @param handler - Function để đọc resource từ server
   */
  setReadHandler(handler: ResourceReadHandler): void {
    this.readHandler = handler;
  }

  /**
   * Update cache options
   */
  setCacheOptions(options: Partial<CacheOptions>): void {
    this.cacheOptions = {
      ...this.cacheOptions,
      ...options,
    };

    // Clear cache nếu disable
    if (!options.enabled) {
      this.clearCache();
    }
  }

  // ==========================================================================
  // Registration Methods
  // ==========================================================================

  /**
   * Đăng ký resources từ một server
   *
   * @param serverName - Tên server nguồn
   * @param resources - Danh sách resources từ server
   */
  registerResources(serverName: string, resources: McpResource[]): void {
    // Tạo set cho server nếu chưa có
    if (!this.serverResources.has(serverName)) {
      this.serverResources.set(serverName, new Set());
    }

    const serverSet = this.serverResources.get(serverName)!;

    for (const resource of resources) {
      const qualifiedUri = this.createQualifiedUri(serverName, resource.uri);

      const managedResource: ManagedResource = {
        ...resource,
        serverName,
        qualifiedUri,
        subscribed: false,
        registeredAt: new Date(),
      };

      this.resources.set(qualifiedUri, managedResource);
      serverSet.add(resource.uri);
    }
  }

  /**
   * Đăng ký resource templates từ một server
   *
   * @param serverName - Tên server
   * @param templates - Danh sách templates
   */
  registerTemplates(serverName: string, templates: ResourceTemplate[]): void {
    for (const template of templates) {
      const key = `${serverName}::${template.uriTemplate}`;
      this.templates.set(key, {
        ...template,
        serverName,
      });
    }
  }

  /**
   * Hủy đăng ký tất cả resources từ một server
   *
   * @param serverName - Tên server
   * @returns Số resources đã hủy
   */
  unregisterServer(serverName: string): number {
    const serverSet = this.serverResources.get(serverName);
    if (!serverSet) {
      return 0;
    }

    let count = 0;

    // Remove resources
    for (const uri of serverSet) {
      const qualifiedUri = this.createQualifiedUri(serverName, uri);
      if (this.resources.delete(qualifiedUri)) {
        count++;
        // Remove subscriptions
        this.subscriptions.delete(qualifiedUri);
      }
    }

    this.serverResources.delete(serverName);

    // Remove templates
    for (const [key, template] of this.templates.entries()) {
      if (template.serverName === serverName) {
        this.templates.delete(key);
      }
    }

    return count;
  }

  /**
   * Xóa tất cả resources
   */
  clear(): void {
    this.resources.clear();
    this.serverResources.clear();
    this.templates.clear();
    this.subscriptions.clear();
  }

  // ==========================================================================
  // Lookup Methods
  // ==========================================================================

  /**
   * Lấy resource theo server name và URI
   *
   * @param serverName - Tên server
   * @param uri - Resource URI
   * @returns Resource hoặc undefined
   */
  getResource(serverName: string, uri: string): ManagedResource | undefined {
    const qualifiedUri = this.createQualifiedUri(serverName, uri);
    return this.resources.get(qualifiedUri);
  }

  /**
   * Kiểm tra resource có tồn tại không
   */
  hasResource(serverName: string, uri: string): boolean {
    return this.resources.has(this.createQualifiedUri(serverName, uri));
  }

  /**
   * Lấy tất cả resources
   *
   * @param filter - Filter options
   */
  getAllResources(filter?: ResourceFilterOptions): ManagedResource[] {
    let resources = Array.from(this.resources.values());

    if (filter) {
      resources = this.applyFilter(resources, filter);
    }

    return resources;
  }

  /**
   * Lấy resources theo server
   */
  getResourcesByServer(serverName: string): ManagedResource[] {
    return this.getAllResources({ serverName });
  }

  /**
   * Lấy resource templates
   *
   * @param serverName - Filter theo server (optional)
   */
  getTemplates(serverName?: string): ManagedResourceTemplate[] {
    const templates = Array.from(this.templates.values());
    if (serverName) {
      return templates.filter((t) => t.serverName === serverName);
    }
    return templates;
  }

  /**
   * Lấy danh sách server names
   */
  getServerNames(): string[] {
    return Array.from(this.serverResources.keys());
  }

  // ==========================================================================
  // Search Methods
  // ==========================================================================

  /**
   * Tìm kiếm resources theo query
   *
   * @param query - Search query
   * @param options - Filter options
   */
  searchResources(query: string, options?: ResourceFilterOptions): ManagedResource[] {
    const queryLower = query.toLowerCase();
    let resources = Array.from(this.resources.values());

    if (options) {
      resources = this.applyFilter(resources, options);
    }

    return resources.filter((resource) => {
      const uriMatch = resource.uri.toLowerCase().includes(queryLower);
      const nameMatch = resource.name.toLowerCase().includes(queryLower);
      const descMatch = resource.description?.toLowerCase().includes(queryLower);
      return uriMatch || nameMatch || descMatch;
    });
  }

  /**
   * Tìm resources theo MIME type
   */
  findByMimeType(mimeType: string | string[]): ManagedResource[] {
    return this.getAllResources({ mimeType });
  }

  /**
   * Tìm resources theo URI pattern
   */
  findByUriPattern(pattern: string | RegExp): ManagedResource[] {
    return this.getAllResources({ uriPattern: pattern });
  }

  // ==========================================================================
  // Read Methods
  // ==========================================================================

  /**
   * Đọc nội dung resource
   * Sử dụng cache nếu có và còn valid
   *
   * @param serverName - Tên server
   * @param uri - Resource URI
   * @param skipCache - Bỏ qua cache, force fetch
   */
  async readResource(
    serverName: string,
    uri: string,
    skipCache = false
  ): Promise<ResourceContent[]> {
    if (!this.readHandler) {
      throw new Error('Read handler not set. Call setReadHandler() first.');
    }

    const qualifiedUri = this.createQualifiedUri(serverName, uri);
    const resource = this.resources.get(qualifiedUri);

    // Kiểm tra cache
    if (!skipCache && this.cacheOptions.enabled && resource?.cachedContent) {
      if (resource.cacheExpiry && resource.cacheExpiry > new Date()) {
        return resource.cachedContent;
      }
    }

    // Fetch từ server
    const content = await this.readHandler(serverName, uri);

    // Update cache
    if (this.cacheOptions.enabled && resource) {
      resource.cachedContent = content;
      resource.cacheExpiry = new Date(Date.now() + this.cacheOptions.ttl);
      resource.lastUpdated = new Date();

      // Enforce cache size limit
      this.enforceCacheLimit();
    }

    return content;
  }

  /**
   * Đọc nhiều resources cùng lúc
   *
   * @param requests - Array của { serverName, uri }
   */
  async readResources(
    requests: Array<{ serverName: string; uri: string }>
  ): Promise<Map<string, ResourceContent[]>> {
    const results = new Map<string, ResourceContent[]>();

    await Promise.all(
      requests.map(async ({ serverName, uri }) => {
        try {
          const content = await this.readResource(serverName, uri);
          const qualifiedUri = this.createQualifiedUri(serverName, uri);
          results.set(qualifiedUri, content);
        } catch (error) {
          console.error(`Failed to read resource ${serverName}:${uri}:`, error);
        }
      })
    );

    return results;
  }

  // ==========================================================================
  // Subscription Methods
  // ==========================================================================

  /**
   * Subscribe vào resource updates
   *
   * @param serverName - Tên server
   * @param uri - Resource URI
   * @param callback - Callback khi resource update
   * @returns Unsubscribe function
   */
  subscribe(
    serverName: string,
    uri: string,
    callback: ResourceUpdateCallback
  ): () => void {
    const qualifiedUri = this.createQualifiedUri(serverName, uri);

    // Tạo subscription set nếu chưa có
    if (!this.subscriptions.has(qualifiedUri)) {
      this.subscriptions.set(qualifiedUri, new Set());
    }

    this.subscriptions.get(qualifiedUri)!.add(callback);

    // Mark resource as subscribed
    const resource = this.resources.get(qualifiedUri);
    if (resource) {
      resource.subscribed = true;
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(qualifiedUri);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(qualifiedUri);
          if (resource) {
            resource.subscribed = false;
          }
        }
      }
    };
  }

  /**
   * Notify subscribers về resource update
   *
   * @param serverName - Tên server
   * @param uri - Resource URI
   * @param content - New content (optional, sẽ fetch nếu không có)
   */
  async notifyUpdate(
    serverName: string,
    uri: string,
    content?: ResourceContent[]
  ): Promise<void> {
    const qualifiedUri = this.createQualifiedUri(serverName, uri);
    const subscribers = this.subscriptions.get(qualifiedUri);

    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Fetch content nếu không được cung cấp
    let resolvedContent = content;
    if (!resolvedContent) {
      try {
        resolvedContent = await this.readResource(serverName, uri, true);
      } catch (error) {
        console.error(`Failed to fetch updated content for ${qualifiedUri}:`, error);
        return;
      }
    }

    // Update cache
    const resource = this.resources.get(qualifiedUri);
    if (resource) {
      resource.cachedContent = resolvedContent;
      resource.cacheExpiry = new Date(Date.now() + this.cacheOptions.ttl);
      resource.lastUpdated = new Date();
    }

    // Notify all subscribers
    for (const callback of subscribers) {
      try {
        callback(uri, resolvedContent);
      } catch (error) {
        console.error(`Error in subscription callback for ${qualifiedUri}:`, error);
      }
    }
  }

  /**
   * Lấy danh sách subscribed resources
   */
  getSubscribedResources(): ManagedResource[] {
    return this.getAllResources({ subscribedOnly: true });
  }

  /**
   * Hủy tất cả subscriptions cho một resource
   */
  unsubscribeAll(serverName: string, uri: string): void {
    const qualifiedUri = this.createQualifiedUri(serverName, uri);
    this.subscriptions.delete(qualifiedUri);

    const resource = this.resources.get(qualifiedUri);
    if (resource) {
      resource.subscribed = false;
    }
  }

  // ==========================================================================
  // Cache Methods
  // ==========================================================================

  /**
   * Clear cache cho một resource
   */
  clearResourceCache(serverName: string, uri: string): void {
    const qualifiedUri = this.createQualifiedUri(serverName, uri);
    const resource = this.resources.get(qualifiedUri);
    if (resource) {
      resource.cachedContent = undefined;
      resource.cacheExpiry = undefined;
    }
  }

  /**
   * Clear tất cả cache
   */
  clearCache(): void {
    for (const resource of this.resources.values()) {
      resource.cachedContent = undefined;
      resource.cacheExpiry = undefined;
    }
  }

  /**
   * Enforce cache size limit (LRU eviction)
   */
  private enforceCacheLimit(): void {
    const cachedResources = Array.from(this.resources.values())
      .filter((r) => r.cachedContent)
      .sort((a, b) => {
        const aTime = a.lastUpdated?.getTime() || 0;
        const bTime = b.lastUpdated?.getTime() || 0;
        return aTime - bTime; // Oldest first
      });

    while (cachedResources.length > this.cacheOptions.maxSize) {
      const oldest = cachedResources.shift();
      if (oldest) {
        oldest.cachedContent = undefined;
        oldest.cacheExpiry = undefined;
      }
    }
  }

  // ==========================================================================
  // Stats Methods
  // ==========================================================================

  /**
   * Lấy statistics về resource manager
   */
  getStats(): ResourceManagerStats {
    const resourcesByServer = new Map<string, number>();
    let cachedResources = 0;
    let activeSubscriptions = 0;

    for (const resource of this.resources.values()) {
      // Count by server
      const count = resourcesByServer.get(resource.serverName) || 0;
      resourcesByServer.set(resource.serverName, count + 1);

      // Count cached
      if (resource.cachedContent) {
        cachedResources++;
      }
    }

    // Count subscriptions
    for (const subs of this.subscriptions.values()) {
      activeSubscriptions += subs.size;
    }

    return {
      totalResources: this.resources.size,
      totalTemplates: this.templates.size,
      activeSubscriptions,
      cachedResources,
      resourcesByServer,
    };
  }

  // ==========================================================================
  // Export Methods
  // ==========================================================================

  /**
   * Export resources thành JSON
   */
  toJSON(): object {
    return {
      resources: Array.from(this.resources.values()).map((resource) => ({
        serverName: resource.serverName,
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        subscribed: resource.subscribed,
        registeredAt: resource.registeredAt.toISOString(),
        lastUpdated: resource.lastUpdated?.toISOString(),
      })),
      templates: Array.from(this.templates.values()).map((template) => ({
        serverName: template.serverName,
        uriTemplate: template.uriTemplate,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
      })),
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Tạo qualified URI từ server name và URI
   */
  private createQualifiedUri(serverName: string, uri: string): string {
    return `mcp://${serverName}/${uri}`;
  }

  /**
   * Apply filter lên danh sách resources
   */
  private applyFilter(
    resources: ManagedResource[],
    filter: ResourceFilterOptions
  ): ManagedResource[] {
    return resources.filter((resource) => {
      // Filter by server name
      if (filter.serverName && resource.serverName !== filter.serverName) {
        return false;
      }

      // Filter by subscribed state
      if (filter.subscribedOnly && !resource.subscribed) {
        return false;
      }

      // Filter by MIME type
      if (filter.mimeType) {
        const mimeTypes = Array.isArray(filter.mimeType)
          ? filter.mimeType
          : [filter.mimeType];
        if (!resource.mimeType || !mimeTypes.includes(resource.mimeType)) {
          return false;
        }
      }

      // Filter by URI pattern
      if (filter.uriPattern) {
        const pattern =
          filter.uriPattern instanceof RegExp
            ? filter.uriPattern
            : new RegExp(filter.uriPattern, 'i');
        if (!pattern.test(resource.uri)) {
          return false;
        }
      }

      // Filter by name pattern
      if (filter.namePattern) {
        const pattern =
          filter.namePattern instanceof RegExp
            ? filter.namePattern
            : new RegExp(filter.namePattern, 'i');
        if (!pattern.test(resource.name)) {
          return false;
        }
      }

      // Filter by audience
      if (filter.audience && resource.annotations?.audience) {
        if (!resource.annotations.audience.includes(filter.audience)) {
          return false;
        }
      }

      return true;
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Tạo ResourceManager instance mới
 */
export function createResourceManager(options?: Partial<CacheOptions>): ResourceManager {
  return new ResourceManager(options);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Expand URI template với values
 *
 * @param template - URI template (RFC 6570 simplified)
 * @param values - Values để expand
 */
export function expandUriTemplate(
  template: string,
  values: Record<string, string>
): string {
  // Simple implementation - chỉ support {name} format
  return template.replace(/\{([^}]+)\}/g, (match, name) => {
    return values[name] ?? match;
  });
}

/**
 * Match URI với template và extract values
 *
 * @param uri - URI cần match
 * @param template - URI template
 * @returns Extracted values hoặc null nếu không match
 */
export function matchUriTemplate(
  uri: string,
  template: string
): Record<string, string> | null {
  // Convert template thành regex
  const regexStr = template.replace(/\{([^}]+)\}/g, '([^/]+)');
  const regex = new RegExp(`^${regexStr}$`);

  const match = uri.match(regex);
  if (!match) {
    return null;
  }

  // Extract variable names from template
  const names: string[] = [];
  const nameRegex = /\{([^}]+)\}/g;
  let nameMatch: RegExpExecArray | null;
  while ((nameMatch = nameRegex.exec(template))) {
    names.push(nameMatch[1]);
  }

  // Build result object
  const result: Record<string, string> = {};
  for (let i = 0; i < names.length; i++) {
    result[names[i]] = match[i + 1];
  }

  return result;
}
