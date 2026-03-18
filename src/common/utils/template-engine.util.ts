/**
 * Lightweight Template Engine for Handlebars-like syntax.
 * Supports: {{variable}}, {{#if var}}...{{else}}...{{/if}}, {{#each arr}}...{{/each}}
 */
export class TemplateEngine {

    /**
     * Render a template string with provided data.
     */
    static render(template: string, data: Record<string, any>): string {
        let html = template;

        // 1. Process {{#each array}} blocks
        html = TemplateEngine.processEachBlocks(html, data);

        // 2. Process {{#if variable}} blocks (supports {{else}})
        html = TemplateEngine.processIfBlocks(html, data);

        // 3. Replace simple {{variable}} placeholders
        html = TemplateEngine.replaceVariables(html, data);

        // 4. Clean up any remaining unresolved placeholders
        html = html.replace(/\{\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\}\}/g, '');

        return html;
    }

    /**
     * Process {{#each items}} ... {{this}} ... {{/each}} blocks
     */
    private static processEachBlocks(html: string, data: Record<string, any>): string {
        const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/gi;

        return html.replace(eachRegex, (_, arrayName: string, blockContent: string) => {
            const arr = data[arrayName.trim()];
            if (!Array.isArray(arr) || arr.length === 0) return '';

            return arr.map((item, index) => {
                let itemHtml = blockContent;
                if (typeof item === 'object' && item !== null) {
                    // If item is an object, replace {{key}} with item.key
                    for (const [key, value] of Object.entries(item)) {
                        itemHtml = itemHtml.replace(
                            new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'),
                            String(value ?? '')
                        );
                    }
                }
                // Replace {{this}} with the item itself (for string arrays)
                itemHtml = itemHtml.replace(/\{\{\s*this\s*\}\}/gi, String(item ?? ''));
                // Replace {{@index}} with the current index
                itemHtml = itemHtml.replace(/\{\{\s*@index\s*\}\}/gi, String(index));
                return itemHtml;
            }).join('');
        });
    }

    /**
     * Process {{#if variable}} ... {{else}} ... {{/if}} blocks (supports nesting)
     */
    private static processIfBlocks(html: string, data: Record<string, any>): string {
        // Process from innermost to outermost to handle nesting
        let result = html;
        let lastResult = '';
        let iterations = 0;
        const maxIterations = 50; // Safety limit

        while (result !== lastResult && iterations < maxIterations) {
            lastResult = result;
            iterations++;

            // Match the innermost {{#if}} block (no nested {{#if}} inside)
            const ifRegex = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/gi;

            result = result.replace(ifRegex, (_, varName: string, innerContent: string) => {
                const value = data[varName.trim()];
                const isTruthy = TemplateEngine.isTruthy(value);

                // Check for {{else}} block
                const elseParts = innerContent.split(/\{\{else\}\}/i);
                const trueBlock = elseParts[0] || '';
                const falseBlock = elseParts[1] || '';

                return isTruthy ? trueBlock : falseBlock;
            });
        }

        return result;
    }

    /**
     * Replace simple {{variable}} placeholders
     */
    private static replaceVariables(html: string, data: Record<string, any>): string {
        let result = html;
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) continue; // Skip arrays, handled by #each
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
            result = result.replace(regex, String(value ?? ''));
        }
        return result;
    }

    /**
     * Check if a value is "truthy" for template conditions
     */
    private static isTruthy(value: any): boolean {
        if (value === null || value === undefined || value === '' || value === false) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
    }
}
