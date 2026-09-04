---
id: forms
display_name: Formularios (yup + estado controlado)
language: nextjs
description: Tres enfoques conviviendo; cuál usar en código nuevo y por qué
applies_to: [frontend]
required_by: []
package: yup
---

# Formularios (web)

> **Reemplaza** la convención `forms` del catálogo, que usa Server Actions + `useActionState` +
> Zod y dice explícitamente "no react-hook-form". Este servicio no usa ninguna de esas piezas
> para validar: usa yup, y el envío va por hook de mutación.

## El estado actual: tres enfoques

Esto es un relevamiento, no una recomendación. Los tres existen en el código.

| # | Enfoque | Dónde | Validación |
|---|---|---|---|
| 1 | `useState` con objeto de formulario + yup `validateSync` al enviar | `projects/new`, `projects/edit/[id]`, `objectives/new`, `objectives/edit/[id]` | `validationSchema.validateSync(data, { abortEarly: false })` en `try/catch` |
| 2 | `useState` + validación yup con errores por campo | `NewClientForm`, `ClientForm`, `CreateRequirementForm`, `EditRequirementForm` | `schema.validate()` y mapeo a `Record<string, string>` |
| 3 | Estado por campo, sin schema | `WorkedTimesPage`, `TimeButtons`, `RequirementStatusCard` | condiciones a mano (`canSubmit`, `isEmpty`) |

`react-hook-form` y `@hookform/resolvers` están **en `package.json` pero no se importan en
ningún archivo de `src/`**. Son dependencias sin uso.

## Para código nuevo: enfoque 2

Es el que da feedback por campo y el que más pantallas usan. La forma canónica está en
`NewClientForm.tsx`:

```tsx
'use client';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('El nombre es obligatorio'),
  description: yup.string(),
});

export function NewClientForm({ onSubmit, loading }: Props) {
  const [values, setValues] = useState({ name: '', description: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');

  const isDirty = useMemo(() => /* comparar contra initialValues */, [values]);

  const processSubmit = () => {
    if (!isDirty) return setGeneralError('No hay cambios para guardar');
    try {
      schema.validateSync(values, { abortEarly: false });
    } catch (err) {
      return setErrors(transformYupErrors(err));
    }
    onSubmit(values);
  };
```

**Reglas:**

- El schema yup se declara **fuera del componente**, a nivel de módulo. Recrearlo en cada render
  invalida cualquier memoización.
- `abortEarly: false` siempre: sin eso yup corta en el primer error y el usuario ve uno por vez.
- Mapear el error de yup con `transformYupErrors` de `@/shared/utils` — existe justamente para eso
  y devuelve `Record<campo, mensaje>`.
- **Chequear `isDirty` antes de validar.** Enviar un formulario sin cambios es un request inútil;
  el mensaje establecido es `"No hay cambios para guardar"`.
- El componente de formulario **recibe `onSubmit` y `loading` por props** y no conoce el hook de
  mutación. La página es la que llama a `mutate` y decide toast y navegación (ver
  [`mutations.md`](./mutations.md)).

## Mensajes de validación

Están en español y en el schema, no en el componente. Los que ya existen:

| Campo | Mensaje |
|---|---|
| nombre (actor) | `"El nombre es obligatorio"` |
| nombre (proyecto) | `"El nombre es requerido"` |
| código | `"El código es requerido"` |
| descripción | `"La descripción es requerida"` |
| fecha de inicio | `"La fecha de inicio es requerida"` |
| tipo | `"El tipo es requerido"` |
| título (requisito) | `"El título es requerido"` |
| proyecto (requisito) | `"El proyecto es requerido"` |
| sin cambios | `"No hay cambios para guardar"` |
| fallo genérico de validación | `"Hay campos obligatorios sin completar"` |
| fallo genérico (tareas) | `"Revisá que no haya campos incompletos"` |

**Inconsistencia registrada:** conviven `"es obligatorio"` y `"es requerido"` para la misma
clase de error. No unificado.

Para strings que pueden llegar con espacios, el patrón es `.test('not-blank', ...)`:

```ts
title: yup.string()
  .required('El título es requerido')
  .test('not-blank', 'El título es requerido', (v) => !!v && v.trim().length > 0),
```

## Campos obligatorios en la UI

Dos patrones conviven:

