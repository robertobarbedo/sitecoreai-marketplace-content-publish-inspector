# Blok Typography System

This project uses the [Blok Design System](https://blok.sitecore.com/theming/typography) typography standards.

## Font Families

We use system font stacks that inherit from the user's operating system:

- **Heading**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
- **Body**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`
- **Mono**: `SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`

## Font Weights

| Weight   | Value | Usage                    |
|----------|-------|--------------------------|
| normal   | 400   | Body text, paragraphs    |
| medium   | 500   | Emphasized text          |
| semibold | 600   | Headings, strong emphasis|

## Font Sizes

| Token | Rem      | Pixels | Usage Example              |
|-------|----------|--------|----------------------------|
| 3xs   | 0.625rem | 10px   | Tiny labels, metadata      |
| 2xs   | 0.6875rem| 11px   | Small metadata             |
| xs    | 0.75rem  | 12px   | Captions, helper text      |
| sm    | 0.8125rem| 13px   | Secondary text             |
| base  | 0.875rem | 14px   | Default body text          |
| md    | 0.875rem | 14px   | Default body text          |
| lg    | 1rem     | 16px   | Large body text            |
| xl    | 1.125rem | 18px   | Small headings             |
| 2xl   | 1.25rem  | 20px   | H4 headings                |
| 3xl   | 1.5rem   | 24px   | H3 headings                |
| 4xl   | 1.875rem | 30px   | H2 headings                |
| 5xl   | 2.25rem  | 36px   | H1 headings                |
| 6xl   | 3rem     | 48px   | Display headings           |
| 7xl   | 3.75rem  | 60px   | Large display headings     |
| 8xl   | 4.5rem   | 72px   | Extra large display        |
| 9xl   | 6rem     | 96px   | Hero text                  |

## Usage

### CSS Variables

Use CSS variables in your styles:

```css
.my-component {
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
}
```

### Utility Classes

Use pre-defined utility classes:

```jsx
<h1 className="text-5xl font-semibold">Main Title</h1>
<p className="text-base font-normal">Body paragraph</p>
<code className="font-mono text-sm">Code snippet</code>
```

### Available Utility Classes

**Font Sizes:**
- `.text-3xs` through `.text-9xl`

**Font Weights:**
- `.font-normal` (400)
- `.font-medium` (500)
- `.font-semibold` (600)

**Font Families:**
- `.font-heading`
- `.font-body`
- `.font-mono`

## Default Heading Styles

Headings are automatically styled:

```html
<h1>Automatically sized at 36px (5xl)</h1>
<h2>Automatically sized at 30px (4xl)</h2>
<h3>Automatically sized at 24px (3xl)</h3>
<h4>Automatically sized at 20px (2xl)</h4>
<h5>Automatically sized at 18px (xl)</h5>
<h6>Automatically sized at 16px (lg)</h6>
```

## Inline Styles (React/Next.js)

When using inline styles:

```jsx
<div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
  Text content
</div>
```

## Migration Guide

To update existing components:

1. Replace hard-coded font sizes with CSS variables or utility classes
2. Replace font-family declarations with system font stacks
3. Use the standard font weights (400, 500, 600)

**Before:**
```jsx
<div style={{ fontSize: '14px', fontFamily: 'Arial' }}>Text</div>
```

**After:**
```jsx
<div className="text-base">Text</div>
// or
<div style={{ fontSize: 'var(--font-size-base)' }}>Text</div>
```
