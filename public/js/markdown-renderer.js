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
            // Decode HTML entities first
            let decodedText = this.decodeHtmlEntities(markdownText);
            
            // Process math expressions before markdown
            decodedText = this.formatMathExpressions(decodedText);
            
            // Convert markdown to HTML
            const rawHtml = marked.parse(decodedText);
            
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
                    'input', 'span', 'div', 'sup', 'sub'
                ],
                ALLOWED_ATTR: [
                    'href', 'src', 'alt', 'title',
                    'type', 'checked', 'disabled', 'class'
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

    decodeHtmlEntities(text) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    // Format math expressions for better display
    formatMathExpressions(text) {
        // Import MathFormatter if available
        let processedText = text;
        
        // Replace display math $$...$$ first
        processedText = processedText.replace(/\$\$([^$]+?)\$\$/g, (match, content) => {
            const formatted = this.formatMathContent(content.trim());
            return `<div class="math-display">${formatted}</div>`;
        });
        
        // Replace inline math $...$ with styled spans (avoid double $$)
        processedText = processedText.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (match, content) => {
            const formatted = this.formatMathContent(content.trim());
            return `<span class="math-inline">${formatted}</span>`;
        });
        
        return processedText;
    }
    
    // Enhanced math content formatting
    formatMathContent(content) {
        let formatted = content;
        
        // Handle fractions: \frac{a}{b}
        formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, 
            '<span class="math-fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>');
        
        // Handle square roots: \sqrt{x}
        formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, 
            '<span class="math-sqrt"><span class="radicand">$1</span></span>');
        
        // Handle superscripts: x^2 or x^{2n+1}
        formatted = formatted.replace(/([a-zA-Z0-9\)])\^\{([^}]+)\}/g, '$1<sup>$2</sup>');
        formatted = formatted.replace(/([a-zA-Z0-9\)])\^([a-zA-Z0-9])/g, '$1<sup>$2</sup>');
        
        // Handle subscripts: x_1 or x_{n+1} or \lim_{x \to 0}
        formatted = formatted.replace(/(\\?[a-zA-Z]+|[a-zA-Z0-9])_\{([^}]+)\}/g, '$1<sub>$2</sub>');
        formatted = formatted.replace(/([a-zA-Z0-9])_([a-zA-Z0-9])/g, '$1<sub>$2</sub>');
        
        // Handle LaTeX formatting commands
        formatted = formatted.replace(/\\mathbf\{([^}]+)\}/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\\mathit\{([^}]+)\}/g, '<em>$1</em>');
        formatted = formatted.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
        
        // Handle common math symbols
        formatted = formatted.replace(/\\lim/g, 'lim');
        formatted = formatted.replace(/\\to/g, '→');
        formatted = formatted.replace(/\\rightarrow/g, '→');
        formatted = formatted.replace(/\\leftarrow/g, '←');
        formatted = formatted.replace(/\\pm/g, '±');
        formatted = formatted.replace(/\\mp/g, '∓');
        formatted = formatted.replace(/\\times/g, '×');
        formatted = formatted.replace(/\\div/g, '÷');
        formatted = formatted.replace(/\\cdot/g, '·');
        formatted = formatted.replace(/\\neq/g, '≠');
        formatted = formatted.replace(/\\leq/g, '≤');
        formatted = formatted.replace(/\\geq/g, '≥');
        formatted = formatted.replace(/\\approx/g, '≈');
        formatted = formatted.replace(/\\infty/g, '∞');
        formatted = formatted.replace(/\\pi/g, 'π');
        formatted = formatted.replace(/\\theta/g, 'θ');
        formatted = formatted.replace(/\\alpha/g, 'α');
        formatted = formatted.replace(/\\beta/g, 'β');
        formatted = formatted.replace(/\\gamma/g, 'γ');
        formatted = formatted.replace(/\\delta/g, 'δ');
        formatted = formatted.replace(/\\sum/g, '∑');
        formatted = formatted.replace(/\\int/g, '∫');
        
        return formatted;
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