sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'id.apnv.apex.ui.routeman',
            componentId: 'RoutesList',
            contextPath: '/Routes'
        },
        CustomPageDefinitions
    );
});