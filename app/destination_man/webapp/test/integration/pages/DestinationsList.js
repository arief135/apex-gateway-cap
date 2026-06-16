sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'id.apnv.apex.ui.destinationman',
            componentId: 'DestinationsList',
            contextPath: '/Destinations'
        },
        CustomPageDefinitions
    );
});