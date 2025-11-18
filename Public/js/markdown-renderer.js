// Markdown Renderer Module
export class MarkdownRenderer {
    constructor() {
        this.initializeMarked();
    }

    initializeMarked() {
        if (typeof marked !== 'undefined') {
            // Configure marked options
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: false,
                mangle: false
            });
        }
    }

    render(markdownText) {
        if (!markdownText) return '';
        
        try {
            // Convert markdown to HTML
            const rawHtml = marked.parse(markdownText);
            
            // Sanitize HTML to prevent XSS
            const cleanHtml = DOMPurify.sanitize(rawHtml, {
                ALLOWED_TAGS: [
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'p', 'br', 'strong', 'em', 'u', 's', 'del',
                    'ul', 'ol', 'li',
                    'blockquote',
                    'code', 'pre',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'a', 'img',
                    'hr',
                    'input'
                ],
                ALLOWED_ATTR: [
                    'href', 'src', 'alt', 'title',
                    'type', 'checked', 'disabled'
                ]
            });
            
            return cleanHtml;
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return this.escapeHtml(markdownText);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Render markdown and apply to element
    renderToElement(element, markdownText) {
        if (!element) return;
        
        const html = this.render(markdownText);
        element.innerHTML = html;
        
        // Add markdown-content class for styling
        element.classList.add('markdown-content');
        
        // Process checkboxes
        this.processCheckboxes(element);
    }

    processCheckboxes(element) {
        // Convert markdown checkboxes to interactive ones
        const checkboxes = element.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                // Prevent modification in read-only contexts
                e.preventDefault();
                checkbox.checked = !checkbox.checked;
            });
        });
    }
}

// Global markdown renderer instance
export const markdownRenderer = new MarkdownRenderer();