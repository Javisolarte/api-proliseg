/**
 * Lightweight Template Engine for Handlebars-like syntax.
 * Supports: {{variable}}, {{#if var}}...{{else}}...{{/if}}, {{#each arr}}...{{/each}}
 */
export class TemplateEngine {

    /**
     * Render a template string with provided data.
     */
    static render(template: string, data: Record<string, any>): string {
        if (!template) return '';
        let html = template;

        // 1. Process {{#each array}} blocks
        html = TemplateEngine.processEachBlocks(html, data);

        // 2. Process {{#if variable}} blocks (supports {{else}})
        html = TemplateEngine.processIfBlocks(html, data);

        // 3. Replace all {{variable}} placeholders in one pass
        // This handles {{ var }} with whitespace and nested properties {{ user.name }}
        html = html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
            const value = TemplateEngine.getValueByPath(data, path);
            if (value === undefined || value === null) {
                // If it looks like a helper or is already processed, leave it
                if (path.startsWith('#') || path.startsWith('/') || path === 'else' || path === 'this') {
                    return match;
                }
                return ''; // Undefined variables become empty string
            }
            if (Array.isArray(value)) return match; // Arrays are for #each
            return String(value);
        });

        return html;
    }

    /**
     * Get value from object by path (desc.name)
     */
    private static getValueByPath(obj: any, path: string): any {
        if (!path) return undefined;
        try {
            return path.split('.').reduce((prev, curr) => {
                return (prev && prev[curr] !== undefined) ? prev[curr] : undefined;
            }, obj);
        } catch (e) {
            return undefined;
        }
    }

    /**
     * Process {{#each items}} ... {{this}} ... {{/each}} blocks
     */
    private static processEachBlocks(html: string, data: Record<string, any>): string {
        const eachRegex = /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/gi;

        return html.replace(eachRegex, (_, path: string, blockContent: string) => {
            const arr = TemplateEngine.getValueByPath(data, path);
            if (!Array.isArray(arr) || arr.length === 0) return '';

            return arr.map((item, index) => {
                let itemHtml = blockContent;
                
                // Replace {{this}} with the item itself
                itemHtml = itemHtml.replace(/\{\{\s*this\s*\}\}/gi, String(item ?? ''));
                // Replace {{@index}} with the current index
                itemHtml = itemHtml.replace(/\{\{\s*@index\s*\}\}/gi, String(index));

                // If item is an object, replace {{key}} with item.key
                if (typeof item === 'object' && item !== null) {
                    itemHtml = itemHtml.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
                        const val = TemplateEngine.getValueByPath(item, key);
                        return val !== undefined ? String(val) : match;
                    });
                }
                
                return itemHtml;
            }).join('');
        });
    }

    /**
     * Process {{#if variable}} ... {{else}} ... {{/if}} blocks
     */
    private static processIfBlocks(html: string, data: Record<string, any>): string {
        let result = html;
        let lastResult = '';
        let iterations = 0;
        const maxIterations = 50;

        while (result !== lastResult && iterations < maxIterations) {
            lastResult = result;
            iterations++;

            const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/gi;

            result = result.replace(ifRegex, (_, path: string, innerContent: string) => {
                const value = TemplateEngine.getValueByPath(data, path);
                const isTruthy = TemplateEngine.isTruthy(value);

                const elseParts = innerContent.split(/\{\{else\}\}/i);
                const trueBlock = elseParts[0] || '';
                const falseBlock = elseParts[1] || '';

                return isTruthy ? trueBlock : falseBlock;
            });
        }

        return result;
    }

    private static isTruthy(value: any): boolean {
        if (value === null || value === undefined || value === '' || value === false) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'number' && isNaN(value)) return false;
        return true;
    }
}
