import LoadedPublicKey from "./LoadedPublicKey";

/** The source for loading keys. */
export default interface KeySource {
  /**
   * Loads the keys provided by this source.
   *
   * @return All keys that this source provides.
   * @throws KeyLoadFailedException if loading of keys failed. If a source intentionally does not
   *     provide keys, an empty list should be returned instead of throwing an exception.
   */
  loadKeysFromSource(): Promise<LoadedPublicKey[]>;
}
