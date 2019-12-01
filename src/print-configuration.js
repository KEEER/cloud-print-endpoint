/** @module print-configuration */

import { DEFAULT_CONFIG } from './consts.js'

/** class to represent a print configuration. */
export class PrintConfiguration{
  /**
   * Create a configuration object.
   * @param {number} options.copies copies to be printed
   * @param {boolean} options.colored whether to print with color
   * @param {boolean} options.doubleSided whether to print with two sides
   * @param {boolean} options.double-sided same with the above, for compatibility with toJSON()
   */
  constructor ({
    copies = DEFAULT_CONFIG.copies,
    colored = DEFAULT_CONFIG.colored,
    doubleSided = DEFAULT_CONFIG.doubleSided,
    'double-sided': doubleSidedKebab
  } = {}) {
    this.copies = copies, this.colored = colored, this.doubleSided = doubleSidedKebab || doubleSided
  }

  /**
   * Converts the configuration object to an object to be sent in network.
   * @returns {object} the object which fulfills the documentation.
   */
  toJSON () {
    return {
      copies: this.copies,
      colored: this.colored,
      'double-sided': this.doubleSided,
    }
  }

  /**
   * Creates an identical configuration.
   * @returns {PrintConfiguration} a copy of this configuration
   */
  copy () {
    return new PrintConfiguration(this.toJSON())
  }
}
