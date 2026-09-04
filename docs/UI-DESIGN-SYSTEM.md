# Gemini Vault UI Design System

## Product feeling

The UI should feel:
- private
- calm
- intelligent
- premium
- editorial
- responsive

Core principle:

**Sophisticated underneath, simple on the surface.**

## Information density

Use desktop width intentionally.

Avoid:
- long vertical walls of cards
- redundant dashboards
- unnecessary side panels
- tiny explanatory text

## Typography

Target hierarchy:

```text
Display: 48–64px
Page title: 28–36px
Section heading: 18–22px
Body: 14–16px
Secondary: 12–13px
Metadata: 11–12px
```

Normal content should not rely on 9–10px text.

## Capitalization

Use:
- Title Case for major page names
- sentence case for explanations
- normal case for category names

Preferred:
- Goal
- Project
- Commitment
- Recurring theme

Avoid arbitrary all-caps labels unless genuinely functioning as metadata eyebrows.

## Themes

### Night Vault
Deep charcoal, warm amber intelligence accent, quiet ambient motion.

### Morning Vault
Warm ivory, charcoal text, softer gold accents, brighter editorial atmosphere.

Theme switching should feel intentional rather than like a simple CSS inversion.

## Motion

Use motion for:
- navigation
- response arrival
- memory save confirmation
- signal reveal
- drawer transitions
- theme transitions
- voice state transitions

Avoid decorative animation with no semantic purpose.

## Reflection workspace

Primary:
conversation

Secondary:
history/context

The composer should:
- support Enter to send
- support Shift+Enter for newline
- autofocus after turns
- allow type-anywhere interaction
- avoid forced virtual-keyboard opening on mobile

## Accessibility

Require:
- keyboard navigation
- clear focus states
- aria labels
- readable contrast
- mobile touch targets
- reduced-motion support
- accessible dialogs
- clear error/loading/empty states
