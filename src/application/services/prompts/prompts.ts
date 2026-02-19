const promptFromClaudeCode = (
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

const promptFromLyraV1 = (
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

const promptFromLyraV2 = (html: string) => `
Act as a Senior Data Engineer specializing in DOM parsing and unstructured web content extraction. Your task is to analyze a raw HTML page dump and transform it into a clean, structured JSON menu.

### THE SOURCE HTML:
${html}

### EXTRACTION LOGIC & HEURISTICS:

1. **Scope Filtering:** Ignore global site headers, footers, navigation links, and sidebar advertisements. Focus exclusively on the main content area where menus, menu items, prices, and categories are listed.
2. **Menus Identification:** A menu is defined by the presence of a name indicator most of the cases as title of a list below.
3. **Item Identification:** An item is defined by the presence of a name paired with a price or a "Market Price" indicator.
4. **Variation Detection (CRITICAL — read carefully):**
   You MUST scan each item's surrounding HTML for any of the following variation patterns and populate the \`variations\` array accordingly. An empty \`variations: []\` is only acceptable when NONE of the patterns below exist for that item.
   **4a. Size-based variations** — triggered by keywords like: Small, Medium, Large, Regular, Half, Full, Mini, Personal, Family, XL, Sm, Md, Lg, or when multiple prices appear for the same item.
   - Rule: The item's \`price\` field should be set to the LOWEST/base price. Each size becomes a variation.
   - \`price_adj\` = that size's absolute price (NOT a delta). Use 0 if no price found.
   - Example output:
     \`\`\`json
     { "name": "Pizza", "price": 10.00, "variations": [
       { "name": "Small", "price_adj": 10.00 },
       { "name": "Medium", "price_adj": 14.00 },
       { "name": "Large", "price_adj": 18.00 }
     ]}
     \`\`\`
   **4b. Add-on variations** — triggered by phrases like: "Add", "Extra", "+$", "add-on", "supplement", "optional", or items listed after a "+" symbol with a price.
   - \`price_adj\` = the additional cost as a positive number.
   - Example output:
     \`\`\`json
     { "name": "Burger", "price": 12.00, "variations": [
       { "name": "Add Avocado", "price_adj": 2.00 },
       { "name": "Add Bacon", "price_adj": 1.50 }
     ]}
     \`\`\`
   **4c. Choice-based variations** — triggered by phrases like: "Choice of", "Choose", "Select", "Served with", "Option", "or" (between two items), radio buttons, dropdowns, or modifier groups in the HTML structure.
   - If choices have no price difference: \`price_adj\` = 0.
   - If choices have different prices: use the price delta.
   - Example output:
     \`\`\`json
     { "name": "Eggs Benedict", "price": 14.00, "variations": [
       { "name": "Choice: Canadian Bacon", "price_adj": 0 },
       { "name": "Choice: Smoked Salmon", "price_adj": 2.00 },
       { "name": "Choice: Spinach (V)", "price_adj": 0 }
     ]}
     \`\`\`
   **4d. HTML structural signals to look for:**
   - Nested lists (\`<ul>\`, \`<li>\`) inside an item container
   - Elements with classes containing: "modifier", "option", "variant", "addon", "add-on", "customization", "size", "choice", "upsell", "extra"
   - Tables with multiple price columns
   - \`data-\` attributes like \`data-price\`, \`data-modifier\`, \`data-option\`
   - Repeated price patterns within the same item block (e.g., \`$10 / $14 / $18\`)
5. **Data Sanitization:**
   - **Price:** Convert all currency strings to numbers (e.g., "$12.99" becomes 12.99). If no price is found, use 0.
   - **Currency:** Default to "USD" unless another ISO code is explicitly detected in the HTML.
   - **Images:** Look for \`<img>\` tags or \`style="background-image:..."\` within the item container. Capture the absolute URL.
   - **Description:** Strip HTML tags, collapse whitespace. Exclude variation/modifier text from the description field — those belong in \`variations\`.
6. **Timestamp:** Set "last_updated" to "${new Date().toISOString()}".

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

const promptFromLyraV3 = (html: string) => `
Act as a Senior Data Engineer specializing in DOM parsing and unstructured web content extraction. Your task is to analyze a raw HTML page dump and transform it into a clean, structured JSON menu.

### THE SOURCE HTML:
${html}

### EXTRACTION LOGIC & HEURISTICS:

1. **Scope Filtering:** Ignore global site headers, footers, navigation links, and sidebar advertisements. Focus exclusively on the main content area where menu items, prices, and categories are listed.
2. **Menus Identification:** A menu is defined by the presence of a name indicator most of the cases as title of a list below.
3. **Item Identification:** An item is defined by the presence of a name paired with a price or a "Market Price" indicator.
4. **Variation Detection (CRITICAL — read carefully):**
   You MUST scan each item's surrounding HTML for any of the following variation patterns and populate the \`variations\` array accordingly. An empty \`variations: []\` is only acceptable when NONE of the patterns below exist for that item.
   **4a. Size-based variations** — triggered by keywords like: Small, Medium, Large, Regular, Half, Full, Mini, Personal, Family, XL, Sm, Md, Lg, 1/2, Pound, Kg or when multiple prices appear for the same item.
   - Rule: The item's \`price\` field should be set to the LOWEST/base price. Each size becomes a variation.
   - \`price_adj\` = that size's absolute price (NOT a delta). Use 0 if no price found.
   - Example output:
     \`\`\`json
     { "name": "Pizza", "price": 10.00, "variations": [
       { "name": "Small", "price_adj": 10.00 },
       { "name": "Medium", "price_adj": 14.00 },
       { "name": "Large", "price_adj": 18.00 }
     ]}
     \`\`\`
   **4b. Add-on variations** — triggered by phrases like: "Add", "Extra", "+$", "add-on", "supplement", "optional", or items listed after a "+" symbol with a price.
   - \`price_adj\` = the additional cost as a positive number.
   - Example output:
     \`\`\`json
     { "name": "Burger", "price": 12.00, "variations": [
       { "name": "Add Avocado", "price_adj": 2.00 },
       { "name": "Add Bacon", "price_adj": 1.50 }
     ]}
     \`\`\`
   **4c. Choice-based variations** — triggered by phrases like: "Choice of", "Choose", "Select", "Served with", "Option", "or" (between two items), radio buttons, dropdowns, or modifier groups in the HTML structure.
   - If choices have no price difference: \`price_adj\` = 0.
   - If choices have different prices: use the price delta.
   - Example output:
     \`\`\`json
     { "name": "Eggs Benedict", "price": 14.00, "variations": [
       { "name": "Choice: Canadian Bacon", "price_adj": 0 },
       { "name": "Choice: Smoked Salmon", "price_adj": 2.00 },
       { "name": "Choice: Spinach (V)", "price_adj": 0 }
     ]}
     \`\`\`
   **4d. HTML structural signals to look for:**
   - Nested lists (\`<ul>\`, \`<li>\`) inside an item container
   - Elements with classes containing: "modifier", "option", "variant", "addon", "add-on", "customization", "size", "choice", "upsell", "extra"
   - Tables with multiple price columns
   - \`data-\` attributes like \`data-price\`, \`data-modifier\`, \`data-option\`
   - Repeated price patterns within the same item block (e.g., \`$10 / $14 / $18\`)
5. **Data Sanitization:**
   - **Price:** Convert all currency strings to numbers (e.g., "$12.99" becomes 12.99). If no price is found, use 0.
   - **Currency:** Default to "USD" unless another ISO code is explicitly detected in the HTML.
   - **Images:** Look for \`<img>\` tags or \`style="background-image:..."\` within the item container. Capture the absolute URL.
   - **Description:** Strip HTML tags, collapse whitespace. Exclude variation/modifier text from the description field — those belong in \`variations\`.
6. **Timestamp:** Set "last_updated" to "${new Date().toISOString()}".

### OUTPUT RESTRICTIONS:
- Return ONLY the raw JSON object.
- Do NOT wrap the response in Markdown code blocks (no \`\`\`json).
- Do NOT include any introductory text, apologies, or explanations.
- If no menu is detected, return: {"restaurant_name": "Not Found", "menus": []}

### TARGET JSON SCHEMA:
{
  "restaurant_name": "string",
  "last_updated": "string",
  "menus": [
    {
      "menu_name": "string", 
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
    }
  ]
}`;
const promptFromLyraV4 = (html: string) => `
Act as a Senior Data Engineer specializing in DOM parsing and unstructured web content extraction. Your task is to analyze a raw HTML page dump and transform it into a clean, structured JSON menu.

### THE SOURCE HTML:
${html}

### EXTRACTION LOGIC & HEURISTICS:

1. **Scope Filtering:** Ignore global site headers, footers, navigation links, and sidebar advertisements. Focus exclusively on the main content area where menu items, prices, and categories are listed.
2. **ld JSON Identification:** A ld+json script tag with type "application/ld+json" may contain restaurant name and menu data. Extract this data first if present.
3. **Menus Identification:** A menu is defined by the presence of a name indicator most of the cases as title of a list below.
4. **Item Identification:** An item is defined by the presence of a name paired with a price or a "Market Price" indicator.
5. **Variation Detection (CRITICAL — read carefully):**
   You MUST scan each item's surrounding HTML for any of the following variation patterns and populate the \`variations\` array accordingly. An empty \`variations: []\` is only acceptable when NONE of the patterns below exist for that item.
   **5a. Size-based variations** — triggered by keywords like: Small, Medium, Large, Regular, Half, Full, Mini, Personal, Family, XL, Sm, Md, Lg, 1/2, Pound, Kg or when multiple prices appear for the same item.
   - Rule: The item's \`price\` field should be set to the LOWEST/base price. Each size becomes a variation.
   - \`price_adj\` = that size's absolute price (NOT a delta). Use 0 if no price found.
   - Example output:
     \`\`\`json
     { "name": "Pizza", "price": 10.00, "variations": [
       { "name": "Small", "price_adj": 10.00 },
       { "name": "Medium", "price_adj": 14.00 },
       { "name": "Large", "price_adj": 18.00 }
     ]}
     \`\`\`
   **5b. Add-on variations** — triggered by phrases like: "Add", "Extra", "+$", "add-on", "supplement", "optional", or items listed after a "+" symbol with a price.
   - \`price_adj\` = the additional cost as a positive number.
   - Example output:
     \`\`\`json
     { "name": "Burger", "price": 12.00, "variations": [
       { "name": "Add Avocado", "price_adj": 2.00 },
       { "name": "Add Bacon", "price_adj": 1.50 }
     ]}
     \`\`\`
   **5c. Choice-based variations** — triggered by phrases like: "Choice of", "Choose", "Select", "Served with", "Option", "or" (between two items), radio buttons, dropdowns, or modifier groups in the HTML structure.
   - If choices have no price difference: \`price_adj\` = 0.
   - If choices have different prices: use the price delta.
   - Example output:
     \`\`\`json
     { "name": "Eggs Benedict", "price": 14.00, "variations": [
       { "name": "Choice: Canadian Bacon", "price_adj": 0 },
       { "name": "Choice: Smoked Salmon", "price_adj": 2.00 },
       { "name": "Choice: Spinach (V)", "price_adj": 0 }
     ]}
     \`\`\`
   **5d. HTML structural signals to look for:**
   - Nested lists (\`<ul>\`, \`<li>\`) inside an item container
   - Elements with classes containing: "modifier", "option", "variant", "addon", "add-on", "customization", "size", "choice", "upsell", "extra"
   - Tables with multiple price columns
   - \`data-\` attributes like \`data-price\`, \`data-modifier\`, \`data-option\`
   - Repeated price patterns within the same item block (e.g., \`$10 / $14 / $18\`)
6. **Data Sanitization:**
   - **Price:** Convert all currency strings to numbers (e.g., "$12.99" becomes 12.99). If no price is found, use 0.
   - **Currency:** Default to "USD" unless another ISO code is explicitly detected in the HTML.
   - **Images:** Look for \`<img>\` tags or \`style="background-image:..."\` within the item container. Capture the absolute URL.
   - **Description:** Strip HTML tags, collapse whitespace. Exclude variation/modifier text from the description field — those belong in \`variations\`.
7. **Timestamp:** Set "last_updated" to "${new Date().toISOString()}".

### OUTPUT RESTRICTIONS:
- Return ONLY the raw JSON object.
- Do NOT wrap the response in Markdown code blocks (no \`\`\`json).
- Do NOT include any introductory text, apologies, or explanations.
- If no menu is detected, return: {"restaurant_name": "Not Found", "menus": []}

### TARGET JSON SCHEMA:
{
  "restaurant_name": "string",
  "last_updated": "string",
  "menus": [
    {
      "menu_name": "string", 
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
    }
  ]
}`;

export default promptFromLyraV4;
