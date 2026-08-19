---
id: state-management
display_name: Estado client-side (Zustand + nuqs)
language: nextjs
description: Client-side state management — decision tree for local, URL, global, and server state
applies_to: [frontend]
required_by: []
package: zustand
---

# State Management (Next.js)

Client-side state in Next.js App Router. The rule: **use the least powerful mechanism that fits**. Most state belongs on the server (Server Components) or in the URL. Reach for a state library only when neither works.

## When to use

Any Next.js app with Client Components that share state or need to reflect state in the URL.

## Package

```
zustand@^5.x         # global client state (store)
nuqs@^2.x            # URL state (type-safe searchParams)
```

`useState` and `useReducer` are React built-ins — no package needed.

## Decision tree

```
Is the data from the server (DB, API)?
  → Fetch directly in a Server Component. No state library.
  → If it needs real-time updates on the client: TanStack Query.

Does the state belong in the URL (filters, pagination, search, tabs)?
  → useSearchParams (Next.js built-in, simple cases)
  → nuqs (type-safe, multiple params, complex cases — recommended)

Is the state local to one component or a small subtree?
  → useState / useReducer

Is the state shared across multiple Client Components (UI state, user preferences, cart)?
  → Zustand

Does the state rarely change and need to be read deep in the tree (theme, locale, auth user)?
  → React Context (only for low-frequency updates)
```

## How to use

### Local state — `useState` / `useReducer`

```tsx
'use client';
import { useState } from 'react';

export function Toggle() {
  const [open, setOpen] = useState(false);
  return <button onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Open'}</button>;
}
```

Use `useReducer` when the state has multiple sub-values or the next state depends on complex logic.

### URL state — `nuqs`

Ideal for filters, pagination, search terms, active tabs — anything a user should be able to bookmark or share.

```tsx
// src/app/layout.tsx — wrap once at the root
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

```tsx
// src/components/product-filters.tsx
'use client';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';

export function ProductFilters() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [category, setCategory] = useQueryState('category', parseAsString.withDefault(''));

  return (
    <div>
      <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
        <option value="">All</option>
        <option value="electronics">Electronics</option>
      </select>
      <button onClick={() => setPage((p) => p + 1)}>Next page ({page})</button>
    </div>
  );
}
```

URL after interaction: `/products?category=electronics&page=2`. Shareable, bookmarkable, browser back button works.

### Global client state — Zustand

For state shared across unrelated Client Components: shopping cart, notification count, UI preferences, multi-step form state.

```ts
// src/stores/cart.ts
import { create } from 'zustand';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i,
          ),
        };
      }
      return { items: [...state.items, item] };
    }),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}));
```

```tsx
// Usage in any Client Component
'use client';
import { useCartStore } from '@/stores/cart';

export function CartBadge() {
  const count = useCartStore((state) => state.items.length);
  return <span>{count}</span>;
}

export function AddToCartButton({ product }: { product: Product }) {
  const addItem = useCartStore((state) => state.addItem);
  return (
    <button onClick={() => addItem({ id: product.id, name: product.name, quantity: 1, price: product.price })}>
      Add to cart
    </button>
  );
}
```

### Zustand with SSR — avoiding state leaking between requests

Zustand stores are module-level singletons. On the server, this can leak state between requests. When initial state comes from the server (e.g., pre-populated cart from DB), use a store factory with a Provider:

```tsx
// src/stores/cart-provider.tsx
'use client';
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { createStore, useStore } from 'zustand';

type CartStore = ReturnType<typeof createCartStore>;
const CartContext = createContext<CartStore | null>(null);

function createCartStore(initialItems: CartItem[] = []) {
  return createStore<CartState>()((set) => ({
    items: initialItems,
    // ...
  }));
}

export function CartProvider({ children, initialItems }: { children: ReactNode; initialItems?: CartItem[] }) {
  const storeRef = useRef<CartStore>();
  if (!storeRef.current) storeRef.current = createCartStore(initialItems);
  return <CartContext.Provider value={storeRef.current}>{children}</CartContext.Provider>;
}

export function useCartStore<T>(selector: (state: CartState) => T) {
  const store = useContext(CartContext);
  if (!store) throw new Error('useCartStore must be used inside CartProvider');
  return useStore(store, selector);
}
```

Use the Provider pattern when the store needs server-side initial data. Use the plain `create()` singleton when the state is purely client-side (no initial server data).

### React Context — low-frequency global state

Suitable for: theme, locale, current user display name. Not suitable for: high-frequency updates (causes re-renders across the tree).

```tsx
// src/contexts/theme-context.tsx
'use client';
import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext<{ theme: 'light' | 'dark'; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
```

If you have more than 4-5 nested Context providers at the root, consolidate into a Zustand store.

## Rules

- Default to Server Components for data from the server. Do not replicate server state into client stores.
- URL state for anything a user should bookmark or share (filters, pagination, tabs, search). Use `nuqs` for type safety.
- `useState` / `useReducer` for state local to a component or small subtree. Lift only when needed.
- Zustand for global UI state shared across unrelated Client Components. One store per domain concern (cart, notifications, UI preferences).
- React Context only for state that rarely changes (theme, locale). Never for state that updates on user interaction.
- Zustand stores live in `src/stores/`. One file per store.
- Select only the slice you need from Zustand stores: `useStore((s) => s.items)`, not the whole store object.
- Use the Provider pattern (store factory + Context) when the store needs server-side initial state.
- Never put server secrets, session data, or PII in client state.

## Integration with other conventions

- **data-fetching**: server data stays in Server Components. Client stores are for UI state only.
- **mutations**: after a Server Action mutates data, it calls `revalidatePath`/`revalidateTag`. Client state mirrors server state only when necessary — prefer re-fetching over manual sync.
- **_base**: stores live in `src/stores/`. URL state with `nuqs` requires `<NuqsAdapter>` in the root layout.
- **auth**: current user identity comes from `verifySession()` (server-side). Do not store auth state in Zustand — it creates a stale-state risk.
