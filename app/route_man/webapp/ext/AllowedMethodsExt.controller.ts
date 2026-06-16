import ControllerExtension from "sap/ui/core/mvc/ControllerExtension";
import JSONModel from "sap/ui/model/json/JSONModel";
import Event from "sap/ui/base/Event";
import ODataV4Context from "sap/ui/model/odata/v4/Context";
import MultiComboBox from "sap/m/MultiComboBox";

/**
 * @namespace id.apnv.apex.ui.routeman.ext
 */
const AllowedMethodsExt = ControllerExtension.extend(
    "id.apnv.apex.ui.routeman.ext.AllowedMethodsExt",
    {
        override: {
            onInit(this: ControllerExtension) {
                (this as any).base.getView().setModel(
                    new JSONModel({ selectedKeys: [] as string[] }),
                    "allowedMethodsModel"
                );
            },

            routing: {
                async onAfterBinding(this: ControllerExtension, oContext: ODataV4Context) {
                    const allowedMethods = (await oContext.requestProperty("allowedMethods")) as string
                    const aKeys = allowedMethods.split(",").map(method => method.trim());

                    (this as any).base
                        .getView()
                        .getModel("allowedMethodsModel")
                        .setProperty("/selectedKeys", aKeys);
                },
            },

                async onAfterRendering(e:Event){
                }
        },

        onSelectionChange(this: ControllerExtension, oEvent: Event) {
            const oCombo = oEvent.getSource() as MultiComboBox;
            const aKeys = oCombo.getSelectedKeys();
            const oContext = (this as any).base.getView().getBindingContext() as ODataV4Context;

            // serialize the array to string before saving, as the backend expects a string
            const sSerializedKeys = aKeys.join(","); // you can choose any delimiter, here we use comma
            oContext.setProperty("allowedMethods", sSerializedKeys);
        },
    }
);

export default AllowedMethodsExt;
