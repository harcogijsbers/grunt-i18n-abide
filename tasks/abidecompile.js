var fs = require('fs');
var path = require('path');
var lockFilePath = '/tmp/abideCompile.lock';
var shell = require('shelljs');
var helpers = require('./lib/helpers');

var runShellSync = helpers.runShellSync;
var checkCommand = helpers.checkCommand;

var reserverdWords = [
  'do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval',
  'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const',
  'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return',
  'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private',
  'continue', 'debugger', 'function', 'arguments', 'interface', 'protected',
  'implements', 'instanceof'
];

var basicVarRx = /^[_$a-zA-Z]{1}[a-zA-Z0-9._$]+?$/;

module.exports = function (grunt) {

  'use strict';

  function createLockFile() {
    return fs.openSync(lockFilePath, 'w');
  }

  function removeLockFile() {
    return fs.unlink(lockFilePath);
  }

  function lockFileExists() {
    return grunt.file.isFile(lockFilePath);
  }

  function basicVarNameCheck(varName) {
    return reserverdWords.indexOf(varName) === -1 && basicVarRx.test(varName);
  }

  function compileJSON(files, localeDir, dest, jsVar, options) {

    // Default creation of JS files to true.
    var createJSFiles = options.createJSFiles;
    if (typeof createJSFiles === 'undefined') {
      createJSFiles = true;
    }

    createLockFile();

    files.forEach(function(pofile){
      var args = [];
      var dir = path.dirname(pofile);
      var subdir = path.dirname(dir);
      var locale = path.basename(subdir);
      var stem = path.basename(pofile, '.po');

      var jsonfile = path.join(dest, locale, stem +'.json');
      var jsfile = path.join(dest, locale, stem + '.js');
      grunt.file.mkdir(path.join(dest, locale));

      var cmd = options.cmd || path.join(__dirname, '../node_modules/po2json/bin/po2json');

      checkCommand(cmd);

      args.push(pofile);
      args.push(jsonfile);

      // Create json file.
      runShellSync(cmd, args);

      if (createJSFiles) {
        fs.writeFileSync(jsfile, 'window.' + jsVar + ' = ');
        fs.writeFileSync(jsfile, fs.readFileSync(jsonfile), { flag: 'a' });
        fs.writeFileSync(jsfile, ';\n', { flag: 'a' });
        fs.writeFileSync(jsfile, 'window.' + jsVar + '.locale = "' + locale + '";\n', { flag: 'a' });
        fs.writeFileSync(jsfile, 'window.' + jsVar + '.lang = "' + helpers.languageFrom(locale) + '";', { flag: 'a' });
      }
    });

    removeLockFile();

  }

  function compileMo(files, options) {
    var cmd = options.cmd || 'msgfmt';
    checkCommand(cmd);

    files.forEach(function(locale) {
      var dir = path.dirname(locale);
      var stem = path.basename(locale, '.po');
      var args = ['-o'];
      args.push(path.join(dir, stem + '.mo'));
      args.push(locale);
      runShellSync(cmd, args);
    });

  }

  grunt.registerMultiTask('abideCompile', 'Wraps po2json/ to simplify updating new locales.', function () {

    var options = this.options();
    var dest = this.data.dest;
    var type = options.type || 'json';
    type = type.toLowerCase();
    var validTypes = ['json', 'mo', 'both'];
    var localeDir = options.localeDir || 'locale';
    var jsVar = options.jsVar || 'json_locale_data';

    if (!basicVarNameCheck(jsVar)) {
      grunt.fail.fatal('"' + jsVar + '" is an invalid var name or reserved word.');
    }

    if (!dest && type === 'json') {
      grunt.fail.fatal('"dest" needs to be specifed when type is JSON');
    }

    if (!localeDir || !grunt.file.isDir(localeDir)) {
      grunt.fail.fatal('localeDir: "' + localeDir + '" doesn\'t exist!');
    }

    if (validTypes.indexOf(type) === -1) {
      grunt.fail.fatal('"options.type" is invalid should be one of ' + validTypes.join(', '));
    }

    var files = shell.find(localeDir).filter(function(file) {
      return file.match(/\.po$/);
    });

    switch(type) {
      case 'json':
        compileJSON(files, localeDir, dest, jsVar, options);
        break;
      case 'mo':
        compileMo(files, options);
        break;
    }

  });

};
