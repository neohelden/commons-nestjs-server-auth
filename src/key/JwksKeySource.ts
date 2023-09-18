import { HttpService } from "@nestjs/axios";
import { Logger } from "@nestjs/common";
import { JsonWebKey, createPublicKey } from "crypto";
import { lastValueFrom } from "rxjs";
import { inspect } from "util";
import KeySource from "./KeySource";
import LoadedPublicKey from "./LoadedPublicKey";

export default class JwksKeySource implements KeySource {
  private readonly jwksUri: string;
  private readonly requiredIssuer: string;
  private logger = new Logger(JwksKeySource.name);

  constructor(
    jwksUri: string,
    requiredIssuer: string,
    private readonly httpService: HttpService,
  ) {
    this.jwksUri = jwksUri;
    this.requiredIssuer = requiredIssuer;
  }

  async loadKeysFromSource(): Promise<LoadedPublicKey[]> {
    const response = await lastValueFrom(
      this.httpService.get<{ keys: JsonWebKey[] }>(this.jwksUri),
    );

    const keys = response.data.keys;

    return Promise.all(keys.map(this.toPublicKey.bind(this)));
  }

  private async toPublicKey(key: JsonWebKey): Promise<LoadedPublicKey> {
    const keyType = key.kty;

    this.logger.debug("Loading key of type: " + keyType);

    const pubKey = createPublicKey({
      format: "jwk",
      key: key,
    });

    this.logger.verbose("Loaded key: " + inspect(key));

    return new LoadedPublicKey(
      key.kid as string,
      key.xt5 as string,
      pubKey,
      this,
      this.requiredIssuer,
      key.alg as string,
    );
  }
}
