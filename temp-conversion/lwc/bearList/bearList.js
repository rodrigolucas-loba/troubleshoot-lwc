import { NavigationMixin } from 'lightning/navigation';
import { LightningElement, wire } from 'lwc';
import searchBears from '@salesforce/apex/BearController.searchBears';
import { publish, MessageContext } from 'lightning/messageService';
import BEAR_LIST_UPDATE_MESSAGE from '@salesforce/messageChannel/BearListUpdate__c';

export default class BearList extends NavigationMixin(LightningElement) {
    searchTerm = '';
    bears; // Store the result here manually

    @wire(MessageContext) 
    messageContext;

    // We use a wired function instead of a property to trigger the publish logic
    @wire(searchBears, {searchTerm: '$searchTerm'})
    loadBears(result) {
        this.bears = result;
        if (result.data) {
            const message = {
                bears: result.data
            };
            // This tells the map: "Here are the bears currently in the search results"
            publish(this.messageContext, BEAR_LIST_UPDATE_MESSAGE, message);
        }
    }

    handleSearchTermChange(event) {
        window.clearTimeout(this.delayTimeout);
        const searchTerm = event.target.value;
        this.delayTimeout = setTimeout(() => {
            this.searchTerm = searchTerm;
        }, 300);
    }

    get hasResults() {
        return (this.bears && this.bears.data && this.bears.data.length > 0);
    }

    handleBearView(event) {
        const bearId = event.detail;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: bearId,
                objectApiName: 'Bear__c',
                actionName: 'view',
            },
        });
    }
}