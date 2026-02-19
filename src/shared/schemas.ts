import { z } from 'zod';
import { NPM_LOG_LEVELS } from './constants';

export const NpmLogLevelSchema = z.enum([...NPM_LOG_LEVELS]);

export const ScrapeRequestSchema = z.object({
  urls: z.array(z.string()),
});

export const EnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  LOG_LEVEL: NpmLogLevelSchema,
});

export const GeminiJsonResponseType = {
  /**
   *   Not specified, should not be used.
   */
  TYPE_UNSPECIFIED: 'TYPE_UNSPECIFIED',
  /**
   *   OpenAPI string type
   */
  STRING: 'STRING',
  /**
   *   OpenAPI number type
   */
  NUMBER: 'NUMBER',
  /**
   *   OpenAPI integer type
   */
  INTEGER: 'INTEGER',
  /**
   *   OpenAPI boolean type
   */
  BOOLEAN: 'BOOLEAN',
  /**
   *   OpenAPI array type
   */
  ARRAY: 'ARRAY',
  /**
   *   OpenAPI object type
   */
  OBJECT: 'OBJECT',
  /**
   *   Null type
   */
  NULL: 'NULL',
} as const;

export type GeminiJsonResponseType =
  (typeof GeminiJsonResponseType)[keyof typeof GeminiJsonResponseType];

export const menuSchema = {
  type: GeminiJsonResponseType.OBJECT,
  description: 'A structured menu for a restaurant including items, prices, and variations',
  properties: {
    restaurantName: { type: GeminiJsonResponseType.STRING },
    lastUpdated: { type: GeminiJsonResponseType.STRING },
    menus: {
      type: GeminiJsonResponseType.ARRAY,
      items: {
        type: GeminiJsonResponseType.OBJECT,
        properties: {
          menuName: { type: GeminiJsonResponseType.STRING },
          sections: {
            type: GeminiJsonResponseType.ARRAY,
            items: {
              type: GeminiJsonResponseType.OBJECT,
              properties: {
                sectionName: { type: GeminiJsonResponseType.STRING },
                items: {
                  type: GeminiJsonResponseType.ARRAY,
                  items: {
                    type: GeminiJsonResponseType.OBJECT,
                    properties: {
                      name: { type: GeminiJsonResponseType.STRING },
                      description: { type: GeminiJsonResponseType.STRING },
                      price: { type: GeminiJsonResponseType.NUMBER },
                      currency: { type: GeminiJsonResponseType.STRING },
                      variations: {
                        type: GeminiJsonResponseType.ARRAY,
                        items: {
                          type: GeminiJsonResponseType.OBJECT,
                          properties: {
                            name: { type: GeminiJsonResponseType.STRING },
                            priceAdj: { type: GeminiJsonResponseType.NUMBER },
                          },
                          required: ['name', 'priceAdj'],
                        },
                      },
                      imageUrl: { type: GeminiJsonResponseType.STRING, nullable: true },
                    },
                    required: ['name', 'price', 'currency'],
                  },
                },
              },
              required: ['sectionName', 'items'],
            },
          },
        },
        required: ['menuName', 'sections'],
      },
    },
  },
  required: ['restaurantName', 'menus'],
};

export const MenuResultSchema = z.object({
  restaurant_name: z.string(),
  last_updated: z.string(),
  menus: z.array(
    z.object({
      menu_name: z.string(),
      sections: z.array(
        z.object({
          section_name: z.string(),
          items: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
              price: z.number(),
              currency: z.string(),
              variations: z.array(
                z.object({
                  name: z.string(),
                  price_adj: z.number(),
                }),
              ),
              image_url: z.string().nullable(),
            }),
          ),
        }),
      ),
    }),
  ),
});

// A flattened schema to avoid Gemini's nesting depth limit (max 5 levels)
export const geminiMenuSchema = {
  type: GeminiJsonResponseType.OBJECT,
  description:
    'A list of menu items with their details, including menu and section names to allow reconstruction of the hierarchy.',
  properties: {
    restaurantName: { type: GeminiJsonResponseType.STRING },
    lastUpdated: { type: GeminiJsonResponseType.STRING },
    items: {
      type: GeminiJsonResponseType.ARRAY,
      items: {
        type: GeminiJsonResponseType.OBJECT,
        properties: {
          menuName: { type: GeminiJsonResponseType.STRING },
          sectionName: { type: GeminiJsonResponseType.STRING },
          name: { type: GeminiJsonResponseType.STRING },
          description: { type: GeminiJsonResponseType.STRING },
          price: { type: GeminiJsonResponseType.NUMBER },
          currency: { type: GeminiJsonResponseType.STRING },
          imageUrl: { type: GeminiJsonResponseType.STRING, nullable: true },
          variations: {
            type: GeminiJsonResponseType.ARRAY,
            items: {
              type: GeminiJsonResponseType.OBJECT,
              properties: {
                name: { type: GeminiJsonResponseType.STRING },
                priceAdj: { type: GeminiJsonResponseType.NUMBER },
              },
              required: ['name', 'priceAdj'],
            },
          },
        },
        required: ['menuName', 'sectionName', 'name', 'price', 'currency'],
      },
    },
  },
  required: ['restaurantName', 'items'],
};

export const FlatMenuResultSchema = z.object({
  restaurantName: z.string(),
  lastUpdated: z.string().optional(),
  items: z.array(
    z.object({
      menuName: z.string(),
      sectionName: z.string(),
      name: z.string(),
      description: z.string().optional().default(''),
      price: z.number(),
      currency: z.string(),
      imageUrl: z.string().nullable().optional(),
      variations: z
        .array(
          z.object({
            name: z.string(),
            priceAdj: z.number(),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
});
