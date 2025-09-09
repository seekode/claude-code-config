# Contexte développeur

## Stack technique

- **Backend**: Bun + Elysia (TypeScript), PHP 8.1+
- **Frontend**: Svelte + SvelteKit (SSR, SCSS, TypeScript)
- **Mobile**: Flutter/Dart
- **BDD**: MySQL, Supabase (RLS, real-time)

## Communication

- Explications et discussions : **français**
- Code, comments, commits, identifiers : **anglais uniquement**
- Réponse directe d'abord, rationale brève après si utile

## Spécificités techniques

- TypeScript strict mode obligatoire, pas de `any`
- Elysia : privilégier les plugins Bun-optimized et validation schemas
- Svelte SSR : hydration strategy et cleanup proper
- Flutter : const constructors, controller disposal
- Supabase : RLS policies et optimistic updates

## Standards

- Tests avec Bun native test runner + Playwright E2E
- Commits : Conventional Commits, impératif, ≤72 chars
- Sécurité : sanitization, parameterized queries, timeout handling

## Approche

- Architecture et maintenabilité > solutions rapides
- Code-first : code fonctionnel plutôt que prose
- Anticiper edge cases et implications sécurité

## Svelte 5 Syntax Guide

**MANDATORY:** Always use Svelte 5 syntax (NOT Svelte 4).

### Key differences

#### State management

- ✅ **Use:** `let count = $state(0)`
- ❌ **Don't use:** `export let count = 0`

#### Derived values

- ✅ **Use:** `const double = $derived(count * 2)`
- ❌ **Don't use:** `$: double = count * 2`

#### Effects

- ✅ **Use:** `$effect(() => { /* code */ })`
- ❌ **Don't use:** `$: { /* code */ }` or `$: () => { /* code */ }`

#### Props (for components)

- ✅ **Use:** `let { propName = defaultValue } = $props()`
- ✅ **With TypeScript:** `let { propName = defaultValue }: Props = $props()`
- ❌ **Don't use:** `export let propName = defaultValue`

#### Slot/Render

- ✅ **Use:** `{@render children()}`
- ❌ **Don't use:** `<slot />`

#### Events

- ✅ **Use:** `onevent`
- ❌ **Don't use:** `on:event`

#### Event Dispatcher

- ✅ **Use:** callback
- ❌ **Note:** avoid `createEventDispatcher`

#### Bindings

- ✅ **Use:** `$bindable()` for two-way binding

### Important

Always check if you're using legacy Svelte 4 patterns and convert them to Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`, `$bindable`.

## Mémoire
