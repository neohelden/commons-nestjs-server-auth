import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { inspect } from "util";
import { AuthModuleOptions } from "./auth.module";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";
import { AUTH_MODULE_OPTIONS_TOKEN } from "./consts";

@Injectable()
export default class OPAGuard implements CanActivate {
  private readonly logger = new Logger(OPAGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly opaService: OPAService,
    @Inject(AUTH_MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    const prefix = this.options.http?.contextPath ?? "/";
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
        request.headers
      );

      this.logger.verbose("Constraints: " + inspect(constraints));

      return true;
    } catch (e) {
      this.logger.debug("Error while authorizing: " + e);
      return false;
    }
  }
}
