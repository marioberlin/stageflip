---
'@stageflip/editor-shell': minor
---

T-125b — ZodForm auto-inspector + Zod-3 introspect module. New public
surface: `ZodForm`, `introspectSchema`, `introspectField`, plus the
`FieldSpec` / `FieldKind` / `DiscriminatedBranch` types. Covers strings
(with hex-color detection), numbers (with slider classification when
bounded), booleans, enums (both `z.enum` and `z.nativeEnum`), string /
number arrays, nested objects, and discriminated unions. Commit
semantics match handover-phase6-mid-2 §3.3: text / number / slider /
color / number-list / tag-list buffer locally and commit on blur /
Enter / pointerup so T-133's undo interceptor captures one entry per
gesture. Discrete controls (boolean toggle, enum select, color picker
click) commit immediately. New i18n keys under the `zodform.*` and
`properties.clip.*` namespaces.
