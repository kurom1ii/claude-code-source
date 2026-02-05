/**
 * Claude Code - Skill Registry
 *
 * Module quan ly dang ky va truy xuat cac skills.
 * Registry la trung tam luu tru tat ca skills da dang ky,
 * cho phep lookup, filter va quan ly lifecycle cua skills.
 */

import type {
  SkillDefinition,
  SkillSource,
  ISkillRegistry,
  SkillUsageInfo,
  SkillUsageMap,
} from './types';

// ============================================================================
// Skill Registry Implementation
// ============================================================================

/**
 * Singleton registry quan ly tat ca skills
 */
class SkillRegistry implements ISkillRegistry {
  /** Map luu tru skills theo ten */
  private skills: Map<string, SkillDefinition> = new Map();

  /** Map theo doi su dung skills */
  private usageMap: SkillUsageMap = {};

  /** Set cac skill da duoc invoked trong session hien tai */
  private invokedSkills: Set<string> = new Set();

  // --------------------------------------------------------------------------
  // Registration Methods - Cac phuong thuc dang ky
  // --------------------------------------------------------------------------

  /**
   * Dang ky mot skill moi
   * Neu skill da ton tai, se ghi de
   * @param skill - Skill definition can dang ky
   */
  register(skill: SkillDefinition): void {
    const name = this.normalizeName(skill.name);
    this.skills.set(name, skill);
  }

