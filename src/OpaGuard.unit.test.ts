import { ExecutionContext } from "@nestjs/common";
import OPAGuard from "./OPAGuard";
import { AuthModuleOptions } from "./auth.module";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("opaGuard", () => {
  let opaGuard: OPAGuard;
  let opaService: jest.Mocked<Pick<OPAService, keyof OPAService>>;
  let authService: jest.Mocked<Pick<AuthService, keyof AuthService>>;
  let authModOpts: AuthModuleOptions;

  beforeEach(async () => {
    opaService = {
      auth: jest.fn(),
    };
    authService = {
      auth: jest.fn(),
    };
    authModOpts = {
      auth: { disableAuth: false },
      opa: { disableOpa: false, baseUrl: "h", policyPackage: "t" },
      http: {},
    };

    opaGuard = new OPAGuard(
      authService as never,
      opaService as never,
      authModOpts,
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
      authModOpts.auth.disableAuth = true;

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
      authModOpts.opa.disableOpa = true;
      authService.auth.mockResolvedValueOnce({ test: "yes" });

      request.headers.authorization = "Bearer " + token;

      const result = await opaGuard.canActivate(context);

      expect(authService.auth).toHaveBeenCalledWith(request, token);
      expect(result).toBe(true);
    });

    it("should return false when authService throws", async () => {
      authModOpts.opa.disableOpa = true;
      authService.auth.mockRejectedValueOnce("test");

      request.headers.authorization = "Bearer " + token;

      const result = await opaGuard.canActivate(context);

      expect(authService.auth).toHaveBeenCalledWith(request, token);
      expect(result).toBe(false);
    });

    it.each([
      ["/test/a", "/test", "/a"],
      ["/test/a", "/test/", "/a"],
      ["/test/a", "/", "/test/a"],
      ["/test/a", undefined, "/test/a"],
      ["/test", "/test", ""],
      ["/test", "/test/", ""],
      ["/test/", "/test", "/"],
      ["/test/", "/test/", "/"],
    ])(
      "should pass the correct path to OPAGuard with input %s, context: %s",
      async (path, contextPath, expected) => {
        authModOpts.http = { contextPath };

        opaService.auth.mockResolvedValueOnce({ test: "yes" });

        request.headers.authorization = "Bearer " + token;
        request.url = path;

        await opaGuard.canActivate(context);

        expect(opaService.auth).toHaveBeenCalledWith(
          request,
          token,
          "TEST",
          expected,
          {
            authorization: "Bearer " + token,
          },
        );
      },
    );
  });
});
