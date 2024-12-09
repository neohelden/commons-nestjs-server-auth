import { Controller, Get, UseGuards } from "@nestjs/common";
import OPAGuard from "./OPAGuard";
import { AuthModuleOptions } from "./auth.module";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";
import { Test, TestingModule } from "@nestjs/testing";
import { AUTH_MODULE_OPTIONS_TOKEN } from "./consts";
import { GrpcMethod } from "@nestjs/microservices";
import request from "supertest";
import { App } from "supertest/types";

@Controller("*")
@UseGuards(OPAGuard)
class TestingController {
  @Get()
  getTest() {
    return "test";
  }
}

@Controller()
@UseGuards(OPAGuard)
class TestingRpcController {
  getTest() {
    return "test";
  }

  @GrpcMethod("TestService")
  rpcTest() {
    return "test";
  }
}

describe("opaGuard", () => {
  let mod: TestingModule;
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

    mod = await Test.createTestingModule({
      controllers: [TestingController, TestingRpcController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: OPAService,
          useValue: opaService,
        },
        {
          provide: AUTH_MODULE_OPTIONS_TOKEN,
          useValue: authModOpts,
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    await mod.close();
  });

  describe("authorization", () => {
    describe("http", () => {
      let http: App;

      beforeEach(() => {
        http = mod
          .createNestApplication({
            logger: ["debug", "log", "error", "warn", "verbose"],
          })
          .getHttpServer();
      });
      const token = "test";

      it("should bypass when auth is disabled", async () => {
        authModOpts.auth.disableAuth = true;

        const result = await request(http).get("/").expect(200);

        expect(result).toBe(true);
      });

      it("should throw when no authorization header is present", async () => {
        await request(http).get("/").expect(403);
      });

      it("should throw when authorization header is not a bearer token", async () => {
        await request(http)
          .get("/")
          .set("Authorization", "Basic test")
          .expect(403);
      });

      it("should call authService", async () => {
        authModOpts.opa.disableOpa = true;
        authService.auth.mockResolvedValueOnce({ test: "yes" });

        await request(http)
          .get("/")
          .set("Authorization", "Basic test")
          .expect(403);

        expect(authService.auth).toHaveBeenCalledWith(expect.anything(), token);
      });

      it("should return false when authService throws", async () => {
        authModOpts.opa.disableOpa = true;
        authService.auth.mockRejectedValueOnce("test");

        await request(http)
          .get("/")
          .set("Authorization", "Basic test")
          .expect(403);

        expect(authService.auth).toHaveBeenCalledWith(expect.anything(), token);
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
          await request(http)
            .get(path)
            .set("Authorization", "Bearer " + token)
            .expect(200);

          expect(opaService.auth).toHaveBeenCalledWith(
            request,
            token,
            "TEST",
            expected,
            {
              authorization: "Bearer " + token,
            }
          );
        }
      );
    });
  });
});
