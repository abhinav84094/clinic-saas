export function fieldErrorsFrom(error, fields) {
  const result = {};
  for (const issue of error.response?.data?.errors || []) {
    const path = issue.field || issue.path;
    const parts = Array.isArray(path) ? path : String(path || "").split(".");
    const field = [...parts].reverse().find(part => fields.includes(part));
    if (fields.includes(field) && issue.message) result[field] = issue.message;
  }
  return result;
}