  /**
   * Dang ky nhieu skills cung luc
   * @param skills - Mang cac skill definitions
   */
  registerMany(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * Huy dang ky skill theo ten
   * @param name - Ten skill can huy
   * @returns true neu da xoa, false neu khong tim thay
   */
  unregister(name: string): boolean {
    const normalized = this.normalizeName(name);
    return this.skills.delete(normalized);
  }

  // --------------------------------------------------------------------------
  // Lookup Methods - Cac phuong thuc tim kiem
  // --------------------------------------------------------------------------

  /**
   * Lay skill theo ten
   * @param name - Ten skill (co hoac khong co dau "/")
   * @returns Skill definition hoac undefined
   */
  get(name: string): SkillDefinition | undefined {
    const normalized = this.normalizeName(name);
    return this.skills.get(normalized);
  }

  /**
   * Lay skill theo ten, ho tro plugin prefix
   * Vi du: "git-workflow:commit" hoac "commit"
   * @param name - Ten skill (co the co plugin prefix)
   * @returns Skill definition hoac undefined
   */
  getWithPrefix(name: string): SkillDefinition | undefined {
    // Thu tim truc tiep truoc
    const direct = this.get(name);
    if (direct) return direct;

    // Neu co prefix, tim trong plugin skills
    if (name.includes(':')) {
      const normalized = this.normalizeName(name);
      return this.skills.get(normalized);
    }

    // Tim skill co ten trung khop (khong quan tam prefix)
    const shortName = this.normalizeName(name);
    const entries = Array.from(this.skills.entries());
    for (const [key, skill] of entries) {
      if (key.endsWith(`:${shortName}`)) {
        return skill;
      }
    }

    return undefined;
  }

  /**
   * Lay tat ca skills da dang ky
   * @returns Mang tat ca skill definitions
   */
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /**
   * Lay skills theo nguon goc
   * @param source - Nguon goc can loc (built-in, user, project, plugin)
   * @returns Mang skills tu nguon goc chi dinh
   */
  getBySource(source: SkillSource): SkillDefinition[] {
    return this.getAll().filter(skill => skill.source === source);
  }

  /**
   * Lay cac skills duoc bat va khong bi an
   * Chi tra ve skills ma:
   * - isEnabled() tra ve true
   * - isHidden = false
   * @returns Mang visible skills
   */
  getVisible(): SkillDefinition[] {
    return this.getAll().filter(skill =>
      skill.isEnabled() && !skill.isHidden
    );
  }

  /**
   * Lay skills theo plugin name
   * @param pluginName - Ten plugin
   * @returns Mang skills tu plugin
   */
  getByPlugin(pluginName: string): SkillDefinition[] {
    return this.getAll().filter(skill => skill.pluginName === pluginName);
  }

  /**
   * Kiem tra skill co ton tai khong
   * @param name - Ten skill can kiem tra
   * @returns true neu ton tai
   */
  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  // --------------------------------------------------------------------------
  // Usage Tracking - Theo doi su dung
  // --------------------------------------------------------------------------

  /**
   * Ghi nhan skill da duoc su dung
   * @param name - Ten skill da su dung
   */
  trackUsage(name: string): void {
    const normalized = this.normalizeName(name);
    const now = Date.now();

    const current = this.usageMap[normalized];
    const usageCount = (current?.usageCount ?? 0) + 1;

    this.usageMap[normalized] = {
      usageCount,
      lastUsedAt: now,
    };

    // Them vao set invoked skills
    this.invokedSkills.add(normalized);
  }

  /**
   * Lay thong tin su dung skill
   * @param name - Ten skill
   * @returns Thong tin su dung hoac undefined
   */
  getUsage(name: string): SkillUsageInfo | undefined {
    const normalized = this.normalizeName(name);
    return this.usageMap[normalized];
  }

  /**
   * Lay danh sach skills da invoked trong session
   * @returns Set ten cac skills da invoked
   */
  getInvokedSkills(): Set<string> {
    return new Set(this.invokedSkills);
  }

  /**
   * Clear danh sach invoked skills
   */
  clearInvokedSkills(): void {
    this.invokedSkills.clear();
  }

  /**
   * Lay skills duoc su dung nhieu nhat
   * @param limit - So luong toi da tra ve
   * @returns Mang skills sap xep theo su dung giam dan
   */
  getMostUsed(limit: number = 10): SkillDefinition[] {
    const entries = Object.entries(this.usageMap)
      .sort((a, b) => b[1].usageCount - a[1].usageCount)
      .slice(0, limit);

    return entries
      .map(([name]) => this.get(name))
      .filter((skill): skill is SkillDefinition => skill !== undefined);
  }

  /**
   * Lay skills duoc su dung gan day
   * @param limit - So luong toi da tra ve
   * @returns Mang skills sap xep theo thoi gian su dung giam dan
   */
  getRecentlyUsed(limit: number = 10): SkillDefinition[] {
    const entries = Object.entries(this.usageMap)
      .sort((a, b) => b[1].lastUsedAt - a[1].lastUsedAt)
      .slice(0, limit);

    return entries
      .map(([name]) => this.get(name))
      .filter((skill): skill is SkillDefinition => skill !== undefined);
  }

  // --------------------------------------------------------------------------
  // Utility Methods - Cac phuong thuc tien ich
  // --------------------------------------------------------------------------

  /**
   * Xoa tat ca skills da dang ky
   */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Xoa skills theo nguon goc
   * @param source - Nguon goc can xoa
   */
  clearBySource(source: SkillSource): void {
    const entries = Array.from(this.skills.entries());
    for (const [name, skill] of entries) {
      if (skill.source === source) {
        this.skills.delete(name);
      }
    }
  }

  /**
   * Lay so luong skills da dang ky
   * @returns So luong skills
   */
  size(): number {
    return this.skills.size;
  }

  /**
   * Lay danh sach ten tat ca skills
   * @returns Mang ten skills
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Chuan hoa ten skill (loai bo "/" dau va lowercase)
   * @param name - Ten skill can chuan hoa
   * @returns Ten da chuan hoa
   */
  private normalizeName(name: string): string {
    // Loai bo "/" o dau neu co
    const withoutSlash = name.startsWith('/') ? name.slice(1) : name;
    // Lowercase de case-insensitive lookup
    return withoutSlash.toLowerCase();
  }

  /**
   * Reset registry (dung cho testing)
   */
  reset(): void {
    this.skills.clear();
    this.usageMap = {};
    this.invokedSkills.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance cua skill registry
 */
const skillRegistry = new SkillRegistry();

// ============================================================================
// Module-level Functions
// ============================================================================

/**
 * Dang ky skill voi registry global
 * @param skill - Skill can dang ky
 */
export function registerSkill(skill: SkillDefinition): void {
  skillRegistry.register(skill);
}

/**
 * Dang ky nhieu skills
 * @param skills - Mang skills can dang ky
 */
export function registerSkills(skills: SkillDefinition[]): void {
  skillRegistry.registerMany(skills);
}

/**
 * Huy dang ky skill
 * @param name - Ten skill can huy
 * @returns true neu thanh cong
 */
export function unregisterSkill(name: string): boolean {
  return skillRegistry.unregister(name);
}

/**
 * Lay skill theo ten
 * @param name - Ten skill
 * @returns Skill definition hoac undefined
 */
export function getSkill(name: string): SkillDefinition | undefined {
  return skillRegistry.getWithPrefix(name);
}

/**
 * Lay tat ca skills
 * @returns Mang tat ca skills
 */
export function getAllSkills(): SkillDefinition[] {
  return skillRegistry.getAll();
}

/**
 * Lay skills hien thi duoc
 * @returns Mang visible skills
 */
export function getVisibleSkills(): SkillDefinition[] {
  return skillRegistry.getVisible();
}

/**
 * Lay skills theo nguon
 * @param source - Nguon goc
 * @returns Mang skills
 */
export function getSkillsBySource(source: SkillSource): SkillDefinition[] {
  return skillRegistry.getBySource(source);
}

/**
 * Kiem tra skill ton tai
 * @param name - Ten skill
 * @returns true neu ton tai
 */
export function hasSkill(name: string): boolean {
  return skillRegistry.has(name);
}

/**
 * Ghi nhan su dung skill
 * @param name - Ten skill
 */
export function trackSkillUsage(name: string): void {
  skillRegistry.trackUsage(name);
}

/**
 * Lay skills da invoked
 * @returns Set ten skills
 */
export function getInvokedSkills(): Set<string> {
  return skillRegistry.getInvokedSkills();
}

/**
 * Clear invoked skills
 */
export function clearInvokedSkills(): void {
  skillRegistry.clearInvokedSkills();
}

/**
 * Reset toan bo registry
 */
export function resetRegistry(): void {
  skillRegistry.reset();
}

// ============================================================================
// Exports
// ============================================================================

export { SkillRegistry };
export default skillRegistry;
