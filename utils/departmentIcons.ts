/**
 * departmentIcons.ts
 * Centralized registry of icons, colors, and backgrounds for major corporate/industry departments.
 */

export interface DepartmentMeta {
  icon: string;
  color: string;
  bg: string;
  border?: string;
}

export const DEPARTMENT_MAP: Record<string, DepartmentMeta> = {
  // ── Technology & Engineering ──
  'Engineering':             { icon: 'code-tags', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'IT & Infrastructure':     { icon: 'server-network', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  'Information Technology':  { icon: 'server', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  'Software Development':    { icon: 'laptop', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  'DevOps & Cloud':          { icon: 'cloud-cog', color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  'Quality Assurance':       { icon: 'checkbox-marked-circle-outline', color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' },
  'Cybersecurity':           { icon: 'shield-lock-outline', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  'Data Science & AI':       { icon: 'brain', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },

  // ── Human Resources & Administration ──
  'HR & Admin':              { icon: 'account-tie', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  'Human Resources':         { icon: 'account-group', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  'Administration':          { icon: 'domain', color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  'Recruitment':             { icon: 'account-search', color: '#8B5CF6', bg: '#F5F3FF', border: '#DDD6FE' },
  'Training & Development':  { icon: 'school-outline', color: '#9333EA', bg: '#FAF5FF', border: '#E9D5FF' },

  // ── Design & Creative ──
  'Design':                  { icon: 'palette-swatch-outline', color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },
  'UI/UX Design':            { icon: 'vector-arrange-below', color: '#EC4899', bg: '#FDF2F8', border: '#FBCFE8' },
  'Creative & Media':        { icon: 'brush-outline', color: '#F43F5E', bg: '#FFF1F2', border: '#FECDD3' },
  'Product Design':          { icon: 'draw', color: '#DB2777', bg: '#FDF2F8', border: '#FBCFE8' },

  // ── Sales, Marketing & Growth ──
  'Marketing':               { icon: 'bullhorn', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'Digital Marketing':       { icon: 'advertisements', color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  'Sales':                   { icon: 'trending-up', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' },
  'Business Development':    { icon: 'briefcase-check-outline', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'Public Relations':        { icon: 'newspaper-variant-outline', color: '#C026D3', bg: '#FDF4FF', border: '#F5D0FE' },
  'Customer Success':        { icon: 'account-heart', color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },

  // ── Finance, Accounting & Legal ──
  'Finance':                 { icon: 'currency-usd', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  'Accounting':              { icon: 'calculator-variant-outline', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  'Billing & Payroll':       { icon: 'cash-register', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4' },
  'Legal & Compliance':      { icon: 'scale-balance', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  'Audit & Risk':            { icon: 'file-document-check-outline', color: '#334155', bg: '#F1F5F9', border: '#CBD5E1' },

  // ── Operations, Logistics & Supply Chain ──
  'Operations':              { icon: 'clipboard-list-outline', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  'Supply Chain':            { icon: 'truck-delivery-outline', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  'Logistics':               { icon: 'warehouse', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD' },
  'Procurement':             { icon: 'cart-outline', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'Inventory':               { icon: 'package-variant-closed', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },

  // ── Healthcare, Medical & Safety ──
  'Medical & Healthcare':    { icon: 'hospital-box-outline', color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },
  'Health & Safety (EHS)':   { icon: 'shield-cross-outline', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  'Pharmacy':                { icon: 'pill', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  'Nursing':                 { icon: 'account-plus-outline', color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3' },

  // ── Manufacturing, Field & Maintenance ──
  'Manufacturing':           { icon: 'factory', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
  'Production':              { icon: 'cogs', color: '#374151', bg: '#F9FAFB', border: '#E5E7EB' },
  'Maintenance & Facilities':{ icon: 'wrench-outline', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'Field Services':          { icon: 'hard-hat', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' },
  'Security':                { icon: 'shield-account', color: '#1E293B', bg: '#F8FAFC', border: '#E2E8F0' },

  // ── Hospitality, Retail & Services ──
  'Customer Support':        { icon: 'headset', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'Hospitality & Food':      { icon: 'silverware-fork-knife', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'Retail & Store':          { icon: 'storefront-outline', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  'Executive & Board':       { icon: 'crown-outline', color: '#FF6900', bg: '#FFF7ED', border: '#FFEDD5' },
  'General':                 { icon: 'briefcase-outline', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
};

/**
 * Resolves icon, color and background metadata for any department string dynamically.
 * Fuzzy matches keywords if an exact name match isn't found.
 */
export function getDepartmentMeta(department?: string | null): DepartmentMeta {
  if (!department) {
    return DEPARTMENT_MAP['General'];
  }

  // Exact match
  if (DEPARTMENT_MAP[department]) {
    return DEPARTMENT_MAP[department];
  }

  const lower = department.toLowerCase();

  // Fuzzy keyword matching
  if (lower.includes('tech') || lower.includes('eng') || lower.includes('code') || lower.includes('dev') || lower.includes('software')) {
    return DEPARTMENT_MAP['Engineering'];
  }
  if (lower.includes('it') || lower.includes('system') || lower.includes('infra') || lower.includes('network')) {
    return DEPARTMENT_MAP['IT & Infrastructure'];
  }
  if (lower.includes('hr') || lower.includes('human') || lower.includes('people') || lower.includes('talent') || lower.includes('recruit')) {
    return DEPARTMENT_MAP['HR & Admin'];
  }
  if (lower.includes('admin') || lower.includes('office') || lower.includes('clerk')) {
    return DEPARTMENT_MAP['Administration'];
  }
  if (lower.includes('design') || lower.includes('ui') || lower.includes('ux') || lower.includes('graphic') || lower.includes('art') || lower.includes('creative')) {
    return DEPARTMENT_MAP['Design'];
  }
  if (lower.includes('market') || lower.includes('brand') || lower.includes('growth') || lower.includes('seo') || lower.includes('ad')) {
    return DEPARTMENT_MAP['Marketing'];
  }
  if (lower.includes('sale') || lower.includes('revenue') || lower.includes('bdr') || lower.includes('client')) {
    return DEPARTMENT_MAP['Sales'];
  }
  if (lower.includes('finan') || lower.includes('account') || lower.includes('tax') || lower.includes('pay') || lower.includes('money') || lower.includes('treasur')) {
    return DEPARTMENT_MAP['Finance'];
  }
  if (lower.includes('law') || lower.includes('legal') || lower.includes('complian') || lower.includes('contract')) {
    return DEPARTMENT_MAP['Legal & Compliance'];
  }
  if (lower.includes('op') || lower.includes('logist') || lower.includes('supply') || lower.includes('procure') || lower.includes('deliver') || lower.includes('store') || lower.includes('warehous')) {
    return DEPARTMENT_MAP['Operations'];
  }
  if (lower.includes('med') || lower.includes('health') || lower.includes('doctor') || lower.includes('nurse') || lower.includes('clinic') || lower.includes('care')) {
    return DEPARTMENT_MAP['Medical & Healthcare'];
  }
  if (lower.includes('safe') || lower.includes('secur') || lower.includes('guard')) {
    return DEPARTMENT_MAP['Security'];
  }
  if (lower.includes('fact') || lower.includes('product') || lower.includes('plant') || lower.includes('manufac') || lower.includes('machin')) {
    return DEPARTMENT_MAP['Manufacturing'];
  }
  if (lower.includes('maint') || lower.includes('repair') || lower.includes('electr') || lower.includes('plumb') || lower.includes('civil')) {
    return DEPARTMENT_MAP['Maintenance & Facilities'];
  }
  if (lower.includes('support') || lower.includes('service') || lower.includes('help') || lower.includes('call') || lower.includes('desk')) {
    return DEPARTMENT_MAP['Customer Support'];
  }
  if (lower.includes('food') || lower.includes('chef') || lower.includes('restaur') || lower.includes('hotel') || lower.includes('hospit')) {
    return DEPARTMENT_MAP['Hospitality & Food'];
  }
  if (lower.includes('exec') || lower.includes('direct') || lower.includes('ceo') || lower.includes('chief') || lower.includes('manag') || lower.includes('head')) {
    return DEPARTMENT_MAP['Executive & Board'];
  }

  // Fallback
  return {
    icon: 'briefcase-outline',
    color: '#64748B',
    bg: '#F8FAFC',
    border: '#E2E8F0',
  };
}
