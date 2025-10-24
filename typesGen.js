// @ts-check
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const {Project, SyntaxKind, ts} = require('ts-morph');

/**
 * @template T
 * @param {T} value
 * @returns {NonNullable<T>}
 */
function assert(value) {
  if (typeof value === 'undefined' || value === null) {
    throw new Error('Value is undefined or null');
  }
  return value;
}

const fileArgs = process.argv.slice(2);

const serverRequestTypesManager = {
  lock: false,
  callAfterLock: false,
  debounceTime: 0
};

/**
 */
async function updateServerRequestTypes() {
  if (serverRequestTypesManager.lock) {
    if (new Date().getTime() - serverRequestTypesManager.debounceTime > 200) {
      serverRequestTypesManager.callAfterLock = true;
    }
    return;
  }
  serverRequestTypesManager.lock = true;
  serverRequestTypesManager.callAfterLock = false;
  serverRequestTypesManager.debounceTime = new Date().getTime();
  console.log('Updating server request types...');
  const project = new Project({
    'compilerOptions': {
      'target': ts.ScriptTarget.ES2021,
      'checkJs': true,
      'allowJs': true,
      'declaration': true,
      'emitDeclarationOnly': true,
      'outDir': 'types',
      'strict': true,
      'declarationMap': true
    }
  });

  project.addSourceFilesAtPaths('routes/**/*.js');
  project.addSourceFilesAtPaths('views/**/*.server.js');
  project.resolveSourceFileDependencies();
  const sourceFiles = project.getSourceFiles();
  const checkSourceFiles = sourceFiles.filter((sourceFile) => {
    return sourceFile.getFilePath().includes('routes/') || sourceFile.getFilePath().includes('views/');
  });

  const outputTypes = [];

  checkSourceFiles.forEach((sourceFile) => {
    const descendantCallExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
      return callExpression.getExpression().getText().endsWith('registerServerRequest');
    });
    if (descendantCallExpressions.length === 0) {
      return;
    }
    for (const callExpression of descendantCallExpressions) {
      const arguments = callExpression.getArguments();
      if (arguments.length === 2) {
        const [requestName, requestHandler] = arguments;
        const componentText = requestName.getType().getText(undefined, ts.TypeFormatFlags.NoTruncation |
          ts.TypeFormatFlags.UseFullyQualifiedType |
          ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral |
          ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
          ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
          ts.TypeFormatFlags.UseStructuralFallback);
        const handlerType = requestHandler.getType();
        const callSignature = handlerType.getCallSignatures()[0];
        const dataParamterText = callSignature.getParameters()[1]
          .getTypeAtLocation(requestHandler).getText(undefined, ts.TypeFormatFlags.NoTruncation |
          ts.TypeFormatFlags.UseFullyQualifiedType |
          ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral |
          ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
          ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
          ts.TypeFormatFlags.UseStructuralFallback);
        const returnTypeText = callSignature.getReturnType().getText(undefined, ts.TypeFormatFlags.NoTruncation |
          ts.TypeFormatFlags.UseFullyQualifiedType |
          ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral |
          ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
          ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
          ts.TypeFormatFlags.UseStructuralFallback).replace(/ErrResult\<[^\>]*\>/g, 'BoundaryErrResult');
        outputTypes.push(`${componentText}: {data: ${dataParamterText}, return: ${returnTypeText}}`);
        // outputTypes.push([componentText, dataParamterText, returnTypeText]);
      }
    }
  });

  const typeDeclationString =
  `/**
  * @typedef {{${outputTypes.join(',\n  * ')}}} ServerRequests
  */`.replace(/[ ]+\*/g, ' *');

  const typeFileContents =
  `/* eslint-disable max-len */\n${typeDeclationString}\n`;


  await fs.writeFile('public/js/serverRequests.js', typeFileContents, 'utf8');
  console.log('Updated server request types');
  serverRequestTypesManager.lock = false;
  if (serverRequestTypesManager.callAfterLock) {
    setImmediate(updateServerRequestTypes);
  }
}

const aleetComptTypesManager = {
  lock: false,
  callAfterLock: false,
  debounceTime: 0
};

/**
 */
