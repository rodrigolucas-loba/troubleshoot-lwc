import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import SUPERVISOR_FIELD from '@salesforce/schema/Bear__c.Supervisor__c';
import { subscribe, MessageContext } from 'lightning/messageService';
import BEAR_LIST_UPDATE from '@salesforce/messageChannel/BearListUpdate__c';

export default class BearSupervisor extends LightningElement {
    @api recordId; // Supports record page use-case
    subscription;

    @wire(MessageContext) messageContext;

    connectedCallback() {
        if (!this.subscription) {
            this.subscription = subscribe(this.messageContext, BEAR_LIST_UPDATE, (message) => {
                if (message?.recordId) {
                    this.recordId = message.recordId;
                }
            });
        }
    }

    @wire(getRecord, { recordId: '$recordId', fields: [SUPERVISOR_FIELD] })
    bear;

    get supervisorId() {
        return getFieldValue(this.bear?.data, SUPERVISOR_FIELD);
    }
}
