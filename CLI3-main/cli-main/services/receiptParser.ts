export interface ReceiptProductDraft {
  id: string;
  name: string;
  quantity: string;
}

interface ProductRule {
  normalizedName: string;
  keywords: string[];
  reject?: string[];
}

const BLOCKED_LINE_PATTERNS = [
  /\b(total|subtotal|importe|base imponible|iva|i\.v\.a|ahorro|descuento|dto\.?|promocion|oferta)\b/i,
  /\b(tarjeta|visa|mastercard|efectivo|cambio|pagado|pago|autorizacion|operacion|contactless)\b/i,
  /\b(ticket|factura|copia|cliente|cajero|caja|tienda|supermercado|mercadona|carrefour|lidl|aldi|dia|consum|eroski)\b/i,
  /\b(fecha|hora|telefono|tel\.?|nif|cif|www\.|https?:|email|gracias|vuelva pronto)\b/i,
  /^[-_*\s=.]+$/,
];

const PRODUCT_RULES: ProductRule[] = [
  { normalizedName: 'Tomate frito', keywords: ['tomate frito'] },
  { normalizedName: 'Pan de molde', keywords: ['pan molde', 'molde'] },
  { normalizedName: 'Alas de pollo', keywords: ['alas pollo', 'alas de pollo', 'alitas pollo', 'alitas de pollo'] },
  { normalizedName: 'Kiwi', keywords: ['kiwi', 'zespri'] },
  { normalizedName: 'Leche', keywords: ['leche'] },
  { normalizedName: 'Huevos', keywords: ['huevo', 'huevos'] },
  { normalizedName: 'Tomate', keywords: ['tomate', 'tomates'] },
  { normalizedName: 'Lechuga', keywords: ['lechuga'] },
  { normalizedName: 'Cebolla', keywords: ['cebolla', 'cebollas'] },
  { normalizedName: 'Patatas', keywords: ['patata', 'patatas', 'papas'] },
  { normalizedName: 'Zanahoria', keywords: ['zanahoria', 'zanahorias'] },
  { normalizedName: 'Pimiento', keywords: ['pimiento', 'pimientos'] },
  { normalizedName: 'Pepino', keywords: ['pepino', 'pepinos'] },
  { normalizedName: 'Ajo', keywords: ['ajo', 'ajos'] },
  { normalizedName: 'Calabacín', keywords: ['calabacin', 'calabacines'] },
  { normalizedName: 'Berenjena', keywords: ['berenjena', 'berenjenas'] },
  { normalizedName: 'Champiñones', keywords: ['champinon', 'champiñon', 'champiñones', 'setas'] },
  { normalizedName: 'Brócoli', keywords: ['brocoli', 'brócoli'] },
  { normalizedName: 'Espinacas', keywords: ['espinaca', 'espinacas'] },
  { normalizedName: 'Judías verdes', keywords: ['judia verde', 'judias verdes', 'judías verdes'] },
  { normalizedName: 'Garbanzos', keywords: ['garbanzo', 'garbanzos'] },
  { normalizedName: 'Lentejas', keywords: ['lenteja', 'lentejas'] },
  { normalizedName: 'Alubias', keywords: ['alubia', 'alubias', 'judion', 'judiones'] },
  { normalizedName: 'Arroz', keywords: ['arroz'] },
  { normalizedName: 'Pasta', keywords: ['pasta', 'macarron', 'macarrones', 'espagueti', 'spaghetti', 'tallarines'] },
  { normalizedName: 'Pan', keywords: ['pan'], reject: ['panal'] },
  { normalizedName: 'Tortillas de trigo', keywords: ['tortilla trigo', 'tortillas trigo', 'fajita', 'fajitas'] },
  { normalizedName: 'Queso', keywords: ['queso'] },
  { normalizedName: 'Yogur', keywords: ['yogur', 'yogurt', 'yogures'] },
  { normalizedName: 'Mantequilla', keywords: ['mantequilla'] },
  { normalizedName: 'Nata', keywords: ['nata cocinar', 'nata'] },
  { normalizedName: 'Pollo', keywords: ['pollo', 'pechuga', 'contramuslo'] },
  { normalizedName: 'Carne picada', keywords: ['carne picada', 'picada'] },
  { normalizedName: 'Ternera', keywords: ['ternera'] },
  { normalizedName: 'Cerdo', keywords: ['cerdo', 'lomo'] },
  { normalizedName: 'Jamón york', keywords: ['jamon york', 'jamón york', 'york'] },
  { normalizedName: 'Atún', keywords: ['atun', 'atún'] },
  { normalizedName: 'Sardinas', keywords: ['sardina', 'sardinas'] },
  { normalizedName: 'Salmón', keywords: ['salmon', 'salmón'] },
  { normalizedName: 'Merluza', keywords: ['merluza'] },
  { normalizedName: 'Aceite', keywords: ['aceite'] },
  { normalizedName: 'Vinagre', keywords: ['vinagre'] },
  { normalizedName: 'Sal', keywords: ['sal'], reject: ['salsa'] },
  { normalizedName: 'Azúcar', keywords: ['azucar', 'azúcar'] },
  { normalizedName: 'Harina', keywords: ['harina'] },
  { normalizedName: 'Café', keywords: ['cafe', 'café'] },
  { normalizedName: 'Té', keywords: ['te verde', 'te negro', 'té'] },
  { normalizedName: 'Manzanas', keywords: ['manzana', 'manzanas'] },
  { normalizedName: 'Plátanos', keywords: ['platano', 'plátano', 'platanos', 'plátanos', 'banana'] },
  { normalizedName: 'Naranjas', keywords: ['naranja', 'naranjas'] },
  { normalizedName: 'Limones', keywords: ['limon', 'limón', 'limones'] },
  { normalizedName: 'Aguacate', keywords: ['aguacate', 'aguacates'] },
  { normalizedName: 'Pesto', keywords: ['pesto'] },
  { normalizedName: 'Pizza', keywords: ['pizza'] },
];

