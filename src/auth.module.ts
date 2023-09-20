import { HttpModule } from "@nestjs/axios";
import { DynamicModule, Module, ModuleMetadata } from "@nestjs/common";
import PublicKeyLoader from "./key/PublicKeyLoader";
import AuthService, { AuthServiceOptions } from "./service/AuthService";
import { OpaServiceOptions } from "./service/OPAService";

export const AUTH_MODULE_OPTIONS_TOKEN = "AUTH_MODULE_OPTIONS_TOKEN";
export interface AuthModuleOptions {
  /**
   * If "true", registers `AuthModule` as a global module.
   * See: https://docs.nestjs.com/modules#global-modules
   */
  isGlobal?: boolean;

  /**
   * Options for the `AuthService`.
   */
  auth: AuthServiceOptions;
  /**
   * Options for the `OPAService`.
   */
  opa: OpaServiceOptions;

  /**
   * Options for http server
   */
  http?: {
    /**
     * Base path of the http server.
     * @default "/"
     */
    contextPath?: string;
  };
}

export interface AuthModuleAsyncOptions
  extends Pick<ModuleMetadata, "imports"> {
  name?: string;
  useFactory: (
    ...args: any[]
  ) => Promise<AuthModuleOptions> | AuthModuleOptions;
  inject?: any[];
}

/**
 * This Module provides authentication and authorization services.
 */
@Module({})
export default class AuthModule {
  static forRoot(opts: AuthModuleOptions): DynamicModule {
    return {
      module: AuthModule,
      global: opts.isGlobal,
      imports: [HttpModule],
      providers: [
        AuthService,
        PublicKeyLoader,
        {
          provide: AUTH_MODULE_OPTIONS_TOKEN,
          useValue: opts,
        },
      ],
      exports: [AuthService],
    };
  }

  static forRootAsync(opts: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      imports: [HttpModule],
      providers: [
        AuthService,
        PublicKeyLoader,
        {
          provide: AUTH_MODULE_OPTIONS_TOKEN,
          useFactory: opts.useFactory,
          inject: opts.inject,
        },
      ],
      exports: [AuthService],
    };
  }
}
