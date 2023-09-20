export default class JwtPrincipal<
  JC extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly jwt: string;
  readonly claims: JC;

  constructor(jwt: string, claims: JC) {
    this.jwt = jwt;
    this.claims = claims;
  }
}
