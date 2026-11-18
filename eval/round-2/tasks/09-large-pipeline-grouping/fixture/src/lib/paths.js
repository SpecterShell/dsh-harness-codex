import { dirname, join, resolve } from "node:path";

export function resolveFrom(base, path) {
  return resolve(base, path);
}

export function sibling(file, name) {
  return join(dirname(file), name);
}

export function withSuffix(file, suffix) {
  return file.replace(/\.[^./]+$/, "") + suffix;
}
