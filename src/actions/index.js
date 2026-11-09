import * as common from './commonActions.js';
import * as kitchen from './kitchenActions.js';
import * as menu from './menuActions.js';
import * as orders from './orderActions.js';
import * as payments from './paymentActions.js';
import * as sales from './salesActions.js';
import * as settings from './settingsActions.js';
import * as tables from './tableActions.js';

const modules = [common, orders, payments, tables, kitchen, sales, menu, settings];

function merge(kind) {
  const out = {};
  for (const mod of modules) {
    for (const [name, fn] of Object.entries(mod[kind] || {})) {
      if (out[name]) throw new Error(`Duplicate ${kind} handler "${name}"`);
      out[name] = fn;
    }
  }
  return out;
}

/** Every handler, keyed by the name used in data-act / data-change / data-input / data-submit. */
export const handlers = {
  click: merge('click'),
  change: merge('change'),
  input: merge('input'),
  submit: merge('submit'),
};
