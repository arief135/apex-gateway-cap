using GatewayService as service from '../../srv/gateway-service';
annotate service.Destinations with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'name',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'url',
                Value : url,
            },
            {
                $Type : 'UI.DataField',
                Label : 'protocol',
                Value : protocol,
            },
            {
                $Type : 'UI.DataField',
                Label : 'absolute',
                Value : absolute,
            },
            {
                $Type : 'UI.DataField',
                Label : 'method',
                Value : method,
            },
            {
                $Type : 'UI.DataField',
                Label : 'headers',
                Value : headers,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'description',
                Value : description,
            },
        ],
    },
    UI.FieldGroup #AuthMethod : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'Type',
                Value : authMethod.type,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Username',
                Value : authMethod.username,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Password',
                Value : authMethod.password,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Key Name',
                Value : authMethod.keyName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Key Value',
                Value : authMethod.keyValue,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Key Location',
                Value : authMethod.keyIn,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Client ID',
                Value : authMethod.clientId,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Client Secret',
                Value : authMethod.clientSecret,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Token URL',
                Value : authMethod.tokenUrl,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Token',
                Value : authMethod.token,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'AuthMethodFacet',
            Label : 'Authentication',
            Target : '@UI.FieldGroup#AuthMethod',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'name',
            Value : name,
        },
        {
            $Type : 'UI.DataField',
            Label : 'url',
            Value : url,
        },
        {
            $Type : 'UI.DataField',
            Label : 'protocol',
            Value : protocol,
        },
        {
            $Type : 'UI.DataField',
            Label : 'absolute',
            Value : absolute,
        },
        {
            $Type : 'UI.DataField',
            Label : 'method',
            Value : method,
        },
    ],
);

