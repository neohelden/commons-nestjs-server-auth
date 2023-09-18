import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jwt, { JwtPayload } from "jsonwebtoken";
import JwksKeySource from "../key/JwksKeySource";
import OpenIdProviderKeySource from "../key/OpenIdProviderKeySource";
import PublicKeyLoader from "../key/PublicKeyLoader";
import { inspect } from "util";
import JWTPrincipal from "../JwtPrincipal";

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
    private readonly publicKeyLoader: PublicKeyLoader,
    private readonly configService: ConfigService,
    private httpService: HttpService,
  ) {
    const keys: AuthKeysConfigType[] = [];

    try {
      keys.push(
        ...JSON.parse(this.configService.getOrThrow("auth.keys") || "[]"),
      );
    } catch (e) {
      this.logger.warn("Failed to parse auth.keys");
      this.logger.warn(e);
    }

    const issuers = this.configService.get<string>("auth.issuers") ?? "";

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
    if (issuers.trim().length !== 0) {
      this.logger.debug("Found issuers");
      for (const issuer of issuers.split(",")) {
        this.logger.verbose("Issuer: " + issuer);
        this.publicKeyLoader.addKeySource(
          new OpenIdProviderKeySource(issuer, issuer, this.httpService),
        );
      }
    }

    this.logger.debug("Loading keys done");
  }

  /**
   *
   * Authorizes a user. This is accomplished by validating the JWT and returning the claims.
   *
   * @param token The JWT of a user.
   * @returns A Map of cliams from the JWT.
   */
  public async auth(request, token: string): Promise<Map<string, unknown>> {
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

    const claims = new Map(Object.entries(payload));

    request.jwtPrincipal = new JWTPrincipal(token, claims);

    return claims;
  }
}
