import z from 'zod';
import { NpmLogLevelSchema, ScrapeRequestSchema } from './schemas';

export interface MenuVariation {
  name: string;
  price_adj: number;
}

export interface MenuItem {
  name: string;
  description: string;
  price: number;
  currency: string;
  variations: MenuVariation[];
  image_url: string | null;
}

export interface MenuSection {
  section_name: string;
  items: MenuItem[];
}

export interface MenuData {
  restaurant_name: string;
  last_updated: string;
  sections: MenuSection[];
}

export interface ScrapeResult {
  url: string;
  success: boolean;
  data?: MenuData;
  error?: string;
}

export interface ScrapeResponse {
  results: ScrapeResult[];
}

export type NpmLogLevel = z.infer<typeof NpmLogLevelSchema>;
export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;
