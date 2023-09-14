# neohelden-commons-nestjs-server-auth

This module provides common mechanisms for NestJS to perform JWT server authentication. Additonally the use
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

The configuration is done using the `@nestjs/config` module.
Configs are queried using the `.` syntax. So `auth.keys` corresponds to the array of key sources.
The config service must guarantee to load these properties. 

### Authorization Configuration

This module utilizes a scoped `@nestjs/config` approach. The following configuration options are available:

```yaml
auth:
  # Disable all authentication, should be NEVER true in production
  disableAuth: false
  # Definition of key sources providing public keys to verify signed tokens.
  keys:
    # Public keys will be loaded from the OpenID provider using discovery.
  - type: OPEN_ID_DISCOVERY
    location: https://keycloak.example.com/auth/realms/my-realm
    requiredIssuer: https://keycloak.example.com/auth/realms/my-realm
  - # Public keys will be loaded directly from the JWKS url of the OpenID provider.
    type: JWKS
    location: https://keycloak.example.com/auth/realms/my-realm/protocol/openid-connect/certs
    requiredIssuer: https://keycloak.example.com/auth/realms/my-realm
  # Comma separated string of OPEN_ID_DISCOVERY key sources with required issuer. Can be used to
  # shorten the configuration when the discovery base URL matches the iss claim, the IDP sets.
  # The value used for configuration here must exactly match the iss claim.
  # keys and issuers can be used at the same time. Both are added to the accepted key sources.
  issuers: "https://keycloak.example.com/auth/realms/my-realm, https://keycloak.example.com/auth/realms/my-other-realm"
```



### OPA Configuration

The module supports the use of the [Open Policy Agent](https://www.openpolicyagent.org/) to perform authorization decisions.

 The following configuration options are available:

```yaml
opa:
  # Disable authorization. An empty prinicpal is created with an empty set of constraints
  disableOpa: false
  # Url to the OPA sidecar
  baseUrl: http://localhost:8181
  # Package name of the policy file that should be evaluated for authorization decision
  # The package name is used to resolve the full path
  policyPackage: http.authz
  # Advanced configuration of the HTTP client that is used to call the Open Policy Agent
  opaClient:
    # timeout for OPA requests, default 500ms
    timeout: 500ms
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