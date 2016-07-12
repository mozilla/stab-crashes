var ghpages = require('gh-pages');
var path = require('path');
var childProcess = require('child_process');
var fs = require('fs-extra');

fs.removeSync('dist');
fs.mkdirSync('dist');

childProcess.execSync('cd ../clouseau && python -m clouseau.stability.crashes -o "' + path.join(process.cwd(), 'dist') + '"');

[
  'index.html', 'dash.js', 'style.css', 'exclamation_mark.svg',
  'question_mark.svg', 'rocket_fly.png',
].forEach(function(file) {
  fs.copySync(file, path.join('dist', file));
});

ghpages.publish('dist', function(err) {
  if (err) {
    console.error('Error while publishing to gh-pages');
    console.error(err);
  }
});
