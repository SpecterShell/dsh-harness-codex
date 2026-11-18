import { validateGroupSummary, validateProductSummary } from "../core/summary-schema.js";
import { buildExport } from "./export.js";

export function validateExport(payload) {
  return payload.group_by
    ? validateGroupSummary(payload)
    : validateProductSummary(payload);
}

export function runValidate(rows, options = {}) {
  const payload = buildExport(rows, options);
  return validateExport(payload);
}
