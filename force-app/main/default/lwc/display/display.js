import { LightningElement } from "lwc";

export default class Display extends LightningElement {
  counter = 0;
  augmentor = 1;

  get options() {
    return [
      { label: "1", value: "1" },
      { label: "2", value: "2" }
    ];
  }

  get selectedAugmentor() {
    return String(this.augmentor);
  }

  handleAugmentorChange(event) {
    this.augmentor = Number(event.detail.value);
  }

  handleIncrement(event) {
    this.counter += Number(event.detail);
  }

  handleDecrement(event) {
    this.counter -= Number(event.detail);
  }
}
