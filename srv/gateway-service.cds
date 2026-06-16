using {apex.gateway as gw} from '../db/schema';


service GatewayService {
    @odata.draft.enabled: true
    entity Routes      as projection on gw.Routes;

    @odata.draft.enabled: true
    entity Destinations as projection on gw.Destinations;
}
