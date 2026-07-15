export function playerFunctionHeaders(jwt: string) {
  return {
    'content-type': 'application/json',
    'juchess-player-jwt': jwt,
  }
}
