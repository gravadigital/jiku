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
<InputText     label code value onChange placeholder error />
<InputTextarea label code value onChange placeholder error />
<InputSelect   label code value options onChange placeholder error />
<InputDate     label code value onChange error />
<InputMultiplePersons label code ... />
```

`code` es el `name`/`id` del campo. `onChange` recibe **el valor**, no el evento.

### Cuándo `react-select`

`react-select` se usa cuando hace falta búsqueda dentro del select, agrupamiento de opciones o
multi-select con chips: `TargetSelector` (opciones agrupadas por proyecto/requisito/tarea),
`RequirementFilters`, `CreateRequirementForm`, `WorkedTimesPage`, `projects/new`.

> **El objeto `selectStyles` está duplicado en cinco archivos** con variaciones menores:
> `projects/new/page.tsx:87-138`, `projects/edit/[id]/page.tsx`, `RequirementFilters.tsx:40-95`,
> `CreateRequirementForm.tsx:60-190`, `WorkedTimesPage.tsx:33-45`, `TargetSelector.tsx:30-50`.
> No hay un módulo compartido. Para código nuevo: reusar uno de los existentes moviéndolo a un
> archivo común antes que copiarlo por sexta vez.

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
- No copiar el objeto `selectStyles` a un archivo nuevo.
