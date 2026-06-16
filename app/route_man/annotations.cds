using GatewayService as service from '../../srv/gateway-service';

annotate service.Routes with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data  : [
            {
                $Type : 'UI.DataField',
                Label : 'Name',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Path Pattern',
                Value : pathPattern,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Destination',
                Value : destination_ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Sync Mode',
                Value : syncMode,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Log Payload',
                Value : logPayload,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Rate Limit',
                Value : rateLimit,
            },
            {
                $Type : 'UI.DataField',
                Label : 'Timeout (ms)',
                Value : timeoutMs,
            },
        ],
    },
    UI.Facets  : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneratedFacet1',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : name,
            Label : 'Name',
            @UI.Importance : #High,
        },
        {
            $Type : 'UI.DataField',
            Value : pathPattern,
            Label : 'Path Pattern',
            @UI.Importance : #High,
        },
        {
            $Type : 'UI.DataField',
            Value : createdAt,
            Label : 'Created At',
        },
    ],
);

annotate service.Routes with {
    destination @(
        Common.Text            : destination.name,
        Common.TextArrangement : #TextFirst,
        Common.ValueList       : {
            CollectionPath : 'Destinations',
            Parameters     : [
                {
                    $Type             : 'Common.ValueListParameterOut',
                    LocalDataProperty : destination_ID,
                    ValueListProperty : 'ID',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
                {
                    $Type             : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'url',
                },
            ],
        }
    );
    allowedMethods    @UI.Hidden: true;
    requestTransform  @UI.Hidden: true;
    responseTransform @UI.Hidden: true;
};
