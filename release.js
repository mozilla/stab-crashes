var ghpages = require('gh-pages');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs-extra');

fs.removeSync('dist');
fs.mkdirSync('dist');

childProcess.exec('cd ../clouseau && python -m clouseau.stability.crashes -o "' + path.join(process.cwd(), 'dist') + '"', function(error, stdout, stderr) {
  if (error) {
    console.error(stdout);
    console.error(stderr);
    return;
  }

  childProcess.exec('cd ../crashcorrelations && python -m plotgen -o "' + path.join(process.cwd(), 'dist', 'plots') + '"', function(error, stdout, stderr) {
    if (error) {
      console.error(stdout);
      console.error(stderr);
      return;
    }

    [
      'index.html', 'dash.js', 'style.css', 'exclamation_mark.svg',
      'question_mark.svg', 'rocket_fly.png',
      'correlations.html', 'correlations.js',
      'missing_uplifts.html', 'missing_uplifts.js',
      '.nojekyll',
    ].forEach(function(file) {
      fs.copySync(file, path.join('dist', file));
    });

    ghpages.publish('dist', {
      dotfiles: true,
    }, function(err) {
      if (err) {
        console.error('Error while publishing to gh-pages');
        console.error(err);
      }
    });
  });
});
