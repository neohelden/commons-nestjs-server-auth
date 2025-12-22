import { KeyObject, generateKeyPairSync } from "crypto";
import KeySource from "./KeySource";
import LoadedPublicKey from "./LoadedPublicKey";
import PublicKeyLoader from "./PublicKeyLoader";

describe("publicKeyLoader", () => {
  let publicKeyLoader: PublicKeyLoader;
  let keyPair: { publicKey: KeyObject; privateKey: KeyObject };

  beforeEach(() => {
    publicKeyLoader = new PublicKeyLoader();
    keyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
  });

  describe("addKeySource", () => {
    it("should add a key source", async () => {
      const key = new LoadedPublicKey(
        "test",
        "test",
        keyPair.publicKey,
        null as unknown as KeySource,
        "https://example.com",
        "RSA",
      );

      await publicKeyLoader.addKeySource({
        loadKeysFromSource: () => Promise.resolve([key]),
      } as KeySource);

      await expect(
        publicKeyLoader.getLoadedPublicKey("test", "test"),
      ).resolves.toStrictEqual(key);
    });
  });

  describe("reloadKeys", () => {
    it("should not throw if a keysource is not available", async () => {
      await publicKeyLoader.addKeySource({
        loadKeysFromSource: () => Promise.reject(new Error("test")),
      } as KeySource);

      await expect(publicKeyLoader.reloadKeys()).resolves.toBeUndefined();
    });
  });

  describe("getLoadedPublicKey", () => {
    it("should return null if no key is found", async () => {
      await expect(
        publicKeyLoader.getLoadedPublicKey("test", "test"),
      ).resolves.toBeNull();
    });

    it("should return a key if it is found", async () => {
      const key = new LoadedPublicKey(
        "test",
        "test",
        keyPair.publicKey,
        null as unknown as KeySource,
        "https://example.com",
        "RSA",
      );

      await publicKeyLoader.addKeySource({
        loadKeysFromSource: () => Promise.resolve([key]),
      } as KeySource);

      await expect(
        publicKeyLoader.getLoadedPublicKey("test", "test"),
      ).resolves.toStrictEqual(key);
    });

    it("should reload sources if the key is not found", async () => {
      const key = new LoadedPublicKey(
        "test",
        "test",
        keyPair.publicKey,
        null as unknown as KeySource,
        "https://example.com",
        "RSA",
      );

      const loadKeysFromSource = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([key]);

      await publicKeyLoader.addKeySource({
        loadKeysFromSource,
      } as KeySource);

      const loadedKey = await publicKeyLoader.getLoadedPublicKey(
        "test",
        "test",
      );

      // eslint-disable-next-line no-magic-numbers
      expect(loadKeysFromSource).toHaveBeenCalledTimes(2);
      expect(loadedKey).toStrictEqual(key);
    });
  });
});
