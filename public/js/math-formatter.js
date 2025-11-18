// Math Formatter Utility for AI Applications
export class MathFormatter {
    
    // Format equation as inline math (single $ delimiters)
    static inline(equation) {
        return `$${equation}$`;
    }
    
    // Format equation as display math (double $$ delimiters)
    static display(equation) {
        return `$$${equation}$$`;
    }
    
    // Enhanced math formatting with LaTeX-like syntax
    static formatMathExpression(text) {
        let formatted = text;
        
        // Handle fractions: \frac{a}{b} -> proper fraction display
        formatted = formatted.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, 
            '<span class="math-fraction"><span class="numerator">$1</span><span class="denominator">$2</span></span>');
        
        // Handle square roots: \sqrt{x} -> √x with overline
        formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, 
            '<span class="math-sqrt"><span class="radicand">$1</span></span>');
        
        // Handle superscripts: x^2 -> x²
        formatted = formatted.replace(/([a-zA-Z0-9])\^\{?([^}\s]+)\}?/g, '$1<sup>$2</sup>');
        
        // Handle subscripts: x_1 -> x₁
        formatted = formatted.replace(/([a-zA-Z0-9])_\{?([^}\s]+)\}?/g, '$1<sub>$2</sub>');
        
        // Handle common math symbols
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
    
    // Auto-detect and format math in text
    static formatText(text, displayMode = false) {
        const delimiter = displayMode ? '$$' : '$';
        return text.replace(/\b([a-zA-Z]\^?\d*\s*[+\-=]\s*[^.]*)\b/g, `${delimiter}$1${delimiter}`);
    }
}

// Usage Examples:
console.log('=== Math Formatter Examples ===');

// Pythagorean Theorem (inline)
const pythagorean = 'a^2 + b^2 = c^2';
console.log('Inline:', MathFormatter.inline(pythagorean));
// Output: $a^2 + b^2 = c^2$

// Quadratic Formula (display)
const quadratic = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
console.log('Display:', MathFormatter.display(quadratic));
// Output: $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

// Enhanced formatting examples
const fraction = '\\frac{1}{2}';
const sqrt = '\\sqrt{16}';
const power = 'x^{2n+1}';
const subscript = 'H_2O';

console.log('Fraction:', MathFormatter.formatMathExpression(fraction));
console.log('Square root:', MathFormatter.formatMathExpression(sqrt));
console.log('Power:', MathFormatter.formatMathExpression(power));
console.log('Subscript:', MathFormatter.formatMathExpression(subscript));

// Example usage in text
const exampleText = `The Pythagorean theorem states that ${MathFormatter.inline(pythagorean)} for right triangles.

The quadratic formula is:
${MathFormatter.display(quadratic)}`;

console.log('Formatted Text:', exampleText);