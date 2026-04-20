import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import { subscribe, MessageContext } from "lightning/messageService";
import BEAR_LIST_UPDATE from "@salesforce/messageChannel/BearListUpdate__c";

const NAME_FIELD = "Bear__c.Name";
const LOCATION_LATITUDE_FIELD = "Bear__c.Location__Latitude__s";
const LOCATION_LONGITUDE_FIELD = "Bear__c.Location__Longitude__s";
const bearFields = [NAME_FIELD, LOCATION_LATITUDE_FIELD, LOCATION_LONGITUDE_FIELD];

export default class BearLocation extends LightningElement {
    @api recordId; // Deixa o recordId em paz (Read-Only)
    
    // Esta variável vai controlar o ID que o @wire realmente usa
    targetRecordId; 

    @wire(MessageContext) messageContext;
    subscription;
    name;
    mapMarkers = [];

    // Sincroniza o targetRecordId com o recordId inicial
    connectedCallback() {
        this.targetRecordId = this.recordId; 
        this.subscribeToMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                BEAR_LIST_UPDATE,
                (message) => {
               
                    this.targetRecordId = message.recordId; 
                }
            );
        }
    }

    
    @wire(getRecord, { recordId: "$targetRecordId", fields: bearFields })
    loadBear({ error, data }) {
        if (error) {
            this.name = undefined;
            this.mapMarkers = [];
        } else if (data) {
            this.name = getFieldValue(data, NAME_FIELD);
            const Latitude = getFieldValue(data, LOCATION_LATITUDE_FIELD);
            const Longitude = getFieldValue(data, LOCATION_LONGITUDE_FIELD);
            this.mapMarkers = [{
                location: { Latitude, Longitude },
                title: this.name
            }];
        }
    }

    get cardTitle() {
        return this.name ? `${this.name}'s location` : "Bear location";
    }
}