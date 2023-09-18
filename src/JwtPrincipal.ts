export default class JwtPrincipal {
  readonly jwt: string;
  readonly claims: Map<string, unknown>;

  constructor(jwt: string, claims: Map<string, unknown>) {
    this.jwt = jwt;
    this.claims = claims;
  }
}
