#!/usr/bin/env node

var log = require('../lib/log');
var pkg = require('../package.json');

var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var ncp = require('ncp');
var walk = require('walk');

var interval = null;
var i = 0;
var namespace = '';

var args = {};
for (var i = 0; i < process.argv.length; i++) {
  var arg = process.argv[i];
  args[arg.split(':')[0]] = arg;
}

if (args['-i']) {
  var namespace = args['-i'].split(':')[1];
  init();
} else if (args['-v']) {
  log.info(pkg.version);
} else {
  log.info('Help:')
  log.info('-v', 'displays current version')
  log.info('-i', 'creates new project. e.g.: $ kickjs:PROJECT_NAME:PROJECT_DESCRIPTION[OPTIONAL]:PROJECT_VERSION[OPTIONAL]');
} 

function credits() {
  log.clear();
  log.info('kickjs', pkg.version);
}

function init() {
  credits();

  copyTemplate(function() {
    log.success('template copied');
    updateFileReferences(function() {
      log.success('file references changed');
      copyStaticFiles(function() {
        log.success('static files copied');
        /*
        installNpmDependencies(function() {
          log.success('npm dependencies installed');
          log.info('\nSetup complete. Please run grunt within the selected namespace');
        });
      */
      });
    })
  });
}

function copyTemplate(onComplete) {
  if (namespace === undefined || namespace === '') {
    return log.fail('please specify a namespace');
  }

  if (fs.existsSync(namespace)) {
    log.fail('specified namespace already exist, overriding folder');
    return bash('rm -rf ' + namespace.replace(/ /g, "\\ ") + '/', function() {
      copyTemplate(onComplete);
    });
  } else {
    var templatePath = path.join(__dirname, '..', 'template', 'project');

    if (fs.existsSync(templatePath)) {
      ncp.ncp(templatePath, process.cwd() + '/' + namespace, function(error) {
        if (error) {
          log.fail(error);
        } else {
          onComplete()
        }
      });
    } else {
      log.fail('couldn\'t find template');
    }
  }
}

function installNpmDependencies(onComplete) {
  showLoading('please wait');
  bash('npm install --prefix ./' + namespace, function() {
    hideLoading();
    onComplete();
  });
}

function updateFileReferences(onComplete) {
  var files = 0;

  var walker = walk.walk('./' + namespace, { followLinks: false, filters: ['node_modules'] });

  walker.on('file', function(root, fileStats, next) {
    parseFile(root + '/' + fileStats.name, {
      namespace: namespace,
      description: args['-i'].split(':')[2] || 'project template',
      version: args['-i'].split(':')[3] || '1.0.0'
    });
    files++;
    next();
  });

  walker.on('end', function() {
    onComplete();
  });
}

function parseFile(file, references) {  
  fs.readFile(file, 'utf8', function(err, data) {
    if (err) return log.failt(err);

    var result = data.replace(/__NAMESPACE__/g, references.namespace)
    .replace(/__DESCRIPTION__/g, references.description)
    .replace(/__VERSION__/g, references.version)

    fs.writeFile(file, result, 'utf8', function (err) {
      if (err) return log.fail(err);
    });
  });
}

function copyStaticFiles(onComplete) {
  bash('mkdir ' + namespace.replace(/ /g, "\\ ") + '/website', function() {
    fs.rename('./' + namespace + '/static/', './' + namespace + '/website/', function (err) {
      if (err) return log.fail(err);
      onComplete();
    });
  });

}

function showLoading(message) {
  interval = setInterval(function() {
    updateLoading(message);
  }, 300);
}

function updateLoading(msn) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  i = (i + 1) % 5;
  var dots = new Array(i + 1).join(".");
  process.stdout.write(msn + dots);
}

function hideLoading() {
  clearInterval(interval);
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
}

function bash(script, onSuccess) {
  child_process.exec(script, function(error, stdout, stderr) {
    if (error) {
      return log.fail(error);
    } else {
      return onSuccess();
    }
  });
}