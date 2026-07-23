export interface ReceiptProductDraft {
  id: string;
  name: string;
  quantity: string;
}

const GROQ_STORAGE_KEY = 'planifia_groq_api_key';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.2-11b-vision-preview';

export const getGroqApiKey = (): string | null => {
  return localStorage.getItem(GROQ_STORAGE_KEY);
};

export const setGroqApiKey = (key: string): void => {
  localStorage.setItem(GROQ_STORAGE_KEY, key.trim());
};

export const hasGroqApiKey = (): boolean => {
  const key = getGroqApiKey();
  return Boolean(key && key.length > 0);
};

const RECEIPT_PROMPT = `Eres un asistente que analiza fotos de tickets de compra de supermercados españoles.

TAREA: Extrae ÚNICAMENTE los nombres de los productos alimentarios comprados.

REGLAS ESTRICTAS:
1. IGNORA completamente: precios (€), pesos (kg, g), precios por kilo (€/kg), cantidades numéricas, códigos de barras, totales, subtotales, IVA, descuentos, nombre del supermercado, fecha, hora, número de ticket, dirección, teléfono, formas de pago, y cualquier texto que NO sea un nombre de producto.
2. NORMALIZA cada producto a su ingrediente básico genérico, sin marca ni especificación:
   - "Leche semidesnatada Gaza" → "Leche"
   - "Macarrones Gallo 500g" → "Macarrones"
   - "Pechuga de pollo fileteada" → "Pollo"
   - "Tomate triturado Orlando" → "Tomate frito"
   - "Yogur natural Hacendado" → "Yogur"
   - "Aceite de oliva virgen extra Carbonell" → "Aceite"
   - "Pan de molde Bimbo integral" → "Pan de molde"
   - "Queso rallado García Baquero" → "Queso"
   - "Agua mineral Bezoya" → "Agua"
   - "Atún claro en aceite Calvo" → "Atún"
   - "Jamón cocido extra Campofrío" → "Jamón york"
   - "Espaguetis integrales Barilla" → "Pasta"
3. Si un producto aparece varias veces en el ticket, inclúyelo SOLO UNA VEZ.
4. Si no puedes identificar ningún producto, devuelve un array vacío [].
5. NO inventes productos que no aparezcan en el ticket.
6. NO incluyas productos de limpieza, higiene, ni artículos no alimentarios.

FORMATO DE RESPUESTA: Devuelve SOLO un JSON array de strings, sin explicaciones, sin markdown, sin bloques de código.
Ejemplo: ["Leche", "Huevos", "Macarrones", "Pollo", "Tomate frito"]`;

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('No se pudo convertir la imagen a base64.'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen.'));
    reader.readAsDataURL(file);
  });
};

const getMimeType = (file: File): string => {
  if (file.type && file.type.startsWith('image/')) return file.type;
  // Fallback based on extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return mimeMap[ext ?? ''] ?? 'image/jpeg';
};

export const analyzeReceiptImage = async (imageFile: File): Promise<ReceiptProductDraft[]> => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('Configura tu API key de Groq antes de escanear tickets.');
  }

  const base64Image = await fileToBase64(imageFile);
  const mimeType = getMimeType(imageFile);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[GroqVision] API error:', response.status, errorBody);
    throw new Error(`Error del servicio de lectura (${response.status}). Inténtalo de nuevo.`);
  }

  const data = await response.json();
  const rawContent: string = data?.choices?.[0]?.message?.content?.trim() ?? '';

  if (!rawContent) {
    throw new Error('La IA no ha devuelto ningún resultado.');
  }

  // Parse the JSON array from the response
  let ingredients: string[];
  try {
    // The model might wrap the array in markdown code blocks, strip them
    const cleaned = rawContent
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    ingredients = JSON.parse(cleaned);
  } catch {
    console.error('[GroqVision] Failed to parse response:', rawContent);
    throw new Error('No se ha podido interpretar la respuesta de la IA.');
  }

  if (!Array.isArray(ingredients)) {
    throw new Error('Respuesta inesperada de la IA.');
  }

  // Filter and deduplicate
  const seen = new Set<string>();
  return ingredients
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((name) => name.trim())
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((name, index) => ({
      id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`,
      name,
      quantity: '1',
    }));
};
