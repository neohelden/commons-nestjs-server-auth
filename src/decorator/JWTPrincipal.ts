import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import JWTPrincipalClass from "../JwtPrincipal";

const JWTPrincipal = createParamDecorator((_data, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().jwtPrincipal as JWTPrincipalClass;
});
export default JWTPrincipal;
