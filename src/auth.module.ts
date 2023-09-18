import { DynamicModule, Module } from "@nestjs/common";
import AuthService from "./service/AuthService";
import PublicKeyLoader from "./key/PublicKeyLoader";
import { ConfigService } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";

export interface AuthModuleOptions {
  /**
   * If "true", registers `AuthModule` as a global module.
   * See: https://docs.nestjs.com/modules#global-modules
   */
  isGlobal?: boolean;
}

@Module({
  providers: [AuthService, PublicKeyLoader, ConfigService],
  imports: [HttpModule],
  exports: [AuthService],
})
/**
 * This Module provides authentication and authorization services.
 */
export default class AuthModule {
  static forRoot(opts: AuthModuleOptions = {}): DynamicModule {
    return {
      module: AuthModule,
      global: opts.isGlobal,
    };
  }
}
