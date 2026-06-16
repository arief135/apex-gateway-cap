sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"id/apnv/apex/ui/routeman/test/integration/pages/RoutesList",
	"id/apnv/apex/ui/routeman/test/integration/pages/RoutesObjectPage"
], function (JourneyRunner, RoutesList, RoutesObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('id/apnv/apex/ui/routeman') + '/test/flp.html#app-preview',
        pages: {
			onTheRoutesList: RoutesList,
			onTheRoutesObjectPage: RoutesObjectPage
        },
        async: true
    });

    return runner;
});