async function updateAleetCompTypes() {
  if (aleetComptTypesManager.lock) {
    if (new Date().getTime() - aleetComptTypesManager.debounceTime > 200) {
      aleetComptTypesManager.callAfterLock = true;
    }
    return;
  }
  aleetComptTypesManager.lock = true;
  aleetComptTypesManager.callAfterLock = false;
  aleetComptTypesManager.debounceTime = new Date().getTime();
  console.log('Updating Aleet Comp types...');
  const project = new Project({
    tsConfigFilePath: './views/tsconfig.json'
  });

  const sourceFiles = project.getSourceFiles();
  const checkSourceFiles = sourceFiles.filter((sourceFile) => {
    return sourceFile.getFilePath().includes('views/') && !sourceFile.getFilePath().includes('.server.js');
  });

  const outputTypes = [];

  checkSourceFiles.forEach((sourceFile) => {
    const descendantCallExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
      return callExpression.getExpression().getText().endsWith('register_component') ||
        callExpression.getExpression().getText().endsWith('register_feature');
    });
    if (descendantCallExpressions.length === 0) {
      return;
    }
    const fullText = sourceFile.getFullText();
    const propTypesPossible = fullText.match(/@typedef {((?:[^\*]|\*[^\/])+|[\n])} [a-zA-Z0-9]+Props(?: \*\/)?\n/);
    const actualPropsType = propTypesPossible && propTypesPossible.length > 1 ? propTypesPossible[1].replace(/\n[ ]*\*([ ]+)([^ ])/g, '\n *$1 $2') :
      'AleetCompProps & {[key: string]: any}';
    // const parsedPropsType = project.createSourceFile('temp.js', `const a: ${actualPropsType};`);
    // const actualPropsTypeNode = parsedPropsType.getVariableDeclarations()[0].getTypeNode();
    // if (actualPropsTypeNode) {
    //   const objectProperties = actualPropsTypeNode.getChildrenOfKind(SyntaxKind.PropertySignature);
    // }
    for (const callExpression of descendantCallExpressions) {
      const arguments = callExpression.getArguments();
      if (arguments.length === 2 || arguments.length === 3) {
        const [componentName, componentVersion, componentExtension] =
            arguments.length === 2 ? [arguments[0], '\'latest\'', arguments[1]] : [arguments[0], arguments[1], arguments[2]];
        const componentText = componentName.getType().getText(undefined, ts.TypeFormatFlags.NoTruncation |
          ts.TypeFormatFlags.UseFullyQualifiedType |
          ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral |
          ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
          ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
          ts.TypeFormatFlags.UseStructuralFallback);
        const componentVersionText = typeof componentVersion === 'string' ? componentVersion : componentVersion.getType().getText();
        const componentExtensionText = componentExtension.getType().getText(undefined, ts.TypeFormatFlags.NoTruncation |
          ts.TypeFormatFlags.UseFullyQualifiedType |
          ts.TypeFormatFlags.WriteClassExpressionAsTypeLiteral |
          ts.TypeFormatFlags.WriteTypeArgumentsOfSignature |
          ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType |
          ts.TypeFormatFlags.UseStructuralFallback);
        outputTypes.push([componentText, componentVersionText, componentExtensionText, actualPropsType]);
      }
    }
  });

  const typeDeclarations = outputTypes.map(([requestName, dataType, responseType, propsType]) => {
    return ` * ${requestName.replace(/"/g, '\'')}: {
    *  version: ${dataType},
    *  extension: ${responseType}
    *  props: ${propsType}
    * }`.replace(/[ ]+\*/g, ' *');
  });

  const typeDeclationString =
  `/**
  * @typedef {{
  ${typeDeclarations.join(',\n')}
  * }} AleetCompTypes
  */`.replace(/[ ]+\*/g, ' *');

  const typeFileContents =
  `${typeDeclationString}\n`.replace(/^[ ]+([\*\/])/g, ' $1');

  await fs.writeFile('public/js/_comps.js', typeFileContents, 'utf8');
  console.log('Updated Aleet Comp types');
  aleetComptTypesManager.lock = false;
  if (aleetComptTypesManager.callAfterLock) {
    setImmediate(updateAleetCompTypes);
  }
}

/**
 * @param {Map<string, {time: number, hash: string}>} debounceMap
 * @param {string} filename
 */
function proceedIfFiveSecondsHAveEllapsed(debounceMap, filename) {
  if (!debounceMap.has(filename)) {
    const hasher = crypto.createHash('sha256');
    hasher.update(fs.readFileSync(filename));
    const hash = hasher.digest('base64');
    debounceMap.set(filename, {time: (new Date()).getTime(), hash: hash});
    return true;
  } else {
    const debounce = assert(debounceMap.get(filename));
    if (new Date().getTime() - debounce.time > 5000) {
      const hasher = crypto.createHash('sha256');
      hasher.update(fs.readFileSync(filename));
      const hash = hasher.digest('base64');
      if (hash !== debounce.hash) {
        debounceMap.set(filename, {time: (new Date()).getTime(), hash: hash});
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}

if (fileArgs.includes('--watch')) {
  const watchDebounce = new Map();
  fs.watch('routes', async (eventType, filename) => {
    if (eventType !== 'change') {
      return;
    }
    if (filename && filename.endsWith('.js')) {
      const fullPath = path.join(__dirname, 'routes', filename);
      if (proceedIfFiveSecondsHAveEllapsed(watchDebounce, fullPath)) {
        try {
          await updateServerRequestTypes();
          await updateAleetCompTypes();
        } catch (e) {
          console.error(e);
        }
      }
    }
  });
  fs.watch('views', {recursive: true}, async (eventType, filename) => {
    if (eventType !== 'change') {
      return;
    }
    if (filename) {
      const fullPath = path.join(__dirname, 'views', filename);
      if (filename.endsWith('.server.js')) {
        if (proceedIfFiveSecondsHAveEllapsed(watchDebounce, fullPath)) {
          try {
            await updateServerRequestTypes();
            await updateAleetCompTypes();
          } catch (e) {
            console.error(e);
          }
        }
      } else if (filename.endsWith('.js') && !filename.endsWith('.server.js')) {
        if (proceedIfFiveSecondsHAveEllapsed(watchDebounce, fullPath)) {
          try {
            await updateServerRequestTypes();
            await updateAleetCompTypes();
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  });
  setInterval(() => {
    watchDebounce.forEach((value, key) => {
      if (new Date().getTime() - value > 5000) {
        watchDebounce.delete(key);
      }
    });
  }, 30);
} else {
  updateServerRequestTypes().then(updateAleetCompTypes).catch(console.error);
}
