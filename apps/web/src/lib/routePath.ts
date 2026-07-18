export function routeBoundaryKey(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}
