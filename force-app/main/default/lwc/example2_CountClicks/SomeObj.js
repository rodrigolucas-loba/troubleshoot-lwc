export class SomeObj {
  constructor() {
    this[
      `p_${btoa(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296)}`
    ] = btoa(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
  }
}
