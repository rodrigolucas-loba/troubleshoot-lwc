import { api, LightningElement } from 'lwc';

const COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Department', fieldName: 'Department', type: 'text' },
    { label: 'Title', fieldName: 'Title', type: 'text' }
];

export default class MainContactSelector extends LightningElement {
    @api contacts = [];
    @api label = 'Main Contact';
    @api firstSelectedRow;

    columns = COLUMNS;

    handleRowSelection(event) {
        const [selectedRow] = event.detail.selectedRows;
        this.firstSelectedRow = selectedRow;
    }

    @api
    validate() {
        return {
            isValid: Boolean(this.firstSelectedRow),
            errorMessage: 'Select a contact.'
        };
    }
}
