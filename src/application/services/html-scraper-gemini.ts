import { GoogleGenAI } from '@google/genai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MenuData } from '../../shared/types';
import { logger } from '../../shared/logger';
import { promptFromClaudeCode, promptFromLyra } from './prompts/prompts';

const TIMEOUT_IN_MS = 300000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3-flash-preview';
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: TIMEOUT_IN_MS, headers: { 'Content-Type': 'application/json' } },
});

// Main scraping function
export const scrapeUrl = async (url: string): Promise<MenuData> => {
  // export const scrapeUrl = async (url: string): Promise<{ htmlContent: string }> => {
  try {
    logger.info('Scraping URL', { url });
    const html = await fetchHtml(url);
    logger.info('HTML fetched');
    const cleanedHtml = cleanHtml(html);
    logger.info('HTML cleaned', { isTruncated: cleanedHtml.includes('...[truncated]') });
    const menuData = await extractMenuWithGemini(cleanedHtml, url);
    logger.info('Menu data extracted', { menuData });
    return menuData;
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
const cleanHtml = (html: string): string => {
  const $ = cheerio.load(html);

  // Remove unnecessary elements
  $('style, noscript, svg, canvas').remove();

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
    ? bodyHtml.substring(0, maxLength - 14) + '...[truncated]'
    : bodyHtml;
};

// Extract menu data using Gemini API
const extractMenuWithGemini = async (html: string, url: string): Promise<MenuData> => {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY is missing');
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const prompt = buildPrompt(html, 2);

  try {
    const response = await ai.models
      .generateContent({
        model: GEMINI_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          maxOutputTokens: 8192,
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

    return parseGeminiResponse(generatedText, url);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Gemini API error: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
};

// Build prompt for Gemini
const buildPrompt = (html: string, version: number = 1): string => {
  if (version > 1) {
    return promptFromLyra(html);
  }
  return promptFromClaudeCode(html);
};

// Parse Gemini response
const parseGeminiResponse = (responseText: string, url: string): MenuData => {
  try {
    // Remove markdown code blocks if present
    const cleanedResponse = responseText
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');

    logger.info('parsing response to JSON', { cleanedResponse });

    try {
      const parsed = JSON.parse(cleanedResponse);
      logger.info('response parsed successfully to JSON', { parsed });

      // Validate basic structure
      if (!parsed.restaurant_name || !Array.isArray(parsed.sections)) {
        throw new Error('Invalid menu data structure from Gemini');
      }

      return parsed as MenuData;
    } catch (parseError) {
      logger.error('JSON parse failed', { error: parseError, cleanedResponse });
      throw parseError;
    }
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
    );
  }
};
