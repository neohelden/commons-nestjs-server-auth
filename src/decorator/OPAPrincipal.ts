import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import OpaJwtPrincipal from "../OpaJwtPrincipal";

const OPAPrincipal = createParamDecorator((_data, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().opaPrincipal as OpaJwtPrincipal;
});
export default OPAPrincipal;