1. **Marca dinámica junto al label**, que desaparece al completar — `projects/new/page.tsx:255`:

   ```tsx
   <label>Nombre {!formData.name && <span className={styles.required}>(obligatorio)</span>}</label>
   ```

2. **Prop `error` en el componente de input**, que pinta el borde y el mensaje —
   `objectives/new/page.tsx:281`:

   ```tsx
   <InputText label="Título" error={fieldHasError('title', form.title)} ... />
   ```

**Regla para código nuevo:** el patrón 2. El 1 no sirve para errores que no son "campo vacío".

## Componentes de input

Los propios, de `@/shared/components/ui`, con la misma firma:

```tsx
<Input  variant="text"     label value onChange placeholder error />
<Input  variant="textarea" label value onChange placeholder error />
<Input  variant="date"     label value onChange error />
<Input  variant="search"   label value onChange placeholder />
<Select variant="single"   label value options onChange placeholder error searchable />
<Select variant="multiple" label value options onChange placeholder error />
```

`onChange` recibe **el valor**, no el evento.

> **Los cinco componentes anteriores se dieron de baja.** `InputText`, `InputTextarea`,
> `InputSelect`, `InputDate` e `InputMultiplePersons` fueron reemplazados por dos componentes
> del Design System —`Input` y `Select`— que resuelven las mismas cinco formas con una prop
> `variant`. La baja la cerró S-060 con cero usos verificados. La prop `code` no existe en los
> nuevos: el `id` lo genera el componente con `useId()`.
>
> **`searchable` en `Select`** agrega un buscador dentro del menú, con filtrado insensible a
> acentos. Es opt-in: con pocas opciones estorba. Se usa donde la lista es larga y no
> memorizable — el filtro por proyecto (~100 opciones) y el selector de persona de la carga de
> horas.

### Cuándo `react-select`

Quedan **dos** usos, y cada uno por una capacidad concreta que el `Select` del DS no tiene:

| Dónde | Por qué |
|---|---|
| `TargetSelector` | Opciones **agrupadas** (por proyecto / requisito / tarea). El `Select` del DS no soporta grupos |
| `InputMultipleSelect` | Multi-select con chips y colapso a `+N` |

**La búsqueda dentro del select ya no es motivo.** El `Select` del DS tiene una prop
`searchable` que agrega un buscador en el menú, con filtrado insensible a acentos. Es la
capacidad que se había perdido al migrar de `react-select` en S-057 y que dejaba el filtro por
proyecto (~100 opciones) sin forma práctica de encontrar nada.

> **El objeto `selectStyles` ya no existe** — tenía cero ocurrencias al cerrar la migración. La
> advertencia anterior («duplicado en cinco archivos, no lo copies por sexta vez») queda sin
> objeto: los dos usos que sobreviven estilan desde su propio módulo.

## Formularios multi-instancia

`objectives/new` permite crear varias tareas en un submit: mantiene `Body[]` en estado y expone
"Clonar" y "Borrar" por formulario. Cada uno tiene un `id` local que sirve de `key` de React y de
selector para los handlers (`handleInputChange(field, value, form.id)`).

**Regla:** si un formulario nuevo necesita multi-instancia, seguir ese patrón: array de estados
con id local, no N componentes con estado propio.

## Envío

- El botón de submit usa `<Button label loading disabled />`; `loading` viene de `isPending` de la
  mutación. `<Button>` ya pone spinner, `aria-busy` y texto `sr-only`.
- `<form onSubmit={...}>` con `e.preventDefault()`, y `noValidate` cuando la validación es toda de
  yup (así el navegador no muestra sus propios mensajes por encima).
- Varias pantallas ponen el botón en el header de la página vía `actions` de `PageLayout` en vez de
  dentro del `<form>`. En ese caso el handler se llama directo, sin pasar por el submit.

## Qué NO hacer

- No agregar un cuarto enfoque.
- No importar `react-hook-form`: está en `package.json` sin uso, y meterlo ahora suma un cuarto
  patrón en vez de reducir.
- No validar solo en el frontend y asumir que alcanza. Estas validaciones son de UI; la autoridad
  está en `api`/`core`. Ver la tabla de reglas replicadas en [`../overview.md`](../overview.md).
- No volver a `react-select` por búsqueda: usar `searchable` del `Select` del DS.
