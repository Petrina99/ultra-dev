# Outline — {{MANUAL_TITLE}} (internal — never shipped)

Read by `user-manual-writing` for context. Never referenced from the shipped `<slug>.md`, never bundled into the PDF.

## Chapters

1. {{Chapter title}}
   - Sections: {{#1}}, {{#2}}, ...

## Feature → section map

| Feature / screen | Manual section | Roles that see it |
| --- | --- | --- |

## Shot list

| # | Screen | Shot name | Annotated? | Markers |
| --- | --- | --- | --- | --- |

## Marker spec

Central marker lists live in the project's own e2e `selectors.ts` (or equivalent). Reference by name here — don't duplicate the locator definition.

## Maintenance triggers

- {{UI change}} → refresh {{section}} → re-shoot {{shot names}} → rebuild.
