import { DynamicModule, Module } from "@nestjs/common";
import AuthService from "./service/AuthService";
import PublicKeyLoader from "./key/PublicKeyLoader";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";

export interface AuthModuleOptions {
  /**
   * If "true", registers `AuthModule` as a global module.
   * See: https://docs.nestjs.com/modules#global-modules
   */
  isGlobal?: boolean;
}

@Module({
  providers: [AuthService, PublicKeyLoader],
  imports: [HttpModule, ConfigModule],
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
      imports: [ConfigModule, HttpModule],
      providers: [AuthService, PublicKeyLoader],
      exports: [AuthService],
    };
  }
}
