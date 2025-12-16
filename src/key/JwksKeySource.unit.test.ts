import { HttpService } from "@nestjs/axios";
import JwksKeySource from "./JwksKeySource";
import { Observable } from "rxjs";
import LoadedPublicKey from "./LoadedPublicKey";
import { jest, beforeEach, describe, expect, it } from "@jest/globals";

describe("jwksKeySource", () => {
  let source: JwksKeySource;
  let httpService: jest.Mocked<Pick<HttpService, "get">>;

  beforeEach(() => {
    httpService = {
      get: jest.fn(),
    };
    source = new JwksKeySource(
      "https://example.com",
      "https://example.com",
      httpService as unknown as HttpService,
    );
  });

  describe("loadKeysFromSource", () => {
    it("should load keys", async () => {
      httpService.get.mockReturnValue(
        new Observable((subscriber) => {
          subscriber.next({
            data: {
              keys: [
                {
                  kty: "RSA",
                  kid: "test",
                  xt5: "ZG0vKF1qjdFlisQUr73rO460iQg",
                  alg: "RS256",
                  n: "pJveUM2qoOSBNSejm_US4nWk_-ufEBykwmDfKRy3RwwzAVueLPa6GbJk_A6k80pCC_RKAC3-NrFbW3lLe92GVRs26Y2yzfb2z0k-QfKHI0WiesHYcpEAz2QYwiUJClaPRvd8BaLpnJPAjKfK3nERp4EGQc8hUuITLiTCSKeTHUUOSKuqqXpoSgCJhAM_7XSpdwan3xfcFU6WAR4Hu91zDRcqPCwwVwIWBKzhZ7dMpeX7-e_Y4_ppEhESGBlVTpaJfTFNZeSQqliyib47MZBpJUI-IU1M1n8-GJeo4sxvOlmeEmK_ceBL4inRkI-IxAvuiNkS0iU6-bbrm6lV5nr8Pw",
                  e: "AQAB",
                },
              ],
            },
          } as never);
          subscriber.complete();
        }),
      );

      const keys = await source.loadKeysFromSource();

      expect(keys).toStrictEqual([
        new LoadedPublicKey(
          "test",
          "ZG0vKF1qjdFlisQUr73rO460iQg",
          expect.anything(),
          source,
          "https://example.com",
          "RS256",
        ),
      ]);
    });
  });
});
