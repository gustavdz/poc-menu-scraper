export const promptFromClaudeCode = (
  html: string,
) => `You are a menu extraction expert. Analyze the following HTML and extract restaurant menu data.

**HTML Content:**
${JSON.stringify(html)}

**Instructions:**
1. Identify the restaurant name
2. Extract all menu sections (e.g., "Appetizers", "Entrees", "Desserts")
3. For each item, extract: name, description, price (as number), currency
4. If an item has variations/sizes (e.g., "Small/Large"), include them in variations array
5. Look for image URLs if available

**Output ONLY valid JSON matching this exact schema (no markdown, no explanation):**
{
  "restaurant_name": "string",
  "last_updated": "${new Date().toISOString()}",
  "sections": [
    {
      "section_name": "string",
      "items": [
        {
          "name": "string",
          "description": "string",
          "price": 0.00,
          "currency": "USD",
          "variations": [{"name": "string", "price_adj": 0.00}],
          "image_url": "string or null"
        }
      ]
    }
  ]
}

**Important:**
- Return ONLY the JSON object, no markdown code blocks
- Use 0 for price if not found
- Use empty string for description if not found
- Currency defaults to "USD"
- If no clear menu found, return minimal structure with empty sections array`;

export const promptFromLyra = (
  html: string,
) => `Act as a Senior Data Engineer specializing in DOM parsing and unstructured web content extraction. Your task is to analyze a raw HTML page dump and transform it into a clean, structured JSON menu.

### THE SOURCE HTML:
${html}

### EXTRACTION LOGIC & HEURISTICS:
1. **Scope Filtering:** Ignore global site headers, footers, navigation links, and sidebar advertisements. Focus exclusively on the main content area where menu items, prices, and categories are listed.
2. **Item Identification:** An item is defined by the presence of a name paired with a price or a "Market Price" indicator.
3. **Add-on & Variation Logic:** - If an item lists sizes (e.g., Small/Large), treat these as objects in the \`variations\` array.
   - If an item lists optional add-ons (e.g., "Add Avocado +$2.00"), treat these as \`variations\` where \`name\` is the add-on and \`price_adj\` is the additional cost.
4. **Data Sanitization:**
   - **Price:** Convert all currency strings to numbers (e.g., "$12.99" becomes 12.99). If no price is found, use 0.
   - **Currency:** Default to "USD" unless another ISO code is explicitly detected in the HTML.
   - **Images:** Look for \`<img>\` tags or \`style="background-image:..."\` within the item container. Capture the absolute URL.
5. **Timestamp:** Set "last_updated" to "${new Date().toISOString()}".

### OUTPUT RESTRICTIONS:
- Return ONLY the raw JSON object. 
- Do NOT wrap the response in Markdown code blocks (no \`\`\`json).
- Do NOT include any introductory text, apologies, or explanations.
- If no menu is detected, return: {"restaurant_name": "Not Found", "sections": []}

### TARGET JSON SCHEMA:
{
  "restaurant_name": "string",
  "last_updated": "string",
  "sections": [
    {
      "section_name": "string",
      "items": [
        {
          "name": "string",
          "description": "string",
          "price": 0.00,
          "currency": "USD",
          "variations": [
            {
              "name": "string",
              "price_adj": 0.00
            }
          ],
          "image_url": "string or null"
        }
      ]
    }
  ]
}`;
