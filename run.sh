#!/bin/sh

echo "Host github.com" >> ~/.ssh/config
echo "HostName github.com" >> ~/.ssh/config
echo "IdentityFile ~/.ssh/deploy-key" >> ~/.ssh/config
echo "User git" >> ~/.ssh/config

git remote set-url origin git@github.com:mozilla/stab-crashes.git
git fetch origin -f gh-pages:gh-pages

pip install -r requirements.txt

python generate-data.py

ghp-import -n -p -m "Updates" dist
