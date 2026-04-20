import { LightningElement, api } from "lwc";

export default class Controls extends LightningElement {
  @api operand = 1;
  @api showMultipliers = false;
  factors = [0, 2, 3, 4, 5, 6];

  get normalizedOperand() {
    return Number(this.operand);
  }

  get subtractLabel() {
    return `-${this.normalizedOperand}`;
  }

  get addLabel() {
    return `+${this.normalizedOperand}`;
  }

  handleAdd() {
    this.dispatchEvent(
      new CustomEvent("add", {
        detail: this.normalizedOperand
      })
    );
  }

  handleSubtract() {
    this.dispatchEvent(
      new CustomEvent("subtract", {
        detail: this.normalizedOperand
      })
    );
  }

  handleMultiply(event) {
    const factor = Number(event.target.dataset.factor);

    this.dispatchEvent(
      new CustomEvent("multiply", {
        detail: factor
      })
    );
  }
}
