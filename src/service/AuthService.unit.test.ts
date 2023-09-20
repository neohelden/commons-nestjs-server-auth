import { HttpService } from "@nestjs/axios";
import OpenIdProviderKeySource from "../key/OpenIdProviderKeySource";
import PublicKeyLoader from "../key/PublicKeyLoader";
import AuthService from "./AuthService";

import { KeyPairKeyObjectResult, generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import { AuthModuleOptions } from "../auth.module";
import JwksKeySource from "../key/JwksKeySource";
import KeySource from "../key/KeySource";
import LoadedPublicKey from "../key/LoadedPublicKey";

type PublicClass<T> = jest.Mocked<Pick<T, keyof T>>;

describe("authentication", () => {
  let authService: AuthService;
  let publicKeyLoader: PublicClass<PublicKeyLoader>;
  let httpService: Pick<PublicClass<HttpService>, "get">;
  let authModOpts: AuthModuleOptions;

  beforeEach(async () => {
    publicKeyLoader = {
      addKeySource: jest.fn(),
      reloadKeys: jest.fn(),
      getLoadedPublicKey: jest.fn(),
    };
    httpService = {
      get: jest.fn(),
    };
    authModOpts = {
      auth: {
        disableAuth: false,
        authKeys: [
          {
            type: "OPEN_ID_DISCOVERY",
            location: "https://example.com",
            requiredIssuer: "https://example.com",
          },
          {
            type: "JWKS",
            location: "https://example.com",
            requiredIssuer: "https://example.com",
          },
        ],
      },
      opa: {
        disableOpa: false,
        baseUrl: "https://example.com",
        policyPackage: "test",
      },
    };

    authService = new AuthService(
      authModOpts,
      publicKeyLoader as never,
      httpService as never
    );
  });

  describe("constructor", () => {
    it("should  load OpenID keys", () => {
      authService = new AuthService(
        authModOpts,
        publicKeyLoader as unknown as PublicKeyLoader,
        httpService as unknown as HttpService
      );

      expect(publicKeyLoader.addKeySource).toHaveBeenCalledWith(
        new OpenIdProviderKeySource(
          "https://example.com",
          "https://example.com",
          httpService as unknown as HttpService
        )
      );
      expect(publicKeyLoader.addKeySource).toHaveBeenCalledWith(
        new JwksKeySource(
          "https://example.com",
          "https://example.com",
          httpService as unknown as HttpService
        )
      );
    });
  });

  describe("auth", () => {
    let key: KeyPairKeyObjectResult;
    let token: string;

    beforeEach(() => {
      key = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      token = jwt.sign({ test: "yes" }, key.privateKey, {
        header: { x5t: "test", kid: "test", alg: "RS256" },
      });
    });

    it("should detect the kid in the token", async () => {
      publicKeyLoader.getLoadedPublicKey.mockResolvedValueOnce(
        new LoadedPublicKey(
          "test",
          "test",
          key.publicKey,
          null as unknown as KeySource,
          "https://example.com",
          "RSA"
        )
      );

      await authService.auth({}, token);

      expect(publicKeyLoader.getLoadedPublicKey).toHaveBeenCalledWith(
        "test",
        "test"
      );
    });

    it("should throw when key is not available", async () => {
      await expect(authService.auth({}, token)).rejects.toThrow(
        "ERR_AUTH_NO_PUBLIC_KEY"
      );
    });

    it("should throw when key is not an JWT", async () => {
      await expect(authService.auth({}, "not a token")).rejects.toThrow(
        "ERR_AUTH_INVALID_TOKEN"
      );
    });

    it("should throw when key does not have a kid", async () => {
      token = jwt.sign({ test: "yes" }, key.privateKey, {
        algorithm: "RS256",
      });
      await expect(authService.auth({}, token)).rejects.toThrow(
        "ERR_AUTH_INVALID_TOKEN"
      );
    });

    it("should throw when key is not signed by the key but has same kid", async () => {
      const newKey = generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });

      token = jwt.sign({ test: "yes" }, newKey.privateKey, {
        header: { x5t: "test", kid: "test", alg: "RS256" },
      });

      publicKeyLoader.getLoadedPublicKey.mockResolvedValueOnce(
        new LoadedPublicKey(
          "test",
          "test",
          key.publicKey,
          null as unknown as KeySource,
          "https://example.com",
          "RSA"
        )
      );

      await expect(authService.auth({}, token)).rejects.toThrow(
        "invalid signature"
      );
    });
  });
});
