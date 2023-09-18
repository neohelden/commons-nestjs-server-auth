import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { inspect } from "util";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";

@Injectable()
export default class OPAGuard implements CanActivate {
  private readonly logger = new Logger(OPAGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly opaService: OPAService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.configService.getOrThrow<string>("auth.disableAuth") === "true") {
      this.logger.warn("Authentication is disabled");
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    const prefix = this.configService.getOrThrow<string>("http.contextPath");
    const method = request.method;

    const requestUrl = request.url.substring(prefix.length - 1);

    if (!authorization) {
      return false;
    }

    const [type, token] = authorization.split(" ");

    if (type !== "Bearer") {
      return false;
    }

    this.logger.verbose("Token: " + token);

    try {
      const claims = await this.authService.auth(request, token);

      this.logger.verbose("Claims: " + inspect(claims));

      const constraints = await this.opaService.auth(
        request,
        token,
        method,
        requestUrl,
        request.headers,
      );

      this.logger.verbose("Constraints: " + inspect(constraints));

      return true;
    } catch (e) {
      this.logger.debug("Error while authorizing: " + e);
      return false;
    }
  }
}
