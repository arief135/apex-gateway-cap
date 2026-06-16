sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"id/apnv/apex/ui/destinationman/test/integration/pages/DestinationsList",
	"id/apnv/apex/ui/destinationman/test/integration/pages/DestinationsObjectPage"
], function (JourneyRunner, DestinationsList, DestinationsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('id/apnv/apex/ui/destinationman') + '/test/flp.html#app-preview',
        pages: {
			onTheDestinationsList: DestinationsList,
			onTheDestinationsObjectPage: DestinationsObjectPage
        },
        async: true
    });

    return runner;
});

