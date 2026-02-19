import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MenuData } from '../../shared/types';
import { logger } from '../../shared/logger';
import prompt from './prompts/prompts';

const TIMEOUT_IN_MS = 300000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL = 'gemini-3-flash-preview';
// const GEMINI_MODEL = 'gemini-2.5-flash-lite';
// const GEMINI_MODEL = 'gemini-3-pro-preview';

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: TIMEOUT_IN_MS, headers: { 'Content-Type': 'application/json' } },
});

// Main scraping function
export const scrapeUrl = async (
  url: string,
): Promise<{
  menuData: MenuData;
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
    const menuData = await extractMenuWithGemini(cleanedHtml.content, url);
    logger.info('Menu data extracted', { menuData: [] });
    return {
      // menuData: {
      //   restaurant_name: 'Not Found',
      //   last_updated: new Date().toISOString(),
      //   menus: [{ menu_name: 'Not Found', sections: [] }],
      // },
      menuData,
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
  const ldJson = $('script[type="application/ld+json"]').html();
  if (ldJson) {
    logger.info('ldJson found', { ldJson });
  } else {
    logger.warn('No ldJson found');
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
  return ldJson
    ? { type: 'ld+json', content: JSON.parse(ldJson) }
    : bodyHtml.length > maxLength
      ? { type: 'string', content: bodyHtml.substring(0, maxLength - 14) + '...[truncated]' }
      : { type: 'string', content: bodyHtml };
};

// Extract menu data using Gemini API
const extractMenuWithGemini = async (html: string, url: string): Promise<MenuData> => {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing');
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const prompt = buildPrompt(html);

  try {
    const response = await ai.models
      .generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
      })
      .catch((error) => {
        logger.error('Gemini API error', { error });
        throw error;
      });

    logger.info('Gemini API response', { response });
    const generatedText = response?.candidates?.[0]?.content?.parts?.[0]?.text;

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
const parseGeminiResponse = (responseText: string): MenuData => {
  try {
    // Remove markdown code blocks if present
    const cleanedResponse = responseText
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');

    logger.info('parsing response to JSON', { cleanedResponse });

    const parsed = JSON.parse(cleanedResponse);
    logger.info('response parsed successfully to JSON', { parsed });

    // Validate basic structure
    if (!parsed.restaurant_name || !Array.isArray(parsed.menus)) {
      throw new Error('Invalid menu data structure from Gemini');
    }

    return parsed as MenuData;
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
    );
  }
};
