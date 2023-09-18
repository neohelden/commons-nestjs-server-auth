import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import JwksKeySource from "./JwksKeySource";
import KeySource from "./KeySource";
import LoadedPublicKey from "./LoadedPublicKey";
import { Logger } from "@nestjs/common";

export default class OpenIdProviderKeySource implements KeySource {
  public readonly DISCOVERY_PATH: string = "/.well-known/openid-configuration";
  private readonly logger = new Logger(OpenIdProviderKeySource.name);

  private issuerUrl: string;
  private requiredIssuer: string;

  constructor(
    issuerUrl: string,
    requiredIssuer: string,
    private readonly httpService: HttpService
  ) {
    this.issuerUrl = issuerUrl;
    this.requiredIssuer = requiredIssuer;
  }

  async loadKeysFromSource(): Promise<LoadedPublicKey[]> {
    const discoveryDocPath = this.issuerUrl + this.DISCOVERY_PATH;

    this.logger.debug("Loading discovery doc from " + discoveryDocPath);

    const discoveryDocPromise = await lastValueFrom(
      this.httpService.get<Discovery>(discoveryDocPath)
    );

    const discoveryDoc = discoveryDocPromise.data;

    return new JwksKeySource(
      discoveryDoc.jwks_uri,
      this.requiredIssuer,
      this.httpService
    ).loadKeysFromSource();
  }
}

class Discovery {
  readonly jwks_uri!: string;
}
