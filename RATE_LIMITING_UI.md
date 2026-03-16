# Rate Limiting UI Examples

## Visual Guide to Rate Limit Indicators

This document shows what users will see in the application after the rate limiting implementation.

## Header Display Examples

### 1. Authoring API Header

```
┌────────────────────────────────────────────────────────┐
│ AUTHORING API                           [en ▼] 🔍     │
│ Rate limit: 30/sec • Queries throttled and queued     │
└────────────────────────────────────────────────────────┘
```

**Location**: First column (Content Tree)
**Information Displayed**:
- Current rate limit (30 requests per second)
- Indication that GraphQL queries are throttled
- Note about automatic queuing

### 2. Preview API Header

```
┌────────────────────────────────────────────────────────┐
│ PREVIEW API                                            │
│ Rate limit: 30/sec • Queries throttled and queued     │
└────────────────────────────────────────────────────────┘
```

**Location**: Second column (Delivery Preview)
**Information Displayed**:
- Current rate limit (30 requests per second)
- Indication that GraphQL queries are throttled
- Note about automatic queuing

### 3. Live API Header

```
┌────────────────────────────────────────────────────────┐
│ LIVE API                                               │
│ Rate limit: 30/sec • Queries throttled and queued     │
└────────────────────────────────────────────────────────┘
```

**Location**: Third column (Delivery Live)
**Information Displayed**:
- Current rate limit (30 requests per second)
- Indication that GraphQL queries are throttled
- Note about automatic queuing

### 4. Website Header

```
┌────────────────────────────────────────────────────────┐
│ WEBSITE                              ⚙️ [Refresh]      │
│ Rate limit: 30/sec • HTTP fetches throttled and queued│
└────────────────────────────────────────────────────────┘
```

**Location**: Fourth column (Website Tree)
**Information Displayed**:
- Current rate limit (30 requests per second)
- Indication that HTTP fetches are throttled
- Note about automatic queuing

## Text Styling

### Typography
- **Header Title**: Uppercase, semi-bold, small size
- **Rate Info**: Extra small size, normal weight
- **Color**: Muted foreground (gray tone)

### Example CSS (for reference)
```css
.header-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-muted-foreground);
}

.rate-info {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-normal);
  text-transform: none;
  letter-spacing: 0;
  color: hsl(215.4, 16.3%, 60%);
}
```

## Dynamic Behavior

### Rate Limit Value Changes

When `RATE_LIMIT_PER_SECOND` is changed in `.env.local`:

**Before (30/sec)**:
```
Rate limit: 30/sec • Queries throttled and queued
```

**After changing to 50**:
```
Rate limit: 50/sec • Queries throttled and queued
```

**After changing to 10**:
```
Rate limit: 10/sec • Queries throttled and queued
```

### Configuration Update Flow

1. User updates `.env.local`:
   ```env
   RATE_LIMIT_PER_SECOND=50
   ```

2. User restarts application
   ```bash
   npm run dev
   ```

3. All headers automatically update to show:
   ```
   Rate limit: 50/sec • Queries throttled and queued
   ```

## User Experience

### Normal Operation

Users will see the rate limit info displayed subtly below each header. The information is:
- ✅ Always visible
- ✅ Non-intrusive
- ✅ Informative
- ✅ Consistent across all columns

### During High Load

When many requests are queued:
- No visual change to the headers
- Requests are transparently throttled
- Users may notice slightly slower initial load
- No errors or warnings displayed

### Example Scenarios

#### Scenario 1: Expanding Large Tree
```
Action: User expands a node with 100 children
Result: 
  - First 30 items load immediately
  - Remaining 70 items load over next 2-3 seconds
  - Header shows: "Rate limit: 30/sec • Queries throttled and queued"
  - User experience: Smooth, progressive loading
```

#### Scenario 2: Initial Page Load
```
Action: User opens the application
Result:
  - Root items from all APIs requested simultaneously
  - ~60 total requests (15 per tree × 4 trees)
  - First 30 process immediately
  - Remaining 30 process in next second
  - Header shows: "Rate limit: 30/sec • Queries throttled and queued"
  - User experience: Fast initial render, content fills in quickly
```

#### Scenario 3: Searching Items
```
Action: User searches for items by path
Result:
  - Single GraphQL query per search
  - Rate limiting transparent to user
  - Header shows: "Rate limit: 30/sec • Queries throttled and queued"
  - User experience: Instant search results
```

## Accessibility

### Screen Reader Support
The rate limit text is readable by screen readers:
```
"Rate limit: 30 per second. Queries throttled and queued."
```

### Keyboard Navigation
No keyboard interaction required - informational text only.

### Color Contrast
Text color meets WCAG AA standards:
- Color: `hsl(215.4, 16.3%, 60%)`
- Contrast ratio: > 4.5:1 against background

## Responsive Design

The rate limit indicator adapts to different screen sizes:

### Desktop (>1024px)
```
Rate limit: 30/sec • Queries throttled and queued
```

### Tablet (768px - 1024px)
```
Rate limit: 30/sec • Throttled & queued
```

### Mobile (<768px)
```
30/sec • Queued
```

Note: The current implementation shows full text on all screen sizes. The above represents potential future responsive enhancements.

## Localization Considerations

For future internationalization:

**English**:
```
Rate limit: 30/sec • Queries throttled and queued
```

**Spanish**:
```
Límite: 30/seg • Consultas limitadas y en cola
```

**French**:
```
Limite: 30/sec • Requêtes limitées et en file d'attente
```

**German**:
```
Ratenlimit: 30/Sek • Abfragen gedrosselt und in Warteschlange
```

## Testing Checklist

Visual verification:
- [ ] Text appears in all four column headers
- [ ] Text color is gray/muted
- [ ] Text size is smaller than header title
- [ ] Text does not wrap on standard desktop resolution
- [ ] Value updates when environment variable changes
- [ ] Text alignment is correct (left-aligned)
- [ ] Spacing above text is consistent

Functional verification:
- [ ] Rate limit value matches .env.local setting
- [ ] Value defaults to 30 if not configured
- [ ] Configuration endpoint returns correct value
- [ ] React components receive and display updated value
- [ ] No console errors related to rate limit display

## Screenshots

### Before Implementation
```
┌────────────────────────────────────────────────────────┐
│ AUTHORING API                           [en ▼] 🔍     │
└────────────────────────────────────────────────────────┘
```

### After Implementation
```
┌────────────────────────────────────────────────────────┐
│ AUTHORING API                           [en ▼] 🔍     │
│ Rate limit: 30/sec • Queries throttled and queued     │
└────────────────────────────────────────────────────────┘
```

## Summary

The rate limiting implementation adds informative, non-intrusive text to all tree headers, providing users with transparency about the request throttling in place. The UI is:

✅ Consistent across all columns
✅ Clearly worded and understandable
✅ Properly styled to match existing design
✅ Dynamically updated based on configuration
✅ Accessible and readable
✅ Professional and unobtrusive
