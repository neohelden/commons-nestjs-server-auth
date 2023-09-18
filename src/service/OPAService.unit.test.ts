import OPAService from "./OPAService";
import { HttpService } from "@nestjs/axios";
import { Observable } from "rxjs";
import { ConfigService } from "@nestjs/config";
import OpaJwtPrincipal from "../OpaJwtPrincipal";
import JWTPrincipal from "../JwtPrincipal";

describe("opaService", () => {
  let opaService: OPAService;
  let configService: jest.Mocked<Pick<ConfigService, "get" | "getOrThrow">>;
  let httpService: jest.Mocked<Pick<HttpService, "post">>;

  let request;
  const token = "test";

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
    httpService = {
      post: jest.fn(),
    };
    request = {
      headers: {},
      url: "/test/test",
      method: "TEST",
      jwtPrincipal: new JWTPrincipal(token, new Map([["test", "yes"]])),
    };

    config.set("opa.disable", false);
    config.set("opa.url", "https://example.com");
    config.set("opa.package", "test");

    request.headers.authorization = "Bearer " + token;

    opaService = new OPAService(httpService as never, configService as never);
  });

  it("should call opa", async () => {
    httpService.post.mockReturnValueOnce(
      new Observable((s) => {
        s.next({
          data: {
            result: {
              allow: true,
              constaint1: "test",
              constraint2: ["test1", "test2"],
            },
          },
        });
        s.complete();
      }) as never
    );

    const result = await opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers
    );

    expect(result).toStrictEqual(
      new Map<string, unknown>([
        ["allow", true],
        ["constaint1", "test"],
        ["constraint2", ["test1", "test2"]],
      ])
    );
    expect(request.opaPrincipal).toStrictEqual(
      new OpaJwtPrincipal(
        token,
        new Map([["test", "yes"]]),
        new Map<string, unknown>([
          ["allow", true],
          ["constaint1", "test"],
          ["constraint2", ["test1", "test2"]],
        ])
      )
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
      }
    );
  });

  it("should reject if opa is not available", async () => {
    httpService.post.mockReturnValueOnce(
      new Observable((s) => {
        s.error("test");
        s.complete();
      }) as never
    );

    const result = opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers
    );

    await expect(result).rejects.toBe("ERR_OPA_UNAIAVAILABLE");
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
      }
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
      }) as never
    );

    const result = opaService.auth(
      request,
      token,
      request.method,
      request.url,
      request.headers
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
      { headers: { "Content-Type": "application/json" } }
    );
  });
});
