import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import jwt, { JwtPayload } from "jsonwebtoken";
import { inspect } from "util";
import JWTPrincipal from "../JwtPrincipal";
import { AuthModuleOptions } from "../auth.module";
import JwksKeySource from "../key/JwksKeySource";
import OpenIdProviderKeySource from "../key/OpenIdProviderKeySource";
import PublicKeyLoader from "../key/PublicKeyLoader";
import { AUTH_MODULE_OPTIONS_TOKEN } from "../consts";

export interface AuthServiceOptions {
  /**
   * Comma separated string of OPEN_ID_DISCOVERY key sources with required issuer. Can be used to
   * shorten the configuration when the discovery base URL matches the iss claim, the IDP sets.
   * The value used for configuration here must exactly match the iss claim.
   * keys and issuers can be used at the same time. Both are added to the accepted key sources.
   */
  authIssuers?: string[];
  /**
   * List of JWKS Key Sources with required issuer. Can be used to configure keys for
   */

  authKeys?: AuthKeysConfigType[];
  /**
   * Disable authentication. This is useful for testing.
   */
  disableAuth: boolean;
}

type AuthKeysConfigType =
  | {
      type: "OPEN_ID_DISCOVERY";
      location: string;
      requiredIssuer: string;
    }
  | {
      type: "JWKS";
      location: string;
      requiredIssuer: string;
    };

@Injectable()
export default class AuthService {
  private logger = new Logger(AuthService.name);
  constructor(
    @Inject(AUTH_MODULE_OPTIONS_TOKEN) authOpts: AuthModuleOptions,
    private readonly publicKeyLoader: PublicKeyLoader,
    private httpService: HttpService,
  ) {
    const keys: AuthKeysConfigType[] = [];
    const config = authOpts.auth;

    try {
      keys.push(...(config.authKeys ?? []));
    } catch (e) {
      this.logger.warn("Failed to parse auth.keys");
      this.logger.warn(e);
    }

    const issuers = config.authIssuers ?? "";

    if (!config.authIssuers && !config.authKeys) {
      this.logger.warn("No auth keys or issuers configured");
    }

    this.logger.debug("Loading keys");
    this.logger.verbose("Keys: " + inspect(keys));

    for (const key of keys) {
      this.logger.verbose("Key: " + inspect(key));
      if (key.type === "OPEN_ID_DISCOVERY") {
        this.publicKeyLoader.addKeySource(
          new OpenIdProviderKeySource(
            key.location,
            key.requiredIssuer,
            this.httpService,
          ),
        );
      } else if (key.type === "JWKS") {
        this.publicKeyLoader.addKeySource(
          new JwksKeySource(key.location, key.requiredIssuer, this.httpService),
        );
      }
    }

    this.logger.debug("Loading issuers");
    this.logger.verbose("Issuers: " + issuers);

    this.logger.debug("Found issuers");
    for (const issuer of issuers) {
      this.logger.verbose("Issuer: " + issuer);
      this.publicKeyLoader.addKeySource(
        new OpenIdProviderKeySource(issuer, issuer, this.httpService),
      );
    }

    this.logger.debug("Loading keys done");
  }

  /**
   *
   * Authorizes a user. This is accomplished by validating the JWT and returning the claims.
   *
   * @param token The JWT of a user.
   * @returns The claims of the JWT
   */
  public async auth(request, token: string): Promise<Record<string, unknown>> {
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      throw new Error("ERR_AUTH_INVALID_TOKEN");
    }

    this.logger.verbose("Decoded token: " + inspect(decoded));

    const kid = decoded.header.kid;
    const x5t = decoded.header.x5t;

    if (!kid) {
      this.logger.warn("No kid found");
      throw new Error("ERR_AUTH_INVALID_TOKEN");
    }

    const loadedPublicKey = await this.publicKeyLoader.getLoadedPublicKey(
      kid,
      x5t,
    );

    this.logger.verbose("Loaded public key: " + inspect(loadedPublicKey));

    if (!loadedPublicKey) {
      this.logger.debug("No public key found");
      throw new Error("ERR_AUTH_NO_PUBLIC_KEY");
    }

    const publicKey = loadedPublicKey.publicKey;

    const payload = jwt.verify(token, publicKey) as JwtPayload;

    if (!payload) {
      throw new Error("ERR_AUTH_INVALID_TOKEN");
    }

    const claims = payload;

    request.jwtPrincipal = new JWTPrincipal(token, claims);

    return claims;
  }
}
