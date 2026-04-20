import { LightningElement, api, wire } from "lwc";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import SUPERVISOR_FIELD from "@salesforce/schema/Bear__c.Supervisor__c";
import { subscribe, MessageContext } from "lightning/messageService";
import BEAR_LIST_UPDATE from "@salesforce/messageChannel/BearListUpdate__c";

export default class BearSupervisor extends LightningElement {
    @api recordId; // Propriedade pública original
    targetRecordId; // Variável para o @wire

    @wire(MessageContext) messageContext;
    subscription;

    connectedCallback() {
        // Inicializa o target com o recordId atual da página
        this.targetRecordId = this.recordId;
        this.subscribeToMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                BEAR_LIST_UPDATE,
                (message) => {
                    // Atualiza o target, nunca o @api recordId
                    this.targetRecordId = message.recordId;
                }
            );
        }
    }

    // O @wire reage a qualquer mudança em targetRecordId
    @wire(getRecord, { recordId: "$targetRecordId", fields: [SUPERVISOR_FIELD] })
    bear;

    get supervisorId() {
        return getFieldValue(this.bear?.data, SUPERVISOR_FIELD);
    }
}