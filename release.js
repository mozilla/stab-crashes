var ghpages = require('gh-pages');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs-extra');

fs.removeSync('dist');
fs.mkdirSync('dist');

function execute(cmd, args, cwd, callback) {
  var proc = childProcess.spawn(cmd, args, {
    cwd: cwd,
    stdio: 'inherit',
  });

  proc.on('close', function(code) {
    if (code != 0) {
      console.error('Process ' + cmd + ' exited with code ' + code);
      process.exit(code);
      return;
    }

    callback();
  });
}

function installRequirements(callback) {
  execute('pip', ['install', '-r', 'requirements.txt'], 'clouseau', callback);
}

function copyConfig() {
  fs.createReadStream('config.ini').pipe(fs.createWriteStream('clouseau/config.ini'));
}

function generateDashboardData() {
  installRequirements(function() {
    copyConfig();

    execute('python', ['-m', 'clouseau.stability.crashes', '-t', '100', '-o', path.join(process.cwd(), 'dist')], 'clouseau', function() {
      copyFiles();

      ghpages.publish('dist', {
        dotfiles: true,
      }, function(err) {
        if (err) {
          console.error('Error while publishing to gh-pages');
          console.error(err);
          process.exit(1);
        }
      });
    });
  });
}

function copyFiles() {
  [
    'index.html',
    'correlations.js',
    'dashboard.html', 'dashboard.js', 'style.css', 'exclamation_mark.svg',
    'question_mark.svg', 'rocket_fly.png',
    'correlations.html', 'correlations_page.js',
    'missing_uplifts.html', 'missing_uplifts.js',
    '.nojekyll',
  ].forEach(function(file) {
    fs.copySync(file, path.join('dist', file));
  });
}

fs.exists('clouseau', function(exists) {
  if (exists) {
    execute('git', ['pull'], 'clouseau', generateDashboardData);
  } else {
    execute('git', ['clone', 'https://github.com/mozilla/clouseau'], process.cwd(), generateDashboardData);
  }
});
