namespace apex.gateway;

using {
    managed,
    cuid
} from '@sap/cds/common';

@assert.unique: {name: [name]}
entity Routes : managed, cuid {
    name           : String not null;
    pathPattern    : String not null;
    allowedMethods : String not null;
    destination    : Association to Destinations not null;
    status         : String enum {
        active;
        inactive;
    } default 'active';
    syncMode       : String enum {
        sync;
        async;
    } default 'sync';
    logPayload     : Boolean not null default false;
    rateLimit          : Integer not null default 0;
    timeoutMs          : Integer not null default 0;
    requestTransform   : LargeString;
    responseTransform  : LargeString;
}

@assert.unique: {name: [name]}
entity Destinations : managed, cuid {
    name        : String not null;
    url         : String not null;
    protocol    : String not null default 'HTTP';
    absolute    : Boolean not null default false;
    method      : String;
    headers     : LargeString default '{}';
    stripPrefix : String default '';
    status      : String enum {
        active;
        inactive;
    } default 'active';
    description : String;
    routes      : Association to many Routes
                      on routes.destination = $self;
    authMethod  : Composition of one AuthMethods;
}

entity AuthMethods : cuid {
    type         : String enum {
        none;
        basic;
        apiKey;
        oauth2;
        bearer;
    } default 'none';
    // Basic Auth
    username     : String;
    password     : String;
    // API Key
    keyName      : String;
    keyValue     : String;
    keyIn        : String enum {
        header;
        query;
    };
    // OAuth2 Client Credentials
    clientId     : String;
    clientSecret : String;
    tokenUrl     : String;
    // Bearer Token
    token        : String;
}

