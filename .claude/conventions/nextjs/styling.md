---
id: styling
display_name: Estilado (Tailwind CSS)
language: nextjs
description: Styling with Tailwind CSS and the cn() helper
applies_to: [frontend]
required_by: []
package: tailwindcss
---

# Styling (Next.js)

Default styling: **Tailwind CSS** utility classes with a `cn()` helper for conditional composition. Aligned with the `create-next-app` official template.

## When to use

Any Next.js app that renders UI. CSS Modules and plain CSS files are permitted in narrow cases (see "When NOT to use Tailwind") but Tailwind is the default for components.

## Package

```
tailwindcss            # runtime
@tailwindcss/postcss   # PostCSS integration
clsx                   # conditional class composition
tailwind-merge         # resolve conflicting Tailwind classes
```

## Setup

`globals.css` (in `src/app/`) imports Tailwind:

```css
@import "tailwindcss";

@layer base {
  body {
    @apply bg-white text-gray-900 antialiased;
  }
}
```

`src/app/layout.tsx` imports it:

```tsx
import './globals.css';
```

Tailwind v4+ auto-detects content; for older versions configure `content` in `tailwind.config.ts`.

## The `cn()` helper

`cn()` combines `clsx` (conditional classes) with `tailwind-merge` (resolves conflicting utilities like `p-2 p-4` → `p-4`). It is the only way to compose classes conditionally.

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Use:

```tsx
import { cn } from '@/lib/utils';

export function Button({
  variant = 'primary',
  className,
  ...props
}: {
  variant?: 'primary' | 'secondary';
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'rounded px-4 py-2 font-medium transition-colors',
        variant === 'primary' && 'bg-blue-600 text-white hover:bg-blue-700',
        variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        className,
      )}
      {...props}
    />
  );
}
```

**Always accept and merge `className` from props.** This lets callers override or extend styles without breaking the component.

## Design system tokens

Tailwind tokens (colors, spacing, typography, breakpoints) come from the **design system** of this Next.js surface, documented at `docs/design-system/{surface}/` (one DS per surface). Configure them in `tailwind.config.ts` (or `@theme` in `globals.css` for v4+):

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
} satisfies Config;
```

When the design system defines a token (e.g., `--color-primary-500`), Tailwind exposes it (e.g., `bg-primary-500`). Components reference tokens, not raw colors. **Never use raw hex** in components.

## Dark mode

If the app supports dark mode, use Tailwind's `dark:` variant with the `class` strategy:

```ts
// tailwind.config.ts
export default {
  darkMode: 'class',
  // ...
};
```

Apply `dark:bg-gray-900 dark:text-white` etc. The `class="dark"` is toggled on `<html>` by a small Client Component reading user preference + system preference.

## Responsive design

Mobile-first by default. Breakpoint prefixes scale up:

```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  ...
</div>
```

Standard breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px). Override only when the design system requires.

## Composition: variants with `cva` (optional)

For components with many variants (Button, Badge, Alert), `class-variance-authority` (cva) keeps the variant matrix readable:

```ts
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonStyles = cva('rounded font-medium transition-colors', {
  variants: {
    variant: {
      primary: 'bg-blue-600 text-white hover:bg-blue-700',
      secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
      ghost: 'bg-transparent hover:bg-gray-100',
    },
    size: {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
```

Use `cva` when a component has 3+ variants or variant + size combinations. For 1-2 variants, inline conditions with `cn()` are clearer.

## When NOT to use Tailwind

Tailwind covers 95% of cases. Use CSS Modules or a `.css` file for:

- **Highly dynamic styles** (e.g., a value computed at runtime that does not map to a token).
- **Complex animations or keyframes** that are hard to express inline.
- **Third-party widgets** that ship their own CSS and need overrides via selectors.

Even then, isolate the file (`{Component}.module.css`) and import locally.

## Class ordering

Use the official Prettier plugin `prettier-plugin-tailwindcss` to enforce a consistent class order automatically. Manual ordering is not enforced by review.

## Rules

- **Tailwind is the default.** CSS Modules or plain CSS only for the cases above.
- **`cn()` for every conditional or composed className.** No template strings with `${condition ? 'x' : 'y'}`.
- **Always accept and merge `className` from props** in reusable components.
- **No raw hex/rgb in components.** Use design-system tokens via Tailwind utilities.
- **Mobile-first**: write the base styles for mobile, add `md:` / `lg:` for larger screens. Never `max-md:` unless the design genuinely degrades upward.
- **Dark mode via `dark:` variant** if the app supports it. Never duplicate components for dark.
- **`cva` for components with 3+ variants.** Inline `cn()` for fewer.
- **No inline `style` prop** unless the value is truly dynamic (e.g., a width based on a prop). Even then, prefer Tailwind's arbitrary values (`w-[123px]`).
- **Long class lists are fine.** Tailwind's strength is co-locating styles with the component. Do not extract to CSS just because the string is long.

## Integration with other conventions

- **_base**: `cn()` lives in `src/lib/utils.ts`. Components live in `src/components/`. UI primitives in `src/components/ui/`.
- **forms**: error messages, pending states, and validation indicators use Tailwind utility classes from the design system tokens.
- Design system: tokens defined in `docs/design-system/{surface}/foundations/` are reflected in `tailwind.config.ts`. When a token changes there, update the Tailwind config.
