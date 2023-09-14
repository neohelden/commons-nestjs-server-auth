import { ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OPAGuard from "./OPAGuard";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";

describe("opaGuard", () => {
  let opaGuard: OPAGuard;
  let configService: jest.Mocked<Pick<ConfigService, "get" | "getOrThrow">>;
  let opaService: jest.Mocked<Pick<OPAService, keyof OPAService>>;
  let authService: jest.Mocked<Pick<AuthService, keyof AuthService>>;
  let config: Map<string, unknown>;

  beforeEach(async () => {
    config = new Map<string, unknown>([
      ["auth.disableAuth", false],
      ["http.contextPath", "/"],
    ]);

    configService = {
      get: jest.fn().mockImplementation((key) => config.get(key)),
      getOrThrow: jest.fn().mockImplementation((key) => config.get(key)),
    };
    opaService = {
      auth: jest.fn(),
    };
    authService = {
      auth: jest.fn(),
    };

    opaGuard = new OPAGuard(
      configService as never,
      authService as never,
      opaService as never
    );
  });

  describe("canActivate", () => {
    let request;
    let response;
    let context: ExecutionContext;
    const token = "test";

    beforeEach(() => {
      request = {
        headers: {},
        url: "/test/test",
        method: "TEST",
      };
      response = {};

      context = {
        switchToHttp: () => ({
          getRequest: jest.fn().mockReturnValue(request),
          getResponse: jest.fn().mockReturnValue(response),
          getNext: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;
    });
    it("should bypass when auth is disabled", async () => {
      config.set("auth.disableAuth", "true");

      const result = await opaGuard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should throw when no authorization header is present", async () => {
      const result = await opaGuard.canActivate(context);

      expect(result).toBe(false);
    });

    it("should throw when authorization header is not a bearer token", async () => {
      request.headers.authorization = "Basic test";

      const result = await opaGuard.canActivate(context);

      expect(result).toBe(false);
    });

    it("should call authService", async () => {
      config.set("opa.disable", "true");
      authService.auth.mockResolvedValueOnce(new Map([["test", "yes"]]));

      request.headers.authorization = "Bearer " + token;

      const result = await opaGuard.canActivate(context);

      expect(authService.auth).toHaveBeenCalledWith(request, token);
      expect(result).toBe(true);
    });

    it("should return false when authService throws", async () => {
      config.set("opa.disable", true);
      authService.auth.mockRejectedValueOnce("test");

      request.headers.authorization = "Bearer " + token;

      const result = await opaGuard.canActivate(context);

      expect(authService.auth).toHaveBeenCalledWith(request, token);
      expect(result).toBe(false);
    });
  });
});