const normalizeText = (value: string): string => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9ñ\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const toTitleCase = (value: string): string => value
  .toLowerCase()
  .split(' ')
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const keywordMatches = (line: string, keyword: string): boolean => {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;

  if (normalizedKeyword.includes(' ')) {
    return line.includes(normalizedKeyword);
  }

  return new RegExp(`(^|\\s)${normalizedKeyword}(\\s|$)`).test(line);
};

const cleanReceiptLine = (line: string): string => line
  // Remove unit-price calculations such as "0,5kg * 10€/kg = 5€" before looking for product names.
  .replace(/\b\d+(?:[,.]\d+)?\s*(kg|g|gr|l|ml|cl|uds?|unid|pack|paq)\s*[xX*]\s*\d+(?:[,.]\d+)?\s*€?\s*\/?\s*(kg|g|gr|l|ml|cl|uds?|unid)?\s*=?\s*\d*(?:[,.]\d+)?\s*€?/gi, ' ')
  .replace(/\b\d+(?:[,.]\d+)?\s*€\s*\/?\s*(kg|g|gr|l|ml|cl|uds?|unid)\b/gi, ' ')
  .replace(/\b\d+(?:[,.]\d+)?\s*(kg|g|gr|l|ml|cl|uds?|unid|pack|paq)\b/gi, ' ')
  .replace(/\b\d+\s*[xX*]\s*\d+(?:[,.]\d+)?\s*€?\b/g, ' ')
  .replace(/\b\d+[,.]\d{1,2}\s*€?\b/g, ' ')
  .replace(/\b\d+\b/g, ' ')
  .replace(/\b(kg|gr|g|l|ml|cl|uds?|unid|pack|paq|eur)\b/gi, ' ')
  .replace(/[€=/*ºª]/g, ' ')
  .replace(/[^\p{L}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const shouldIgnoreLine = (line: string): boolean => {
  const clean = line.trim();
  if (clean.length < 3) return true;
  if (/^\d+$/.test(clean)) return true;
  return BLOCKED_LINE_PATTERNS.some((pattern) => pattern.test(clean));
};

const normalizeProductName = (line: string): string | null => {
  const normalizedLine = normalizeText(line);
  if (!normalizedLine) return null;

  const exactRule = [...PRODUCT_RULES]
    .sort((a, b) => Math.max(...b.keywords.map((keyword) => keyword.length)) - Math.max(...a.keywords.map((keyword) => keyword.length)))
    .find((rule) => rule.keywords.some((keyword) => keywordMatches(normalizedLine, keyword)));
  if (exactRule) {
    const rejected = exactRule.reject?.some((word) => keywordMatches(normalizedLine, word)) ?? false;
    if (!rejected) return exactRule.normalizedName;
  }

  const fallback = cleanReceiptLine(line)
    .replace(/\b(desnatada|semidesnatada|entera|fresco|fresca|camperos?|rallado|rallada|natural|bio|eco|sin lactosa)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (fallback.length < 3 || /\d/.test(fallback)) return null;
  return toTitleCase(fallback).slice(0, 40);
};

export const parseReceiptProducts = (receiptText: string): ReceiptProductDraft[] => {
  const seen = new Set<string>();

  return receiptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !shouldIgnoreLine(line))
    .map(cleanReceiptLine)
    .filter((line) => !shouldIgnoreLine(line))
    .map(normalizeProductName)
    .filter((name): name is string => Boolean(name))
    .filter((name) => {
      const key = normalizeText(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((name, index) => ({ id: `${Date.now()}_${index}_${name}`, name, quantity: '1' }));
};
