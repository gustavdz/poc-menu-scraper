import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MenuResult, MenuItem } from '../../shared/types';
import { logger } from '../../shared/logger';
import prompt from './prompts/prompts';
import { geminiMenuSchema, FlatMenuResultSchema } from '../../shared/schemas';
import z from 'zod';

const TIMEOUT_IN_MS = 300000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
// const GEMINI_MODEL = 'gemini-3-flash-preview';
// const GEMINI_MODEL = 'gemini-2.5-flash-lite';

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: TIMEOUT_IN_MS, headers: { 'Content-Type': 'application/json' } },
});

// Main scraping function
export const scrapeUrl = async (
  url: string,
): Promise<{
  menuScrapeResult: MenuResult;
  htmlContent: string | object;
  url: string;
  isTruncated: boolean;
}> => {
  try {
    logger.info('Scraping URL', { url });
    const html = await fetchHtml(url);
    logger.info('HTML fetched');
    const cleanedHtml = cleanHtml(html);
    const isTruncated =
      cleanedHtml.type === 'string' && cleanedHtml.content.includes('...[truncated]')
        ? true
        : false;

    logger.info('HTML cleaned', { isTruncated, cleanedHtml });
    const menuScrapeResult = await extractMenuWithGemini(cleanedHtml.content);

    return {
      menuScrapeResult,
      url,
      isTruncated,
      htmlContent: cleanedHtml.content,
    };
  } catch (error) {
    throw error;
  }
};

// Fetch HTML from URL
const fetchHtml = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)',
      },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// Clean HTML - remove scripts, styles, and unnecessary tags
const cleanHtml = (
  html: string,
): { type: 'string'; content: string } | { type: 'ld+json'; content: any } => {
  const $ = cheerio.load(html);

  // Remove unnecessary elements
  $('style, noscript, svg, canvas').remove();

  // Get all the ldJson scripts data if there is any
  const ldJson = $('script[type="application/ld+json"]').each((_, el) => {
    const ldJsonElement = $(el).html();
    if (ldJsonElement) {
      const ldJsonFormatted = JSON.parse(ldJsonElement);
      if (ldJsonFormatted['@type'] === 'Menu') {
        return true;
      }
    }
  });
  const ldJsonContent = ldJson.html();
  if (!ldJsonContent) {
    logger.warn('No ldJson found');
  } else {
    const JSONldJsonContent = JSON.parse(ldJsonContent);
    logger.info('ldJson found', { ldJson: JSONldJsonContent });
    return { type: 'ld+json', content: JSONldJsonContent };
  }

  // Remove comments
  $('*')
    .contents()
    .each(function () {
      if (this.type === 'comment') {
        $(this).remove();
      }
    });

  // Get text content with basic structure preserved
  const bodyHtml = $('body').html() || '';

  // Limit size (Gemini has token limits)
  const maxLength = 30000; // ~7500 tokens
  return bodyHtml.length > maxLength
    ? { type: 'string', content: bodyHtml.substring(0, maxLength - 14) + '...[truncated]' }
    : { type: 'string', content: bodyHtml };
};

// Extract menu data using Gemini API
const extractMenuWithGemini = async (html: string): Promise<MenuResult> => {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing');
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const prompt = buildPrompt(html);

  try {
    const { name: modelName } = await ai.models.get({ model: GEMINI_MODEL });
    if (!modelName) {
      const errorMessage = `Model not found`;
      logger.error(errorMessage, { model: GEMINI_MODEL });
      throw new Error(errorMessage);
    }
    const { totalTokens } = await ai.models.countTokens({ model: modelName, contents: prompt });
    const responseJsonSchema = z.toJSONSchema(FlatMenuResultSchema);

    logger.info('Generating content with AI', {
      totalInputTokens: totalTokens,
      responseJsonSchema: responseJsonSchema.properties,
      geminiMenuSchema,
    });

    const response = await ai.models
      .generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          // thinkingConfig: {
          //   thinkingLevel: ThinkingLevel.LOW,
          // },
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 16384, // 8192 or 16384
          responseMimeType: 'application/json',
          responseJsonSchema: geminiMenuSchema,
          systemInstruction:
            'Act as a Senior Data Engineer specializing in DOM parsing and unstructured web content extraction. Your task is to analyze a raw HTML page dump and transform it into a clean, structured JSON menu.',
        },
      })
      .catch((error) => {
        logger.error('Gemini API error', { error });
        throw error;
      });

    logger.info('Gemini API response', { response });
    const generatedText = response.text;

    if (!generatedText) {
      throw new Error('No response from Gemini API');
    }

    return parseGeminiResponse(generatedText);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Gemini API error: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
};

// Build prompt for Gemini
const buildPrompt = (html: string): string => {
  return prompt(html);
};

// Parse Gemini response
const parseGeminiResponse = (responseText: string): MenuResult => {
  try {
    // Parse using the flat schema first
    const flatMenuParsed = FlatMenuResultSchema.safeParse(JSON.parse(responseText));

    if (!flatMenuParsed.success) {
      logger.error('Zod validation failed for FlatMenuResultSchema', {
        error: flatMenuParsed.error,
      });
      throw flatMenuParsed.error;
    }

    const flatData = flatMenuParsed.data;

    // Transform flat data to nested MenuResult structure
    const menusMap = flatData.items.reduce((acc, item) => {
      const menuItem: MenuItem = {
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        image_url: item.imageUrl ?? null,
        variations: item.variations.map((v) => ({ name: v.name, price_adj: v.priceAdj })),
      };

      const sectionsMap = acc.get(item.menuName) ?? new Map<string, MenuItem[]>();
      const currentItems = sectionsMap.get(item.sectionName) ?? [];

      sectionsMap.set(item.sectionName, [...currentItems, menuItem]);
      acc.set(item.menuName, sectionsMap);

      return acc;
    }, new Map<string, Map<string, MenuItem[]>>());

    const menus = Array.from(menusMap.entries()).map(([menuName, sectionsMap]) => ({
      menu_name: menuName,
      sections: Array.from(sectionsMap.entries()).map(([sectionName, items]) => ({
        section_name: sectionName,
        items,
      })),
    }));

    const result: MenuResult = {
      restaurant_name: flatData.restaurantName,
      last_updated: flatData.lastUpdated || new Date().toISOString(),
      menus: menus,
    };

    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
    );
  }
};
