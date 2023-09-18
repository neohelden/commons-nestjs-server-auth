export default class OpaJwtPrincipal<
  JC extends Map<string, unknown> = Map<string, unknown>,
  OC extends Map<string, unknown> = Map<string, unknown>,
> {
  /**
   * The JSON Web Token for the User
   */
  readonly jwt: string | null;
  /**
   * A map of JWT claims for the User
   */
  readonly claims: JC | null;
  /**
   * OPA evaluated constraints
   */
  readonly constraints: OC;

  constructor(jwt: string | null, claims: JC | null, constraints: OC) {
    this.jwt = jwt;
    this.claims = claims;
    this.constraints = constraints;
  }
}
