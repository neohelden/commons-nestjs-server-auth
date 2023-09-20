# neohelden-commons-nestjs-server-auth

This module provides common mechanisms for NestJS to perform JWT server authentication. Additionally the use
of the [Open Poilcy Agent](https://www.openpolicyagent.org/) is supported.


## Auth Bundle

The decisions are available to the Application using decorators. 
An example for OPA enabled decision is: 

```typescript
import {
  Get,
  UseGuards,
} from "@nestjs/common";import {
  OPAGuard,
  OPAPrincipal,
  OpaJwtPrincipal,
} from "@neohelden/commons-nestjs-server-auth";

class Controller {
    @UseGuards(OPAGuard)
    @Get("/")
    public getSomethingSecure(@OPAPrincipal(): opaPrincipal: OpaJwtPrincipal) {
        const constraints = opaPrincipal.constraints;
        return constraints
    }
}
```

## Configuration 

The configuration of this module is accomplished using NestJS Dynamic modules. 
Therefore import the `AuthModule` in your `AppModule` and provide the configuration.

Example: 

```typescript
AuthModule.forRootAsync({
  isGlobal: true,
  useFactory: async (configService: ConfigService) => {
    console.log("Using factory");
    return {
      opa: {
        disableOpa: configService.get<boolean>("opa.disable"),
        baseUrl: configService.get<string>("opa.url"),
        policyPackage: configService.get<string>("opa.package"),
        opaClient: {
          timeout: configService.get<number>("opa.opaClient.timeout"),
        },
      },
      auth: {
        disableAuth: configService.getOrThrow<boolean>("auth.disableAuth"),
        authIssuers: configService
          .get<string>("auth.issuers")
          ?.trim()
          .split(","),
        authKeys: configService.get("auth.keys"),
      },
    } as AuthModuleOptions;
  },
  inject: [ConfigService],
  imports: [ConfigModule],
}),
```

### OPA Evaluation

Inputs are available to the OPA policy file. 
An example of this file is: 

```rego
# each policy lies in a package that is referenced in the configuration of the OpaBundle
package example

# decode the JWT as new variable 'token'
token = {"payload": payload} {
    not input.jwt == null
    io.jwt.decode(input.jwt, [_, payload, _])
}

# deny by default
default allow = false

allow {
    # allow if path match '/contracts/:anyid' 
    input.path = ["contracts", _]

    # allow if request method 'GET' is used
    input.httpMethod == "GET"

    # allow if 'claim' exists in the JWT payload
    token.payload.claim

    # allow if a request header 'HttpRequestHeaderName' has a certain value 
    input.headers["httprequestheadername"][_] == "certain-value"
}

# set some example constraints 
constraint1 := true                # always true
constraint2 := [ "v2.1", "v2.2" ]  # always an array of "v2.1" and "v2.2"
constraint3[token.payload.sub].    # always a set that contains the 'sub' claim from the token
                                   # or is empty if no token is present
```

The resuts of this policy are then added to the `@OPAPrincipal` Decorator available for requests. 