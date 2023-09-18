import { KeyObject } from "crypto";
import KeySource from "./KeySource";

export default class LoadedPublicKey {
  private readonly _kid: string;
  private readonly _publicKey: KeyObject;
  private readonly _x5t: string;
  private readonly _sigAlgorythm: string;
  private readonly _keySource: KeySource;
  private readonly _requiredIssuer: string;
  constructor(
    kid: string,
    xt5: string,
    publicKey: KeyObject,
    keySource: KeySource,
    requiredIssuer: string,
    sigAlgorythm: string,
  ) {
    this._kid = kid;
    this._publicKey = publicKey;
    this._keySource = keySource;
    this._requiredIssuer = requiredIssuer;
    this._x5t = xt5;
    this._sigAlgorythm = sigAlgorythm;
  }
  public get sigAlgorythm(): string {
    return this._sigAlgorythm;
  }

  public get x5t(): string {
    return this._x5t;
  }

  public get kid(): string {
    return this._kid;
  }

  public get publicKey(): KeyObject {
    return this._publicKey;
  }

  public get keySource(): KeySource {
    return this._keySource;
  }

  public get requiredIssuer(): string {
    return this._requiredIssuer;
  }
}
