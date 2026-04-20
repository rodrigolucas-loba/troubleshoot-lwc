import { LightningElement, api } from "lwc";

export default class Button extends LightningElement {
  @api label;
  @api icon;

  handleButton(event) {
    // 'bubbles: true' allows this event to move up to the parent (controls)
    this.dispatchEvent(
      new CustomEvent("buttonclick", {
        bubbles: true
      })
    );
  }
}
