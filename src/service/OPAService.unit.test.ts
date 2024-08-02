import { HttpService } from "@nestjs/axios";
import { Observable } from "rxjs";
import JWTPrincipal from "../JwtPrincipal";
import OpaJwtPrincipal from "../OpaJwtPrincipal";
import { AuthModuleOptions } from "../auth.module";
import OPAService from "./OPAService";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("opaService", () => {
  let opaService: OPAService;
  let httpService: jest.Mocked<Pick<HttpService, "post">>;
  let authModOpts: AuthModuleOptions;

  let request;
  const token = "test";

  beforeEach(async () => {
    authModOpts = {
      opa: {
        baseUrl: "https://example.com",
        policyPackage: "test",
      },
      auth: {
        disableAuth: false,
      },
      http: {
        contextPath: "/",
      },
    };

    httpService = {
      post: jest.fn(),
    };
    request = {
      headers: {},
      url: "/test/test",
      method: "TEST",
      jwtPrincipal: new JWTPrincipal(token, { test: "yes" }),
    };

    authModOpts.opa.disableOpa = false;
    authModOpts.opa.baseUrl = "https://example.com";
    authModOpts.opa.policyPackage = "test";

    request.headers.authorization = "Bearer " + token;

    opaService = new OPAService(httpService as never, authModOpts);
  });

  it("should call opa", async () => {
    httpService.post.mockReturnValueOnce(
      new Observable((s) => {
        s.next({
          data: {
            result: {
              allow: true,
              constraint1: "test",
              constraint2: ["test1", "test2"],
            },
          },
        });
        s.complete();
      }) as never,
    );

    const result = await opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers,
    );

    expect(result).toStrictEqual({
      allow: true,
      constraint1: "test",
      constraint2: ["test1", "test2"],
    });
    expect(request.opaPrincipal).toStrictEqual(
      new OpaJwtPrincipal(
        token,
        { test: "yes" },
        {
          allow: true,
          constraint1: "test",
          constraint2: ["test1", "test2"],
        },
      ),
    );
    expect(httpService.post).toHaveBeenCalledWith(
      "https://example.com/v1/data/test",
      {
        input: {
          token,
          headers: request.headers,
          httpMethod: "TEST",
          path: ["test", "test"],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 500,
      },
    );
  });

  it("should reject if opa is not available", async () => {
    httpService.post.mockReturnValueOnce(
      new Observable((s) => {
        s.error("test");
        s.complete();
      }) as never,
    );

    const result = opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers,
    );

    await expect(result).rejects.toBe("ERR_OPA_UNAVAILABLE");
    expect(httpService.post).toHaveBeenCalledWith(
      "https://example.com/v1/data/test",
      {
        input: {
          token,
          httpMethod: "TEST",
          path: ["test", "test"],
          headers: request.headers,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 500,
      },
    );
  });

  it("should reject when OPA does not allow", async () => {
    httpService.post.mockReturnValueOnce(
      new Observable((s) => {
        s.next({
          data: {
            result: {
              test: { allow: false },
            },
          },
        });
        s.complete();
      }) as never,
    );

    const result = opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers,
    );

    await expect(result).rejects.toThrow("ERR_OPA_FORBIDDEN");
    expect(httpService.post).toHaveBeenCalledWith(
      "https://example.com/v1/data/test",
      {
        input: {
          token,
          httpMethod: "TEST",
          path: ["test", "test"],
          headers: request.headers,
        },
      },
      { headers: { "Content-Type": "application/json" }, timeout: 500 },
    );
  });
});
