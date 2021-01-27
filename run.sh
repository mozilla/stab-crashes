#!/bin/sh

pip install -r requirements.txt

mkdir ~/.ssh

echo "Host github.com" >> ~/.ssh/config
echo "HostName github.com" >> ~/.ssh/config
echo "IdentityFile ~/.ssh/deploy-key" >> ~/.ssh/config
echo "User git" >> ~/.ssh/config

python taskcluster_get_secret.py ssh_key > ~/.ssh/deploy-key
chmod u=rw,og= ~/.ssh/deploy-key

git remote set-url origin git@github.com:mozilla/stab-crashes.git
git fetch origin -f gh-pages:gh-pages

export BUGZILLA_TOKEN=$(python taskcluster_get_secret.py BUGZILLA_TOKEN)
python generate-data.py

ghp-import -n -p -m "Updates" dist
