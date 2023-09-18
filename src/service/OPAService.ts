import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosResponse } from "axios";
import { Observable, lastValueFrom } from "rxjs";
import { inspect } from "util";
import OpaJwtPrincipal from "../OpaJwtPrincipal";
import JWTPrincipal from "../JwtPrincipal";

export declare type OPAResponse = {
  result: {
    allow: boolean;
    [key: string]: unknown;
  };
};

@Injectable()
export default class OPAService {
  private readonly logger = new Logger(OPAService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Performs authorization using the Open policy agent. Returns a map of the
   * constraints provided by OPA.
   */
  public async auth(
    request,
    token: string,
    httpMethod: string,
    path: string,
    headers: Map<string, string>,
  ): Promise<Map<string, unknown>> {
    const disable =
      this.configService.getOrThrow<string>("opa.disable") === "true";

    if (disable) {
      this.logger.warn("OPA is disabled");
      return new Map();
    }

    const opaUrl = this.configService.getOrThrow<string>("opa.url");
    const opaPackage = this.configService.getOrThrow<string>("opa.package");

    const callUrl =
      opaUrl + (opaUrl.endsWith("/") ? "" : "/") + "v1/data/" + opaPackage;

    this.logger.verbose("OPA URL: " + callUrl);

    const input = {
      token,
      httpMethod,
      path: path.substring(1).split("/"),
      headers,
    };

    this.logger.verbose("OPA input: " + inspect(input));

    const res = this.httpService.post<OPAResponse>(
      callUrl,
      {
        input,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const claims = await this.transformResponse(res);

    if (!claims.get("allow")) {
      this.logger.debug("OPA returned allow: " + claims.get("allow"));
      throw new Error("ERR_OPA_FORBIDDEN");
    }

    const jwtPrincipal = request.jwtPrincipal as JWTPrincipal | undefined;
    const jwtClaims = jwtPrincipal?.claims ?? null;
    const jwtToken = jwtPrincipal?.jwt ?? null;

    request.opaPrincipal = new OpaJwtPrincipal(jwtToken, jwtClaims, claims);

    return claims;
  }

  private transformResponse(
    res: Observable<AxiosResponse<OPAResponse>>,
  ): Promise<Map<string, unknown>> {
    const obs: Observable<Map<string, unknown>> = new Observable(
      (subscriber) => {
        res.subscribe({
          error: (e) => {
            this.logger.warn("Error while contacting OPA: " + e);
            subscriber.error("ERR_OPA_UNAIAVAILABLE");
          },
          next: (r) => {
            const data = r.data;
            this.logger.verbose("OPA response: " + inspect(data));
            const result = data.result;

            if (!result) {
              this.logger.warn("No result from OPA");
              subscriber.error("Authorization not available");
              return;
            }

            const opaResponse = result;

            const constraints = new Map<string, unknown>(
              Object.entries(opaResponse),
            );

            subscriber.next(constraints);
          },
          complete: () => {
            subscriber.complete();
          },
        });
      },
    );

    return lastValueFrom(obs);
  }
}
