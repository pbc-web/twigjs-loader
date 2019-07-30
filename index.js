'use strict';

const path = require('path');
const Twig = require('twig');
const utils = require('loader-utils');

module.exports = twigLoader;

module.exports.default = module.exports;

Twig.cache(false);

function twigLoader(source) {
  const callback = this.async();
  const options = utils.getOptions(this) || {};
  const namespaces = options.namespaces || {};
  let stringOptions = {};


  /*
  if (options.functions) {
    stringOptions.functions = {};

    Object.entries(options.functions).forEach(([name, fn]) => {
      stringOptions.functions[name] = `Twig.extendFunction('${name}', ${String(fn)});`;
      return Twig.extendFunction(name, fn);
    });
  }

  */
  const template = Twig.twig({
    allowInlineIncludes: true,
    data: source,
    id: makeTemplateId(this, this.resourcePath),
    path: this.resourcePath,
    rethrow: true,
    namespaces: namespaces
  });

  compile(this, template, stringOptions)
    .then(output => callback(null, output))
    .catch(err => callback(err));
    


}

async function compile(loaderApi, template, options) {
  let dependencies = [];
  await each(template.tokens, processToken);

  const opts = utils.getOptions(loaderApi) || {};
  //console.log(opts)

  const twigData = {
    allowInlineIncludes: true,
    data: template.tokens,
    id: template.id,
    namespaces: opts.namespaces
  };

  const dependenciesString = unique(dependencies)
    .map(d => `require(${JSON.stringify(d)});`)
    .join('\n');

  let functions = '';
  //Object.entries(options.functions).forEach(function(entry) {
  //  functions += entry[1];
  //  return;
  //});

//  console.log( twigData)

  return `
     ${dependenciesString}
    var Twig = require("twig");
    ${functions}
    var tpl = Twig.twig(${JSON.stringify(twigData)});
    module.exports = function(context) { return tpl.render(context); };
    module.exports.id = ${JSON.stringify(template.id)};
    module.exports.default = module.exports;
  `.replace(/^\s+/gm, '');


  async function processDependency(token) {
      const absolutePath = await resolveModule(loaderApi, token.value);
      dependencies.push(token.value);
      token.value = makeTemplateId(loaderApi, absolutePath);
      loaderApi.addDependency(absolutePath);
  }

  async function processToken(token) {
    if (token.type !== 'logic' || !token.token.type) {
      return;
    }

    switch (token.token.type) {
      case 'Twig.logic.type.block':
      case 'Twig.logic.type.if':
      case 'Twig.logic.type.elseif':
      case 'Twig.logic.type.else':
      case 'Twig.logic.type.for':
      case 'Twig.logic.type.spaceless':
      case 'Twig.logic.type.macro': {
        await each(token.token.output, processToken);
        break;
      }

      case 'Twig.logic.type.extends':
      case 'Twig.logic.type.include': {
        await each(token.token.stack, processDependency);
        break;
      }

      case 'Twig.logic.type.embed': {
        await each(token.token.output, processToken);
        await each(token.token.stack, processDependency);
        break;
      }

      case 'Twig.logic.type.import':
      case 'Twig.logic.type.from':
        if (token.token.expression !== '_self') {
          await each(token.token.stack, processDependency);
        }
        break;
    }
  }
}

async function each(arr, callback) {
  if (!Array.isArray(arr)) {
    return Promise.resolve();
  }

  return Promise.all(arr.map(callback));
}

function makeTemplateId(loaderApi, absolutePath) {
  const root = loaderApi.rootContext || process.cwd();
  return path.relative(root, absolutePath);
}

async function resolveModule(loaderApi, modulePath) {
  return new Promise((resolve, reject) => {
    loaderApi.resolve(loaderApi.context, modulePath, (err, result) => {
      err ? reject(err) : resolve(result);
    });
  });
}

function unique(arr) {
  return arr.filter((val, i, self) => self.indexOf(val) === i);
}

/**
 * Render compiled twig template
 */

 /*
function ExpressView(view) {
  this.render = (options, callback) => {
    const variables = { ...options._locals, ...options };
    callback(null, view(variables));
  };
  this.path = view.id;
}
*/
