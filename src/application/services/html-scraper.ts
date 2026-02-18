import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { MenuData, MenuSection, MenuItem } from '../../shared/types.ts';

// Core scraping function
export const scrapeUrl = async (url: string): Promise<MenuData> => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    return {
      restaurant_name: extractRestaurantName($),
      last_updated: new Date().toISOString(),
      sections: extractSections($),
    };
  } catch (error) {
    throw new Error(
      `Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// Restaurant name extraction
const extractRestaurantName = ($: cheerio.CheerioAPI): string => {
  const h1Text = $('h1').first().text().trim();
  const titleText = $('title').text().split('|')[0].trim();

  return h1Text || titleText || 'Unknown Restaurant';
};

// Section extraction
const extractSections = ($: cheerio.CheerioAPI): MenuSection[] => {
  const sections: MenuSection[] = [];

  $('section, .menu-section').each((_, section) => {
    const $section = $(section);
    const sectionName = extractSectionName($section);
    const items = extractItems($section);

    if (sectionName && items.length > 0) {
      sections.push({ section_name: sectionName, items });
    }
  });

  return sections;
};

// Extract section name
const extractSectionName = ($section: cheerio.Cheerio<AnyNode>): string => {
  return $section.find('h2, h3, .section-title').first().text().trim();
};

// Extract menu items from a section
const extractItems = ($section: cheerio.Cheerio<AnyNode>): MenuItem[] => {
  const items: MenuItem[] = [];

  $section.find('.menu-item, .item').each((_, item) => {
    const menuItem = extractMenuItem(cheerio.load(item)(item));

    if (menuItem) {
      items.push(menuItem);
    }
  });

  return items;
};

// Extract a single menu item
const extractMenuItem = ($item: cheerio.Cheerio<AnyNode>): MenuItem | null => {
  const name = $item.find('.item-name, h4').first().text().trim();
  const description = $item.find('.item-description, p').first().text().trim();
  const priceText = $item.find('.price, .item-price').first().text().trim();
  const price = parsePrice(priceText);

  if (!name || price <= 0) {
    return null;
  }

  return {
    name,
    description,
    price,
    currency: 'USD',
    variations: [],
    image_url: null,
  };
};

// Price parsing utility
const parsePrice = (priceText: string): number => {
  const match = priceText.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
};
