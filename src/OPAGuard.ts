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
import { Metadata } from "@grpc/grpc-js";

@Injectable()
export default class OPAGuard implements CanActivate {
  private readonly logger = new Logger(OPAGuard.name);

  constructor(
    private readonly authService: AuthService,
    private readonly opaService: OPAService,
    @Inject(AUTH_MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions
  ) {
    if (options.auth.disableAuth) {
      this.logger.warn(
        "Authentication is disabled. This setting should never be used in production."
      );
    }
  }

  // eslint-disable-next-line max-lines-per-function
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.options.auth.disableAuth) {
      return true;
    }

    const contextType = context.getType();

    let request: Record<string, any>;
    let authorization: string | undefined;
    let method: string;
    let requestUrl: string;
    let headers: Record<string, string>;

    if (contextType === "http") {
      request = context.switchToHttp().getRequest();
      authorization = request.headers.authorization;

      const contextPath = this.options.http?.contextPath ?? "/";

      const prefix = contextPath.endsWith("/")
        ? contextPath
        : contextPath + "/";
      method = request.method;

      requestUrl = request.url.substring(prefix.length - 1);

      headers = request.headers;
    } else if (contextType === "rpc") {
      const rpc = context.switchToRpc();
      const meta = rpc.getContext<Metadata>();
      authorization = meta.get("authorization")?.[0]?.toString();

      request = rpc;
      method = "POST"; // RPC is always POST

      const serverStream = context.getArgByIndex(2);

      requestUrl = serverStream.path;

      const metaMap = meta.getMap();
      headers = metaMap as Record<string, string>;
    } else {
      this.logger.warn("Unsupported context type: " + contextType);
      throw new Error("Unsupported context type: " + contextType);
    }

    if (!authorization) {
      return false;
    }

    const [type, token] = authorization.split(" ");

    if (type !== "Bearer" || !token) {
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
        headers
      );

      this.logger.verbose("Constraints: " + inspect(constraints));

      return true;
    } catch (e) {
      this.logger.debug("Error while authorizing: " + e);
      return false;
    }
  }
}
