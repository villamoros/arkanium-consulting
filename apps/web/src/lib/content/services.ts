/**
 * Agrupa los servicios planos del almacén (content/services/<idioma>/*.json) en
 * familia → categoría → servicio, en el orden declarado en cada archivo.
 * Valida la forma: un servicio sin familia o categoría se rechaza con su valor, no se oculta.
 */

export interface TermRecord {
  value: string;
  name: string;
  order: number;
}

export interface FamilyGroup extends TermRecord {
  categories: CategoryGroup[];
}

export interface CategoryGroup extends TermRecord {
  services: Record<string, unknown>[];
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function term(raw: unknown, where: string): TermRecord {
  if (!isObject(raw)) throw new Error(`[content] ${where}: falta el objeto de familia o categoría.`);
  const value = text(raw.value);
  const name = text(raw.name);
  const order = typeof raw.order === 'number' ? raw.order : NaN;
  if (!value || !name || !Number.isFinite(order)) throw new Error(`[content] ${where}: familia o categoría incompleta (value, name, order).`);
  return { value, name, order };
}

export function groupServices(items: Record<string, unknown>[]): FamilyGroup[] {
  const families = new Map<string, FamilyGroup>();

  for (const item of items) {
    const id = text(item.value) ?? '(sin value)';
    const family = term(item.family, `servicio ${id}`);
    const category = term(item.category, `servicio ${id}`);

    let group = families.get(family.value);
    if (!group) {
      group = { ...family, categories: [] };
      families.set(family.value, group);
    } else if (group.name !== family.name || group.order !== family.order) {
      throw new Error(`[content] familia ${family.value}: nombre u orden distintos entre servicios.`);
    }

    let cat = group.categories.find((c) => c.value === category.value);
    if (!cat) {
      cat = { ...category, services: [] };
      group.categories.push(cat);
    } else if (cat.name !== category.name || cat.order !== category.order) {
      throw new Error(`[content] categoría ${category.value}: nombre u orden distintos entre servicios.`);
    }
    cat.services.push(item);
  }

  const byOrder = (a: TermRecord, b: TermRecord) => a.order - b.order || a.value.localeCompare(b.value);
  const sorted = [...families.values()].sort(byOrder);
  for (const f of sorted) {
    f.categories.sort(byOrder);
    for (const c of f.categories) {
      c.services.sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0) || String(a.value).localeCompare(String(b.value)));
    }
  }
  return sorted;
}
