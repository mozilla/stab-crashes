var ghpages = require('gh-pages');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs-extra');

fs.removeSync('dist');
fs.mkdirSync('dist');

function execute(cmd, args, callback) {
  var proc = childProcess.spawn(cmd, args, {
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

function generateDashboardData() {
  execute('python', ['-m', 'generate-data', '-o', path.join(process.cwd(), 'dist')], function() {
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
  })
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

generateDashboardData();
