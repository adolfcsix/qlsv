export function go(route) { location.hash = route; }
export function routeParts() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); }
