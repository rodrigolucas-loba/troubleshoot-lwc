import { LightningElement } from "lwc";

export default class Example4_Table extends LightningElement {
  totalRows = 400;
  cellsInRow = 10;
  totalDivs = 50;
  border = "1px solid #000";
  padding = "10px";

  randomString(length) {
    let result = "";
    const characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const charactersLength = characters.length;

    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(
          (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) *
            charactersLength
        )
      );
    }
    return result;
  }

  renderedCallback() {
    const tbl = document.createElement("table");
    tbl.style.border = this.border;
    tbl.style.padding = this.padding;

    for (let r = 0; r < this.totalRows; r++) {
      const row = document.createElement("tr");
      row.style.border = this.border;
      row.style.padding = this.padding;
      // create cells in row
      for (let c = 0; c < this.cellsInRow; c++) {
        const cell = document.createElement("td");
        cell.style.border = this.border;
        cell.style.padding = this.padding;
        const firstDiv = document.createElement("div");
        let lastDiv = firstDiv;
        for (let d = 0; d < this.totalDivs; d++) {
          const newDiv = document.createElement("div");
          lastDiv.appendChild(newDiv);
          lastDiv = newDiv;
        }
        let cellText = document.createTextNode(
          this.randomString(
            (crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 10
          )
        );
        lastDiv.appendChild(cellText);
        cell.appendChild(firstDiv);
        row.appendChild(cell);
      }
      tbl.appendChild(row);
    }
    this.template.querySelector(".container").appendChild(tbl);
  }
}
