import { Injectable, Logger } from "@nestjs/common";
import KeySource from "./KeySource";
import LoadedPublicKey from "./LoadedPublicKey";

@Injectable()
export default class PublicKeyLoader {
  private readonly logger = new Logger(PublicKeyLoader.name);
  private keySources: Map<KeySource, boolean> = new Map();
  private keysByKid: Map<string, LoadedPublicKey> = new Map();
  private keysByX5t: Map<string, LoadedPublicKey> = new Map();

  public async addKeySource(keySource: KeySource): Promise<void> {
    this.logger.verbose("Adding key source");
    this.keySources.set(keySource, false);
    await this.reloadKeys();
  }

  public async reloadKeys(): Promise<void> {
    this.logger.verbose("Reloading keys");
    const keys: Promise<LoadedPublicKey[]>[] = [];

    for (const keySource of this.keySources.keys()) {
      this.keySources.set(keySource, true);
      keys.push(keySource.loadKeysFromSource());
    }

    const keyResults = (await Promise.all(keys)).flat();

    // Reset all keys to remove expired keys
    this.keysByKid.clear();

    for (const loadedKey of keyResults) {
      this.keysByKid.set(loadedKey.kid, loadedKey);
      this.keysByX5t.set(loadedKey.x5t, loadedKey);
    }
    this.logger.verbose(
      "Keys: " + Array.from(this.keysByKid.values()).map((key) => key.kid),
    );
    this.logger.verbose("Reloading keys done");
  }

  public async getLoadedPublicKey(
    kid: string,
    x5t?: string,
  ): Promise<LoadedPublicKey | null> {
    this.logger.verbose("Getting loaded public key");
    const existingKey = this._getLoadedPublicKey(kid, x5t);

    if (existingKey !== null) {
      return existingKey;
    }

    this.logger.verbose("Key not found, reloading keys");

    await this.reloadKeys();
    return this._getLoadedPublicKey(kid, x5t);
  }

  private _getLoadedPublicKey(
    kid: string,
    x5t?: string,
  ): LoadedPublicKey | null {
    this.logger.verbose("Getting loaded public key");
    this.logger.verbose("kid: " + kid);
    this.logger.verbose("x5t: " + x5t);
    if (kid) {
      const key = this.keysByKid.get(kid);

      if (key) {
        return key;
      }
    }

    if (x5t) {
      const key = this.keysByX5t.get(x5t);

      if (key) {
        return key;
      }
    }

    return null;
  }
}
