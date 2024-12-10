/* eslint-disable max-lines */
import {
  Controller,
  Get,
  INestApplication,
  INestMicroservice,
  UseGuards,
} from "@nestjs/common";
import OPAGuard from "./OPAGuard";
import { AuthModuleOptions } from "./auth.module";
import AuthService from "./service/AuthService";
import OPAService from "./service/OPAService";
import { Test, TestingModule } from "@nestjs/testing";
import { AUTH_MODULE_OPTIONS_TOKEN } from "./consts";
import {
  GrpcMethod,
  MicroserviceOptions,
  Transport,
} from "@nestjs/microservices";
import request from "supertest";
import { App } from "supertest/types";
import { join } from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { ServiceClient } from "@grpc/grpc-js/build/src/make-client";

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
  @GrpcMethod("TestService", "Test")
  rpcTest() {
    return { message: "test" };
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
      let app: INestApplication<App>;

      beforeEach(async () => {
        app = mod.createNestApplication<INestApplication<App>>({
          logger: ["debug", "log", "error", "warn", "verbose"],
        });

        http = app.getHttpServer();

        await app.listen(0);
      });

      afterEach(async () => {
        await app.close();
      });

      const token = "test";

      it("should bypass when auth is disabled", async () => {
        authModOpts.auth.disableAuth = true;

        const result = await request(http).get("/").expect(200);

        expect(result.status).toBe(200);
      });

      it("should throw when no authorization header is present", async () => {
        const result = await request(http).get("/").expect(403);

        expect(result.status).toBe(403);
      });

      it("should throw when authorization header is not a bearer token", async () => {
        const result = await request(http)
          .get("/")
          .set("Authorization", "Basic test")
          .expect(403);

        expect(result.status).toBe(403);
      });

      it("should call authService", async () => {
        authModOpts.opa.disableOpa = true;
        authService.auth.mockResolvedValueOnce({ test: "yes" });

        await request(http)
          .get("/")
          .set("Authorization", "Bearer test")
          .expect(200);

        expect(authService.auth).toHaveBeenCalledWith(expect.anything(), token);
      });

      it("should return false when authService throws", async () => {
        authModOpts.opa.disableOpa = true;
        authService.auth.mockRejectedValueOnce("test");

        await request(http)
          .get("/")
          .set("Authorization", "Bearer test")
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
            expect.anything(),
            token,
            "GET",
            expected,
            expect.objectContaining({
              authorization: "Bearer " + token,
            }),
          );
        },
      );
    });
  });

  describe("grpc", () => {
    let app: INestMicroservice;
    let request: (
      client: ServiceClient,
      metadata?: grpc.Metadata,
    ) => Promise<string | undefined>;
    let testService: grpc.ServiceClientConstructor;

    beforeEach(async () => {
      app = mod.createNestMicroservice<MicroserviceOptions>({
        logger: ["debug", "log", "error", "warn", "verbose"],
        transport: Transport.GRPC,
        options: {
          package: "test",
          protoPath: join(__dirname, "..", "test", "test.proto"),
        },
      });

      await app.listen();

      const proto = protoLoader.loadSync(
        join(__dirname, "..", "test", "test.proto"),
      );
      const packageDefinition = grpc.loadPackageDefinition(proto);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      testService = (packageDefinition.test as grpc.GrpcObject)
        .TestService! as grpc.ServiceClientConstructor;

      request = async (client, metadata) =>
        new Promise<string | undefined>((resolve, reject) =>
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          client.Test!({}, metadata ?? new grpc.Metadata(), (err, response) => {
            if (err) {
              return reject(err);
            }

            resolve(response.message);
          }),
        );
    });

    afterEach(async () => {
      await app.close();
    });

    it("should bypass when auth is disabled", async () => {
      authModOpts.auth.disableAuth = true;

      const client = new testService(
        "localhost:5000",
        grpc.credentials.createInsecure(),
      );

      const result = request(client);

      await expect(result).resolves.toBe("test");
    });

    it("should throw when no authorization header is present", async () => {
      const client = new testService(
        "localhost:5000",
        grpc.credentials.createInsecure(),
      );

      const result = request(client);

      await expect(result).rejects.toThrow("Forbidden resource");
    });

    it("should throw when authorization header is not a bearer token", async () => {
      const client = new testService(
        "localhost:5000",
        grpc.credentials.createInsecure(),
      );

      const metadata = new grpc.Metadata();
      metadata.add("authorization", "Basic abc");

      const result = request(client, metadata);

      await expect(result).rejects.toThrow("Forbidden resource");
    });

    it("should call authService", async () => {
      authModOpts.opa.disableOpa = true;
      authService.auth.mockResolvedValueOnce({ test: "yes" });

      const client = new testService(
        "localhost:5000",
        grpc.credentials.createInsecure(),
      );

      const metadata = new grpc.Metadata();
      metadata.add("authorization", "Bearer test");

      const result = request(client, metadata);

      await expect(result).resolves.toBe("test");

      expect(authService.auth).toHaveBeenCalledWith(expect.anything(), "test");
    });

    it("should call opaService", async () => {
      authService.auth.mockResolvedValueOnce({ test: "yes" });
      opaService.auth.mockResolvedValueOnce({ test: "yes" });

      const client = new testService(
        "localhost:5000",
        grpc.credentials.createInsecure(),
      );

      const metadata = new grpc.Metadata();
      metadata.add("authorization", "Bearer test");

      const result = request(client, metadata);

      await expect(result).resolves.toBe("test");

      expect(opaService.auth).toHaveBeenCalledWith(
        expect.anything(),
        "test",
        "POST",
        "/test.TestService/Test",
        expect.objectContaining({
          authorization: "Bearer test",
        }),
      );
    });
  });
});
