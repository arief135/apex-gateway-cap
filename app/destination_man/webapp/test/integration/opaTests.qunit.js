sap.ui.loader.config({
    shim: {
        "sap/ui/qunit/qunit-junit": {
            deps: ["sap/ui/thirdparty/qunit-2"]
        },
        "sap/ui/qunit/qunit-coverage": {
            deps: ["sap/ui/thirdparty/qunit-2"]
        },
        "sap/ui/thirdparty/sinon-qunit": {
            deps: ["sap/ui/thirdparty/qunit-2", "sap/ui/thirdparty/sinon"]
        },
        "sap/ui/qunit/sinon-qunit-bridge": {
            deps: ["sap/ui/thirdparty/qunit-2", "sap/ui/thirdparty/sinon-4"]
        }
    }
});

window.QUnit = Object.assign({}, window.QUnit, { config: { autostart: false } });

sap.ui.require(
  [
    "sap/ui/thirdparty/qunit-2",
    "sap/ui/qunit/qunit-junit",
    "sap/ui/qunit/qunit-coverage",
    "id/apnv/apex/ui/destinationman/test/integration/FirstJourney",
    "id/apnv/apex/ui/destinationman/test/integration/DestinationsListJourney",
    "id/apnv/apex/ui/destinationman/test/integration/DestinationsObjectPageJourney",
], function (QUnit) {
    "use strict";
    QUnit.start();
});
